/*
  The Proxy Shop — Phase G2: Cancellation & stock lifecycle
  ---------------------------------------------------------------------------
  Implements the first confirmed stock-lifecycle rule in this project: when an
  eligible order is cancelled, the stock deducted at checkout is restored
  EXACTLY ONCE.

  New on public.orders (all nullable, all additive):
    restocked_at         exactly-once restock marker (the critical field)
    cancellation_reason  constrained text code (nullable — see REASONS below)
    cancellation_note    optional internal note (Admin-only, never customer-visible)
    cancelled_by         auth.uid() of the admin who cancelled (nullable FK)

  New object
    public.admin_cancel_order(uuid, text, text)  the cancellation + restock path

  ---------------------------------------------------------------------------
  WHY RESTOCK IS SAFE NOW
  ---------------------------------------------------------------------------
  `create_order_from_cart()` (008) decrements `product_variants.stock` at order
  creation — so a cancellation that never restocks leaks inventory. Migration
  009 deliberately performed NO restock because the rule was unconfirmed; it
  said: "When the rule is confirmed, implement restock as a separate,
  idempotent migration/RPC (guarded so it can never run twice)." This is that
  migration.

  ---------------------------------------------------------------------------
  CANCELLATION RULES (as decided for G2)
  ---------------------------------------------------------------------------
    pending    → cancelled  + AUTO-RESTOCK
    confirmed  → cancelled  + AUTO-RESTOCK
    processing → cancelled  + AUTO-RESTOCK
    shipped    → cancelled  WITHOUT auto-restock (owner decision: semantics of
                 009 are unchanged — shipped orders remain cancellable, but the
                 goods are already out the door, so inventory is handled
                 manually outside this app; `restocked_at` stays NULL)
    delivered  → terminal, CANNOT be cancelled (rejected)
    cancelled  → terminal, repeat calls are a no-op rejection (never restocks)

  RESTOCK ELIGIBILITY == {pending, confirmed, processing} AND restocked_at IS
  NULL. The row is locked FOR UPDATE first, so two admins cancelling the same
  order serialise: the first transaction moves the stock, the second sees
  status = 'cancelled' and raises `no_change` before any stock update runs.

  Payment domain is NOT touched: this function never assigns `payment_status`
  or `paid_at`. Cancelling a paid order leaves it `paid`; refunds are a
  separate, explicitly recorded act (no Paystack refund API exists here).

  Stock restoration uses `order_items.variant_id` — the authoritative link
  captured at checkout — never size/colour/SKU text reconstruction. Legacy
  `products.stock` (non-authoritative) is re-derived with the SAME strategy as
  checkout step 13: sum of the product's ACTIVE variant stock.

  ---------------------------------------------------------------------------
  REASONS (constrained text code — deliberately not a reference table)
    customer_request | item_unavailable | duplicate_order |
    payment_issue    | operational_issue | other
  `cancellation_reason` stays NULLABLE on purpose: `admin_set_order_status`
  (009) still supports its original reason-less cancel path unchanged (owner
  decision: reason enforcement is UI-level — the Admin UI always cancels
  through `admin_cancel_order`, which REQUIRES a reason).

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically. Safe to re-run: every
  statement is guarded/idempotent.
*/

-- ---------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.product_variants') is null
     or to_regclass('public.products') is null then
    raise exception 'orders / order_items / product_variants / products were not found. Apply migrations 001 and 008 first, then run this file.';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() was not found. The Phase A admin/auth migration must be applied first.';
  end if;

  if to_regprocedure('public.admin_set_order_status(uuid, text)') is null then
    raise exception 'public.admin_set_order_status(uuid, text) was not found. Apply migration 009 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Cancellation columns — nullable and additive, no backfill required.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists restocked_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancellation_note text;
alter table public.orders
  add column if not exists cancelled_by uuid
  references auth.users(id) on delete set null;

comment on column public.orders.restocked_at is
  'EXACTLY-ONCE restock marker. Set by admin_cancel_order() in the same transaction that returns the stock. Null = stock was never restored (not cancelled yet, or a shipped-order cancellation that requires manual handling).';
comment on column public.orders.cancellation_reason is
  'Constrained reason code (customer_request, item_unavailable, duplicate_order, payment_issue, operational_issue, other). Nullable: the legacy admin_set_order_status cancel path does not require one. Customer sees a friendly rendering of this code, never free text.';
comment on column public.orders.cancellation_note is
  'Optional internal Admin note about the cancellation. Admin-only — never selected by the customer order query.';
comment on column public.orders.cancelled_by is
  'auth.uid() of the Admin who cancelled through admin_cancel_order(). Null for the legacy path or when the actor is unknown.';

-- ---------------------------------------------------------------------------
-- 2. Validation constraints (idempotent — pg has no IF NOT EXISTS for
--    constraints, so each is checked against pg_constraint first).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_cancellation_reason_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_cancellation_reason_check
      check (
        cancellation_reason is null
        or cancellation_reason in (
          'customer_request', 'item_unavailable', 'duplicate_order',
          'payment_issue', 'operational_issue', 'other'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_cancellation_note_length_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_cancellation_note_length_check
      check (cancellation_note is null or char_length(cancellation_note) <= 500);
  end if;

  -- A restock can only ever be recorded on a cancelled order.
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_restocked_requires_cancelled_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_restocked_requires_cancelled_check
      check (restocked_at is null or status = 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. admin_cancel_order(uuid, text, text) — cancellation + exactly-once restock
--
--    Contract (same family as the other admin order functions):
--      - fail closed unless public.is_admin()
--      - SECURITY DEFINER + set search_path = public, pg_temp
--      - '<code>|<human sentence>' errors: not_authorized, order_not_found,
--        invalid_cancellation_reason, invalid_cancellation_note,
--        terminal_status, no_change
--      - row locked FOR UPDATE before any decision (concurrency)
--
--    Restock sequence, only when eligible (pending/confirmed/processing AND
--    restocked_at IS NULL), all inside this single transaction:
--      1. add each order line's quantity back to its variant (by variant_id)
--      2. re-derive legacy products.stock from ACTIVE variant stock
--      3. stamp restocked_at (guarded: only if still NULL)
--
--    NEVER touches payment_status, paid_at, or shipment fields.
-- ---------------------------------------------------------------------------
create or replace function public.admin_cancel_order(
  p_order_id uuid,
  p_reason text,
  p_note text default null
)
returns setof public.orders
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_status text;
  v_restocked_at timestamptz;
  v_do_restock boolean;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to cancel an order.';
  end if;

  if v_reason is null then
    raise exception 'invalid_cancellation_reason|A cancellation reason is required.';
  end if;

  if v_reason not in (
    'customer_request', 'item_unavailable', 'duplicate_order',
    'payment_issue', 'operational_issue', 'other'
  ) then
    raise exception 'invalid_cancellation_reason|% is not a valid cancellation reason.', v_reason;
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_cancellation_note|Cancellation note must be 500 characters or fewer.';
  end if;

  -- Lock the order first: two admins cancelling simultaneously serialise here.
  select o.status, o.restocked_at
  into v_status, v_restocked_at
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found|That order no longer exists.';
  end if;

  -- Terminal states. A repeat call changes nothing and, critically, never
  -- reaches the restock block.
  if v_status = 'cancelled' then
    raise exception 'no_change|This order is already cancelled.';
  end if;

  if v_status = 'delivered' then
    raise exception 'terminal_status|A delivered order is in a final state and cannot be cancelled.';
  end if;

  -- Shipped orders remain cancellable (009 semantics unchanged) but are NOT
  -- auto-restocked: the goods are already out the door. restocked_at stays
  -- NULL and stock is handled operationally, outside this function.
  v_do_restock := v_status in ('pending', 'confirmed', 'processing')
                  and v_restocked_at is null;

  update public.orders
  set
    status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now()),
    cancellation_reason = v_reason,
    cancellation_note = v_note,
    cancelled_by = auth.uid()
  where id = p_order_id;

  if v_do_restock then
    -- 1. Authoritative inventory: restore by the variant_id captured on the
    --    order line. Never reconstructed from size/colour/SKU text. Multiple
    --    lines for the same variant are aggregated first.
    update public.product_variants pv
    set stock = pv.stock + agg.total_quantity
    from (
      select oi.variant_id, sum(oi.quantity)::integer as total_quantity
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.variant_id is not null
      group by oi.variant_id
    ) agg
    where pv.id = agg.variant_id;

    -- 2. Legacy aggregate (products.stock is NOT authoritative) — identical
    --    strategy to create_order_from_cart() step 13: re-derive from the
    --    product's ACTIVE variant stock.
    update public.products p
    set stock = coalesce(
      (
        select sum(v.stock)::integer
        from public.product_variants v
        where v.product_id = p.id
          and v.active
      ),
      0
    )
    where p.id in (
      select distinct oi.product_id
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.product_id is not null
        and oi.variant_id is not null
    );

    -- 3. Exactly-once stamp — guarded so even a hypothetical second pass
    --    cannot mark an un-restocked order as restocked.
    update public.orders
    set restocked_at = now()
    where id = p_order_id
      and restocked_at is null;
  end if;

  return query select o.* from public.orders o where o.id = p_order_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Grants: authenticated sessions only; the function re-checks
--    public.is_admin() itself (fail closed). No table-level privilege is
--    added or widened anywhere by this migration — customers keep SELECT-only
--    access to their own orders and can never cancel, restock or read the
--    internal note.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_cancel_order(uuid, text, text) from public;
revoke all on function public.admin_cancel_order(uuid, text, text) from anon;

grant execute on function public.admin_cancel_order(uuid, text, text) to authenticated;

-- Ask PostgREST to pick up the new columns/function immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  order_count bigint;
  cancelled_count bigint;
begin
  select count(*) into order_count from public.orders;
  select count(*) into cancelled_count from public.orders where status = 'cancelled';

  raise notice 'Phase G2 cancellation stock lifecycle applied. Orders: %, cancelled: %. Auto-restock applies to pending/confirmed/processing cancellations exactly once (restocked_at); shipped cancellations never auto-restock; payment state is never changed by cancellation.', order_count, cancelled_count;
end $$;

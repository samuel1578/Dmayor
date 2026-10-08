/*
  The Proxy Shop — Phase G1: Shipment & tracking foundation
  ---------------------------------------------------------------------------
  Adds the manual shipment/tracking data model and the single Admin write path
  for it. No courier integration, no automation, no notifications.

  New on public.orders (all nullable, all additive):
    carrier             free-text carrier/courier name (no enum invented)
    tracking_number     free-text tracking reference
    tracking_url        optional HTTP(S) link to the carrier's tracking page
    delivery_note       short operational note about the delivery
    tracking_updated_at when the shipment block was last saved

  New objects
    public.admin_set_order_shipment(...)  the ONLY writer of the four fields
    admin_list_orders(...) redefined to also return carrier + tracking_number
                           so the order queue can show a compact indicator
                           (return type changes, so the function is dropped and
                           recreated here — forward-only, 009 is never edited)

  ---------------------------------------------------------------------------
  DOMAINS STAY SEPARATE — THIS MIGRATION TOUCHES NEITHER
  ---------------------------------------------------------------------------
    - `status` (fulfilment)      : never read or written by the new RPC. Saving
      shipment details does NOT mark an order Shipped, and marking an order
      Shipped does NOT require tracking details. The two actions are
      independent in both directions (Admin may enter tracking first, or mark
      shipped first and add tracking later).
    - `payment_status` / paid_at : never read or written here.
    - stock                      : never touched. No restock, no deduction.

  ---------------------------------------------------------------------------
  FIELD VALIDATION
  ---------------------------------------------------------------------------
    carrier / tracking_number : trimmed, max 120 characters
    tracking_url              : trimmed, max 500, and must match
                                '^https?://[^[:space:]]+$' — javascript:,
                                data: and every other scheme are rejected both
                                by the RPC (clear error) and by a CHECK
                                constraint (defense in depth for any other
                                write path, e.g. a future migration or console
                                edit).
    delivery_note             : trimmed, max 500 characters

  Customer access is unchanged: SELECT own orders through the existing E1 RLS
  policy, no INSERT/UPDATE/DELETE grants, no new policies. Customers can read
  their shipment fields through the same ownership rule and can never write
  them.

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically. Safe to re-run: every
  statement is guarded/idempotent.
*/

-- ---------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'public.orders was not found. Apply migration 008 first, then run this file.';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() was not found. The Phase A admin/auth migration must be applied first.';
  end if;

  if to_regprocedure('public.admin_list_orders(text, text, text, integer, integer)') is null then
    raise exception 'public.admin_list_orders(text, text, text, integer, integer) was not found. Apply migration 009 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Shipment columns — nullable and additive, no backfill required.
--    No courier-specific columns: one carrier name, one tracking number, one
--    optional link, one note. Nothing here is a foreign key, because a
--    carrier's own tracking system is the source of truth for courier data.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists carrier text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists delivery_note text;
alter table public.orders add column if not exists tracking_updated_at timestamptz;

comment on column public.orders.carrier is
  'Free-text carrier/courier name, set by an Admin through admin_set_order_shipment(). Null until shipment details are saved. Not an enum — no courier list has been confirmed.';
comment on column public.orders.tracking_number is
  'Free-text tracking reference as given by the carrier. Null until an Admin saves shipment details. Display only — there is no courier integration.';
comment on column public.orders.tracking_url is
  'Optional HTTP(S) link to the carrier tracking page. Any other scheme (javascript:, data:, …) is rejected by the CHECK constraint and by admin_set_order_shipment().';
comment on column public.orders.delivery_note is
  'Short operational note about this delivery, saved by an Admin. Visible to the customer on their order page — keep it customer-appropriate.';
comment on column public.orders.tracking_updated_at is
  'When the shipment block was last saved through admin_set_order_shipment(). Current state only, not an audit trail.';

-- ---------------------------------------------------------------------------
-- 2. Field validation constraints (idempotent — pg has no IF NOT EXISTS for
--    constraints, so each one is checked against pg_constraint first).
--    The RPC below raises a friendlier error before these are ever hit; the
--    constraints are the guarantee for every other path.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_carrier_length_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_carrier_length_check
      check (carrier is null or char_length(carrier) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_tracking_number_length_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_tracking_number_length_check
      check (tracking_number is null or char_length(tracking_number) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_tracking_url_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_tracking_url_check
      check (
        tracking_url is null
        or (
          char_length(tracking_url) <= 500
          and tracking_url ~* '^https?://[^[:space:]]+$'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_note_length_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_delivery_note_length_check
      check (delivery_note is null or char_length(delivery_note) <= 500);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. admin_set_order_shipment(uuid, text, text, text, text)
--
--    The ONLY writer of carrier / tracking_number / tracking_url /
--    delivery_note. Same contract as the other admin order functions:
--      - fail closed unless public.is_admin()
--      - SECURITY DEFINER + set search_path = public, pg_temp
--      - '<code>|<human sentence>' errors: not_authorized, order_not_found,
--        invalid_shipment
--
--    The UPDATE assigns exactly five columns: the four shipment fields plus
--    tracking_updated_at. It does not read, write or infer `status`,
--    `payment_status`, `paid_at`, `shipped_at`, any stock column, or any
--    payment column. Passing an empty/whitespace value clears that field, so
--    the Admin edit flow supports full edit/save/cancel semantics including
--    removing a previously saved value.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_shipment(
  p_order_id uuid,
  p_carrier text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_delivery_note text default null
)
returns setof public.orders
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_carrier text := nullif(btrim(coalesce(p_carrier, '')), '');
  v_tracking_number text := nullif(btrim(coalesce(p_tracking_number, '')), '');
  v_tracking_url text := nullif(btrim(coalesce(p_tracking_url, '')), '');
  v_delivery_note text := nullif(btrim(coalesce(p_delivery_note, '')), '');
  v_now timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to save shipment details.';
  end if;

  if v_carrier is not null and char_length(v_carrier) > 120 then
    raise exception 'invalid_shipment|Carrier must be 120 characters or fewer.';
  end if;

  if v_tracking_number is not null and char_length(v_tracking_number) > 120 then
    raise exception 'invalid_shipment|Tracking number must be 120 characters or fewer.';
  end if;

  if v_delivery_note is not null and char_length(v_delivery_note) > 500 then
    raise exception 'invalid_shipment|Delivery note must be 500 characters or fewer.';
  end if;

  if v_tracking_url is not null then
    if char_length(v_tracking_url) > 500 then
      raise exception 'invalid_shipment|Tracking link must be 500 characters or fewer.';
    end if;
    if v_tracking_url !~* '^https?://[^[:space:]]+$' then
      raise exception 'invalid_shipment|Tracking link must be a valid http:// or https:// address.';
    end if;
  end if;

  -- Shipment data only: status, payment_status and stock are untouched here.
  update public.orders
  set
    carrier = v_carrier,
    tracking_number = v_tracking_number,
    tracking_url = v_tracking_url,
    delivery_note = v_delivery_note,
    tracking_updated_at = v_now
  where id = p_order_id;

  if not found then
    raise exception 'order_not_found|That order no longer exists.';
  end if;

  return query select o.* from public.orders o where o.id = p_order_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. admin_list_orders — recreate with two extra columns.
--
--    A CREATE OR REPLACE cannot change a function's return type, so the
--    original (009) definition is dropped and the full function is defined
--    again here, with `carrier` and `tracking_number` appended. Everything
--    else — search, filters, clamping, grouping, ordering, the is_admin() gate
--    — is identical to 009. This is a forward-only definition: 009 itself is
--    never edited.
--
--    The two columns let the order queue show a compact "tracking added"
--    indicator for shipped orders without a second query per row.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_orders(text, text, text, integer, integer);

create function public.admin_list_orders(
  p_search text default null,
  p_status text default null,
  p_payment_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  order_number text,
  status text,
  payment_status text,
  subtotal numeric,
  shipping_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  currency text,
  item_count integer,
  line_count integer,
  customer_name text,
  customer_email text,
  customer_phone text,
  recipient_name text,
  phone text,
  created_at timestamptz,
  updated_at timestamptz,
  carrier text,
  tracking_number text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to view orders.';
  end if;

  if p_status is not null
     and p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'invalid_status|% is not a valid order status.', p_status;
  end if;

  if p_payment_status is not null
     and p_payment_status not in ('unpaid', 'paid', 'failed', 'refunded') then
    raise exception 'invalid_status|% is not a valid payment status.', p_payment_status;
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.subtotal,
    o.shipping_amount,
    o.tax_amount,
    o.total_amount,
    o.currency,
    coalesce(sum(oi.quantity), 0)::integer as item_count,
    count(oi.id)::integer as line_count,
    -- Prefer the customer's account name, fall back to the delivery snapshot.
    coalesce(nullif(btrim(pr.full_name), ''), o.recipient_name) as customer_name,
    u.email::text as customer_email,
    coalesce(nullif(btrim(pr.phone), ''), o.phone) as customer_phone,
    o.recipient_name,
    o.phone,
    o.created_at,
    o.updated_at,
    o.carrier,
    o.tracking_number
  from public.orders o
  left join public.profiles pr on pr.id = o.user_id
  left join auth.users u on u.id = o.user_id
  left join public.order_items oi on oi.order_id = o.id
  where (p_status is null or o.status = p_status)
    and (p_payment_status is null or o.payment_status = p_payment_status)
    and (
      v_search is null
      or o.order_number ilike '%' || v_search || '%'
      or o.recipient_name ilike '%' || v_search || '%'
      or o.phone ilike '%' || v_search || '%'
      or pr.full_name ilike '%' || v_search || '%'
      or u.email ilike '%' || v_search || '%'
    )
  group by o.id, pr.full_name, pr.phone, u.email
  order by o.created_at desc
  limit v_limit
  offset v_offset;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grants: authenticated sessions only; every function re-checks
--    public.is_admin() itself (fail closed). The DROP above also removed the
--    original grants on admin_list_orders, so they are re-applied here. No
--    table-level privilege is added or widened anywhere: customers keep
--    SELECT-only access to their own orders and can never write shipment
--    fields.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_set_order_shipment(uuid, text, text, text, text) from public;
revoke all on function public.admin_set_order_shipment(uuid, text, text, text, text) from anon;
revoke all on function public.admin_list_orders(text, text, text, integer, integer) from public;
revoke all on function public.admin_list_orders(text, text, text, integer, integer) from anon;

grant execute on function public.admin_set_order_shipment(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_list_orders(text, text, text, integer, integer) to authenticated;

-- Ask PostgREST to pick up the new columns/functions immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 6. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  order_count bigint;
  shipped_with_tracking bigint;
begin
  select count(*) into order_count from public.orders;

  select count(*) into shipped_with_tracking
  from public.orders
  where status = 'shipped'
    and (carrier is not null or tracking_number is not null or tracking_url is not null);

  raise notice 'Phase G1 shipment foundation applied. Orders: %. Shipped orders with tracking: %. No status, payment, stock or notification behaviour changed — shipment details are saved separately from every other domain.', order_count, shipped_with_tracking;
end $$;

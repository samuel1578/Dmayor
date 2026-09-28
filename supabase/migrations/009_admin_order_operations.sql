/*
  The Proxy Shop — Phase E3: Admin order operations (manual payment + fulfilment)
  ---------------------------------------------------------------------------
  Gives an authenticated Admin the operations surface for orders created in E1,
  with no payment automation of any kind.

  Adds
    - operational timestamps on public.orders: paid_at, confirmed_at, shipped_at,
      delivered_at, cancelled_at (nullable, lightweight — NOT an audit-event log)
    - an admin queue index on (status, payment_status)
    - five admin-only SECURITY DEFINER functions:
        admin_list_orders(...)              search + filter + paginate
        admin_get_order(uuid)               one order: header + items + customer
        admin_set_order_status(uuid, text)  validated fulfilment transitions
        admin_set_order_payment_status(...)  manual payment state
        admin_order_stats()                 real operational counts

  Authorization
    Every function starts with a fail-closed check:
        if not coalesce(public.is_admin(), false) then raise exception …
    Admin reads/writes deliberately run through these functions instead of new
    table policies, so NOTHING is widened:
      - no new grants on public.orders / public.order_items
      - no new INSERT/UPDATE/DELETE access for customers (unchanged from E1)
      - customers still can only SELECT their own orders and order items
    The customer email is only reachable through admin_get_order /
    admin_list_orders (auth.users is not exposed to PostgREST).

  Manual payment only
    No Paystack, no webhooks, no verification, no secret keys, no email. Payment
    status is a human record of something that happened outside this app:
    unpaid | paid | failed | refunded. Nothing here creates a payment
    transaction that did not happen.

  STOCK / RESTOCK — deliberately NOT automated (open commerce decision)
    E1 deducted stock at order creation. Whether cancelling an order should put
    that stock back is still an unconfirmed business rule, so this migration
    performs NO restocking and adds no restock flag: inventing that behaviour
    would silently move inventory. The Admin order screen surfaces the situation
    explicitly instead. When the rule is confirmed, implement restock as a
    separate, idempotent migration/RPC (guarded so it can never run twice).

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically. Safe to re-run.
*/

-- ---------------------------------------------------------------------------
-- 0. Preconditions
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.order_items') is null then
    raise exception 'public.orders / public.order_items were not found. Apply migration 008 first, then run this file.';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() was not found. The Phase A admin/auth migration must be applied first.';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles was not found. Apply migration 005 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Operational timestamps (lightweight; not an audit-event system)
--    Each one is written by admin_set_order_status() / _payment_status() and
--    records WHEN the order reached that state. Setting a later step backfills
--    any earlier step that was skipped, so a jump (pending → shipped) still
--    shows a coherent progression. There is intentionally no history of
--    previous statuses.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists confirmed_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;

comment on column public.orders.paid_at is
  'When the Admin last marked this order paid. Nulled if payment_status moves away from paid — this is current state, not an audit trail.';

-- ---------------------------------------------------------------------------
-- 2. Admin queue index (orders are listed newest-first and filtered on both
--    status dimensions).
-- ---------------------------------------------------------------------------
create index if not exists idx_orders_status_payment_status
  on public.orders(status, payment_status);

-- ---------------------------------------------------------------------------
-- 3. admin_list_orders() — search + filter + paginate the whole order book
--
--    p_search      matches order number, recipient name, delivery phone,
--                  customer full name and customer email (case-insensitive)
--    p_status      exact fulfilment status, or null for all
--    p_payment_status  exact payment status, or null for all
--    Newest first. Limit is clamped to 1..200 so a client can never ask for an
--    unbounded result set.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_orders(
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
  updated_at timestamptz
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
    o.updated_at
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
-- 4. admin_get_order(uuid) — one order as jsonb
--    { order: {…all order columns…}, items: [...], customer: {name,email,phone} }
--    Reading the row with to_jsonb keeps the client mapper identical to the
--    list/table columns, and the customer email comes from auth.users (which is
--    never exposed through PostgREST).
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to view this order.';
  end if;

  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(oi) order by oi.created_at, oi.id)
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'customer', jsonb_build_object(
      'name', coalesce(nullif(btrim(pr.full_name), ''), o.recipient_name),
      'email', u.email::text,
      'phone', coalesce(nullif(btrim(pr.phone), ''), o.phone)
    )
  )
  into v_result
  from public.orders o
  left join public.profiles pr on pr.id = o.user_id
  left join auth.users u on u.id = o.user_id
  where o.id = p_order_id;

  if v_result is null then
    raise exception 'order_not_found|That order no longer exists.';
  end if;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- 5. admin_set_order_status(uuid, text) — validated fulfilment transitions
--
--    pending      → confirmed | cancelled
--    confirmed    → processing | cancelled
--    processing   → shipped | cancelled
--    shipped      → delivered | cancelled
--    delivered    → (final)
--    cancelled    → (final)
--
--    Anything else is rejected, including backwards moves such as
--    delivered → processing, with no override switch (none was specified).
--    Fulfilment and payment stay independent: this function never touches
--    payment_status.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status text
)
returns setof public.orders
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_current text;
  v_allowed text[];
  v_now timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to change an order status.';
  end if;

  if p_status is null
     or p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'invalid_status|% is not a valid order status.', coalesce(p_status, '(none)');
  end if;

  select o.status into v_current
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found|That order no longer exists.';
  end if;

  if v_current = p_status then
    raise exception 'no_change|This order is already %.', p_status;
  end if;

  v_allowed := case v_current
    when 'pending' then array['confirmed', 'cancelled']
    when 'confirmed' then array['processing', 'cancelled']
    when 'processing' then array['shipped', 'cancelled']
    when 'shipped' then array['delivered', 'cancelled']
    else array[]::text[]
  end;

  if not (p_status = any (v_allowed)) then
    if v_current in ('delivered', 'cancelled') then
      raise exception 'terminal_status|A % order is in a final state and cannot be changed.', v_current;
    end if;
    raise exception 'invalid_transition|% → % is not an allowed order transition.', v_current, p_status;
  end if;

  update public.orders
  set
    status = p_status,
    -- Backfill earlier steps so a jump still reads coherently.
    confirmed_at = case
      when p_status in ('confirmed', 'processing', 'shipped', 'delivered') and confirmed_at is null then v_now
      else confirmed_at
    end,
    shipped_at = case
      when p_status in ('shipped', 'delivered') and shipped_at is null then v_now
      else shipped_at
    end,
    delivered_at = case
      when p_status = 'delivered' and delivered_at is null then v_now
      else delivered_at
    end,
    cancelled_at = case
      when p_status = 'cancelled' then v_now
      else cancelled_at
    end
  where id = p_order_id;

  return query select o.* from public.orders o where o.id = p_order_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. admin_set_order_payment_status(uuid, text) — manual payment state
--
--    Any of unpaid | paid | failed | refunded may be set: this field records
--    what happened outside the app (bank transfer, MoMo, cash) and that may
--    need correcting. paid_at is written only while the order is paid and is
--    cleared otherwise, so it always describes the CURRENT state.
--    Order status is never touched here.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_payment_status(
  p_order_id uuid,
  p_payment_status text
)
returns setof public.orders
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_current text;
  v_now timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to change a payment status.';
  end if;

  if p_payment_status is null
     or p_payment_status not in ('unpaid', 'paid', 'failed', 'refunded') then
    raise exception 'invalid_status|% is not a valid payment status.', coalesce(p_payment_status, '(none)');
  end if;

  select o.payment_status into v_current
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found|That order no longer exists.';
  end if;

  if v_current = p_payment_status then
    raise exception 'no_change|This order is already marked %.', p_payment_status;
  end if;

  update public.orders
  set
    payment_status = p_payment_status,
    paid_at = case when p_payment_status = 'paid' then v_now else null end
  where id = p_order_id;

  return query select o.* from public.orders o where o.id = p_order_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. admin_order_stats() — real operational counts (no invented metrics)
-- ---------------------------------------------------------------------------
create or replace function public.admin_order_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to view order statistics.';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'pending', count(*) filter (where o.status = 'pending'),
    'confirmed', count(*) filter (where o.status = 'confirmed'),
    'processing', count(*) filter (where o.status = 'processing'),
    'shipped', count(*) filter (where o.status = 'shipped'),
    'delivered', count(*) filter (where o.status = 'delivered'),
    'cancelled', count(*) filter (where o.status = 'cancelled'),
    'unpaid', count(*) filter (where o.payment_status = 'unpaid'),
    'paid', count(*) filter (where o.payment_status = 'paid'),
    'failed', count(*) filter (where o.payment_status = 'failed'),
    'refunded', count(*) filter (where o.payment_status = 'refunded'),
    'paidTotal', coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid'), 0)
  )
  into v_result
  from public.orders o;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Function grants: callable by an authenticated session only, and every
--    function re-checks public.is_admin() itself (fail closed). No table-level
--    privilege is added or widened anywhere by this migration.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_list_orders(text, text, text, integer, integer) from public;
revoke all on function public.admin_list_orders(text, text, text, integer, integer) from anon;
revoke all on function public.admin_get_order(uuid) from public;
revoke all on function public.admin_get_order(uuid) from anon;
revoke all on function public.admin_set_order_status(uuid, text) from public;
revoke all on function public.admin_set_order_status(uuid, text) from anon;
revoke all on function public.admin_set_order_payment_status(uuid, text) from public;
revoke all on function public.admin_set_order_payment_status(uuid, text) from anon;
revoke all on function public.admin_order_stats() from public;
revoke all on function public.admin_order_stats() from anon;

grant execute on function public.admin_list_orders(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_order(uuid) to authenticated;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
grant execute on function public.admin_set_order_payment_status(uuid, text) to authenticated;
grant execute on function public.admin_order_stats() to authenticated;

-- Ask PostgREST to pick up the new functions immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 9. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  order_count bigint;
begin
  select count(*) into order_count from public.orders;

  raise notice 'Phase E3 admin order operations applied. Existing orders: %. No restocking is performed on cancellation — that business rule is still unconfirmed.', order_count;
end $$;

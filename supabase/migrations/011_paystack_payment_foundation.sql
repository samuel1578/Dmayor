/*
  The Proxy Shop — Phase F1: Paystack payment plumbing (server-side foundation)
  ---------------------------------------------------------------------------
  Creates the SERVER-SIDE payment-attempt ledger that the F1 Edge Functions
  (initialize-payment / verify-payment) write to. It is deliberately NOT the
  customer payment UX (F2) and NOT the webhook/reconciliation layer (F3).

  This migration does NOT (and must not):
    - initialize Paystack from the database
    - create callback routes, a webhook, or a webhook-event ledger
    - verify payments
    - expose any Paystack secret
    - create fake transactions or fake references
    - mark orders paid automatically
    - move money, stock, order status or fulfilment state
    - touch migrations 001–010

  Adds
    - public.payment_attempts — one row per external payment initialization.
    - a BEFORE UPDATE trigger that keeps updated_at fresh.
    - one customer-facing policy: SELECT of the caller's OWN attempts only.
      There are deliberately NO customer INSERT/UPDATE/DELETE policies.
    - column-level SELECT grants so customers can read only the safe columns
      (never access_code or provider_response).
    - public.admin_list_payment_attempts(uuid, integer) — admin-only read
      (fail-closed on public.is_admin()) for a future support/Admin surface.
    - public.record_paystack_payment(...) — the ONLY write path that can mark
      an order paid from a verified Paystack payment. Callable by service_role
      only; it is atomic, idempotent and refuses to overwrite a manual payment.

  payment_attempts.status domain (deliberate internal states only)
    initialized → the local attempt row exists, Paystack not yet called
    pending     → Paystack returned an authorization URL; awaiting the outcome
    success     → server-to-server verification confirmed payment
    failed      → Paystack reported the attempt failed
    abandoned   → Paystack reported the attempt was abandoned
  No other states are invented. `verified_at` is set only on `success`.

  Retries
    Every initialization is a NEW attempt with a NEW server-generated
    reference. A failed/abandoned/superseded reference is never reused.

  Manual vs Paystack attribution (E3/H0.1 manual flow stays valid)
    Manual payments keep payment_source = 'manual' via admin_set_manual_payment().
    record_paystack_payment() refuses to convert an order that is already paid
    as manual (returns outcome 'conflict'); it returns 'already_verified' when
    the same verified attempt is recorded twice. paid_at is preserved.

  F3 forward compatibility (documented decision)
    A generic webhook/event-idempotency table is NOT added here. F1 only needs
    the attempt ledger, whose UNIQUE(reference) is already the idempotency
    anchor, and whose status + provider_response + verified_at columns let F3
    process webhook events idempotently without reworking this schema. When F3
    needs event storage it can add a dedicated table in its own forward
    migration; nothing here would have to change.

  Coupling
    Payment status and fulfilment status remain SEPARATE domains. Nothing here
    maps paid → confirmed, and nothing writes orders.status.

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically. Safe to re-run.
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

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() was not found. Apply migration 001 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. payment_attempts — one row per external payment initialization
-- ---------------------------------------------------------------------------
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'paystack',
  reference text not null unique,
  status text not null default 'initialized',
  amount numeric(12,2) not null,
  currency text not null default 'GHS',
  channel text,
  authorization_url text,
  access_code text,
  provider_response jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_status_check
    check (status in ('initialized', 'pending', 'success', 'failed', 'abandoned')),
  constraint payment_attempts_amount_check check (amount >= 0)
);

comment on table public.payment_attempts is
  'Phase F1 server-side payment-attempt ledger. One row per external payment initialization; multiple attempts may exist for one order and only the successful attempt becomes the payment attribution. Written only by privileged server paths (Edge Functions with the service role); customers may read only their own safe columns.';
comment on column public.payment_attempts.reference is
  'Server-generated Paystack reference (unique, immutable per attempt). Never generated by the browser and never reused across attempts.';
comment on column public.payment_attempts.status is
  'initialized | pending | success | failed | abandoned. Not a Paystack status — a deliberate internal state.';
comment on column public.payment_attempts.provider_response is
  'Raw provider payload retained for support/diagnosis. Never granted to customers.';
comment on column public.payment_attempts.verified_at is
  'Set once, when a server-to-server verification confirmed the payment succeeded.';

create index if not exists idx_payment_attempts_order_id
  on public.payment_attempts(order_id);
create index if not exists idx_payment_attempts_user_id
  on public.payment_attempts(user_id);
create index if not exists idx_payment_attempts_created_at
  on public.payment_attempts(created_at desc);

drop trigger if exists set_payment_attempts_updated_at on public.payment_attempts;
create trigger set_payment_attempts_updated_at
  before update on public.payment_attempts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS + grants
--    Customers: SELECT own attempts only, and only the safe columns.
--    No customer INSERT/UPDATE/DELETE table policies exist at all — every
--    write happens through the service role inside the Edge Functions.
-- ---------------------------------------------------------------------------
alter table public.payment_attempts enable row level security;

drop policy if exists "Customers can read own payment attempts" on public.payment_attempts;
create policy "Customers can read own payment attempts"
  on public.payment_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.payment_attempts from public;
revoke all on public.payment_attempts from anon;
revoke all on public.payment_attempts from authenticated;

-- Column-level SELECT only: the raw provider payload (provider_response) and
-- access_code are intentionally NOT readable by customers.
grant select (
  id,
  order_id,
  provider,
  reference,
  status,
  amount,
  currency,
  channel,
  authorization_url,
  verified_at,
  created_at,
  updated_at
) on public.payment_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_list_payment_attempts(uuid, integer) — admin-only read
--    Fail-closed like every other admin function. This prepares the data layer
--    for a later Admin/support view without adding a UI in F1.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_payment_attempts(
  p_order_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  order_id uuid,
  order_number text,
  user_id uuid,
  provider text,
  reference text,
  status text,
  amount numeric,
  currency text,
  channel text,
  authorization_url text,
  verified_at timestamptz,
  provider_response jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_authorized|Admin access is required to view payment attempts.';
  end if;

  if p_order_id is null then
    raise exception 'invalid_status|An order id is required to list payment attempts.';
  end if;

  return query
  select
    a.id,
    a.order_id,
    o.order_number,
    a.user_id,
    a.provider,
    a.reference,
    a.status,
    a.amount,
    a.currency,
    a.channel,
    a.authorization_url,
    a.verified_at,
    a.provider_response,
    a.created_at,
    a.updated_at
  from public.payment_attempts a
  join public.orders o on o.id = a.order_id
  where a.order_id = p_order_id
  order by a.created_at desc
  limit v_limit;
end $$;

-- ---------------------------------------------------------------------------
-- 4. record_paystack_payment(...) — the ONE verified-success write path
--
--    Called only by the verify-payment Edge Function with the service role,
--    after that function has already authenticated the caller AND verified the
--    Paystack transaction server-to-server. This function is the atomic,
--    idempotent, lock-taking guard around the order write.
--
--    It re-checks everything against the database (never trusting the caller):
--      - the attempt exists and its reference matches
--      - the recorded minor-unit amount equals round(order.total_amount * 100)
--      - the currency matches the order
--      - the order is not already attributed to a manual payment (conflict)
--
--    Outcomes (jsonb `outcome`):
--      success            — attempt + order written as paid via paystack
--      already_verified   — the same verified attempt was already recorded
--      conflict           — order already paid by a different/manual source
--      amount_mismatch    — provider amount does not match the order total
--      currency_mismatch  — provider currency does not match the order
--      reference_mismatch — the attempt reference does not match
--      attempt_not_found  — unknown attempt id
--      order_not_found    — the attempt's order no longer exists
--
--    On success it sets: payment_status='paid', payment_source='paystack',
--    payment_provider='Paystack', payment_reference=<attempt reference>,
--    real channel when supplied, and paid_at (preserving an existing value).
--    Fulfilment status is never touched.
-- ---------------------------------------------------------------------------
create or replace function public.record_paystack_payment(
  p_attempt_id uuid,
  p_reference text,
  p_amount_minor bigint,
  p_currency text,
  p_channel text default null,
  p_provider_response jsonb default null,
  p_verified_at timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_expected_minor bigint;
  v_verified_at timestamptz := coalesce(p_verified_at, now());
begin
  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'attempt_not_found');
  end if;

  if v_attempt.reference is distinct from p_reference then
    return jsonb_build_object('outcome', 'reference_mismatch');
  end if;

  select * into v_order
  from public.orders
  where id = v_attempt.order_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'order_not_found');
  end if;

  -- Paystack minor units for every currency this project uses are 2 decimal
  -- places (GHS pesewas), so the expected minor amount is the exact numeric
  -- order total scaled by 100 — no floating point involved.
  v_expected_minor := round(v_order.total_amount * 100)::bigint;

  if p_amount_minor is null or p_amount_minor <> v_expected_minor then
    return jsonb_build_object(
      'outcome', 'amount_mismatch',
      'expected_minor', v_expected_minor,
      'received_minor', p_amount_minor
    );
  end if;

  if p_currency is null or upper(p_currency) <> upper(v_order.currency) then
    return jsonb_build_object(
      'outcome', 'currency_mismatch',
      'expected', v_order.currency,
      'received', p_currency
    );
  end if;

  -- Idempotency: the same verified attempt is already the attribution.
  if v_attempt.status = 'success'
     and v_order.payment_status = 'paid'
     and v_order.payment_source = 'paystack'
     and v_order.payment_reference is not distinct from v_attempt.reference then
    return jsonb_build_object(
      'outcome', 'already_verified',
      'order_id', v_order.id,
      'paid_at', v_order.paid_at
    );
  end if;

  -- Manual attribution protection: never silently convert a manual payment.
  if v_order.payment_status = 'paid'
     and coalesce(v_order.payment_source, 'manual') <> 'paystack' then
    return jsonb_build_object(
      'outcome', 'conflict',
      'reason', 'order_already_paid_manually',
      'order_id', v_order.id
    );
  end if;

  -- A different Paystack payment already marked this order paid.
  if v_order.payment_status = 'paid'
     and v_order.payment_reference is not null
     and v_order.payment_reference <> v_attempt.reference then
    return jsonb_build_object(
      'outcome', 'conflict',
      'reason', 'order_paid_by_other_reference',
      'order_id', v_order.id
    );
  end if;

  -- Verified success write.
  update public.payment_attempts
  set
    status = 'success',
    channel = coalesce(p_channel, channel),
    verified_at = coalesce(verified_at, v_verified_at),
    provider_response = coalesce(p_provider_response, provider_response)
  where id = p_attempt_id;

  update public.orders
  set
    payment_status = 'paid',
    payment_source = 'paystack',
    payment_provider = 'Paystack',
    payment_reference = v_attempt.reference,
    payment_channel = coalesce(p_channel, payment_channel),
    paid_at = coalesce(paid_at, v_verified_at)
  where id = v_order.id;

  return jsonb_build_object(
    'outcome', 'success',
    'order_id', v_order.id,
    'reference', v_attempt.reference,
    'paid_at', coalesce(v_order.paid_at, v_verified_at)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5. Function grants
--    admin_list_payment_attempts: authenticated sessions only; re-checks
--    public.is_admin() itself (fail closed).
--    record_paystack_payment: service_role ONLY — never a browser session.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_list_payment_attempts(uuid, integer) from public;
revoke all on function public.admin_list_payment_attempts(uuid, integer) from anon;
grant execute on function public.admin_list_payment_attempts(uuid, integer) to authenticated;

revoke all on function public.record_paystack_payment(uuid, text, bigint, text, text, jsonb, timestamptz) from public;
revoke all on function public.record_paystack_payment(uuid, text, bigint, text, text, jsonb, timestamptz) from anon;
revoke all on function public.record_paystack_payment(uuid, text, bigint, text, text, jsonb, timestamptz) from authenticated;
grant execute on function public.record_paystack_payment(uuid, text, bigint, text, text, jsonb, timestamptz) to service_role;

-- Ask PostgREST to pick up the new table/functions immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 6. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  attempt_count bigint;
begin
  select count(*) into attempt_count from public.payment_attempts;

  raise notice 'Phase F1 Paystack payment foundation applied. Existing attempts: %. No order is marked paid by this migration; only verify-payment (service role) can record a verified Paystack payment.', attempt_count;
end $$;

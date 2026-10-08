/*
  The Proxy Shop — Phase F3: Paystack webhook events + reconciliation
  ---------------------------------------------------------------------------
  Adds the backend-only webhook event / audit store used by the `paystack-webhook`
  Edge Function. It is deliberately isolated from the trusted payment
  finalization primitive: this table only RECORDS webhook deliveries and their
  processing outcome.

  The ONLY path that can mark an order paid remains
  public.record_paystack_payment(...) (migration 011), which the webhook,
  verify-payment and reconcile-payment all call. This migration adds no second
  finalization path.

  This migration does NOT (and must not):
    - verify payments or move money
    - mark orders paid
    - create a webhook endpoint (that is the Edge Function)
    - expose raw provider payloads to any client
    - touch migrations 001–011
    - change stock, fulfilment or order status

  Adds
    - public.payment_events — one row per provider webhook delivery.
      provider_event_key is deterministic and UNIQUE, so duplicate deliveries
      collide and are processed idempotently.
    - RLS with NO policies and all grants revoked: customers can never read or
      write this table. Only the service role (Edge Functions) writes it.
    - public.admin_list_payment_events(uuid, integer) — an admin-only read of
      NON-payload fields, for operational visibility (the raw payload is never
      exposed through it).

  processing_status domain
    received  → registered, not yet handled
    processed → handled and applied (verified success recorded)
    ignored   → handled but intentionally not applied (unsupported event, or a
                provider non-success / unmatched reference)
    failed    → handled but produced a conflict/mismatch/transient error
  No other states are invented.

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

  if to_regclass('public.payment_attempts') is null then
    raise exception 'public.payment_attempts was not found. Apply migration 011 first, then run this file.';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() was not found. The Phase A admin/auth migration must be applied first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. payment_events — backend/audit store for provider webhook deliveries
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_type text not null,
  provider_event_key text not null unique,
  payment_reference text,
  provider_transaction_id text,
  order_id uuid references public.orders(id) on delete set null,
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  processing_status text not null default 'received',
  payload jsonb,
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_events_status_check
    check (processing_status in ('received', 'processed', 'ignored', 'failed'))
);

comment on table public.payment_events is
  'Phase F3 backend-only webhook event/audit store. One row per provider webhook delivery. provider_event_key is deterministic and unique for idempotency. Customers have no access; raw payloads are never exposed to clients.';
comment on column public.payment_events.provider_event_key is
  'Deterministic idempotency identity, e.g. paystack:<event_type>:<transaction_id>. Never a timestamp or random value.';
comment on column public.payment_events.processing_status is
  'received | processed | ignored | failed — our own handling state, not a Paystack status.';
comment on column public.payment_events.payload is
  'Raw provider payload retained for support/audit. Backend only; never granted to clients.';

create index if not exists idx_payment_events_reference
  on public.payment_events(payment_reference);
create index if not exists idx_payment_events_order_id
  on public.payment_events(order_id);
create index if not exists idx_payment_events_attempt_id
  on public.payment_events(payment_attempt_id);
create index if not exists idx_payment_events_created_at
  on public.payment_events(created_at desc);

-- ---------------------------------------------------------------------------
-- 2. RLS + grants — backend only. No customer read/write at all.
-- ---------------------------------------------------------------------------
alter table public.payment_events enable row level security;

-- Deliberately NO policies: even with a grant, RLS would deny every row.
revoke all on public.payment_events from public;
revoke all on public.payment_events from anon;
revoke all on public.payment_events from authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_list_payment_events(uuid, integer) — admin-only, payload-free read
--    Fail-closed like every other admin function. Returns operational fields
--    only; the raw payload is never exposed through this surface.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_payment_events(
  p_order_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  provider text,
  event_type text,
  payment_reference text,
  provider_transaction_id text,
  order_id uuid,
  payment_attempt_id uuid,
  processing_status text,
  error_code text,
  error_message text,
  received_at timestamptz,
  processed_at timestamptz
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
    raise exception 'not_authorized|Admin access is required to view payment events.';
  end if;

  return query
  select
    e.id,
    e.provider,
    e.event_type,
    e.payment_reference,
    e.provider_transaction_id,
    e.order_id,
    e.payment_attempt_id,
    e.processing_status,
    e.error_code,
    e.error_message,
    e.received_at,
    e.processed_at
  from public.payment_events e
  where p_order_id is null or e.order_id = p_order_id
  order by e.received_at desc
  limit v_limit;
end $$;

revoke all on function public.admin_list_payment_events(uuid, integer) from public;
revoke all on function public.admin_list_payment_events(uuid, integer) from anon;
grant execute on function public.admin_list_payment_events(uuid, integer) to authenticated;

-- Ask PostgREST to pick up the new table/functions immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 4. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  event_count bigint;
begin
  select count(*) into event_count from public.payment_events;

  raise notice 'Phase F3 payment events store applied. Existing events: %. The only order-paid write path remains record_paystack_payment(); this table records webhook handling only.', event_count;
end $$;

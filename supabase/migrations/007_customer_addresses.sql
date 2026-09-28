/*
  The Proxy Shop — Phase D3: customer saved addresses
  ---------------------------------------------------------------------------
  Adds the `customer_addresses` store used by the new /account/addresses
  surface (and, later, by Checkout in Phase E).

  Ownership : user_id -> auth.users(id) ON DELETE CASCADE
  RLS       : auth.uid() = user_id for SELECT/INSERT/UPDATE/DELETE, granted
              `to authenticated` only. Anon has no address access at all.
  Default   : at most ONE default address per customer, enforced by a partial
              unique index on (user_id) WHERE is_default = true. The app sets
              a new default by unsetting the current one first, then marking
              the selected row.
  Storage   : delivery details only — no cards, no Paystack/bank data, no
              orders. Postal code is optional (Ghana).

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically.

  Safe to re-run: every statement is guarded/idempotent.
*/

-- ---------------------------------------------------------------------------
-- 0. Precondition: Phase A/001 objects must exist
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.customer_addresses') is not null then
    null; -- table already present, remaining statements are idempotent
  end if;

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() was not found. Apply migration 001 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text,
  country text not null default 'Ghana',
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive column guards (no-ops when the CREATE above just ran).
alter table public.customer_addresses add column if not exists label text;
alter table public.customer_addresses add column if not exists address_line2 text;
alter table public.customer_addresses add column if not exists region text;
alter table public.customer_addresses add column if not exists postal_code text;
alter table public.customer_addresses alter column country set default 'Ghana';
alter table public.customer_addresses alter column is_default set default false;
alter table public.customer_addresses alter column created_at set default now();
alter table public.customer_addresses alter column updated_at set default now();

-- ---------------------------------------------------------------------------
-- 2. Practical required-field guard at the storage layer
--    (the UI validates too — this is defence in depth)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_addresses'::regclass
      and conname = 'customer_addresses_required_check'
  ) then
    alter table public.customer_addresses
      add constraint customer_addresses_required_check
      check (
        char_length(trim(recipient_name)) > 0
        and char_length(trim(phone)) > 0
        and char_length(trim(address_line1)) > 0
        and char_length(trim(city)) > 0
        and char_length(trim(country)) > 0
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Indexes: owner lookups + at most ONE default address per customer
-- ---------------------------------------------------------------------------
create index if not exists idx_customer_addresses_user_id
  on public.customer_addresses(user_id);

create unique index if not exists uq_customer_addresses_one_default
  on public.customer_addresses(user_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- 4. updated_at is managed by the shared trigger from 001
-- ---------------------------------------------------------------------------
drop trigger if exists set_customer_addresses_updated_at on public.customer_addresses;
create trigger set_customer_addresses_updated_at
  before update on public.customer_addresses
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS: a customer can only ever touch their own addresses.
--    No anon policies exist, so anon has zero address access.
--    auth.uid() — never a browser-supplied id — is the authorization source.
-- ---------------------------------------------------------------------------
alter table public.customer_addresses enable row level security;

drop policy if exists "Customers can read own addresses" on public.customer_addresses;
create policy "Customers can read own addresses"
  on public.customer_addresses
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Customers can insert own addresses" on public.customer_addresses;
create policy "Customers can insert own addresses"
  on public.customer_addresses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Customers can update own addresses" on public.customer_addresses;
create policy "Customers can update own addresses"
  on public.customer_addresses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers can delete own addresses" on public.customer_addresses;
create policy "Customers can delete own addresses"
  on public.customer_addresses
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Grants: exactly what an authenticated address book needs. RLS remains
--    the authorization boundary. anon (and PUBLIC) keep no address privileges.
-- ---------------------------------------------------------------------------
revoke all on public.customer_addresses from public;
revoke all on public.customer_addresses from anon;

grant select, insert, update, delete on public.customer_addresses to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  default_index_exists boolean;
begin
  select exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and indexname = 'uq_customer_addresses_one_default'
  ) into default_index_exists;

  raise notice 'Phase D3 customer addresses applied: ownership FK -> auth.users(id) ON DELETE CASCADE, RLS auth.uid() = user_id (authenticated only), anon has no access, single default index present: %', default_index_exists;
end $$;

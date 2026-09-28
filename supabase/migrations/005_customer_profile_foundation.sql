/*
  The Proxy Shop — Phase D1: customer profile foundation
  ---------------------------------------------------------------------------
  Turns `profiles` into the customer-facing profile store while keeping Admin
  authorization exactly as Phase A left it (public.is_admin()).

  This migration is DEFENSIVE and IDEMPOTENT:
    - the Phase A admin/auth SQL was applied outside this repository, so every
      statement checks first and only adds what is missing.
    - no field is duplicated, nothing is dropped, no existing policy is removed.

  Target profile fields supported after this file:
    id (== auth.users.id), full_name, phone, role, created_at, updated_at

  Column-level UPDATE privileges are the primary defence against self-promotion:
  authenticated users may only write `full_name` and `phone`. `role` is not
  grantable from the browser at all, and a BEFORE UPDATE trigger rejects role
  changes from API roles as a second layer.

  Deliberately NOT added: addresses, orders, payments, cart data.

  Safe to re-run.
*/

-- ---------------------------------------------------------------------------
-- 0. Table + columns (no-ops when Phase A already created them)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text not null default 'customer';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 1. Role domain (only added when missing; never rewrites usable data)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('customer', 'admin'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. New profiles always start as customers
-- ---------------------------------------------------------------------------
alter table public.profiles alter column role set default 'customer';

-- ---------------------------------------------------------------------------
-- 3. Guard trigger: immutable identity, no self-promotion, managed timestamps
--    Role changes stay possible from the SQL editor / service role (that is how
--    an Admin is promoted), but never from an API (anon/authenticated) request.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed';
  end if;

  if new.created_at is distinct from old.created_at then
    new.created_at := old.created_at;
  end if;

  if new.role is distinct from old.role and current_user in ('anon', 'authenticated') then
    raise exception 'profiles.role cannot be changed from the API';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row
  execute function public.profiles_guard_update();

-- ---------------------------------------------------------------------------
-- 4. Row level security: a user may read and update only their own row
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 5. Privileges: row access via RLS, column access via grants.
--    Table-level UPDATE is revoked so only the two safe columns are writable.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke insert, delete, update on public.profiles from anon;
revoke insert, delete, update on public.profiles from public;
revoke insert, delete, update on public.profiles from authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- No INSERT/DELETE for clients: rows are created by the Phase A signup trigger
-- (SECURITY DEFINER) and removed by ON DELETE CASCADE from auth.users.

-- ---------------------------------------------------------------------------
-- 6. Confirmation notices
-- ---------------------------------------------------------------------------
do $$
declare
  has_phone boolean;
  update_grant_count integer;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) into has_phone;

  select count(*) into update_grant_count
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'profiles'
    and grantee = 'authenticated'
    and privilege_type = 'UPDATE';

  raise notice 'profiles.phone present: %', has_phone;
  raise notice 'authenticated UPDATE column grants on profiles: % (expected 2: full_name, phone)', update_grant_count;
end $$;

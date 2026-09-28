/*
  The Proxy Shop — Phase D2: persistent authenticated customer cart
  ---------------------------------------------------------------------------
  Activates the reserved `cart_items` table for signed-in customers.

  Ownership : every row belongs to auth.users(id), ON DELETE CASCADE
  Identity  : UNIQUE (user_id, product_id, variant_id) — one row per exact
              variant. Same product + different variant = separate rows.
  Quantity  : integer > 0 (the 001 check is kept and re-asserted defensively).
  RLS       : auth.uid() = user_id for SELECT / INSERT / UPDATE / DELETE,
              granted `to authenticated` only.
  Grants    : SELECT/INSERT/UPDATE/DELETE for `authenticated` ONLY — `anon`
              keeps no cart access at all.

  Guest carts stay localStorage-only: there are deliberately NO anon policies
  and no anonymous database carts. Nothing here touches products, variants or
  Admin policies, and no presentation fields (name/price/image/stock) are
  stored on cart rows — display data is always resolved from the catalogue.

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically.

  Safe to re-run: every statement is guarded/idempotent.
*/

-- ---------------------------------------------------------------------------
-- 0. Precondition
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.cart_items') is null then
    raise exception 'public.cart_items was not found. Apply migration 001 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Defence cleanup before the new NOT NULL / UNIQUE rules
--    The table has been unreachable since 001 (no policies, all grants
--    revoked), so both statements are no-ops on a clean database.
-- ---------------------------------------------------------------------------
delete from public.cart_items
where user_id is null
   or variant_id is null;

-- Collapse any accidental duplicate product+variant lines (keep one row each).
delete from public.cart_items a
using public.cart_items b
where a.user_id = b.user_id
  and a.product_id = b.product_id
  and a.variant_id = b.variant_id
  and a.ctid < b.ctid;

-- ---------------------------------------------------------------------------
-- 2. Ownership: user_id -> auth.users(id) ON DELETE CASCADE
--    001 created user_id without a foreign key; add it if missing.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cart_items'::regclass
      and contype = 'f'
      and conname = 'cart_items_user_id_fkey'
  ) then
    alter table public.cart_items
      add constraint cart_items_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Authenticated cart rows are always owned + always an exact variant
-- ---------------------------------------------------------------------------
alter table public.cart_items alter column user_id set not null;
alter table public.cart_items alter column variant_id set not null;

do $$
begin
  -- Legacy rule was ON DELETE SET NULL, incompatible with NOT NULL variant_id:
  -- replace it with cascade so a deleted variant removes its cart line.
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cart_items'::regclass
      and conname = 'cart_items_variant_id_fkey'
  ) then
    alter table public.cart_items drop constraint cart_items_variant_id_fkey;
  end if;

  alter table public.cart_items
    add constraint cart_items_variant_id_fkey
    foreign key (variant_id)
    references public.product_variants(id)
    on delete cascade;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Unique cart identity: customer + product + variant
--    (also the conflict target for PostgREST/Supabase upserts)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cart_items'::regclass
      and conname = 'cart_items_user_product_variant_key'
  ) then
    alter table public.cart_items
      add constraint cart_items_user_product_variant_key
      unique (user_id, product_id, variant_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Quantity: integer, strictly positive (001 already added the check)
-- ---------------------------------------------------------------------------
alter table public.cart_items alter column quantity set default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cart_items'::regclass
      and conname = 'cart_items_quantity_check'
  ) then
    alter table public.cart_items
      add constraint cart_items_quantity_check
      check (quantity > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. RLS: a customer can only ever touch their own cart rows.
--    No anon policies exist, so anon has zero database cart access and the
--    guest cart remains localStorage-only. auth.uid() — never a
--    browser-supplied id — is the authorization source.
-- ---------------------------------------------------------------------------
alter table public.cart_items enable row level security;

drop policy if exists "Customers can read own cart" on public.cart_items;
create policy "Customers can read own cart"
  on public.cart_items
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Customers can insert own cart rows" on public.cart_items;
create policy "Customers can insert own cart rows"
  on public.cart_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Customers can update own cart rows" on public.cart_items;
create policy "Customers can update own cart rows"
  on public.cart_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers can delete own cart rows" on public.cart_items;
create policy "Customers can delete own cart rows"
  on public.cart_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. Grants: exactly what an authenticated cart needs. RLS remains the
--    authorization boundary. anon (and PUBLIC) keep no cart privileges.
-- ---------------------------------------------------------------------------
revoke all on public.cart_items from public;
revoke all on public.cart_items from anon;

grant select, insert, update, delete on public.cart_items to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
begin
  raise notice 'Phase D2 authenticated cart applied: ownership FK -> auth.users(id) ON DELETE CASCADE, UNIQUE(user_id, product_id, variant_id), quantity > 0, RLS auth.uid() = user_id (authenticated only), anon has no cart access.';
end $$;

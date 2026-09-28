/*
  The Proxy Shop — Phase B: Admin catalogue write authorization
  ---------------------------------------------------------------------------
  Enables catalogue management for the authorised Admin browser session.

  Authorization boundary: PostgreSQL RLS + public.is_admin().
  The browser never receives privileged credentials (no service role / secret
  keys anywhere in the Vite app).

  Tables receiving Admin write policies:
    - categories
    - products
    - product_variants
    - product_images

  Also added (required for the Admin UI to work at all):
    - Admin-only SELECT policies so drafts / archived products, inactive
      categories, inactive variants and images of non-active products are
      visible to Admins in the admin screens.
    - A partial unique index guaranteeing at most ONE primary image per product.

  Explicitly NOT changed:
    - existing public SELECT policies (anon still sees only active catalogue)
    - collections / collection_products / blog_posts / cart_items / newsletter
    - nothing is granted to anon

  Requires: the Phase A admin/auth migration (public.is_admin()) applied first.

  Safe to re-run: policies are dropped before being recreated.
*/

-- ---------------------------------------------------------------------------
-- 0. Precondition: Phase A helper must exist
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception
      'public.is_admin() was not found. Apply the Phase A admin/auth migration first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Data safety: collapse any pre-existing duplicate primary images
--    (no-op on a clean catalogue; prevents the unique index below from failing)
-- ---------------------------------------------------------------------------
update public.product_images pi
set is_primary = false
where pi.is_primary = true
  and pi.id not in (
    select distinct on (product_id) id
    from public.product_images
    where is_primary = true
    order by product_id, display_order asc, created_at asc
  );

-- ---------------------------------------------------------------------------
-- 2. At most one primary image per product
-- ---------------------------------------------------------------------------
create unique index if not exists uq_product_images_one_primary
  on public.product_images (product_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- 3. Admin read access to non-public catalogue rows
--    (permissive policies OR together with the existing public ones, so the
--     public/anon view is unchanged)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read all categories" on public.categories;
create policy "Admins can read all categories"
  on public.categories
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all products" on public.products;
create policy "Admins can read all products"
  on public.products
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all product variants" on public.product_variants;
create policy "Admins can read all product variants"
  on public.product_variants
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all product images" on public.product_images;
create policy "Admins can read all product images"
  on public.product_images
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Admin-only write policies (authenticated AND is_admin())
--    A normal authenticated customer passes the table privilege but fails
--    these policies, so RLS remains the real authorization boundary.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can insert categories" on public.categories;
create policy "Admins can insert categories"
  on public.categories
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update categories" on public.categories;
create policy "Admins can update categories"
  on public.categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories"
  on public.categories
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert product variants" on public.product_variants;
create policy "Admins can insert product variants"
  on public.product_variants
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update product variants" on public.product_variants;
create policy "Admins can update product variants"
  on public.product_variants
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete product variants" on public.product_variants;
create policy "Admins can delete product variants"
  on public.product_variants
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert product images" on public.product_images;
create policy "Admins can insert product images"
  on public.product_images
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update product images" on public.product_images;
create policy "Admins can update product images"
  on public.product_images
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete product images" on public.product_images;
create policy "Admins can delete product images"
  on public.product_images
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Grants: minimum table privileges for RLS-authorized Admin writes.
--    Existing migration 001 revoked catalogue writes from browser roles, so
--    the grants must be restored for `authenticated` only.
--    RLS (is_admin()) still decides every single write.
-- ---------------------------------------------------------------------------
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant insert, update, delete on public.product_images to authenticated;

-- anon (and anything granted via PUBLIC) keeps NO catalogue write access.
revoke insert, update, delete on public.categories from anon;
revoke insert, update, delete on public.products from anon;
revoke insert, update, delete on public.product_variants from anon;
revoke insert, update, delete on public.product_images from anon;

revoke insert, update, delete on public.categories from public;
revoke insert, update, delete on public.products from public;
revoke insert, update, delete on public.product_variants from public;
revoke insert, update, delete on public.product_images from public;

-- ---------------------------------------------------------------------------
-- 6. Confirmation notices
-- ---------------------------------------------------------------------------
do $$
begin
  raise notice 'Phase B catalogue policies applied. Admin writes require public.is_admin() = true.';
end $$;

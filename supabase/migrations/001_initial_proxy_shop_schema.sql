/*
  The Proxy Shop — clean initial schema (fresh Supabase project)

  Apply on a new/empty project only. Replaces legacy D'Mayor demo migrations.

  Tables:
    categories, products, product_variants, product_images,
    collections, collection_products, blog_posts,
    newsletter_subscribers, cart_items

  Notes:
    - products.images (jsonb) + products.stock are LEGACY compatibility columns
      for the current storefront. Authoritative inventory: product_variants.stock.
    - New products default to status = 'draft'.
    - Public/anon: catalogue reads only (RLS-filtered). No catalogue writes.
    - Authenticated: same public catalogue reads. No catalogue management via auth alone.
    - Admin write auth is a later sprint (service role / server-side).
*/

-- ---------------------------------------------------------------------------
-- Shared: single reusable updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Public can read active categories"
  on public.categories
  for select
  to anon, authenticated
  using (active = true);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique,
  description text,
  price numeric not null,
  featured boolean not null default false,
  status text not null default 'draft',
  sku text unique,
  -- LEGACY: temporary JSON URL list still read by Home/Shop. Prefer product_images.
  images jsonb not null default '[]'::jsonb,
  -- LEGACY: non-authoritative product-level stock. Authoritative: product_variants.stock.
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_status_check check (status in ('draft', 'active', 'archived')),
  constraint products_price_check check (price >= 0),
  constraint products_stock_check check (stock >= 0)
);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_featured on public.products(featured);

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "Public can read active products"
  on public.products
  for select
  to anon, authenticated
  using (status = 'active');

-- ---------------------------------------------------------------------------
-- product_variants (authoritative inventory)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  colour text,
  stock integer not null default 0,
  active boolean not null default true,
  price_override numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_stock_check check (stock >= 0),
  constraint product_variants_price_override_check
    check (price_override is null or price_override >= 0)
);

create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_product_variants_sku on public.product_variants(sku);
create index if not exists idx_product_variants_active on public.product_variants(active);

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at
  before update on public.product_variants
  for each row
  execute function public.set_updated_at();

alter table public.product_variants enable row level security;

create policy "Public can read active variants of active products"
  on public.product_variants
  for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- product_images (long-term normalized images; external HTTPS URLs allowed)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_images_product_id on public.product_images(product_id);
create index if not exists idx_product_images_product_primary
  on public.product_images(product_id, is_primary);

drop trigger if exists set_product_images_updated_at on public.product_images;
create trigger set_product_images_updated_at
  before update on public.product_images
  for each row
  execute function public.set_updated_at();

alter table public.product_images enable row level security;

create policy "Public can read images of active products"
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- collections + collection_products
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  featured_image text,
  created_at timestamptz not null default now()
);

create index if not exists idx_collections_slug on public.collections(slug);

alter table public.collections enable row level security;

create policy "Public can read collections"
  on public.collections
  for select
  to anon, authenticated
  using (true);

create table if not exists public.collection_products (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, product_id)
);

create index if not exists idx_collection_products_collection_id
  on public.collection_products(collection_id);
create index if not exists idx_collection_products_product_id
  on public.collection_products(product_id);

alter table public.collection_products enable row level security;

create policy "Public can read collection products for active products"
  on public.collection_products
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = collection_products.product_id
        and p.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  featured_image text,
  tags text[] not null default '{}'::text[],
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_slug on public.blog_posts(slug);
create index if not exists idx_blog_posts_published on public.blog_posts(published);

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
  before update on public.blog_posts
  for each row
  execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

create policy "Public can read published blog posts"
  on public.blog_posts
  for select
  to anon, authenticated
  using (published = true);

-- ---------------------------------------------------------------------------
-- newsletter_subscribers (public INSERT only; no public SELECT)
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_newsletter_subscribers_email
  on public.newsletter_subscribers(email);

alter table public.newsletter_subscribers enable row level security;

create policy "Public can subscribe to newsletter"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (subscribed = true);

-- No public SELECT policy — subscriber emails are not exposed to clients.

-- ---------------------------------------------------------------------------
-- cart_items (future authenticated cart; locked down today)
-- Current app cart is localStorage-only. No anonymous/public access.
-- ---------------------------------------------------------------------------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null default 1,
  -- Reserved for future authenticated cart ownership (not used yet).
  user_id uuid,
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_quantity_check check (quantity > 0)
);

create index if not exists idx_cart_items_product_id on public.cart_items(product_id);
create index if not exists idx_cart_items_variant_id on public.cart_items(variant_id);
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at
  before update on public.cart_items
  for each row
  execute function public.set_updated_at();

alter table public.cart_items enable row security;
alter table public.cart_items enable row level security;

-- No policies: anon/authenticated cannot read or write cart items until
-- authenticated ownership design is introduced.

-- ---------------------------------------------------------------------------
-- Grants: least privilege for browser keys (anon + authenticated)
-- Catalogue tables: SELECT only. Writes require server/service role later.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.products from anon, authenticated;
revoke insert, update, delete on public.product_variants from anon, authenticated;
revoke insert, update, delete on public.product_images from anon, authenticated;
revoke insert, update, delete on public.collections from anon, authenticated;
revoke insert, update, delete on public.collection_products from anon, authenticated;
revoke insert, update, delete on public.blog_posts from anon, authenticated;
revoke all on public.cart_items from anon, authenticated;
revoke select, update, delete on public.newsletter_subscribers from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.collections to anon, authenticated;
grant select on public.collection_products to anon, authenticated;
grant select on public.blog_posts to anon, authenticated;
grant insert on public.newsletter_subscribers to anon, authenticated;

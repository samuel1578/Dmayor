/*
  The Proxy Shop — Phase E1: Orders foundation + checkout
  ---------------------------------------------------------------------------
  Creates the order store and the single atomic, server-authoritative checkout
  path. No payment provider, no payment verification, no admin order UI.

  New objects
    public.commerce_settings        single-row commerce config (PROVISIONAL)
    public.orders                   order header + delivery SNAPSHOT
    public.order_items              line items + product/variant SNAPSHOT
    public.order_number_seq         race-safe human-readable order numbers
    public.preview_cart_order()     read-only server-authoritative preview
    public.create_order_from_cart() atomic checkout RPC

  ---------------------------------------------------------------------------
  BUSINESS-RULE SAFETY — READ BEFORE CHANGING ANY NUMBER IN THIS FILE
  ---------------------------------------------------------------------------
  This project has NO confirmed commerce rules. The storefront previously
  displayed placeholder claims (a flat ₵50 shipping fee, "Tax (10%)",
  "Secure checkout with Paystack", "Free returns within 30 days", "Fast
  shipping across Ghana"). Those were presentation copy, NOT business rules,
  and they have been removed from the UI in this phase.

  Nothing here invents a Ghanaian tax treatment. The single config row ships
  with NEUTRAL, UNAPPLIED defaults and `rules_confirmed = false`:

    shipping_flat_fee       0     → no delivery fee is charged yet
    free_shipping_threshold null  → no free-delivery threshold is assumed
    tax_rate                0     → no tax is charged until a rate is confirmed
    prices_include_tax      true  → catalogue prices are treated as the price
                                    the customer pays; no tax is added on top
    rules_confirmed         false → the UI must disclose that these are
                                    provisional defaults

  `rules_confirmed` is a disclosure flag only — it does not change any
  calculation. Once the business answers the open questions (see SPRINT_LOG
  "Commerce Decisions / Open Questions"), set the real values and set
  rules_confirmed = true in one reviewed statement. Until then every customer
  sees the provisional notice on /checkout and pays ₵0.00 above subtotal.

  ---------------------------------------------------------------------------
  Order numbers
  ---------------------------------------------------------------------------
  `TPS-YYYY-000001`, generated from a sequence inside the checkout RPC — never
  `count(*) + 1`, never a UUID as the customer-facing reference. A sequence can
  leave gaps when a checkout transaction rolls back; that is intentional and is
  the price of being race-safe.

  ---------------------------------------------------------------------------
  Snapshots
  ---------------------------------------------------------------------------
  `orders` stores the delivery address as text columns (NOT a foreign key to
  customer_addresses) and `order_items` stores name/slug/sku/size/colour/price.
  The optional product_id / variant_id columns are `ON DELETE SET NULL` links
  for reporting only: an archived product, a deleted variant, a renamed product
  or a price change can never alter what a past order says.

  Forward migration only: previous files are never edited, and this file is
  applied manually — it is not run automatically. Safe to re-run: every
  statement is guarded/idempotent.
*/

-- ---------------------------------------------------------------------------
-- 0. Preconditions (Phase A/001 + C2/D2 + D3 foundations)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.cart_items') is null then
    raise exception 'public.cart_items was not found. Apply migration 001 first, then run this file.';
  end if;
  if to_regclass('public.cart_items') is not null
     and to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() was not found. Apply migration 001 first, then run this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. commerce_settings — ONE provisional row, server-readable only
--    Deliberately has no RLS policies and no grants: the browser can never
--    read or write it. Only the SECURITY DEFINER checkout functions read it.
-- ---------------------------------------------------------------------------
create table if not exists public.commerce_settings (
  id boolean primary key default true,
  currency text not null default 'GHS',
  shipping_flat_fee numeric(12,2) not null default 0,
  free_shipping_threshold numeric(12,2),
  tax_rate numeric(6,4) not null default 0,
  prices_include_tax boolean not null default true,
  rules_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint commerce_settings_single_row check (id),
  constraint commerce_settings_shipping_check check (shipping_flat_fee >= 0),
  constraint commerce_settings_threshold_check
    check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  constraint commerce_settings_tax_rate_check check (tax_rate >= 0 and tax_rate < 1)
);

comment on table public.commerce_settings is
  'PROVISIONAL single-row commerce config. Defaults apply no shipping fee and no tax. Rules must be confirmed by the business before rules_confirmed is set to true. Server-only: no client grants.';

insert into public.commerce_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists set_commerce_settings_updated_at on public.commerce_settings;
create trigger set_commerce_settings_updated_at
  before update on public.commerce_settings
  for each row
  execute function public.set_updated_at();

alter table public.commerce_settings enable row level security;

revoke all on public.commerce_settings from public;
revoke all on public.commerce_settings from anon;
revoke all on public.commerce_settings from authenticated;

-- ---------------------------------------------------------------------------
-- 2. order_number_seq — race-safe, gap-tolerant order numbering
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq
  as bigint
  start with 1
  increment by 1
  no cycle;

revoke all on sequence public.order_number_seq from public;
revoke all on sequence public.order_number_seq from anon;
revoke all on sequence public.order_number_seq from authenticated;

-- ---------------------------------------------------------------------------
-- 3. orders — header + delivery SNAPSHOT
--    status         : fulfilment only
--    payment_status : separate domain, never merged with status
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  subtotal numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'GHS',
  -- Delivery SNAPSHOT: copied at checkout because the saved address may later
  -- be edited or deleted. Never resolve past deliveries from customer_addresses.
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text,
  country text not null default 'Ghana',
  postal_code text,
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  constraint orders_payment_status_check
    check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  constraint orders_amounts_check
    check (
      subtotal >= 0
      and shipping_amount >= 0
      and tax_amount >= 0
      and total_amount >= 0
    ),
  -- Totals are authoritative: the header must equal the sum of its own parts.
  constraint orders_total_matches_parts_check
    check (total_amount = subtotal + shipping_amount + tax_amount)
);

comment on table public.orders is
  'Phase E1 order header. status = fulfilment, payment_status = payment (separate domains). Delivery columns are a snapshot taken at checkout. Totals are computed server-side by create_order_from_cart().';

create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

alter table public.orders enable row level security;

-- ---------------------------------------------------------------------------
-- 4. order_items — line snapshot (authoritative for historical display)
--    product_id / variant_id are optional reporting links only. ON DELETE SET
--    NULL means deleting a product or variant can never destroy order history.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  product_slug text,
  variant_sku text,
  size text,
  colour text,
  unit_price numeric(12,2) not null,
  quantity integer not null,
  line_total numeric(12,2) not null,
  image_url text,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_amounts_check check (unit_price >= 0 and line_total >= 0),
  constraint order_items_line_total_check check (line_total = round(unit_price * quantity, 2))
);

comment on table public.order_items is
  'Phase E1 order line snapshot. product_name / sku / size / colour / unit_price are authoritative for historical order display; product_id / variant_id are nullable reporting links.';

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_order_items_variant_id on public.order_items(variant_id);

alter table public.order_items enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Customer RLS — read your own orders only.
--    There are deliberately NO insert/update/delete policies: a customer can
--    never change status, change payment_status, delete an order, or create an
--    order outside the checkout RPC.
-- ---------------------------------------------------------------------------
drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
  on public.orders
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Customers can read own order items" on public.order_items;
create policy "Customers can read own order items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Grants: read-only for authenticated; nothing at all for anon.
--    Writes only ever happen inside the SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------
revoke all on public.orders from public;
revoke all on public.orders from anon;
revoke all on public.order_items from public;
revoke all on public.order_items from anon;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;

-- ---------------------------------------------------------------------------
-- 7. preview_cart_order() — read-only, server-authoritative checkout preview
--
--    Returns the cart exactly as the server will price it, plus the delivery
--    totals and a list of blockers. Used by /checkout for display AND for the
--    final revalidation before "Place Order" is enabled. SECURITY DEFINER so
--    it can price lines whose product/variant is no longer publicly readable
--    (an inactive item must surface as a blocker, never silently disappear).
-- ---------------------------------------------------------------------------
create or replace function public.preview_cart_order()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_settings public.commerce_settings%rowtype;
  v_lines jsonb := '[]'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_purchasable_qty integer := 0;
  v_issue text;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  r record;
begin
  if v_user is null then
    raise exception 'not_authenticated|Please sign in to continue to checkout.';
  end if;

  select * into v_settings from public.commerce_settings where id;
  if not found then
    raise exception 'config_missing|Checkout is not configured yet. Please try again later.';
  end if;

  for r in
    select
      c.product_id as cart_product_id,
      c.variant_id,
      c.quantity as cart_quantity,
      v.product_id,
      v.sku,
      v.size,
      v.colour,
      v.stock,
      v.active as variant_active,
      v.price_override,
      p.name as product_name,
      p.slug as product_slug,
      p.price as product_price,
      p.status as product_status,
      (
        select pi.image_url
        from public.product_images pi
        where pi.product_id = v.product_id
        order by pi.is_primary desc, pi.display_order asc, pi.created_at asc
        limit 1
      ) as image_url
    from public.cart_items c
    join public.product_variants v on v.id = c.variant_id
    left join public.products p on p.id = v.product_id
    where c.user_id = v_user
    order by v.id
  loop
    v_issue := null;

    if r.product_name is null or r.product_status is distinct from 'active' then
      v_issue := 'This product is no longer available.';
    elsif r.variant_active is not true then
      v_issue := 'This option is no longer available.';
    elsif r.product_id is distinct from r.cart_product_id then
      v_issue := 'This line no longer matches the saved option. Please re-add it from the product page.';
    elsif r.stock < r.cart_quantity then
      if r.stock > 0 then
        v_issue := 'Only ' || r.stock || ' left in stock.';
      else
        v_issue := 'Out of stock.';
      end if;
    end if;

    if v_issue is null then
      v_unit_price := round(coalesce(r.price_override, r.product_price), 2);
      v_line_total := round(v_unit_price * r.cart_quantity, 2);
      v_subtotal := v_subtotal + v_line_total;
      v_purchasable_qty := v_purchasable_qty + r.cart_quantity;
    else
      v_unit_price := round(coalesce(r.price_override, r.product_price, 0), 2);
      v_line_total := round(v_unit_price * r.cart_quantity, 2);
      v_blockers := v_blockers || to_jsonb(
        coalesce(r.product_name, 'An item in your cart') || ' — ' || v_issue
      );
    end if;

    v_lines := v_lines || jsonb_build_object(
      'productId', r.product_id,
      'variantId', r.variant_id,
      'productName', coalesce(r.product_name, 'Item'),
      'productSlug', r.product_slug,
      'variantSku', r.sku,
      'size', r.size,
      'colour', r.colour,
      'unitPrice', v_unit_price,
      'quantity', r.cart_quantity,
      'lineTotal', v_line_total,
      'imageUrl', r.image_url,
      'issue', v_issue,
      'purchasable', v_issue is null
    );
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    v_blockers := v_blockers || to_jsonb('Your cart is empty.'::text);
  end if;

  -- Delivery rules come from the single provisional config row (see the
  -- BUSINESS-RULE SAFETY note at the top of this file).
  if v_subtotal > 0 then
    v_shipping := case
      when v_settings.shipping_flat_fee <= 0 then 0
      when v_settings.free_shipping_threshold is not null
           and v_subtotal >= v_settings.free_shipping_threshold then 0
      else round(v_settings.shipping_flat_fee, 2)
    end;
    v_tax := case
      when v_settings.prices_include_tax then 0
      else round(v_subtotal * v_settings.tax_rate, 2)
    end;
  end if;

  return jsonb_build_object(
    'currency', v_settings.currency,
    'settings', jsonb_build_object(
      'shippingFlatFee', v_settings.shipping_flat_fee,
      'freeShippingThreshold', v_settings.free_shipping_threshold,
      'taxRate', v_settings.tax_rate,
      'pricesIncludeTax', v_settings.prices_include_tax,
      'rulesConfirmed', v_settings.rules_confirmed
    ),
    'lines', v_lines,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'tax', v_tax,
    'total', v_subtotal + v_shipping + v_tax,
    'purchasableQuantity', v_purchasable_qty,
    'blockers', v_blockers
  );
end $$;

-- ---------------------------------------------------------------------------
-- 8. create_order_from_cart() — the ONLY way a customer creates an order
--
--    Atomic: one transaction, all-or-nothing. If anything fails, nothing is
--    written, no stock moves and the cart is untouched.
--
--      1. require an authenticated caller (auth.uid())
--      2. load the caller's persisted cart
--      3. verify every product is active
--      4. verify every variant is active
--      5. verify the variant belongs to the cart line's product
--      6. verify stock >= requested quantity
--      7. resolve the CURRENT effective price (variant override, else product)
--      8. calculate the subtotal server-side
--      9. calculate shipping / tax from the confirmed config
--     10. snapshot the selected delivery address (must be owned by the caller)
--     11. create the order + order_items
--     12. decrement variant stock (row-locked, never below zero)
--     13. sync legacy products.stock for Admin compatibility
--     14. clear the caller's cart
--     15. return the order id + human-readable order number
--
--    No browser-supplied price, stock, total, status or payment_status is ever
--    read. Locking: cart lines are locked FOR UPDATE on their variant row, in
--    variant-id order, so two customers racing for the last unit serialise and
--    the loser is rejected with insufficient_stock instead of overselling.
--
--    Error contract (PostgREST returns message verbatim):
--      '<code>|<human sentence>'  — codes: not_authenticated, config_missing,
--      address_required, note_too_long, cart_empty, product_unavailable,
--      variant_unavailable, variant_product_mismatch, insufficient_stock
-- ---------------------------------------------------------------------------
create or replace function public.create_order_from_cart(
  p_address_id uuid,
  p_customer_note text default null
)
returns table (
  order_id uuid,
  order_number text,
  status text,
  payment_status text,
  subtotal numeric,
  shipping_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_address public.customer_addresses%rowtype;
  v_settings public.commerce_settings%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_lines jsonb := '[]'::jsonb;
  v_product_ids uuid[] := '{}'::uuid[];
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_line_count integer := 0;
  v_note text;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  r record;
begin
  -- 1. Authenticated caller only.
  if v_user is null then
    raise exception 'not_authenticated|Please sign in to place an order.';
  end if;

  select * into v_settings from public.commerce_settings where id;
  if not found then
    raise exception 'config_missing|Checkout is not configured yet. Please try again later.';
  end if;

  -- 10a. The delivery address must be one of the caller's own saved addresses.
  if p_address_id is null then
    raise exception 'address_required|Choose a delivery address.';
  end if;

  select * into v_address
  from public.customer_addresses
  where id = p_address_id
    and user_id = v_user;

  if not found then
    raise exception 'address_required|That delivery address is no longer available. Please choose another.';
  end if;

  v_note := nullif(btrim(coalesce(p_customer_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note_too_long|Order notes must be 500 characters or fewer.';
  end if;

  -- 2–8. Lock, validate and price every cart line. FOR UPDATE OF v serialises
  -- concurrent checkouts on the same variant so the last unit cannot be sold
  -- twice. Nothing has been written yet.
  for r in
    select
      c.product_id as cart_product_id,
      c.variant_id,
      c.quantity as cart_quantity,
      v.product_id,
      v.sku,
      v.size,
      v.colour,
      v.stock,
      v.active as variant_active,
      v.price_override,
      p.name as product_name,
      p.slug as product_slug,
      p.price as product_price,
      p.status as product_status,
      (
        select pi.image_url
        from public.product_images pi
        where pi.product_id = v.product_id
        order by pi.is_primary desc, pi.display_order asc, pi.created_at asc
        limit 1
      ) as image_url
    from public.cart_items c
    join public.product_variants v on v.id = c.variant_id
    left join public.products p on p.id = v.product_id
    where c.user_id = v_user
    order by v.id
    for update of v
  loop
    -- 3. Product must exist and be active.
    if r.product_name is null or r.product_status is distinct from 'active' then
      raise exception 'product_unavailable|% is no longer available.',
        coalesce(r.product_name, 'An item in your cart');
    end if;

    -- 4. Variant must be active.
    if r.variant_active is not true then
      raise exception 'variant_unavailable|The selected option of % is no longer available.', r.product_name;
    end if;

    -- 5. The variant must belong to the cart line's product.
    if r.product_id is distinct from r.cart_product_id then
      raise exception 'variant_product_mismatch|An item in your cart changed and no longer matches the saved option. Please review your cart.';
    end if;

    -- 6. Stock must cover the requested quantity (row is locked above).
    if r.stock < r.cart_quantity then
      raise exception 'insufficient_stock|Only % left of % — your cart asks for %.',
        r.stock, r.product_name, r.cart_quantity;
    end if;

    -- 7. Current effective price, resolved server-side.
    v_unit_price := round(coalesce(r.price_override, r.product_price), 2);
    v_line_total := round(v_unit_price * r.cart_quantity, 2);

    v_line_count := v_line_count + 1;
    v_subtotal := v_subtotal + v_line_total;
    v_product_ids := array_append(v_product_ids, r.product_id);

    v_lines := v_lines || jsonb_build_object(
      'product_id', r.product_id,
      'variant_id', r.variant_id,
      'product_name', r.product_name,
      'product_slug', r.product_slug,
      'variant_sku', r.sku,
      'size', r.size,
      'colour', r.colour,
      'unit_price', v_unit_price,
      'quantity', r.cart_quantity,
      'line_total', v_line_total,
      'image_url', r.image_url
    );
  end loop;

  if v_line_count = 0 then
    raise exception 'cart_empty|Your cart is empty.';
  end if;

  -- 9. Delivery rules from the single provisional config row.
  v_shipping := case
    when v_settings.shipping_flat_fee <= 0 then 0
    when v_settings.free_shipping_threshold is not null
         and v_subtotal >= v_settings.free_shipping_threshold then 0
    else round(v_settings.shipping_flat_fee, 2)
  end;

  v_tax := case
    when v_settings.prices_include_tax then 0
    else round(v_subtotal * v_settings.tax_rate, 2)
  end;

  v_total := v_subtotal + v_shipping + v_tax;

  -- Human-readable, race-safe order number (gaps are possible on rollback).
  v_order_number :=
    'TPS-'
    || to_char((now() at time zone 'UTC'), 'YYYY')
    || '-'
    || lpad(nextval('public.order_number_seq')::text, 6, '0');

  -- 11a. Order header, with the delivery SNAPSHOT and server-computed totals.
  -- payment_status intentionally stays 'unpaid' — there is no payment path in E1.
  insert into public.orders (
    id,
    order_number,
    user_id,
    status,
    payment_status,
    subtotal,
    shipping_amount,
    tax_amount,
    total_amount,
    currency,
    recipient_name,
    phone,
    address_line1,
    address_line2,
    city,
    region,
    country,
    postal_code,
    customer_note
  )
  values (
    v_order_id,
    v_order_number,
    v_user,
    'pending',
    'unpaid',
    v_subtotal,
    v_shipping,
    v_tax,
    v_total,
    v_settings.currency,
    v_address.recipient_name,
    v_address.phone,
    v_address.address_line1,
    v_address.address_line2,
    v_address.city,
    v_address.region,
    v_address.country,
    v_address.postal_code,
    v_note
  );

  -- 11b. Order lines, from the snapshot values validated above.
  insert into public.order_items (
    order_id,
    product_id,
    variant_id,
    product_name,
    product_slug,
    variant_sku,
    size,
    colour,
    unit_price,
    quantity,
    line_total,
    image_url
  )
  select
    v_order_id,
    nullif(l ->> 'product_id', '')::uuid,
    nullif(l ->> 'variant_id', '')::uuid,
    l ->> 'product_name',
    l ->> 'product_slug',
    l ->> 'variant_sku',
    l ->> 'size',
    l ->> 'colour',
    (l ->> 'unit_price')::numeric,
    (l ->> 'quantity')::integer,
    (l ->> 'line_total')::numeric,
    l ->> 'image_url'
  from jsonb_array_elements(v_lines) as l;

  -- 12. Decrement authoritative inventory. Rows are already locked, and the
  --     product_variants_stock_check (stock >= 0) constraint is the last guard.
  update public.product_variants v
  set stock = v.stock - x.quantity
  from (
    select
      (l ->> 'variant_id')::uuid as variant_id,
      (l ->> 'quantity')::integer as quantity
    from jsonb_array_elements(v_lines) as l
  ) x
  where v.id = x.variant_id;

  -- 13. Legacy Admin compatibility only: products.stock is NOT authoritative.
  --     It is re-derived from active variant stock after the decrement.
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
  where p.id = any (v_product_ids);

  -- 14. Clear the cart — reached only after the order exists and stock moved.
  delete from public.cart_items where user_id = v_user;

  -- 15. Return the created order.
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
    o.currency
  from public.orders o
  where o.id = v_order_id;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Function grants: authenticated customers only, never anon/PUBLIC.
-- ---------------------------------------------------------------------------
revoke all on function public.preview_cart_order() from public;
revoke all on function public.preview_cart_order() from anon;
revoke all on function public.create_order_from_cart(uuid, text) from public;
revoke all on function public.create_order_from_cart(uuid, text) from anon;

grant execute on function public.preview_cart_order() to authenticated;
grant execute on function public.create_order_from_cart(uuid, text) to authenticated;

-- Ask PostgREST to pick up the new tables/functions immediately (Supabase
-- normally does this itself; this makes a freshly applied migration reliable).
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 10. Confirmation notice
-- ---------------------------------------------------------------------------
do $$
declare
  confirmed boolean;
begin
  select rules_confirmed into confirmed from public.commerce_settings where id;

  raise notice 'Phase E1 orders foundation applied. commerce_settings.rules_confirmed = % — no shipping fee and no tax are applied until the business confirms the rules.', confirmed;
end $$;

/*
  The Proxy Shop — seed real catalogue categories only

  Categories:
    Shirts, Trousers, Hoodies, Shoes

  No demo products, collections, or blog posts.
  New products must be created later with status = 'draft' until ready to publish.
*/

insert into public.categories (name, slug, description, icon_name, active)
values
  ('Shirts', 'shirts', 'Classic and modern shirts for every occasion', 'shirt', true),
  ('Trousers', 'trousers', 'Formal and casual trousers', 'pants', true),
  ('Hoodies', 'hoodies', 'Comfortable hoodies in various styles', 'shirt', true),
  ('Shoes', 'shoes', 'Footwear that finishes the fit', 'shoe', true)
on conflict (slug) do nothing;

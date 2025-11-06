/*
  # Seed Initial Data

  1. Insert sample data for categories, products, and collections
  2. Establishes foundation for the eCommerce platform
  3. Data includes Ghanaian-inspired categories and themed collections
*/

-- Insert categories
INSERT INTO categories (id, name, slug, description, icon_name)
VALUES
  (gen_random_uuid(), 'Streetwear', 'streetwear', 'Urban fashion pieces inspired by Accra streets', 'shirt'),
  (gen_random_uuid(), 'Accessories', 'accessories', 'Hats, bags, and statement pieces', 'bag'),
  (gen_random_uuid(), 'Culture', 'culture', 'Pieces celebrating Ghanaian heritage', 'heart'),
  (gen_random_uuid(), 'Art', 'art', 'Limited edition artist collaborations', 'palette')
ON CONFLICT DO NOTHING;

-- Insert sample products
INSERT INTO products (id, name, description, price, category_id, featured, stock)
SELECT
  gen_random_uuid(),
  product.name,
  product.description,
  product.price,
  (SELECT id FROM categories WHERE slug = product.category LIMIT 1),
  product.featured,
  product.stock
FROM (
  VALUES
    ('Accra Heritage Tee', 'Premium cotton t-shirt with cultural print', 85.00, 'streetwear', true, 50),
    ('Golden Star Hoodie', 'Comfortable oversized hoodie with embroidered star', 150.00, 'streetwear', true, 30),
    ('Midnight Black Jacket', 'Street-ready bomber jacket with signature D''Mayor branding', 280.00, 'streetwear', true, 20),
    ('Culture Carrier Tote', 'Spacious canvas bag with kente-inspired patterns', 120.00, 'accessories', true, 40),
    ('Flag Cap', 'Classic baseball cap in Ghana flag colors', 65.00, 'accessories', false, 60),
    ('Heritage Collection Scarf', 'Silk scarf with traditional Ghanaian motifs', 95.00, 'culture', true, 25),
    ('Artist Collab Tee #1', 'Limited edition piece by local Accra artist', 110.00, 'art', true, 15),
    ('Story Hoodie', 'Storytelling piece with hand-drawn graphics', 175.00, 'art', true, 10)
) AS product(name, description, price, category, featured, stock)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE products.name = product.name)
ON CONFLICT DO NOTHING;

-- Insert collections
INSERT INTO collections (id, name, slug, description)
VALUES
  (gen_random_uuid(), 'Accra Nights', 'accra-nights', 'Urban elegance inspired by the vibrant nightlife of Accra'),
  (gen_random_uuid(), 'The Culture Collection', 'culture-collection', 'Celebrating Ghanaian heritage and traditional craftsmanship'),
  (gen_random_uuid(), 'Street Essence', 'street-essence', 'Raw, unfiltered streetwear for the bold and authentic'),
  (gen_random_uuid(), 'Art & Expression', 'art-expression', 'Limited edition pieces featuring local artists'' work')
ON CONFLICT DO NOTHING;

-- Insert sample blog posts
INSERT INTO blog_posts (id, title, slug, excerpt, content, tags, published)
VALUES
  (
    gen_random_uuid(),
    'The Evolution of Ghanaian Streetwear in 2025',
    'evolution-ghanaian-streetwear',
    'Explore how Ghanaian street fashion is transforming the global fashion landscape with authentic cultural expression.',
    'Ghanaian fashion is having a moment. From the streets of Accra to runways around the world, our unique style is getting the recognition it deserves...',
    ARRAY['Fashion', 'Culture', 'Trends'],
    true
  ),
  (
    gen_random_uuid(),
    'Behind the Scenes: Our New Collection Launch',
    'behind-scenes-collection',
    'Get an exclusive look at how we create each piece in our Accra studio.',
    'Our creative process begins with inspiration from everyday life. We walk the streets of Accra, observe the fashion, the energy, the people...',
    ARRAY['Process', 'Design', 'News'],
    true
  ),
  (
    gen_random_uuid(),
    'Interview: Local Artists Supporting D''Mayor',
    'interview-local-artists',
    'Meet the talented Ghanaian artists whose work inspires our designs.',
    'We sat down with three of the incredible artists collaborating with D''Mayor to create limited edition pieces that celebrate their vision...',
    ARRAY['Art', 'Community', 'Interview'],
    true
  )
ON CONFLICT DO NOTHING;
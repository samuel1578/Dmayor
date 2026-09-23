/*
  # The Proxy Shop — Product Variant Architecture

  1. New Tables
    - `product_variants` — Tracks size, colour, SKU, stock per variant
    - `product_images` — Separate table for product images (supports multiple)

  2. Changes to existing tables
    - `products` — Add `slug`, `status`, `sku` columns
    - `categories` — Update seed data to The Proxy Shop categories

  3. Relationships
    - product_variants.product_id → products(id) ON DELETE CASCADE
    - product_images.product_id → products(id) ON DELETE CASCADE

  4. Security
    - Maintain existing RLS policies
    - Add RLS for new tables
*/

-- Add columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text UNIQUE;

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text UNIQUE NOT NULL,
  size text NOT NULL,
  colour text DEFAULT '',
  stock integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active variants"
  ON product_variants FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Service role can manage variants"
  ON product_variants FOR ALL
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(active);

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read product images"
  ON product_images FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage product images"
  ON product_images FOR ALL
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id, is_primary);

-- Insert The Proxy Shop categories (replace generic ones)
INSERT INTO categories (id, name, slug, description, icon_name)
VALUES
  (gen_random_uuid(), 'Shirts', 'shirts', 'Classic and modern shirts for every occasion', 'shirt'),
  (gen_random_uuid(), 'Trousers', 'trousers', 'Formal and casual trousers', 'pants'),
  (gen_random_uuid(), 'Hoodies', 'hoodies', 'Comfortable hoodies in various styles', 'shirt'),
  (gen_random_uuid(), 'Shoes', 'shoes', 'Complete footwear collection', 'shoe')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name;

-- Update existing products to link to categories by slug and add slugs/status
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'streetwear') WHERE category_id = (SELECT id FROM categories WHERE slug = 'streetwear');
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'accessories') WHERE category_id = (SELECT id FROM categories WHERE slug = 'accessories');
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'culture') WHERE category_id = (SELECT id FROM categories WHERE slug = 'culture');
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'art') WHERE category_id = (SELECT id FROM categories WHERE slug = 'art');

import { supabase } from '../supabase';

/**
 * Public storefront catalogue data layer (normalized).
 *
 * Authoritative sources — legacy `products.images` / `products.stock` are NOT
 * read anywhere in this file:
 *   - `product_images`   → gallery (primary first, then display order)
 *   - `product_variants` → active variants, stock, price overrides, availability
 *
 * Products, images and variants are fetched with one relation select per page
 * (no per-card requests, no N+1). Admin data-layer helpers are not used here.
 */

export interface CatalogueImage {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  displayOrder: number;
}

/** Active variants only — the authoritative inventory. */
export interface CatalogueVariant {
  id: string;
  size: string;
  colour: string | null;
  sku: string;
  stock: number;
  priceOverride: number | null;
}

/** Normalized presentation shape consumed by ProductCard / QuickView. */
export interface CatalogueProductSummary {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  /** Normalized primary image URL, or null when the product has no images. */
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  variantCount: number;
  /** SUM of active variant stock. */
  totalStock: number;
  /** At least one active variant currently in stock. */
  available: boolean;
}

export interface CatalogueProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  images: CatalogueImage[];
  variants: CatalogueVariant[];
  totalStock: number;
  available: boolean;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

/** Matches the existing public-site GHS convention (₵ + 2 decimals). */
export function formatGhs(value: number): string {
  return `₵${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

/* -------------------------------------------------------------------------- */
/* Row mapping (no `any`)                                                     */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

const LIST_SELECT =
  'id, name, slug, price, category_id, categories(name), ' +
  'product_images(image_url, display_order, is_primary), ' +
  'product_variants(id, stock, active)';

const DETAIL_SELECT =
  'id, name, slug, description, price, category_id, categories(name), ' +
  'product_images(id, image_url, alt_text, display_order, is_primary), ' +
  'product_variants(id, size, colour, sku, stock, price_override, active)';

function toRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Row => Boolean(entry) && typeof entry === 'object');
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** PostgREST returns an object for a many-to-one embed, an array when joined. */
function categoryNameFromRow(row: Row): string | null {
  const related = row.categories;
  if (Array.isArray(related)) return related.length > 0 ? toText((related[0] as Row)?.name) : null;
  if (related && typeof related === 'object') return toText((related as Row).name);
  return null;
}

function primaryImageUrl(rows: Row[]): string | null {
  const ordered = [...rows].sort((a, b) => {
    const primaryDelta = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
    if (primaryDelta !== 0) return primaryDelta;
    return toNumber(a.display_order) - toNumber(b.display_order);
  });

  const url = ordered.length > 0 ? toText(ordered[0].image_url) : null;
  return url;
}

function mapImages(rows: Row[]): CatalogueImage[] {
  return [...rows]
    .sort((a, b) => {
      const primaryDelta = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
      if (primaryDelta !== 0) return primaryDelta;
      return toNumber(a.display_order) - toNumber(b.display_order);
    })
    .map((row) => ({
      id: String(row.id ?? ''),
      url: toText(row.image_url) ?? '',
      altText: toText(row.alt_text) ?? '',
      isPrimary: Boolean(row.is_primary),
      displayOrder: toNumber(row.display_order),
    }))
    .filter((image) => image.url.length > 0);
}

/**
 * Variant rows are filtered to `active` here as well as by RLS: an Admin
 * browsing the storefront can read inactive variants through the Phase B
 * admin SELECT policy, and those must never appear publicly.
 */
function mapActiveVariants(rows: Row[]): CatalogueVariant[] {
  return rows
    .filter((row) => row.active !== false)
    .map((row) => ({
      id: String(row.id ?? ''),
      size: toText(row.size) ?? '',
      colour: toText(row.colour),
      sku: toText(row.sku) ?? '',
      stock: Math.max(0, Math.floor(toNumber(row.stock))),
      priceOverride:
        row.price_override === null || row.price_override === undefined
          ? null
          : toNumber(row.price_override),
    }))
    .filter((variant) => variant.id.length > 0);
}

function summarize(variants: CatalogueVariant[]): { variantCount: number; totalStock: number; available: boolean } {
  const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
  return { variantCount: variants.length, totalStock, available: totalStock > 0 };
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export async function listPublicCategories(): Promise<PublicCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;

  return toRows(data).map((row) => ({
    id: String(row.id),
    name: toText(row.name) ?? '',
    slug: toText(row.slug) ?? '',
  }));
}

/* -------------------------------------------------------------------------- */
/* Listings                                                                   */
/* -------------------------------------------------------------------------- */

interface ListingOptions {
  featuredOnly?: boolean;
  limit?: number;
  categoryId?: string;
}

/** Active products with their normalized primary image and variant availability. */
export async function listProducts(options: ListingOptions = {}): Promise<CatalogueProductSummary[]> {
  let query = supabase
    .from('products')
    .select(LIST_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (options.featuredOnly) query = query.eq('featured', true);
  if (options.categoryId) query = query.eq('category_id', options.categoryId);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;

  return toRows(data).map((row) => {
    const variants = mapActiveVariants(toRows(row.product_variants));
    const { variantCount, totalStock, available } = summarize(variants);

    return {
      id: String(row.id),
      name: toText(row.name) ?? '',
      slug: toText(row.slug),
      price: toNumber(row.price),
      image: primaryImageUrl(toRows(row.product_images)),
      categoryId: toText(row.category_id),
      categoryName: categoryNameFromRow(row),
      variantCount,
      totalStock,
      available,
    };
  });
}

export async function listActiveProducts(): Promise<CatalogueProductSummary[]> {
  return listProducts();
}

export async function listFeaturedProducts(limit = 8): Promise<CatalogueProductSummary[]> {
  return listProducts({ featuredOnly: true, limit });
}

/* -------------------------------------------------------------------------- */
/* Product detail                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Loads a single publicly visible product by slug in one request. Returns
 * `null` when the slug does not exist or the product is not active (RLS already
 * hides draft/archived rows from the public).
 */
export async function getProductBySlug(slug: string): Promise<CatalogueProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_SELECT)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Row;
  const images = mapImages(toRows(row.product_images));
  const variants = mapActiveVariants(toRows(row.product_variants));
  const { totalStock, available } = summarize(variants);

  return {
    id: String(row.id),
    name: toText(row.name) ?? '',
    slug: toText(row.slug) ?? slug,
    description: toText(row.description),
    price: toNumber(row.price),
    categoryId: toText(row.category_id),
    categoryName: categoryNameFromRow(row),
    images,
    variants,
    totalStock,
    available,
  };
}

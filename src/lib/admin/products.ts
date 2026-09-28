import { supabase } from '../supabase';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
}

export interface AdminProductRecord {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price: number;
  status: ProductStatus;
  featured: boolean;
  sku: string | null;
  categoryId: string | null;
  /** Legacy compatibility array — kept in sync from product_images. */
  images: string[];
  /** Legacy compatibility stock — authoritative value is product_variants.stock. */
  stock: number;
  updatedAt: string;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  status: ProductStatus;
  featured: boolean;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  updatedAt: string;
  /** SUM(active variant stock) — 0 when the product has no variants yet. */
  totalStock: number;
  variantCount: number;
  activeVariantCount: number;
  imageUrl: string | null;
  imageCount: number;
}

/** Editable image row. `id === null` means "not persisted yet". */
export interface ImageDraft {
  id: string | null;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
}

/**
 * Editable variant row. Numeric fields are held as strings so the Admin can
 * clear an input while editing; they are validated and converted on save.
 */
export interface VariantDraft {
  id: string | null;
  size: string;
  colour: string;
  sku: string;
  stock: string;
  priceOverride: string;
  active: boolean;
}

export interface ProductGeneralInput {
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  price: number;
  sku: string | null;
  featured: boolean;
  status: ProductStatus;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

export interface ProductEditorData {
  product: AdminProductRecord;
  images: ImageDraft[];
  variants: VariantDraft[];
}

/* -------------------------------------------------------------------------- */
/* Mapping helpers                                                            */
/* -------------------------------------------------------------------------- */

export function parseLegacyImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function mapProduct(row: Record<string, unknown>): AdminProductRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: (row.slug as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    price: Number(row.price ?? 0),
    status: (row.status as ProductStatus) ?? 'draft',
    featured: Boolean(row.featured),
    sku: (row.sku as string | null) ?? null,
    categoryId: (row.category_id as string | null) ?? null,
    images: parseLegacyImages(row.images),
    stock: Number(row.stock ?? 0),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export async function listProducts(): Promise<AdminProductListItem[]> {
  const [productsRes, categoriesRes, variantsRes, imagesRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, slug, price, status, featured, sku, category_id, images, stock, updated_at')
      .order('updated_at', { ascending: false }),
    supabase.from('categories').select('id, name, slug, description, active'),
    supabase.from('product_variants').select('id, product_id, stock, active'),
    supabase
      .from('product_images')
      .select('id, product_id, image_url, display_order, is_primary')
      .order('display_order', { ascending: true }),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (variantsRes.error) throw variantsRes.error;
  if (imagesRes.error) throw imagesRes.error;

  const categoryNames = new Map<string, string>(
    (categoriesRes.data ?? []).map((c) => [String(c.id), String(c.name)]),
  );

  const variantStats = new Map<string, { total: number; active: number; stock: number }>();
  for (const variant of variantsRes.data ?? []) {
    const productId = String(variant.product_id);
    const stats = variantStats.get(productId) ?? { total: 0, active: 0, stock: 0 };
    stats.total += 1;
    if (variant.active) {
      stats.active += 1;
      stats.stock += Number(variant.stock ?? 0);
    }
    variantStats.set(productId, stats);
  }

  const imageStats = new Map<string, { count: number; primary: string | null; first: string | null }>();
  for (const image of imagesRes.data ?? []) {
    const productId = String(image.product_id);
    const stats = imageStats.get(productId) ?? { count: 0, primary: null, first: null };
    stats.count += 1;
    if (!stats.first) stats.first = String(image.image_url);
    if (image.is_primary) stats.primary = String(image.image_url);
    imageStats.set(productId, stats);
  }

  return (productsRes.data ?? []).map((row) => {
    const productId = String(row.id);
    const legacyImages = parseLegacyImages(row.images);
    const stats = variantStats.get(productId) ?? { total: 0, active: 0, stock: 0 };
    const images = imageStats.get(productId) ?? { count: 0, primary: null, first: null };

    return {
      id: productId,
      name: String(row.name ?? ''),
      slug: (row.slug as string | null) ?? null,
      price: Number(row.price ?? 0),
      status: (row.status as ProductStatus) ?? 'draft',
      featured: Boolean(row.featured),
      sku: (row.sku as string | null) ?? null,
      categoryId: (row.category_id as string | null) ?? null,
      categoryName: row.category_id ? categoryNames.get(String(row.category_id)) ?? null : null,
      updatedAt: String(row.updated_at ?? ''),
      totalStock: stats.total === 0 ? 0 : stats.stock,
      variantCount: stats.total,
      activeVariantCount: stats.active,
      imageUrl: images.primary ?? images.first ?? legacyImages[0] ?? null,
      imageCount: images.count || legacyImages.length,
    };
  });
}

export async function getProduct(id: string): Promise<AdminProductRecord | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, slug, description, price, status, featured, sku, category_id, images, stock, updated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProduct(data) : null;
}

export async function listProductImages(productId: string): Promise<ImageDraft[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, image_url, alt_text, display_order, is_primary')
    .eq('product_id', productId)
    .order('display_order', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    imageUrl: String(row.image_url ?? ''),
    altText: (row.alt_text as string | null) ?? '',
    isPrimary: Boolean(row.is_primary),
  }));
}

export async function listProductVariants(productId: string): Promise<VariantDraft[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, size, colour, sku, stock, price_override, active')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    size: String(row.size ?? ''),
    colour: (row.colour as string | null) ?? '',
    sku: String(row.sku ?? ''),
    stock: String(row.stock ?? 0),
    priceOverride: row.price_override === null || row.price_override === undefined
      ? ''
      : String(row.price_override),
    active: Boolean(row.active),
  }));
}

export async function loadProductEditor(id: string): Promise<ProductEditorData | null> {
  const [product, images, variants] = await Promise.all([
    getProduct(id),
    listProductImages(id),
    listProductVariants(id),
  ]);

  if (!product) return null;
  return { product, images, variants };
}

export async function createProduct(input: ProductGeneralInput): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      slug: input.slug || null,
      description: input.description || null,
      category_id: input.categoryId,
      price: input.price,
      sku: input.sku,
      featured: input.featured,
      status: input.status,
    })
    .select('id')
    .single();

  if (error) throw error;
  return String(data.id);
}

export async function updateProduct(id: string, input: ProductGeneralInput): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      name: input.name,
      slug: input.slug || null,
      description: input.description || null,
      category_id: input.categoryId,
      price: input.price,
      sku: input.sku,
      featured: input.featured,
      status: input.status,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<void> {
  const { error } = await supabase.from('products').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function setProductFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from('products').update({ featured }).eq('id', id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Persists the image list with clearly sequenced mutations:
 *   1. delete rows removed in the editor
 *   2. clear the current primary flag
 *   3. update existing / insert new rows (ordered, never primary yet)
 *   4. promote exactly one primary image
 *   5. sync the legacy products.images array
 *
 * The clear-then-set sequence avoids transient duplicate primaries, which the
 * uq_product_images_one_primary index also guards against.
 */
export async function saveProductImages(
  productId: string,
  drafts: ImageDraft[],
): Promise<ImageDraft[]> {
  const ordered = drafts
    .map((draft) => ({ ...draft, imageUrl: draft.imageUrl.trim() }))
    .filter((draft) => draft.imageUrl.length > 0);

  const { data: existingRows, error: existingError } = await supabase
    .from('product_images')
    .select('id')
    .eq('product_id', productId);

  if (existingError) throw existingError;

  const keptIds = new Set(ordered.map((draft) => draft.id).filter(Boolean) as string[]);
  const removedIds = (existingRows ?? [])
    .map((row) => String(row.id))
    .filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase.from('product_images').delete().in('id', removedIds);
    if (error) throw error;
  }

  const { error: clearPrimaryError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true);

  if (clearPrimaryError) throw clearPrimaryError;

  const saved: ImageDraft[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const draft = ordered[index];
    const payload = {
      product_id: productId,
      image_url: draft.imageUrl,
      alt_text: draft.altText.trim() ? draft.altText.trim() : null,
      display_order: index,
      is_primary: false,
    };

    if (draft.id) {
      const { error } = await supabase.from('product_images').update(payload).eq('id', draft.id);
      if (error) throw error;
      saved.push({ ...draft, altText: payload.alt_text ?? '' });
      continue;
    }

    const { data, error } = await supabase
      .from('product_images')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    saved.push({ ...draft, id: String(data.id), altText: payload.alt_text ?? '' });
  }

  // Exactly one primary image: the Admin's choice, otherwise the first image.
  if (saved.length > 0) {
    const primaryIndex = Math.max(
      saved.findIndex((draft) => draft.isPrimary),
      0,
    );

    const { error } = await supabase
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', saved[primaryIndex].id as string);

    if (error) throw error;
  }

  const withPrimary = saved.map((draft, index) => ({
    ...draft,
    isPrimary: saved.length > 0 && index === Math.max(saved.findIndex((d) => d.isPrimary), 0),
  }));

  await syncLegacyImages(productId, withPrimary);

  return withPrimary;
}

/**
 * Legacy compatibility: the public storefront still reads products.images.
 * Written as [primary, ...remaining in display order] because the storefront
 * uses the first entry as the product card image.
 */
async function syncLegacyImages(productId: string, images: ImageDraft[]): Promise<void> {
  const ordered = images
    .map((image, index) => ({ image, index }))
    .sort((a, b) => Number(b.image.isPrimary) - Number(a.image.isPrimary) || a.index - b.index)
    .map((entry) => entry.image.imageUrl);

  const { error } = await supabase.from('products').update({ images: ordered }).eq('id', productId);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                   */
/* -------------------------------------------------------------------------- */

export interface SaveVariantsResult {
  variants: VariantDraft[];
  totalStock: number;
}

/**
 * Persists variants, then syncs the legacy products.stock column to
 * SUM(active variant stock). product_variants.stock stays authoritative.
 */
export async function saveProductVariants(
  productId: string,
  drafts: VariantDraft[],
): Promise<SaveVariantsResult> {
  const { data: existingRows, error: existingError } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId);

  if (existingError) throw existingError;

  const keptIds = new Set(drafts.map((draft) => draft.id).filter(Boolean) as string[]);
  const removedIds = (existingRows ?? [])
    .map((row) => String(row.id))
    .filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase.from('product_variants').delete().in('id', removedIds);
    if (error) throw error;
  }

  const saved: VariantDraft[] = [];

  for (const draft of drafts) {
    const stock = Number(draft.stock || 0);
    const payload = {
      product_id: productId,
      size: draft.size.trim(),
      colour: draft.colour.trim() ? draft.colour.trim() : null,
      sku: draft.sku.trim(),
      stock,
      price_override: draft.priceOverride.trim() ? Number(draft.priceOverride) : null,
      active: draft.active,
    };

    if (draft.id) {
      const { error } = await supabase.from('product_variants').update(payload).eq('id', draft.id);
      if (error) throw error;
      saved.push(mapVariantPayload(draft.id, payload));
      continue;
    }

    const { data, error } = await supabase
      .from('product_variants')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    saved.push(mapVariantPayload(String(data.id), payload));
  }

  const totalStock = saved.reduce(
    (sum, variant) => sum + (variant.active ? Number(variant.stock || 0) : 0),
    0,
  );

  const { error: syncError } = await supabase
    .from('products')
    .update({ stock: totalStock })
    .eq('id', productId);

  if (syncError) throw syncError;

  return { variants: saved, totalStock };
}

function mapVariantPayload(
  id: string,
  payload: {
    size: string;
    colour: string | null;
    sku: string;
    stock: number;
    price_override: number | null;
    active: boolean;
  },
): VariantDraft {
  return {
    id,
    size: payload.size,
    colour: payload.colour ?? '',
    sku: payload.sku,
    stock: String(payload.stock),
    priceOverride: payload.price_override === null ? '' : String(payload.price_override),
    active: payload.active,
  };
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export async function listCategories(): Promise<CategoryRecord[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, active')
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    description: (row.description as string | null) ?? null,
    active: Boolean(row.active),
  }));
}

/** Product counts per category — used on the categories screen only. */
export async function countProductsByCategory(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('products').select('category_id');
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const categoryId = row.category_id as string | null;
    if (!categoryId) continue;
    counts[categoryId] = (counts[categoryId] ?? 0) + 1;
  }
  return counts;
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await supabase.from('categories').insert({
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    active: input.active,
  });

  if (error) throw error;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      active: input.active,
    })
    .eq('id', id);

  if (error) throw error;
}

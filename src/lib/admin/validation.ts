import type { ImageDraft, ProductStatus, VariantDraft } from './products';

/* -------------------------------------------------------------------------- */
/* Slug                                                                       */
/* -------------------------------------------------------------------------- */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/* -------------------------------------------------------------------------- */
/* Image URLs                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Only direct, publicly reachable image URLs are accepted. Pinterest *page*
 * links are rejected on purpose — nothing is scraped or converted server-side
 * (direct i.pinimg.com image URLs are fine if they resolve).
 */
export function describeImageUrlProblem(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return 'Enter an image URL.';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'That is not a valid URL. Include the full https:// address.';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Image URLs must start with http:// or https://.';
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'pinterest.com' || host === 'www.pinterest.com' || host.endsWith('.pinterest.com')) {
    return 'That is a Pinterest page link. Paste the direct image URL instead (usually i.pinimg.com/...).';
  }

  return null;
}

/**
 * Verifies an image actually loads before it can be trusted as a preview or
 * used to publish a product.
 */
export function verifyImageLoads(url: string, timeoutMs = 10000): Promise<boolean> {
  if (describeImageUrlProblem(url)) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(ok);
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  });
}

/* -------------------------------------------------------------------------- */
/* General product fields                                                     */
/* -------------------------------------------------------------------------- */

export interface GeneralFormValues {
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  /** Kept as a string so the Admin can clear the input while editing. */
  price: string;
  sku: string;
  featured: boolean;
  status: ProductStatus;
}

export function getGeneralFormError(values: GeneralFormValues): string | null {
  if (!values.name.trim()) return 'Product name is required.';

  const slug = values.slug.trim();
  if (!slug) return 'Slug is required.';
  if (!isValidSlug(slug)) {
    return 'Slug must be lowercase kebab-case (letters, numbers and single hyphens).';
  }

  const price = Number(values.price);
  if (!values.price.trim() || Number.isNaN(price) || price < 0) {
    return 'Base price must be a number of 0 or more.';
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Images / variants save validation                                          */
/* -------------------------------------------------------------------------- */

export function getImageSaveError(images: ImageDraft[]): string | null {
  for (const image of images) {
    if (!image.imageUrl.trim()) return 'Every image row needs a URL, or remove the empty row.';
    const problem = describeImageUrlProblem(image.imageUrl);
    if (problem) return problem;
  }
  return null;
}

export function getVariantSaveError(variants: VariantDraft[]): string | null {
  const seen = new Set<string>();

  for (const variant of variants) {
    const sku = variant.sku.trim();
    if (!sku) return 'Every variant needs a SKU.';
    if (seen.has(sku.toLowerCase())) return `Duplicate SKU "${sku}" on this product.`;
    seen.add(sku.toLowerCase());

    if (!variant.size.trim()) return `Variant ${sku}: size is required.`;

    const stock = Number(variant.stock);
    if (!variant.stock.trim() || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      return `Variant ${sku}: stock must be a whole number of 0 or more.`;
    }

    if (variant.priceOverride.trim()) {
      const override = Number(variant.priceOverride);
      if (Number.isNaN(override) || override < 0) {
        return `Variant ${sku}: price override must be 0 or more.`;
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Publish readiness                                                          */
/* -------------------------------------------------------------------------- */

export interface PublishInput {
  name: string;
  slug: string;
  categoryId: string | null;
  price: string;
  sku: string;
  images: ImageDraft[];
  variants: VariantDraft[];
  /** null = still verifying the primary image. */
  primaryImageResolves: boolean | null;
}

/** Everything still standing between a draft and `status = 'active'`. */
export function getPublishBlockers(input: PublishInput): string[] {
  const blockers: string[] = [];

  if (!input.name.trim()) blockers.push('Product name is missing.');
  if (!input.categoryId) blockers.push('No category assigned.');

  const slug = input.slug.trim();
  if (!slug) blockers.push('Slug is missing.');
  else if (!isValidSlug(slug)) blockers.push('Slug is not valid lowercase kebab-case.');

  if (!input.sku.trim()) blockers.push('Product SKU is missing.');

  const price = Number(input.price);
  if (!input.price.trim() || Number.isNaN(price) || price < 0) {
    blockers.push('Base price must be a number of 0 or more.');
  }

  const images = input.images.filter((image) => image.imageUrl.trim().length > 0);
  if (images.length === 0) blockers.push('No product images yet.');

  for (const image of images) {
    const problem = describeImageUrlProblem(image.imageUrl);
    if (problem) blockers.push(problem);
  }

  const primaryCount = images.filter((image) => image.isPrimary).length;
  if (images.length > 0 && primaryCount === 0) blockers.push('No primary image selected.');
  if (primaryCount > 1) blockers.push('More than one primary image is selected.');

  if (images.length > 0) {
    if (input.primaryImageResolves === null) {
      blockers.push('Still verifying the primary image.');
    } else if (!input.primaryImageResolves) {
      blockers.push('The primary image could not be loaded. Fix or replace it before publishing.');
    }
  }

  const activeVariants = input.variants.filter((variant) => variant.active);
  if (activeVariants.length === 0) blockers.push('No active variant yet.');

  for (const variant of activeVariants) {
    const label = variant.sku.trim() || 'variant';
    if (!variant.sku.trim()) blockers.push('An active variant is missing its SKU.');
    if (!variant.size.trim()) blockers.push(`Variant ${label}: size is missing.`);

    const stock = Number(variant.stock);
    if (!variant.stock.trim() || Number.isNaN(stock) || stock < 0) {
      blockers.push(`Variant ${label}: stock must be 0 or more.`);
    }

    if (variant.priceOverride.trim()) {
      const override = Number(variant.priceOverride);
      if (Number.isNaN(override) || override < 0) {
        blockers.push(`Variant ${label}: price override must be 0 or more.`);
      }
    }
  }

  return Array.from(new Set(blockers));
}

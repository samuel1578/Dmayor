import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder';
import {
  formatGhs,
  getProductBySlug,
  type CatalogueProductDetail,
} from '../lib/catalogue/products';

const STANDARD_COLOUR = 'Standard';

const normalizeColour = (colour: string | null): string =>
  (colour ?? '').trim() || STANDARD_COLOUR;

type PageStatus = 'loading' | 'ready' | 'not-found' | 'error';
type OptionState = 'available' | 'sold-out' | 'unavailable';

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();

  const [status, setStatus] = useState<PageStatus>('loading');
  const [product, setProduct] = useState<CatalogueProductDetail | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColour, setSelectedColour] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<
    { status: 'added' | 'warning' | 'error'; message: string } | null
  >(null);

  const load = useCallback(async () => {
    if (!slug) {
      setProduct(null);
      setStatus('not-found');
      return;
    }

    setStatus('loading');

    try {
      const data = await getProductBySlug(slug);
      if (!data) {
        setProduct(null);
        setStatus('not-found');
        return;
      }
      setProduct(data);
      setStatus('ready');
    } catch (err) {
      console.error('Failed to load product:', err);
      setProduct(null);
      setStatus('error');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------------------------------------- selection */

  const variants = useMemo(() => product?.variants ?? [], [product]);

  const colourOptions = useMemo(() => {
    if (!product) return [];
    const hasNamedColour = product.variants.some((variant) => (variant.colour ?? '').trim().length > 0);
    if (!hasNamedColour) return [];
    return Array.from(new Set(product.variants.map((variant) => normalizeColour(variant.colour))));
  }, [product]);

  const sizeOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.size))),
    [variants],
  );

  const effectiveColour = colourOptions.length > 1 ? selectedColour : colourOptions[0] ?? null;

  const selectedVariant = useMemo(() => {
    if (variants.length === 0) return null;
    // A single variant is safe to select automatically.
    if (variants.length === 1) return variants[0];
    if (!selectedSize) return null;

    return (
      variants.find(
        (variant) =>
          variant.size === selectedSize &&
          (colourOptions.length === 0 || normalizeColour(variant.colour) === effectiveColour),
      ) ?? null
    );
  }, [variants, selectedSize, colourOptions.length, effectiveColour]);

  // Reset the selection whenever a different product loads.
  useEffect(() => {
    setActiveImage(0);
    setAddFeedback(null);

    if (!product) {
      setSelectedColour(null);
      setSelectedSize(null);
      return;
    }

    const sizes = Array.from(new Set(product.variants.map((variant) => variant.size)));
    const namedColours = Array.from(
      new Set(
        product.variants
          .filter((variant) => (variant.colour ?? '').trim().length > 0)
          .map((variant) => normalizeColour(variant.colour)),
      ),
    );

    // An axis with only one option is implicit; anything with real choice is
    // left to the shopper so the wrong variant can never be added silently.
    setSelectedSize(sizes.length === 1 ? sizes[0] : null);
    setSelectedColour(namedColours.length === 1 ? namedColours[0] : null);
  }, [product]);

  const sizeState = (size: string): OptionState => {
    const matches = variants.filter(
      (variant) =>
        variant.size === size &&
        (colourOptions.length === 0 || normalizeColour(variant.colour) === effectiveColour),
    );
    if (matches.length === 0) return 'unavailable';
    return matches.some((variant) => variant.stock > 0) ? 'available' : 'sold-out';
  };

  const handleSelectColour = (colour: string) => {
    setSelectedColour(colour);
    setAddFeedback(null);

    // Never leave a size selected that does not exist in the new colour.
    if (selectedSize) {
      const stillExists = variants.some(
        (variant) => variant.size === selectedSize && normalizeColour(variant.colour) === colour,
      );
      if (!stillExists) setSelectedSize(null);
    }
  };

  const handleSelectSize = (size: string) => {
    setSelectedSize(size);
    setAddFeedback(null);
  };

  const activeImageData = product?.images[activeImage] ?? product?.images[0] ?? null;
  const displayPrice = selectedVariant?.priceOverride ?? product?.price ?? 0;
  // Availability and stock come from active variants only (normalized model).
  const allSoldOut = variants.length > 0 && !product?.available;
  const canAddToCart = Boolean(selectedVariant && selectedVariant.stock > 0);

  const stockMessage = (): string => {
    if (variants.length === 0) return 'Currently unavailable';
    if (allSoldOut) return 'Out of stock';
    if (selectedVariant) {
      return selectedVariant.stock > 0 ? 'In stock' : 'Out of stock';
    }
    return 'Select an option';
  };

  const addButtonLabel = (): string => {
    if (variants.length === 0 || allSoldOut) return 'Out of stock';
    if (canAddToCart) return 'Add to cart';
    if (colourOptions.length > 1 && !selectedColour) return 'Select a colour';
    return 'Select a size';
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant || selectedVariant.stock <= 0) return;

    const result = addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      productSlug: product.slug,
      productName: product.name,
      size: selectedVariant.size,
      colour: selectedVariant.colour,
      sku: selectedVariant.sku,
      price: selectedVariant.priceOverride ?? product.price,
      quantity: 1,
      image: activeImageData?.url ?? null,
      stock: selectedVariant.stock,
    });

    if (!result.ok) {
      setAddFeedback({ status: 'error', message: result.message ?? 'Could not add this item.' });
      return;
    }

    setAddFeedback({
      status: result.message ? 'warning' : 'added',
      message: result.message ?? 'Added to cart.',
    });
  };

  /* ---------------------------------------------------------------- states */

  if (status === 'loading') {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16" aria-busy="true">
            <div className="aspect-[3/4] w-full rounded-lg bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
            <div className="space-y-4">
              <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-10 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-24 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
          <p className="sr-only">Loading product</p>
        </div>
      </div>
    );
  }

  if (status === 'not-found' || status === 'error') {
    const isError = status === 'error';

    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="max-w-xl text-center"
        >
          <p className="hero-type-ui mb-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-ghana-green">
            {isError ? 'Something went wrong' : 'Not available'}
          </p>
          <h1 className="hero-type-display mb-5 font-medium text-ghana-black dark:text-white text-empty-heading">
            {isError ? 'We could not load this piece.' : 'This piece is no longer available.'}
          </h1>
          <p className="mx-auto mb-8 max-w-[42ch] text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 md:text-base">
            {isError
              ? 'Please try again in a moment, or continue browsing the collection.'
              : 'It may have sold out or been removed from the edit. Explore the rest of the collection.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/shop" className="btn-primary inline-flex items-center gap-2 bg-ghana-green text-white">
              <ArrowLeft size={18} aria-hidden="true" />
              Back to shop
            </Link>
            {isError && (
              <button type="button" onClick={() => void load()} className="btn-secondary border-ghana-green text-ghana-green">
                Try again
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!product) return null;

  const sizeControlLabel = colourOptions.length > 1 && effectiveColour ? `Size — ${effectiveColour}` : 'Size';

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400"
        >
          <Link to="/shop" className="hover:text-ghana-green transition-colors">
            Shop
          </Link>
          {product.categoryName && (
            <>
              <span aria-hidden="true">/</span>
              <span>{product.categoryName}</span>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="text-ghana-black dark:text-white normal-case tracking-normal text-[13px]">
            {product.name}
          </span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
              {activeImageData ? (
                <img
                  src={activeImageData.url}
                  alt={activeImageData.altText || product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ProductImagePlaceholder label="Image coming soon" />
              )}

              {allSoldOut && (
                <span className="absolute top-4 left-4 rounded-full bg-ghana-black/85 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                  Out of stock
                </span>
              )}
            </div>

            {product.images.length > 1 && (
              <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
                {product.images.map((image, index) => (
                  <li key={image.id}>
                    <button
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-pressed={index === activeImage}
                      aria-label={`Show image ${index + 1} of ${product.images.length}`}
                      className={`block w-full overflow-hidden rounded-lg border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green ${
                        index === activeImage
                          ? 'border-ghana-green'
                          : 'border-transparent hover:border-ghana-green/50'
                      }`}
                    >
                      <img
                        src={image.url}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Product information */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            {product.categoryName && (
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-ghana-green">
                {product.categoryName}
              </p>
            )}

            <h1 className="hero-type-display text-4xl leading-tight font-medium text-ghana-black dark:text-white sm:text-5xl">
              {product.name}
            </h1>

            <div aria-live="polite" className="mt-6">
              <p className="text-3xl font-semibold text-ghana-green">{formatGhs(displayPrice)}</p>
              <p
                className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                  canAddToCart ? 'text-ghana-black/60 dark:text-white/60' : 'text-ghana-red'
                }`}
              >
                {stockMessage()}
              </p>
            </div>

            {product.description && (
              <p className="mt-6 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                {product.description}
              </p>
            )}

            {/* Colour */}
            {colourOptions.length > 1 && (
              <fieldset className="mt-8">
                <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-ghana-black dark:text-white">
                  Colour
                  {selectedColour && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-gray-500 dark:text-gray-400">
                      {selectedColour}
                    </span>
                  )}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {colourOptions.map((colour) => (
                    <button
                      key={colour}
                      type="button"
                      onClick={() => handleSelectColour(colour)}
                      aria-pressed={selectedColour === colour}
                      className={`min-h-[44px] rounded-lg border px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green ${
                        selectedColour === colour
                          ? 'border-ghana-green bg-ghana-green/10 text-ghana-green'
                          : 'border-gray-300 text-ghana-black hover:border-ghana-green dark:border-gray-600 dark:text-white'
                      }`}
                    >
                      {colour}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {colourOptions.length === 1 && (
              <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Colour: <span className="text-ghana-black dark:text-white">{colourOptions[0]}</span>
              </p>
            )}

            {/* Size */}
            <fieldset className="mt-8">
              <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-ghana-black dark:text-white">
                {sizeControlLabel}
              </legend>

              {sizeOptions.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No sizes available for this piece yet.
                </p>
              ) : sizeOptions.length === 1 ? (
                <p className="text-sm text-ghana-black dark:text-white">{sizeOptions[0]}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((size) => {
                    const state = sizeState(size);
                    const disabled = state !== 'available';

                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleSelectSize(size)}
                        disabled={disabled}
                        aria-pressed={selectedSize === size}
                        aria-label={
                          state === 'unavailable'
                            ? `${size} — not available in this colour`
                            : state === 'sold-out'
                              ? `${size} — out of stock`
                              : size
                        }
                        className={`min-h-[44px] min-w-[56px] rounded-lg border px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green ${
                          selectedSize === size
                            ? 'border-ghana-green bg-ghana-green/10 text-ghana-green'
                            : 'border-gray-300 text-ghana-black hover:border-ghana-green dark:border-gray-600 dark:text-white'
                        } ${
                          disabled
                            ? 'cursor-not-allowed text-gray-400 line-through opacity-60 hover:border-gray-300 dark:text-gray-500 dark:hover:border-gray-600'
                            : ''
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              aria-label={
                canAddToCart
                  ? `Add ${product.name} to cart`
                  : `${product.name} cannot be added to the cart`
              }
              className="mt-10 flex w-full items-center justify-center gap-2 rounded-lg bg-ghana-green px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-colors duration-300 hover:bg-ghana-black disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              <ShoppingCart size={18} aria-hidden="true" />
              {addButtonLabel()}
            </button>

            <div role="status" aria-live="polite">
              {addFeedback && (
                <p
                  className={`mt-4 text-sm ${
                    addFeedback.status === 'error'
                      ? 'text-ghana-red'
                      : addFeedback.status === 'warning'
                        ? 'text-ghana-black dark:text-white'
                        : 'text-ghana-green'
                  }`}
                >
                  {addFeedback.message}
                  {addFeedback.status === 'added' && (
                    <>
                      {' '}
                      <Link
                        to="/cart"
                        className="underline underline-offset-4 hover:text-ghana-black dark:hover:text-white"
                      >
                        View cart
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>

            {selectedVariant?.sku && (
              <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                SKU: {selectedVariant.sku}
              </p>
            )}

            <p className="mt-6">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 text-[13px] text-ghana-black/70 transition-colors hover:text-ghana-green dark:text-white/70"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to shop
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

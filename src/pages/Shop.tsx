import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { QuickViewModal } from '../components/QuickViewModal';
import {
  listActiveProducts,
  listPublicCategories,
  type CatalogueProductSummary,
  type PublicCategory,
} from '../lib/catalogue/products';

/**
 * GHS price bands for the current catalogue (₵250–₵550+).
 * Bounds are half-open: `min` inclusive, `max` exclusive, so the bands never
 * overlap and never leave a gap. `null` means unbounded on that side.
 */
const PRICE_RANGES = [
  { id: 'under-300', label: 'Under ₵300', min: null, max: 300 },
  { id: '300-399', label: '₵300 - ₵399', min: 300, max: 400 },
  { id: '400-499', label: '₵400 - ₵499', min: 400, max: 500 },
  { id: '500-plus', label: '₵500 and above', min: 500, max: null },
] as const;

type PriceRangeId = (typeof PRICE_RANGES)[number]['id'];

function matchesPriceRange(price: number, range: (typeof PRICE_RANGES)[number]): boolean {
  if (range.min !== null && price < range.min) return false;
  if (range.max !== null && price >= range.max) return false;
  return true;
}

export function Shop() {
  const sortOptions = ['newest', 'price-low', 'price-high'] as const;
  type SortOption = (typeof sortOptions)[number];
  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest',
    'price-low': 'Price: Low to High',
    'price-high': 'Price: High to Low',
  };
  const [products, setProducts] = useState<CatalogueProductSummary[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProductSummary | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<PriceRangeId[]>([]);
  const [loading, setLoading] = useState(true);

  /** The URL is the source of truth for the active category (`?category=slug`). */
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('category');

  /**
   * Slug → id. An unknown/invalid slug resolves to `null`, which renders the
   * full catalogue as All Products instead of an empty grid.
   */
  const selectedCategory = useMemo(() => {
    if (!categorySlug) return null;
    return categories.find((cat) => cat.slug === categorySlug)?.id ?? null;
  }, [categories, categorySlug]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catalogue, categoryList] = await Promise.all([
          listActiveProducts(),
          listPublicCategories(),
        ]);

        setProducts(catalogue);
        setCategories(categoryList);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /**
   * Category ∩ price (OR across selected bands), then sort.
   * Each control is independent, so they compose without resetting one another.
   */
  const sortedProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const categoryOk = selectedCategory === null || product.categoryId === selectedCategory;
      const priceOk =
        selectedPriceRanges.length === 0 ||
        selectedPriceRanges.some((rangeId) => {
          const range = PRICE_RANGES.find((entry) => entry.id === rangeId);
          return range ? matchesPriceRange(product.price, range) : false;
        });
      return categoryOk && priceOk;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      return 0;
    });
  }, [products, selectedCategory, selectedPriceRanges, sortBy]);

  const handleCategorySelect = (slug: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set('category', slug);
    else next.delete('category');
    setSearchParams(next);
  };

  const togglePriceRange = (rangeId: PriceRangeId) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(rangeId) ? prev.filter((id) => id !== rangeId) : [...prev, rangeId],
    );
  };

  const handleQuickView = (product: CatalogueProductSummary) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
      <QuickViewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        product={selectedProduct || undefined}
      />

      <div className="bg-gradient-to-r from-ghana-green to-ghana-black text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Shop Our Collection
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-200"
          >
            Shirts, Trousers, Hoodies, and Shoes — premium menswear for every occasion.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-1"
          >
            <div className="mb-8">
              <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-4">Categories</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === null
                      ? 'bg-ghana-green text-white'
                      : 'text-ghana-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.slug)}
                    className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-ghana-green text-white'
                        : 'text-ghana-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="sticky top-20">
              <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-4">Price Range</h3>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {PRICE_RANGES.map((range) => (
                  <label key={range.id} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={selectedPriceRanges.includes(range.id)}
                      onChange={() => togglePriceRange(range.id)}
                    />
                    {range.label}
                  </label>
                ))}
              </div>
            </div>
          </motion.aside>

          <div className="md:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex items-center justify-between"
            >
              <p className="text-gray-600 dark:text-gray-400">
                Showing {sortedProducts.length} products
              </p>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="input-field appearance-none pr-10"
                >
                  {sortOptions.map((option) => (
                    <option key={option} value={option}>
                      {sortLabels[option]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ghana-green" />
              </div>
            </motion.div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-5xl text-ghana-green mb-4"
                  >
                    ★
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedProducts.length > 0 ? (
                  sortedProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.05 }}
                    >
                      <ProductCard
                        {...product}
                        onQuickView={() => handleQuickView(product)}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <p className="text-ghana-black dark:text-white text-lg">No products found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { QuickViewModal } from '../components/QuickViewModal';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export function Shop() {
  const sortOptions = ['newest', 'price-low', 'price-high'] as const;
  type SortOption = (typeof sortOptions)[number];
  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest',
    'price-low': 'Price: Low to High',
    'price-high': 'Price: High to Low',
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          supabase.from('products').select('id, name, price, image, category_id'),
          supabase.from('categories').select('id, name, slug'),
        ]);

        if (productsRes.error) throw productsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;

        setProducts(productsRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    return 0;
  });

  const handleQuickView = (product: Product) => {
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

      {/* Header */}
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
            Discover authentic Ghanaian streetwear, lifestyle products, and creative merchandise
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-1"
          >
            {/* Category Filter */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-4">Categories</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(null)}
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
                    onClick={() => setSelectedCategory(cat.id)}
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

            {/* Price Filter */}
            <div className="sticky top-20">
              <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-4">Price Range</h3>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  Under ₵50
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  ₵50 - ₵100
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  ₵100 - ₵200
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" />
                  Over ₵200
                </label>
              </div>
            </div>
          </motion.aside>

          {/* Main Content */}
          <div className="md:col-span-3">
            {/* Sorting */}
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

            {/* Products Grid */}
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

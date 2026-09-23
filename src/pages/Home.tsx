import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { QuickViewModal } from '../components/QuickViewModal';
import { ScrollyHero } from '../components/hero/ScrollyHero';
import { BrandValueSection } from '../components/home/BrandValueSection';
import { FitCollections } from '../components/home/FitCollections';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  featured: boolean;
  slug?: string;
}

export function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 4;
    }
    return window.innerWidth >= 1024 ? 6 : 4;
  });

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, featured, slug, images')
          .eq('featured', true)
          .eq('status', 'active')
          .limit(8);

        if (error) throw error;

        const enrichedProducts = (data || []).map((productItem) => {
          const images = productItem.images as string[] || [];
          return {
            ...productItem,
            image: images.length > 0 ? images[0] : undefined,
          };
        }) as Product[];

        setProducts(enrichedProducts);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  useEffect(() => {
    const updateVisibleCount = () => {
      setVisibleCount(window.innerWidth >= 1024 ? 6 : 4);
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300">
      <QuickViewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        product={selectedProduct || undefined}
      />

      {/* Hero — scrollytelling split-screen morphing story */}
      <ScrollyHero />

      {/* Brand / value — why buy from The Proxy Shop */}
      <BrandValueSection />

      {/* Featured Products Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mb-4 text-5xl text-ghana-green"
                >
                  ★
                </motion.div>
                <p className="text-ghana-black dark:text-white">
                  Loading products...
                </p>
              </div>
            </div>
          ) : products.length === 0 ? (
            /* Editorial empty state — branded, not a dev placeholder */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mx-auto max-w-2xl px-2 py-4 text-center"
            >
              <p className="hero-type-ui mb-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-ghana-green">
                Featured Pieces
              </p>

              <h2 className="hero-type-display mb-5 whitespace-pre-line font-medium text-ghana-black dark:text-white text-empty-heading">
                {'The next rotation\nis taking shape.'}
              </h2>

              <p className="mx-auto mb-8 max-w-[42ch] text-[14px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 md:text-base">
                We’re refreshing the edit. In the meantime, explore the full
                collection.
              </p>

              {/* Subtle decorative mark */}
              <div
                aria-hidden="true"
                className="mb-8 flex items-center justify-center gap-3 text-ghana-green"
              >
                <span className="block h-px w-10 bg-ghana-green/45 sm:w-14" />
                <span className="block h-1.5 w-1.5 rotate-45 border border-ghana-green/70" />
                <span className="block h-px w-10 bg-ghana-green/45 sm:w-14" />
              </div>

              <Link
                to="/shop"
                className="hero-type-ui group inline-flex w-fit items-center gap-2 text-[13px] font-medium tracking-[0.04em] text-ghana-black transition-colors hover:text-ghana-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2 focus-visible:ring-offset-ghana-light dark:text-white dark:focus-visible:ring-offset-ghana-dark md:text-sm"
              >
                <span className="border-b border-ghana-green/50 pb-0.5 transition-colors group-hover:border-ghana-green">
                  Explore the Shop
                </span>
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="text-ghana-green transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.div {...fadeInUp} className="mb-16 text-center">
                <h2 className="section-title">Featured Pieces</h2>
                <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
                  Explore our latest drops and most-loved items.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {products.slice(0, visibleCount).map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <ProductCard
                      {...product}
                      image={product.image}
                      onQuickView={() => handleQuickView(product)}
                    />
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-12 text-center"
              >
                <Link
                  to="/shop"
                  className="btn-primary inline-flex items-center gap-2 bg-ghana-green text-white"
                >
                  View All Products
                  <ChevronRight size={20} />
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </section>

      {/* Fit Collections — curated looks / styling directions */}
      <FitCollections />

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-ghana-yellow dark:bg-opacity-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-ghana-black dark:text-white mb-6"
          >
            Stay Updated with the Latest Drops
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-gray-700 dark:text-gray-300 mb-8"
          >
            Subscribe to our newsletter and be the first to know about new collections and exclusive offers.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              placeholder="your@email.com"
              className="input-field flex-1"
            />
            <button className="btn-primary bg-ghana-green text-white">Subscribe</button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

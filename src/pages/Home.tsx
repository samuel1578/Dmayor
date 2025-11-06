import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { QuickViewModal } from '../components/QuickViewModal';
import { supabase } from '../lib/supabase';
import gyeNyameImg from '../assets/gye-nyame.png';
import sankofaImg from '../assets/sankofa.png';
import denkyemImg from '../assets/denkyem.png';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  featured: boolean;
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

  const assetFiles = import.meta.glob('../assets/*.{webp,png,jpg,jpeg}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>;

  const productAssetFileMap: Record<string, string> = {
    'Accra Heritage Tee': 'Heritage-Tee.webp',
    'Golden Star Hoodie': 'Gold-hoodie.webp',
    'Heritage Collection Scarf': 'african-scarf.webp',
    'Midnight Black Jacket': 'midnight-jacket.webp',
    // Additional featured product images can be added here as they become available
  };

  const resolveProductImage = (productName: string) => {
    const assetFile = productAssetFileMap[productName];
    if (!assetFile) return undefined;

    const matchedEntry = Object.entries(assetFiles).find(([filePath]) =>
      filePath.endsWith(`/${assetFile}`)
    );

    return matchedEntry?.[1];
  };

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, featured')
          .eq('featured', true)
          .limit(8);

        if (error) throw error;

        const enrichedProducts = (data || []).map((productItem) => ({
          ...productItem,
          image: resolveProductImage(productItem.name),
        })) as Product[];

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
    const productWithImage = {
      ...product,
      image: product.image ?? resolveProductImage(product.name),
    };

    setSelectedProduct(productWithImage);
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

  {/* Hero Section */}
  <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden kente-pattern">
        <div className="absolute inset-0 z-0">
          <motion.div
            initial={{ scale: 1.1, opacity: 0.3 }}
            animate={{ scale: 1, opacity: 0.1 }}
            transition={{ duration: 2 }}
            className="absolute inset-0 bg-gradient-to-br from-ghana-green via-ghana-yellow to-ghana-red"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold text-ghana-black dark:text-white mb-6"
          >
            Crafting African Excellence,<span className="text-ghana-green">One Piece at a Time</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto"
          >
            We believe that every crafted piece 
is a living story of Africa’s rich heritage, creativity, and the unmatched ingenuity of 
the African craftsman.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/shop" className="btn-primary bg-ghana-green text-white flex items-center justify-center gap-2">
              Shop the Vibe
              <ChevronRight size={20} />
            </Link>
            <Link to="/collections" className="btn-secondary border-ghana-green text-ghana-green">
              View Collections
            </Link>
          </motion.div>
        </div>

        {/* Floating stars */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -100, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
              className="absolute text-4xl text-ghana-yellow"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`,
              }}
            >
              ★
            </motion.div>
          ))}
        </div>
      </section>

      {/* Made in Ghana Banner */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden bg-ghana-black text-white py-12 md:py-16"
      >
        <div className="pointer-events-none absolute inset-0">
          <img
            src={gyeNyameImg}
            alt=""
            className="absolute right-0 bottom-0 w-24 sm:w-32 lg:w-48 opacity-20 invert dark:invert-0"
            loading="lazy"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            100% <span className="text-ghana-yellow">Made in Ghana</span>
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Every piece tells a story of Ghanaian craftsmanship, culture, and innovation. We celebrate our heritage with pride.
          </p>
        </div>
      </motion.section>

      {/* Featured Products Section */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-7xl mx-auto">
          <div className="pointer-events-none absolute inset-0">
            <img
              src={sankofaImg}
              alt=""
              className="absolute -top-10 -left-4 w-20 sm:w-24 lg:w-32 opacity-20 dark:opacity-25 mix-blend-multiply dark:mix-blend-screen"
              loading="lazy"
            />
            <img
              src={denkyemImg}
              alt=""
              className="absolute -top-10 right-0 w-20 sm:w-24 lg:w-32 opacity-20 dark:opacity-25 mix-blend-multiply dark:mix-blend-screen"
              loading="lazy"
            />
          </div>
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="section-title">Featured Pieces</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Explore our latest drops and most-loved items from the community
            </p>
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
                <p className="text-ghana-black dark:text-white">Loading products...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.length > 0 ? (
                products.slice(0, visibleCount).map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <ProductCard
                      {...product}
                      image={product.image ?? resolveProductImage(product.name)}
                      onQuickView={() => handleQuickView(product)}
                    />
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-ghana-black dark:text-white text-lg">No products yet. Check back soon!</p>
                </div>
              )}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center mt-12"
          >
            <Link to="/shop" className="btn-primary bg-ghana-green text-white inline-flex items-center gap-2">
              View All Products
              <ChevronRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Collections Preview */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-gradient-to-r from-ghana-green to-ghana-black text-white py-16 md:py-24 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Themed <span className="text-ghana-yellow">Collections</span>
              </h2>
              <p className="text-lg text-gray-200 mb-8">
                Each collection celebrates a unique aspect of Ghanaian culture and urban fashion. From "Accra Nights" to "The Culture Collection."
              </p>
              <Link to="/collections" className="btn-secondary border-white text-white hover:bg-ghana-yellow hover:text-ghana-black">
                Explore Collections
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                'https://images.pexels.com/photos/34550955/pexels-photo-34550955.jpeg?auto=compress&cs=tinysrgb&w=400',
                'https://images.pexels.com/photos/31485635/pexels-photo-31485635.jpeg?auto=compress&cs=tinysrgb&w=400',
                'https://images.pexels.com/photos/15753014/pexels-photo-15753014.jpeg?auto=compress&cs=tinysrgb&w=400',
                'https://images.pexels.com/photos/16429834/pexels-photo-16429834.jpeg?auto=compress&cs=tinysrgb&w=400',
              ].map((img, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.05 }}
                  className="overflow-hidden rounded-lg h-48"
                >
                  <img src={img} alt="Collection" className="w-full h-full object-cover" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

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

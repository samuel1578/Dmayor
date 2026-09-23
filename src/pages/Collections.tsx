import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  featured_image?: string;
}

export function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const { data, error: err } = await supabase
          .from('collections')
          .select('id, name, slug, description, featured_image');

        if (err) throw err;
        setCollections(data || []);
      } catch (err) {
        console.error('Error fetching collections:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  if (error) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ghana-black dark:text-white text-lg">Unable to load collections.</p>
          <Link to="/" className="btn-primary bg-ghana-green text-white mt-4 inline-block">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
      <div className="bg-gradient-to-r from-ghana-yellow to-ghana-red text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Collections
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white opacity-90"
          >
            Curated collections for every style.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl text-ghana-green"
            >
              ★
            </motion.div>
          </div>
        ) : collections.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-ghana-black dark:text-white text-lg">No collections yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {collections.map((collection, index) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group"
              >
                <div className="relative h-96 rounded-lg overflow-hidden mb-6">
                  <img
                    src={collection.featured_image}
                    alt={collection.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition-all duration-300 flex items-end p-6">
                    <div className="text-white">
                      <h2 className="text-3xl font-bold mb-2">{collection.name}</h2>
                      <p className="text-gray-100 line-clamp-2">{collection.description}</p>
                    </div>
                  </div>
                </div>
                <Link
                  to={`/shop?collection=${collection.slug}`}
                  className="btn-primary bg-ghana-green text-white w-full md:w-auto"
                >
                  Explore Collection
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-ghana-black text-white py-16 md:py-24 px-4"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            New Collections Dropping Monthly
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            We constantly evolve our collections to reflect the latest trends and styles.
          </p>
          <button className="btn-primary bg-ghana-green text-white">
            Notify Me of New Drops
          </button>
        </div>
      </motion.section>
    </div>
  );
}

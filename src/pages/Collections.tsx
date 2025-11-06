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

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const { data, error } = await supabase
          .from('collections')
          .select('id, name, slug, description, featured_image');

        if (error) throw error;
        setCollections(data || []);
      } catch (err) {
        console.error('Error fetching collections:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  const defaultCollections = [
    {
      id: '1',
      name: 'Accra Nights',
      slug: 'accra-nights',
      description: 'Urban elegance inspired by the vibrant nightlife of Accra',
      featured_image: 'https://images.pexels.com/photos/3407270/pexels-photo-3407270.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: '2',
      name: 'The Culture Collection',
      slug: 'culture-collection',
      description: 'Celebrating Ghanaian heritage and traditional craftsmanship',
      featured_image: 'https://images.pexels.com/photos/1778412/pexels-photo-1778412.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: '3',
      name: 'Street Essence',
      slug: 'street-essence',
      description: 'Raw, unfiltered streetwear for the bold and authentic',
      featured_image: 'https://images.pexels.com/photos/1082516/pexels-photo-1082516.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: '4',
      name: 'Art & Expression',
      slug: 'art-expression',
      description: 'Limited edition pieces featuring local artists\' work',
      featured_image: 'https://images.pexels.com/photos/2018961/pexels-photo-2018961.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
  ];

  const displayCollections = collections.length > 0 ? collections : defaultCollections;

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
      {/* Header */}
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
            Curated themed collections celebrating Ghanaian culture and urban fashion
          </motion.p>
        </div>
      </div>

      {/* Collections Grid */}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {displayCollections.map((collection, index) => (
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

      {/* Featured Section */}
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
            We constantly evolve our collections to reflect the latest trends, seasons, and stories from the Ghanaian streets.
          </p>
          <button className="btn-primary bg-ghana-green text-white">
            Notify Me of New Drops
          </button>
        </div>
      </motion.section>
    </div>
  );
}

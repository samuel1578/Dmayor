import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string;
  tags?: string[];
  created_at: string;
}

export function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, featured_image, tags, created_at')
          .eq('published', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (err) {
        console.error('Error fetching posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const defaultPosts = [
    {
      id: '1',
      title: 'The Evolution of Ghanaian Streetwear in 2025',
      slug: 'evolution-ghanaian-streetwear',
      excerpt: 'Explore how Ghanaian street fashion is transforming the global fashion landscape with authentic cultural expression.',
      featured_image: 'https://images.pexels.com/photos/3407270/pexels-photo-3407270.jpeg?auto=compress&cs=tinysrgb&w=800',
      tags: ['Fashion', 'Culture', 'Trends'],
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Behind the Scenes: Our New Collection Launch',
      slug: 'behind-scenes-collection',
      excerpt: 'Get an exclusive look at how we create each piece in our Accra studio.',
      featured_image: 'https://images.pexels.com/photos/1082516/pexels-photo-1082516.jpeg?auto=compress&cs=tinysrgb&w=800',
      tags: ['Process', 'Design', 'News'],
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      title: "Interview: Local Artists Supporting D'Mayor",
      slug: 'interview-local-artists',
      excerpt: 'Meet the talented Ghanaian artists whose work inspires our designs.',
      featured_image: 'https://images.pexels.com/photos/2018961/pexels-photo-2018961.jpeg?auto=compress&cs=tinysrgb&w=800',
      tags: ['Art', 'Community', 'Interview'],
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  const displayPosts = posts.length > 0 ? posts : defaultPosts;
  const filteredPosts = selectedTag
    ? displayPosts.filter((post) => post.tags?.includes(selectedTag))
    : displayPosts;

  const allTags = Array.from(
    new Set(displayPosts.flatMap((post) => post.tags || []))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-ghana-black to-ghana-green text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            D'Mayor Stories
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-200"
          >
            News, trends, and stories from the heart of Ghanaian culture and fashion
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Tag Filter */}
        {allTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex flex-wrap gap-3"
          >
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-4 py-2 rounded-full font-semibold transition-all ${
                selectedTag === null
                  ? 'bg-ghana-green text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-ghana-black dark:text-white hover:bg-ghana-green hover:text-white'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-4 py-2 rounded-full font-semibold transition-all ${
                  selectedTag === tag
                    ? 'bg-ghana-green text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-ghana-black dark:text-white hover:bg-ghana-green hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </motion.div>
        )}

        {/* Posts Grid */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="card-product group flex flex-col"
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                      src={
                        post.featured_image ||
                        'https://images.pexels.com/photos/3407270/pexels-photo-3407270.jpeg?auto=compress&cs=tinysrgb&w=500'
                      }
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6 flex flex-col">
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs font-semibold px-3 py-1 bg-ghana-yellow text-ghana-black rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <h3 className="text-lg font-bold text-ghana-black dark:text-white mb-3 line-clamp-2 group-hover:text-ghana-green transition-colors">
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2 flex-1">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Date and Link */}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(post.created_at)}
                      </span>
                      <Link
                        to={`/blog/${post.slug}`}
                        className="text-ghana-green hover:text-ghana-black dark:hover:text-ghana-yellow transition-colors"
                      >
                        <ArrowRight size={20} />
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-ghana-black dark:text-white text-lg">
                  No posts found with the selected tag
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Newsletter CTA */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-gradient-to-r from-ghana-green to-ghana-yellow text-white dark:text-ghana-black py-16 md:py-24 px-4"
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Never Miss a Story
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Subscribe to our blog for the latest news, drops, and cultural insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="your@email.com"
              className="input-field flex-1 bg-white bg-opacity-20 border-white text-white placeholder-white placeholder-opacity-70"
            />
            <button className="btn-primary bg-ghana-black text-white hover:bg-ghana-red">
              Subscribe
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

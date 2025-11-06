import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Moon, Sun, ShoppingBag } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useCart } from '../contexts/CartContext';
import logoImage from '../assets/logo.jpg';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { itemCount } = useCart();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Collections', path: '/collections' },
    { name: 'About', path: '/about' },
    { name: 'Blog', path: '/blog' },
    { name: 'Contact', path: '/contact' },
  ];

  const socialLinks = [
    { name: 'Instagram', url: '#' },
    { name: 'TikTok', url: '#' },
    { name: 'Twitter', url: '#' },
    { name: 'Facebook', url: '#' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-ghana-light dark:bg-ghana-dark border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 border-ghana-green shadow-md">
                <img
                  src={logoImage}
                  alt="D'Mayor logo"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-ghana-black dark:text-white group-hover:text-ghana-green transition-colors">
                D'Mayor
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="underline-hover text-ghana-black dark:text-white font-medium"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <Link
              to="/cart"
              className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800 relative"
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1 -translate-y-1 bg-ghana-red rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="md:hidden fixed inset-0 top-16 bg-ghana-light dark:bg-ghana-dark z-40"
          >
            <div className="px-4 pt-6 pb-4 space-y-3">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={link.path}
                    className="block px-4 py-3 rounded-lg text-ghana-black dark:text-white hover:bg-ghana-green hover:text-white transition-colors font-semibold"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}

              <div className="pt-4 mt-4 border-t border-gray-300 dark:border-gray-600">
                <p className="px-4 py-2 text-sm font-semibold text-ghana-black dark:text-white mb-3">
                  Follow Us
                </p>
                <div className="flex space-x-3 px-4">
                  {socialLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.url}
                      className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-ghana-green hover:text-white"
                    >
                      {link.name[0]}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

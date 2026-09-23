import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Moon,
  Sun,
  ShoppingBag,
  Home as HomeIcon,
  Layers,
  Info,
  Newspaper,
  MessageCircle,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useCart } from '../contexts/CartContext';
import logoHeader from '../assets/logo-header.png';
import logoDark from '../assets/logodark.png';

interface NavLink {
  name: string;
  path: string;
  icon: typeof HomeIcon;
  tagline: string;
}

const navLinks: NavLink[] = [
  { name: 'Home', path: '/', icon: HomeIcon, tagline: 'Discover the latest' },
  { name: 'Shop', path: '/shop', icon: ShoppingBag, tagline: 'Browse all pieces' },
  {
    name: 'Collections',
    path: '/collections',
    icon: Layers,
    tagline: 'Explore curated fits',
  },
  { name: 'About', path: '/about', icon: Info, tagline: 'Our point of view' },
  { name: 'Blog', path: '/blog', icon: Newspaper, tagline: 'Stories & style' },
  { name: 'Contact', path: '/contact', icon: MessageCircle, tagline: 'Talk to us' },
];

const padNumber = (value: number) => String(value).padStart(2, '0');

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { itemCount } = useCart();
  const location = useLocation();
  const logoSrc = theme === 'dark' ? logoHeader : logoDark;

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-ghana-light dark:bg-ghana-dark border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 md:h-24">
          {/* Logo — no border, no container, no shadow */}
          <Link
            to="/"
            className="flex-shrink-0 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green rounded-lg"
            aria-label="The Proxy Shop — go to homepage"
          >
            <img
              src={logoSrc}
              alt="The Proxy Shop"
              className="h-16 md:h-[72px] w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActive(link.path) ? 'page' : undefined}
                className={`underline-hover font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green rounded ${
                  isActive(link.path)
                    ? 'text-ghana-green'
                    : 'text-ghana-black dark:text-white hover:text-ghana-green'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? (
                <Sun size={20} aria-hidden="true" />
              ) : (
                <Moon size={20} aria-hidden="true" />
              )}
            </button>

            <Link
              to="/cart"
              className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800 relative"
              aria-label={`Shopping cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
            >
              <ShoppingBag size={20} aria-hidden="true" />
              {itemCount > 0 && (
                <span
                  className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1 -translate-y-1 bg-ghana-red rounded-full"
                  aria-hidden="true"
                >
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
            >
              {isOpen ? (
                <X size={24} aria-hidden="true" />
              ) : (
                <Menu size={24} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen mobile navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-ghana-light text-ghana-black dark:bg-ghana-dark dark:text-white"
          >
            {/* Header row inside open menu: logo + controls + close */}
            <div className="flex h-20 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green rounded-lg"
                aria-label="The Proxy Shop — go to homepage"
              >
                <img
                  src={logoSrc}
                  alt="The Proxy Shop"
                  className="h-14 w-auto object-contain"
                />
              </Link>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
                  aria-label={
                    theme === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'
                  }
                >
                  {theme === 'dark' ? (
                    <Sun size={20} aria-hidden="true" />
                  ) : (
                    <Moon size={20} aria-hidden="true" />
                  )}
                </button>

                <Link
                  to="/cart"
                  onClick={() => setIsOpen(false)}
                  className="btn-icon relative text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
                  aria-label={`Shopping cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
                >
                  <ShoppingBag size={20} aria-hidden="true" />
                  {itemCount > 0 && (
                    <span
                      className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-ghana-red px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                      aria-hidden="true"
                    >
                      {itemCount}
                    </span>
                  )}
                </Link>

                <button
                  onClick={() => setIsOpen(false)}
                  className="btn-icon bg-ghana-green text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2"
                  aria-label="Close menu"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
            </div>

            <nav
              aria-label="Mobile navigation"
              className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-8 pt-6"
            >
              <p className="hero-type-ui mb-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-ghana-green">
                Menu
              </p>

              {/* Primary navigation — editorial rows */}
              <ul className="flex-1 space-y-0">
                {navLinks.map((link, index) => {
                  const Icon = link.icon;
                  const active = isActive(link.path);
                  return (
                    <motion.li
                      key={link.path}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.04 + index * 0.04,
                        duration: 0.28,
                        ease: 'easeOut',
                      }}
                      className="border-b border-gray-200/80 last:border-b-0 dark:border-gray-700/80"
                    >
                      <Link
                        to={link.path}
                        onClick={() => setIsOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex min-h-[72px] items-center gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green ${
                          active ? 'text-ghana-green' : 'text-ghana-black dark:text-white'
                        }`}
                      >
                        <span
                          className={`hero-type-ui w-7 shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.12em] ${
                            active
                              ? 'text-ghana-green'
                              : 'text-ghana-black/35 dark:text-white/35'
                          }`}
                        >
                          {padNumber(index + 1)}
                        </span>

                        <Icon
                          size={18}
                          aria-hidden="true"
                          className={
                            active
                              ? 'shrink-0 text-ghana-green'
                              : 'shrink-0 text-gray-400 transition-colors group-hover:text-ghana-green dark:text-gray-500'
                          }
                        />

                        <span className="min-w-0 flex-1">
                          <span
                            className={`hero-type-display block text-[28px] font-medium leading-none tracking-[-0.02em] sm:text-[32px] ${
                              active
                                ? 'text-ghana-green'
                                : 'text-ghana-black dark:text-white'
                            }`}
                          >
                            {link.name}
                          </span>
                          <span className="mt-1.5 block text-[12px] font-normal leading-snug text-gray-500 sm:text-[13px] dark:text-gray-400">
                            {link.tagline}
                          </span>
                        </span>

                        {active && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-ghana-green"
                            aria-hidden="true"
                          />
                        )}
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>

              {/* Cart — stronger bottom row */}
              <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
                <Link
                  to="/cart"
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-[56px] items-center gap-4 border border-ghana-green/40 px-4 py-3.5 text-ghana-black transition-colors hover:bg-ghana-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green dark:text-white"
                >
                  <ShoppingBag size={20} aria-hidden="true" className="text-ghana-green" />
                  <span className="hero-type-ui flex-1 text-[15px] font-semibold tracking-[0.02em]">
                    Cart
                  </span>
                  <span className="hero-type-ui text-[13px] font-medium text-ghana-green">
                    {itemCount > 0 ? (
                      <>
                        {itemCount}
                        <span className="sr-only"> items in cart</span>
                      </>
                    ) : (
                      '0'
                    )}
                  </span>
                </Link>
              </div>

              {/*
                Future account area (not rendered — no fake Login/Register CTAs).
                Structure: mobileMenu → primary nav / cart / account slot.
              */}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AdminSidebar } from './AdminSidebar';
import logoHeader from '../../assets/logo-header.png';
import logoDark from '../../assets/logodark.png';

/**
 * Admin chrome — deliberately separate from the public Layout (no storefront
 * navbar/footer), but built from the same brand tokens, logo and type system.
 */
export function AdminLayout() {
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const logoSrc = theme === 'dark' ? logoHeader : logoDark;

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-ghana-light dark:bg-ghana-dark transition-colors duration-300">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-ghana-black/10 dark:border-white/10 p-6">
          <p className="font-display text-lg text-ghana-black dark:text-white mb-6">Admin</p>
          <AdminSidebar />
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 bg-ghana-light dark:bg-ghana-dark border-b border-ghana-black/10 dark:border-white/10">
            <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  aria-label="Open admin navigation"
                  className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-ghana-black dark:text-white hover:bg-ghana-green/10 transition-colors duration-200"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <img src={logoSrc} alt="The Proxy Shop" className="h-10 w-auto object-contain" />

                <span className="hidden sm:inline text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 border border-ghana-black/15 dark:border-white/20 rounded-full px-3 py-1">
                  Admin
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-busy={signingOut}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-60"
                  disabled={signingOut}
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  {signingOut ? 'Signing out…' : 'Log out'}
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-ghana-black/50"
              onClick={() => setNavOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 w-72 max-w-[80%] bg-ghana-light dark:bg-ghana-dark p-6 border-r border-ghana-black/10 dark:border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <p className="font-display text-lg text-ghana-black dark:text-white">Admin</p>
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close admin navigation"
                  className="w-10 h-10 flex items-center justify-center rounded-full text-ghana-black dark:text-white hover:bg-ghana-green/10 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <AdminSidebar onNavigate={() => setNavOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

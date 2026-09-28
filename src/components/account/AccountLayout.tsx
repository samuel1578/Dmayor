import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Reusable customer account shell (Phase D3).
 *
 * Desktop  : editorial side navigation + content area.
 * Mobile   : compact horizontal section navigation above the content.
 *
 * This is a customer-facing surface in the storefront design language — not
 * an Admin dashboard clone. Authentication is handled ONCE by the parent
 * `AuthenticatedRoute`; this layout never checks sessions itself.
 */

const navItems = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/profile', label: 'Profile', end: false },
  { to: '/account/addresses', label: 'Addresses', end: false },
  // Phase E2: the real order history replaces the disabled placeholder.
  { to: '/account/orders', label: 'Orders', end: false },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-4 py-2.5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green ${
    isActive
      ? 'bg-ghana-green/10 font-semibold text-ghana-green'
      : 'text-ghana-black/70 dark:text-white/70 hover:text-ghana-black dark:hover:text-white'
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative whitespace-nowrap px-3 py-3 text-[11px] uppercase tracking-[0.16em] transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green ${
    isActive
      ? 'text-ghana-green after:bg-ghana-green'
      : 'text-ghana-black/55 dark:text-white/55 after:bg-transparent hover:text-ghana-black dark:hover:text-white'
  }`;

export function AccountLayout() {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-ghana-light transition-colors duration-300 dark:bg-ghana-dark">
      <div className="max-w-6xl px-4 py-12 sm:px-6 lg:px-8 md:py-16">
        {/* Mobile — compact section navigation */}
        <div className="md:hidden">
          <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-ghana-green">Account</p>
          <nav
            aria-label="Account sections"
            className="-mx-4 flex overflow-x-auto border-b border-ghana-black/10 px-4 sm:-mx-6 sm:px-6 dark:border-white/10"
          >
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="md:mt-0 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-12">
          {/* Desktop — side navigation */}
          <aside className="hidden md:block">
            <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-ghana-green">Account</p>

            <nav aria-label="Account sections" className="space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-6 space-y-1 border-t border-ghana-black/10 pt-6 dark:border-white/10">
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-ghana-black/70 transition-colors duration-200 hover:text-ghana-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green dark:text-white/70 dark:hover:text-ghana-green"
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  Admin console
                </NavLink>
              )}

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm text-ghana-black/70 transition-colors duration-200 hover:text-ghana-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green dark:text-white/70 dark:hover:text-ghana-red"
              >
                <LogOut size={16} aria-hidden="true" />
                Log out
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

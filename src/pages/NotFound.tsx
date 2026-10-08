import { Link, useLocation } from 'react-router-dom';
import { GlitchBrand } from '../components/GlitchBrand';

/**
 * Invalid route state (Phase G3).
 *
 * One shared "page not found" surface for any URL that matches no route —
 * public, account or admin — so an unknown path never renders a blank screen.
 * It reuses the existing dashed-card empty-state pattern (no redesign) and
 * always offers exactly one way back: home for public paths, the Admin
 * overview for `/admin/*`.
 */
export function NotFound() {
  const { pathname } = useLocation();
  const inAdmin = pathname.startsWith('/admin');

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <GlitchBrand size="corner" />

      <div className="mt-6 rounded-lg border border-dashed border-ghana-black/15 p-8 text-center dark:border-white/15">
        <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green">404</p>
        <h1 className="mt-3 font-display text-3xl text-ghana-black dark:text-white">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ghana-black/60 dark:text-white/60">
          The page you are looking for does not exist or may have been moved.
        </p>

        {inAdmin ? (
          <Link
            to="/admin"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            Back to overview
          </Link>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
            >
              Back to home
            </Link>
            <Link
              to="/shop"
              className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
            >
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

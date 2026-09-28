import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface OverviewCounts {
  activeProducts: number | null;
  draftProducts: number | null;
  categories: number | null;
  collections: number | null;
}

type CountResult = { count: number | null; error: unknown };

/** Read-only counts; a failed query renders as "—" rather than breaking the page. */
const readCount = (result: CountResult): number | null =>
  result.error ? null : result.count ?? 0;

export function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    let active = true;

    const loadCounts = async () => {
      try {
        const [activeProducts, draftProducts, categories, collections] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
          supabase.from('categories').select('id', { count: 'exact', head: true }),
          supabase.from('collections').select('id', { count: 'exact', head: true }),
        ]);

        if (!active) return;

        setCounts({
          activeProducts: readCount(activeProducts),
          draftProducts: readCount(draftProducts),
          categories: readCount(categories),
          collections: readCount(collections),
        });
      } catch (err) {
        console.error('Admin overview counts failed:', err);
      } finally {
        if (active) setLoadingCounts(false);
      }
    };

    void loadCounts();

    return () => {
      active = false;
    };
  }, []);

  const metrics = [
    { label: 'Active products', value: counts?.activeProducts },
    { label: 'Draft products', value: counts?.draftProducts },
    { label: 'Categories', value: counts?.categories },
    { label: 'Collections', value: counts?.collections },
  ];

  const deferred = ['Collections', 'Blog publishing', 'Orders & payments'];

  return (
    <div className="max-w-5xl">
      <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-4">Overview</p>
      <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white mb-4">
        Admin foundation ready
      </h1>
      <p className="text-sm text-ghana-black/60 dark:text-white/60 max-w-xl leading-relaxed">
        Authentication, session persistence and database-verified admin access are active. Products,
        variants, images and categories are now managed from here.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/admin/products"
          className="px-5 py-3 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black"
        >
          Manage products
        </Link>
        <Link
          to="/admin/categories"
          className="px-5 py-3 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green"
        >
          Manage categories
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 bg-white/60 dark:bg-white/[0.03]"
          >
            <p className="font-display text-3xl text-ghana-black dark:text-white">
              {loadingCounts ? '···' : metric.value ?? '—'}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
              {metric.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="font-display text-xl text-ghana-black dark:text-white mb-3">Signed in as</h2>
          <p className="text-sm text-ghana-black/70 dark:text-white/70 break-all">
            {user?.email ?? 'Unknown account'}
          </p>
          <p className="mt-2 text-xs text-ghana-black/50 dark:text-white/50">
            {isAdmin ? 'Admin role verified via is_admin().' : 'Admin role not verified.'}
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-ghana-black dark:text-white mb-3">
            Deferred
          </h2>
          <ul className="space-y-2">
            {deferred.map((item) => (
              <li
                key={item}
                className="text-sm text-ghana-black/60 dark:text-white/60 flex items-center gap-2"
              >
                <span className="w-1 h-1 rounded-full bg-ghana-green" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAdminOrderStats, type AdminOrderStats } from '../../lib/admin/orders';
import { formatCedis } from '../../lib/admin/format';

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
  const [orderStats, setOrderStats] = useState<AdminOrderStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

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

    // Phase E3 — real operational order counts (admin_order_stats re-checks
    // is_admin() server-side). A failure renders as "—" and never blocks the
    // catalogue counts.
    getAdminOrderStats()
      .then((stats) => {
        if (active) setOrderStats(stats);
      })
      .catch((err) => {
        console.error('Admin order stats failed:', err);
      })
      .finally(() => {
        if (active) setLoadingStats(false);
      });

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

  // Real counts only — no invented metrics, no revenue charts.
  const orderMetrics: { label: string; value: number | string | undefined }[] = [
    { label: 'Pending orders', value: orderStats?.pending },
    { label: 'Unpaid orders', value: orderStats?.unpaid },
    { label: 'Processing orders', value: orderStats?.processing },
    { label: 'Shipped orders', value: orderStats?.shipped },
    { label: 'Delivered orders', value: orderStats?.delivered },
    { label: 'Cancelled orders', value: orderStats?.cancelled },
    {
      label: 'Paid order value',
      value: orderStats ? formatCedis(orderStats.paidTotal) : undefined,
    },
  ];

  const deferred = ['Collections', 'Blog publishing', 'Automated payments & receipts'];

  return (
    <div className="max-w-5xl">
      <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-4">Overview</p>
      <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white mb-4">
        Admin foundation ready
      </h1>
      <p className="text-sm text-ghana-black/60 dark:text-white/60 max-w-xl leading-relaxed">
        Authentication, session persistence and database-verified admin access are active. Products,
        variants, images and categories are managed here, alongside customer orders with manual
        payment and fulfilment tracking.
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
        <Link
          to="/admin/orders"
          className="px-5 py-3 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green"
        >
          Manage orders
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

      {/* Phase E3 — operations: real order counts from real rows */}
      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ghana-black dark:text-white">Operations</h2>
          <Link
            to="/admin/orders"
            className="text-[10px] uppercase tracking-[0.22em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Open order queue
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {orderMetrics.map((metric) => (
            <div
              key={metric.label}
              className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 bg-white/60 dark:bg-white/[0.03]"
            >
              <p className="font-display text-3xl text-ghana-black dark:text-white">
                {loadingStats ? '···' : metric.value ?? '—'}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                {metric.label}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-ghana-black/50 dark:text-white/50">
          Counts come from real orders. Payment status is maintained manually — there is no
          automated payment provider yet, and nothing here is a projected revenue figure.
        </p>
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

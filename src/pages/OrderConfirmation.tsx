import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GlitchBrand } from '../components/GlitchBrand';
import { DownloadInvoiceButton } from '../components/orders/DownloadInvoiceButton';
import { OrderDetailView } from '../components/account/OrderDetailView';
import { formatOrderDate, getMyOrder, type OrderDetail } from '../lib/account/orders';

/**
 * Order confirmation (Phase E1, extended in E2).
 *
 * Read-only view of the order that was just placed, loaded by its human-readable
 * order number. RLS restricts the read to the order's owner, so a foreign number
 * simply resolves to "not found" — no existence leak.
 *
 * The body is the same shared `OrderDetailView` used by `/account/orders/:orderNumber`,
 * so an order renders identically everywhere and always from its SNAPSHOT
 * columns. E2 adds the link through to the durable account order page.
 *
 * The wording never claims a payment: every order is created `unpaid`, and any
 * later payment is verified server-side before it is shown as paid.
 */
export function OrderConfirmation() {
  const { user } = useAuth();
  const { orderNumber = '' } = useParams<{ orderNumber: string }>();
  const userId = user?.id ?? '';

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !orderNumber) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setOrder(await getMyOrder(userId, orderNumber));
    } catch (err) {
      console.error('Order load failed:', err);
      setError('We could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [userId, orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex flex-col">
        <div className="flex-grow flex items-center justify-center px-4 py-16">
          <div role="status" aria-live="polite" className="text-center">
            <div
              aria-hidden="true"
              className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-ghana-green dark:border-gray-700 dark:border-t-ghana-green"
            />
            <p className="text-lg text-gray-600 dark:text-gray-400">Loading your order…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p role="alert" className="text-sm text-ghana-red">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold text-ghana-black dark:text-white">Order not found</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            We could not find an order with the reference <strong>{orderNumber}</strong> on your
            account.
          </p>
          <Link
            to="/account/orders"
            className="btn-primary bg-ghana-green text-white mt-8 inline-flex items-center gap-2"
          >
            Go to your orders
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ghana-green/10 text-ghana-green"
            >
              <CheckCircle2 size={22} />
            </span>
            <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green">
              Order recorded
            </p>
          </div>

          {/* Brand signature above the confirmation heading (page surface). */}
          <div className="mt-5">
            <GlitchBrand size="lg" />
          </div>

          <h1 className="mt-5 text-4xl font-bold text-ghana-black dark:text-white md:text-5xl">
            Thank you — your order is in
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            We have saved your order against your account. No payment has been taken.
          </p>

          <dl className="mt-8 grid gap-4 rounded-lg bg-white p-6 sm:grid-cols-2 dark:bg-ghana-black">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Order number
              </dt>
              <dd className="mt-1 font-mono text-base text-ghana-black dark:text-white">
                {order.orderNumber}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Placed
              </dt>
              <dd className="mt-1 text-base text-ghana-black dark:text-white">
                {formatOrderDate(order.createdAt, true)}
              </dd>
            </div>
          </dl>
        </motion.div>

        <div className="mt-8">
          <OrderDetailView order={order} />
        </div>

        {/* Phase F2 — Pay Now is available in the shared OrderDetailView above
            (unpaid/failed and not cancelled). This panel points to the customer
            payment center for the full payment record. */}
        {order.paymentStatus === 'unpaid' && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
            <div>
              <p className="text-sm font-medium text-ghana-black dark:text-white">
                Payment outstanding
              </p>
              <p className="mt-1 text-xs text-ghana-black/60 dark:text-white/60">
                No payment has been recorded for this order yet.
              </p>
            </div>
            <Link
              to={`/account/payments/${order.orderNumber}`}
              className="text-xs uppercase tracking-[0.16em] text-ghana-green transition-colors duration-200 hover:text-ghana-black dark:hover:text-white"
            >
              View Payment
            </Link>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {/* Downloads are generated from the order's current recorded state,
              so this document always matches what the account pages show. */}
          <DownloadInvoiceButton
            userId={userId}
            orderNumber={order.orderNumber}
            order={order}
            variant="primary"
          />
          <Link
            to={`/account/orders/${order.orderNumber}`}
            className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
          >
            View Order
          </Link>
          <Link
            to="/shop"
            className="btn-secondary border-ghana-green text-ghana-green inline-flex items-center gap-2"
          >
            Continue Shopping
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

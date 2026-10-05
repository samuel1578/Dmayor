import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GlitchBrand } from '../../components/GlitchBrand';
import { DownloadInvoiceButton } from '../../components/orders/DownloadInvoiceButton';
import { OrderDetailView } from '../../components/account/OrderDetailView';
import {
  PAYMENT_STATUS_LABELS,
  formatOrderDate,
  getMyOrder,
  type OrderDetail,
} from '../../lib/account/orders';

/**
 * Order detail (Phase E2) — one order, read-only.
 *
 * `getMyOrder` is scoped to the session user id and RLS enforces ownership on
 * top of that, so another customer's order number resolves to `null` exactly
 * like a number that does not exist: the not-found state below never reveals
 * whether someone else's order exists.
 *
 * Customers are read-only here — no status changes, no totals, no cancellation.
 */
export function AccountOrderDetail() {
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
      console.error('Order detail load failed:', err);
      setError('We could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [userId, orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const backLink = (
    <Link
      to="/account/orders"
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-black/60 transition-colors hover:text-ghana-green dark:text-white/60"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      All orders
    </Link>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <p className="mt-6 text-sm text-ghana-black/50 dark:text-white/50">Loading order…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {backLink}
        <div
          role="alert"
          className="mt-6 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        {backLink}
        <div className="mt-8 rounded-lg border border-dashed border-ghana-black/15 p-8 text-center dark:border-white/15">
          <h1 className="font-display text-2xl text-ghana-black dark:text-white">
            Order not found
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ghana-black/60 dark:text-white/60">
            We could not find that order on your account. Check the order number or pick one from
            your order history.
          </p>
          <Link
            to="/account/orders"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {backLink}

      <div className="mt-4">
        {/* Brand signature above the order header, clear of the order number,
            status blocks and timeline below. */}
        <div className="mb-3">
          <GlitchBrand size="corner" />
        </div>

        <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green">Order</p>
        <h1 className="mt-2 font-mono text-3xl text-ghana-black sm:text-4xl dark:text-white">
          {order.orderNumber}
        </h1>
        <p className="mt-2 text-sm text-ghana-black/60 dark:text-white/60">
          Placed {formatOrderDate(order.createdAt, true)}
        </p>
      </div>

      <div className="mt-8">
        <OrderDetailView order={order} />
      </div>

      {/* Phase H0.2 — restrained payment action area linking to the payment
          center. Payment metadata is not duplicated here. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
        <p className="text-sm text-ghana-black/70 dark:text-white/70">
          Payment:{' '}
          <span className="font-medium text-ghana-black dark:text-white">
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
        </p>
        <Link
          to={`/account/payments/${order.orderNumber}`}
          className="text-xs uppercase tracking-[0.16em] text-ghana-green transition-colors duration-200 hover:text-ghana-black dark:hover:text-white"
        >
          {order.paymentStatus === 'paid' ? 'Payment Details' : 'View Payment'}
        </Link>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {/* Always generated from the CURRENT recorded state, so a status change
            by Admin is reflected in the next download. */}
        <DownloadInvoiceButton
          userId={userId}
          orderNumber={order.orderNumber}
          order={order}
          variant="primary"
        />
        <Link
          to="/account/orders"
          className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
        >
          Back to orders
        </Link>
        <Link
          to="/shop"
          className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

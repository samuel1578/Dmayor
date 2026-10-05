import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { countAddresses } from '../../lib/account/addresses';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  countMyOrders,
  formatItemCount,
  formatOrderDate,
  getRecentOrder,
  type OrderSummary,
} from '../../lib/account/orders';
import { formatGhs } from '../../lib/catalogue/products';
import {
  PAYMENT_STATE_TITLES,
  countMyPaymentsByStatus,
  listMyPayments,
  type CustomerPayment,
} from '../../lib/account/payments';
import { GlitchBrand } from '../../components/GlitchBrand';
import { DownloadInvoiceButton } from '../../components/orders/DownloadInvoiceButton';

/**
 * Account Overview (Phase D3) — real data only.
 *
 * Shows the customer's name, email, profile completion, saved-address count,
 * current persistent cart count and real order data (Phase E2): how many orders
 * exist and the most recent one, with an honest empty state when there are none.
 * Deliberately NO invented spend, loyalty points or membership tier.
 */

export function AccountOverview() {
  const { user, profile, profileError, refreshProfile } = useAuth();
  const { itemCount } = useCart();

  const [addressCount, setAddressCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  /** `undefined` = still loading, `null` = loaded and genuinely no orders. */
  const [recentOrder, setRecentOrder] = useState<OrderSummary | null | undefined>(undefined);
  /** Phase H0.2 — payment summary derived from the customer's own orders. */
  const [payments, setPayments] = useState<CustomerPayment[] | null>(null);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    countAddresses(userId)
      .then((count) => {
        if (!cancelled) setAddressCount(count);
      })
      .catch((err) => {
        // Overview degrades gracefully — the Addresses page reports load errors.
        console.error('Address count failed:', err);
      });

    countMyOrders(userId)
      .then((count) => {
        if (!cancelled) setOrderCount(count);
      })
      .catch((err) => {
        // Overview degrades gracefully — the Orders page reports load errors.
        console.error('Order count failed:', err);
      });

    getRecentOrder(userId)
      .then((order) => {
        if (!cancelled) setRecentOrder(order);
      })
      .catch((err) => {
        console.error('Recent order load failed:', err);
        if (!cancelled) setRecentOrder(null);
      });

    // One list query feeds both the counts and the most recent payment (no N+1).
    listMyPayments(userId)
      .then((records) => {
        if (!cancelled) setPayments(records);
      })
      .catch((err) => {
        console.error('Payment summary load failed:', err);
        if (!cancelled) setPayments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const paymentCounts = useMemo(() => countMyPaymentsByStatus(payments ?? []), [payments]);
  const recentPayment = payments && payments.length > 0 ? payments[0] : null;

  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'there';

  const checks = [
    { label: 'Full name', done: Boolean(profile?.fullName), to: '/account/profile' },
    { label: 'Phone', done: Boolean(profile?.phone), to: '/account/profile' },
    { label: 'Saved address', done: (addressCount ?? 0) > 0, to: '/account/addresses' },
  ];
  const completed = checks.filter((check) => check.done).length;

  return (
    <>
      {/* Mobile — solid brand block pinned under the navbar while cards scroll */}
      <GlitchBrand variant="sticky" />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h1 className="font-display text-4xl text-ghana-black sm:text-5xl dark:text-white">
            Hello, {displayName}
          </h1>
          {/* Desktop — glitched brand mark, right-aligned in the hero row */}
          <div className="hidden md:ml-auto md:block">
            <GlitchBrand />
          </div>
        </div>
        <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
          Your details, saved addresses, cart and orders — all in one place.
        </p>

        {profileError && (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
          >
            <p>{profileError}</p>
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {/* Real counts — addresses, cart and orders */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
            <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              Saved addresses
            </p>
            <p className="mt-2 font-display text-3xl text-ghana-black dark:text-white">
              {addressCount === null ? '—' : addressCount}
            </p>
            <Link
              to="/account/addresses"
              className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              Manage addresses
            </Link>
          </div>

          <div className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
            <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              Items in cart
            </p>
            <p className="mt-2 font-display text-3xl text-ghana-black dark:text-white">{itemCount}</p>
            <Link
              to="/cart"
              className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              View cart
            </Link>
          </div>

          <div className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
            <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              Orders placed
            </p>
            <p className="mt-2 font-display text-3xl text-ghana-black dark:text-white">
              {orderCount === null ? '—' : orderCount}
            </p>
            <Link
              to="/account/orders"
              className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              View orders
            </Link>
          </div>
        </div>

        {/* Most recent order — real data, or an honest empty state */}
        <div className="mt-6 rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-ghana-black dark:text-white">
              Most recent order
            </h2>
            <Link
              to="/account/orders"
              className="text-[10px] uppercase tracking-[0.22em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              All orders
            </Link>
          </div>

          {recentOrder === undefined && (
            <p className="mt-4 text-sm text-ghana-black/50 dark:text-white/50">
              Loading your orders…
            </p>
          )}

          {recentOrder === null && (
            <div className="mt-4">
              <p className="text-sm text-ghana-black/60 dark:text-white/60">
                You have not placed an order yet.
              </p>
              <Link
                to="/shop"
                className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
              >
                Start shopping
              </Link>
            </div>
          )}

          {recentOrder && userId && (
            <div className="mt-4 rounded-lg border border-ghana-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <Link
                    to={`/account/orders/${recentOrder.orderNumber}`}
                    className="font-mono text-sm text-ghana-black transition-colors duration-200 hover:text-ghana-green dark:text-white"
                  >
                    {recentOrder.orderNumber}
                  </Link>
                  <p className="mt-1 text-xs text-ghana-black/55 dark:text-white/55">
                    {formatOrderDate(recentOrder.createdAt)} ·{' '}
                    {formatItemCount(recentOrder.itemCount)}
                  </p>
                </div>
                <p className="font-display text-2xl text-ghana-black dark:text-white">
                  {formatGhs(recentOrder.totalAmount)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60">
                <span className={recentOrder.status === 'cancelled' ? 'text-ghana-red' : ''}>
                  {ORDER_STATUS_LABELS[recentOrder.status]}
                </span>
                <span>Payment: {PAYMENT_STATUS_LABELS[recentOrder.paymentStatus]}</span>
              </div>

              {/* Restrained: one view action and one invoice download, not an
                  invoice UI in every account section. */}
              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-ghana-black/10 pt-3 dark:border-white/10">
                <Link
                  to={`/account/orders/${recentOrder.orderNumber}`}
                  className="text-xs uppercase tracking-[0.16em] text-ghana-green transition-colors duration-200 hover:text-ghana-black dark:hover:text-white"
                >
                  View order
                </Link>
                <DownloadInvoiceButton
                  userId={userId}
                  orderNumber={recentOrder.orderNumber}
                  variant="quiet"
                />
              </div>
            </div>
          )}
        </div>

        {/* Phase H0.2 — payment summary. Real counts and the latest recorded
            state only: no wallet, balance, loyalty points or card details. */}
        <div className="mt-6 rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-ghana-black dark:text-white">Payments</h2>
            <Link
              to="/account/payments"
              className="text-[10px] uppercase tracking-[0.22em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              View Payments
            </Link>
          </div>

          {payments === null && (
            <p className="mt-4 text-sm text-ghana-black/50 dark:text-white/50">
              Loading your payments…
            </p>
          )}

          {payments !== null && payments.length === 0 && (
            <p className="mt-4 text-sm text-ghana-black/60 dark:text-white/60">
              No payment records yet — they appear here once you place an order.
            </p>
          )}

          {payments !== null && payments.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                    Unpaid orders
                  </p>
                  <p className="mt-1 font-display text-2xl text-ghana-black dark:text-white">
                    {paymentCounts.unpaid}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                    Paid orders
                  </p>
                  <p className="mt-1 font-display text-2xl text-ghana-black dark:text-white">
                    {paymentCounts.paid}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                    Most recent payment
                  </p>
                  <p className="mt-1 text-sm text-ghana-black dark:text-white">
                    {recentPayment
                      ? `${recentPayment.orderNumber} · ${PAYMENT_STATE_TITLES[recentPayment.paymentStatus]}`
                      : '—'}
                  </p>
                </div>
              </div>

              {recentPayment && (
                <p className="mt-3 text-xs text-ghana-black/50 dark:text-white/50">
                  Current status: {PAYMENT_STATUS_LABELS[recentPayment.paymentStatus]}. Payment is
                  tracked separately from order progress.
                </p>
              )}
            </>
          )}
        </div>

        {/* Profile completion — real fields only */}
        <div className="mt-6 rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-ghana-black dark:text-white">
              Profile completion
            </h2>
            <span className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              {completed} of {checks.length} complete
            </span>
          </div>

          <ul className="mt-5 space-y-3 text-sm">
            {checks.map((check) => (
              <li
                key={check.label}
                className="flex items-center justify-between gap-4 border-b border-ghana-black/5 pb-3 last:border-0 last:pb-0 dark:border-white/5"
              >
                <span className="flex items-center gap-3 text-ghana-black dark:text-white">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      check.done ? 'bg-ghana-green text-white' : 'bg-ghana-black/10 text-ghana-black/50 dark:bg-white/10 dark:text-white/50'
                    }`}
                    aria-hidden="true"
                  >
                    {check.done ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                  </span>
                  {check.label}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  {check.done ? 'Complete' : 'Add now'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/shop"
            className="btn-primary bg-ghana-green text-white disabled:opacity-60"
          >
            Continue shopping
          </Link>
          <Link
            to="/account/profile"
            className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
          >
            Manage profile
          </Link>
          <Link
            to="/account/addresses"
            className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
          >
            Manage addresses
          </Link>
        </div>
      </motion.div>
    </>
  );
}

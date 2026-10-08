import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GlitchBrand } from '../../components/GlitchBrand';
import { formatGhs } from '../../lib/catalogue/products';
import { formatOrderDate } from '../../lib/account/orders';
import {
  PAYMENT_FILTERS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATE_TITLES,
  countMyPaymentsByStatus,
  listMyPayments,
  paymentChannelLabel,
  paymentMatchesFilter,
  paymentProviderLabel,
  paymentReferenceLabel,
  paymentSourceLabel,
  paymentStateNote,
  type CustomerPayment,
  type PaymentFilter,
} from '../../lib/account/payments';

/**
 * Customer payment center (Phase H0.2) — the customer's own payment records,
 * derived from their own order rows and scoped by RLS to `auth.uid()`.
 *
 * Read-only: the customer cannot change a payment state. `Manual` / `Paystack`
 * / `Not recorded` labels are shown honestly; nothing is fabricated. Starting a
 * payment (Pay Now / Retry) lives on the payment detail page and is always
 * verified server-side before an order becomes paid.
 *
 * Filters are applied to the already-loaded list (no extra requests).
 */
function statusTextClass(status: CustomerPayment['paymentStatus']): string {
  if (status === 'paid') return 'text-ghana-green';
  if (status === 'failed' || status === 'refunded') return 'text-ghana-red';
  return 'text-ghana-black/60 dark:text-white/60';
}

export function AccountPayments() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [payments, setPayments] = useState<CustomerPayment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');

  const load = useCallback(async () => {
    if (!userId) return;

    setLoadError(null);

    try {
      setPayments(await listMyPayments(userId));
    } catch (err) {
      console.error('Payment list load failed:', err);
      setLoadError('We could not load your payments.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => countMyPaymentsByStatus(payments ?? []), [payments]);
  const visiblePayments = useMemo(
    () => (payments ?? []).filter((payment) => paymentMatchesFilter(payment, filter)),
    [payments, filter],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          {/* Brand signature (page surface), restrained beside the heading. */}
          <div className="mb-3">
            <GlitchBrand size="corner" />
          </div>

          <h1 className="font-display text-4xl text-ghana-black sm:text-5xl dark:text-white">
            Payments
          </h1>
          <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
            Payment records for your orders, newest first. Payment is recorded by our team and
            tracked separately from order progress.
          </p>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {payments === null && !loadError && (
        <p className="mt-8 text-sm text-ghana-black/50 dark:text-white/50">Loading payments…</p>
      )}

      {payments !== null && payments.length === 0 && !loadError && (
        <div className="mt-8 rounded-lg border border-dashed border-ghana-black/15 p-8 text-center dark:border-white/15">
          <span
            aria-hidden="true"
            className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-ghana-black/5 dark:bg-white/5"
          >
            <Wallet size={28} className="text-ghana-black/40 dark:text-white/40" />
          </span>
          <h2 className="font-display text-2xl text-ghana-black dark:text-white">
            No payments yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ghana-black/60 dark:text-white/60">
            Once you place an order, its payment record will appear here.
          </p>
          <Link
            to="/shop"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            Start shopping
          </Link>
        </div>
      )}

      {payments !== null && payments.length > 0 && !loadError && (
        <>
          <div
            role="group"
            aria-label="Filter payments"
            className="mt-8 flex flex-wrap gap-2 border-b border-ghana-black/10 pb-4 dark:border-white/10"
          >
            {PAYMENT_FILTERS.map((option) => {
              const active = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors duration-200 ${
                    active
                      ? 'bg-ghana-green text-white'
                      : 'text-ghana-black/60 hover:text-ghana-black dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  {option.label} ({counts[option.id]})
                </button>
              );
            })}
          </div>

          {visiblePayments.length === 0 ? (
            <p className="mt-8 text-sm text-ghana-black/60 dark:text-white/60">
              No payments in this filter.
            </p>
          ) : (
            <ul className="mt-8 space-y-4">
              {visiblePayments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10"
                >
                  {/* The card is not itself a link: the actions below are real
                      links, and interactive elements are never nested. */}
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                    <div className="min-w-0">
                      <Link
                        to={`/account/payments/${payment.orderNumber}`}
                        className="font-mono text-sm text-ghana-black transition-colors duration-200 hover:text-ghana-green dark:text-white"
                      >
                        {payment.orderNumber}
                      </Link>
                      <p className="mt-1 text-xs text-ghana-black/55 dark:text-white/55">
                        {formatOrderDate(payment.createdAt)}
                      </p>
                    </div>

                    <p className="font-display text-2xl text-ghana-black dark:text-white">
                      {formatGhs(payment.totalAmount)}
                    </p>
                  </div>

                  {/* Payment state as text — never colour-only. */}
                  <p className={`mt-4 text-[10px] uppercase tracking-[0.16em] ${statusTextClass(payment.paymentStatus)}`}>
                    {PAYMENT_STATE_TITLES[payment.paymentStatus]} ·{' '}
                    {PAYMENT_STATUS_LABELS[payment.paymentStatus]}
                  </p>
                  <p className="mt-1 text-xs text-ghana-black/60 dark:text-white/60">
                    {paymentStateNote(payment)}
                  </p>

                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-ghana-black/10 pt-4 text-xs sm:grid-cols-2 dark:border-white/10">
                    <div className="flex justify-between gap-4">
                      <dt className="text-ghana-black/50 dark:text-white/50">Source</dt>
                      <dd className="text-right text-ghana-black/80 dark:text-white/80">
                        {paymentSourceLabel(payment.paymentSource)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-ghana-black/50 dark:text-white/50">Provider</dt>
                      <dd className="text-right text-ghana-black/80 dark:text-white/80">
                        {paymentProviderLabel(payment.paymentProvider)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-ghana-black/50 dark:text-white/50">Channel</dt>
                      <dd className="text-right text-ghana-black/80 dark:text-white/80">
                        {paymentChannelLabel(payment.paymentChannel)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-ghana-black/50 dark:text-white/50">Reference</dt>
                      <dd className="break-all text-right font-mono text-ghana-black/80 dark:text-white/80">
                        {paymentReferenceLabel(payment.paymentReference)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 sm:col-span-2">
                      <dt className="text-ghana-black/50 dark:text-white/50">
                        Latest payment update
                      </dt>
                      <dd className="text-right text-ghana-black/80 dark:text-white/80">
                        {payment.paymentUpdatedAt
                          ? formatOrderDate(payment.paymentUpdatedAt, true)
                          : 'No update recorded'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ghana-black/10 pt-4 dark:border-white/10">
                    <Link
                      to={`/account/payments/${payment.orderNumber}`}
                      className="text-xs uppercase tracking-[0.16em] text-ghana-green transition-colors duration-200 hover:text-ghana-black dark:hover:text-white"
                    >
                      {payment.paymentStatus === 'paid' ? 'Payment details' : 'View payment'}
                    </Link>
                    <Link
                      to={`/account/orders/${payment.orderNumber}`}
                      className="text-xs uppercase tracking-[0.16em] text-ghana-black/60 transition-colors duration-200 hover:text-ghana-green dark:text-white/60 dark:hover:text-ghana-green"
                    >
                      View order
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

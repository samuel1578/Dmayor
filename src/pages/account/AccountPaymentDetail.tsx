import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GlitchBrand } from '../../components/GlitchBrand';
import { DownloadInvoiceButton } from '../../components/orders/DownloadInvoiceButton';
import { PaymentAction } from '../../components/payments/PaymentAction';
import { formatGhs } from '../../lib/catalogue/products';
import { customerStatusLabel, formatOrderDate } from '../../lib/account/orders';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATE_TITLES,
  getMyPayment,
  paymentChannelLabel,
  paymentProviderLabel,
  paymentReferenceLabel,
  paymentSourceLabel,
  paymentStateNote,
  type CustomerPayment,
} from '../../lib/account/payments';

/**
 * Customer payment detail (Phase H0.2) — one order's payment record.
 *
 * Read-only and derived from the customer's own order row. `getMyPayment` is
 * scoped to the session user id and RLS enforces ownership on top, so another
 * customer's order number resolves to `null` exactly like a number that does
 * not exist: the not-found state below never reveals whether someone else's
 * payment exists.
 *
 * Phase F2 activates `Pay Now` / `Retry Payment` through the shared
 * `PaymentAction`, which hands off to Paystack hosted checkout and returns via
 * `/payment/callback`. The order is only marked paid by the server after a
 * server-to-server verification; nothing here trusts the client.
 *
 * The full order lives on `/account/orders/:orderNumber`; this page shows only
 * a restrained summary and links across rather than duplicating it.
 */
export function AccountPaymentDetail() {
  const { user } = useAuth();
  const { orderNumber = '' } = useParams<{ orderNumber: string }>();
  const userId = user?.id ?? '';

  const [payment, setPayment] = useState<CustomerPayment | null>(null);
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
      setPayment(await getMyPayment(userId, orderNumber));
    } catch (err) {
      console.error('Payment detail load failed:', err);
      setError('We could not load this payment.');
    } finally {
      setLoading(false);
    }
  }, [userId, orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const backLink = (
    <Link
      to="/account/payments"
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-black/60 transition-colors hover:text-ghana-green dark:text-white/60"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      All payments
    </Link>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <p className="mt-6 text-sm text-ghana-black/50 dark:text-white/50">Loading payment…</p>
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

  if (!payment) {
    return (
      <div>
        {backLink}
        <div className="mt-8 rounded-lg border border-dashed border-ghana-black/15 p-8 text-center dark:border-white/15">
          <h1 className="font-display text-2xl text-ghana-black dark:text-white">
            Payment not found
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ghana-black/60 dark:text-white/60">
            We could not find a payment for that order on your account. Check the order number or
            pick one from your payments.
          </p>
          <Link
            to="/account/payments"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            Back to payments
          </Link>
        </div>
      </div>
    );
  }

  const manual = payment.paymentSource === 'manual';

  return (
    <div>
      {backLink}

      <div className="mt-4">
        {/* Brand signature above the heading, restrained and clear of status. */}
        <div className="mb-3">
          <GlitchBrand size="corner" />
        </div>

        <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green">Payment</p>
        <h1 className="mt-2 font-mono text-3xl text-ghana-black sm:text-4xl dark:text-white">
          {payment.orderNumber}
        </h1>
        <p className="mt-2 text-sm text-ghana-black/60 dark:text-white/60">
          Order placed {formatOrderDate(payment.createdAt, true)}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ------------------------------ Payment --------------------------- */}
        <section className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 lg:col-span-2 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
                Payment status
              </p>
              <p className="mt-2 font-display text-3xl text-ghana-black dark:text-white">
                {/* Text first — colour is never the only signal. */}
                {PAYMENT_STATE_TITLES[payment.paymentStatus]}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ghana-black/50 dark:text-white/50">
                {PAYMENT_STATUS_LABELS[payment.paymentStatus]}
              </p>
            </div>
            <p className="font-display text-3xl text-ghana-green">
              {formatGhs(payment.totalAmount)}
            </p>
          </div>

          <p className="mt-4 text-sm text-ghana-black/70 dark:text-white/70">
            {paymentStateNote(payment)}
          </p>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-ghana-black/10 pt-5 text-sm sm:grid-cols-2 dark:border-white/10">
            <div className="flex justify-between gap-4">
              <dt className="text-ghana-black/50 dark:text-white/50">Source</dt>
              <dd className="text-right text-ghana-black dark:text-white">
                {paymentSourceLabel(payment.paymentSource)}
                {manual && (
                  <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-ghana-black/45 dark:text-white/45">
                    Recorded manually
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ghana-black/50 dark:text-white/50">Provider</dt>
              <dd className="text-right text-ghana-black dark:text-white">
                {paymentProviderLabel(payment.paymentProvider)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ghana-black/50 dark:text-white/50">Channel</dt>
              <dd className="text-right text-ghana-black dark:text-white">
                {paymentChannelLabel(payment.paymentChannel)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ghana-black/50 dark:text-white/50">Reference</dt>
              <dd className="break-all text-right font-mono text-ghana-black dark:text-white">
                {paymentReferenceLabel(payment.paymentReference)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ghana-black/50 dark:text-white/50">Amount</dt>
              <dd className="text-right text-ghana-black dark:text-white">
                {formatGhs(payment.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ghana-black/50 dark:text-white/50">Currency</dt>
              <dd className="text-right text-ghana-black dark:text-white">{payment.currency}</dd>
            </div>
            {payment.paidAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-ghana-black/50 dark:text-white/50">Paid</dt>
                <dd className="text-right text-ghana-black dark:text-white">
                  {formatOrderDate(payment.paidAt, true)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 sm:col-span-2">
              <dt className="text-ghana-black/50 dark:text-white/50">Last payment update</dt>
              <dd className="text-right text-ghana-black dark:text-white">
                {payment.paymentUpdatedAt
                  ? formatOrderDate(payment.paymentUpdatedAt, true)
                  : 'No update recorded'}
              </dd>
            </div>
          </dl>
        </section>

        {/* ---------------------------- State CTA --------------------------- */}
        <div className="space-y-6">
          {/* Unpaid — Pay Now via the shared payment action. Suppressed for a
              cancelled order (no online payment on a cancelled order). */}
          {payment.paymentStatus === 'unpaid' && payment.orderStatus !== 'cancelled' && (
            <section className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Payment outstanding
              </h2>
              <p className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
                No payment has been recorded for this order yet.
              </p>
              <PaymentAction
                orderId={payment.id}
                paymentStatus={payment.paymentStatus}
                orderStatus={payment.orderStatus}
                className="mt-4"
              />
            </section>
          )}

          {/* Failed — Retry Payment starts a NEW attempt/server reference. */}
          {payment.paymentStatus === 'failed' && payment.orderStatus !== 'cancelled' && (
            <section className="rounded-lg border border-ghana-red/40 p-5 sm:p-6">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Payment failed
              </h2>
              <p className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
                The last payment attempt did not go through. You can try again.
              </p>
              <PaymentAction
                orderId={payment.id}
                paymentStatus={payment.paymentStatus}
                orderStatus={payment.orderStatus}
                className="mt-4"
              />
            </section>
          )}

          {/* Paid — factual confirmation, never implying an online provider. */}
          {payment.paymentStatus === 'paid' && (
            <section className="rounded-lg border border-ghana-green/40 p-5 sm:p-6">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Payment received
              </h2>
              <p className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
                {manual
                  ? 'Recorded manually by our team.'
                  : 'This order has been marked as paid.'}
              </p>
              <dl className="mt-4 space-y-2 text-xs">
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
                {payment.paidAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Paid date</dt>
                    <dd className="text-right text-ghana-black/80 dark:text-white/80">
                      {formatOrderDate(payment.paidAt, true)}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Refunded — recorded status only; no automated refund implied. */}
          {payment.paymentStatus === 'refunded' && (
            <section className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Refund recorded
              </h2>
              <p className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
                {paymentStateNote(payment)}
              </p>
            </section>
          )}

          {/* --------------------------- Related order ---------------------- */}
          <section className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">Related order</h2>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-ghana-black/50 dark:text-white/50">Order number</dt>
                <dd className="font-mono text-right text-ghana-black/80 dark:text-white/80">
                  {payment.orderNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ghana-black/50 dark:text-white/50">Fulfilment</dt>
                <dd className="text-right text-ghana-black/80 dark:text-white/80">
                  {customerStatusLabel(payment.orderStatus)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 text-[11px] text-ghana-black/50 dark:text-white/50">
              <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-ghana-green" />
              Payment status and order progress are tracked separately.
            </p>
            <Link
              to={`/account/orders/${payment.orderNumber}`}
              className="mt-4 inline-flex text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              View order
            </Link>
          </section>

          {/* ------------------------------- Invoice ------------------------ */}
          {userId && (
            <section className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">Invoice</h2>
              <p className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
                Generated from this order's current recorded state.
              </p>
              <div className="mt-4">
                <DownloadInvoiceButton
                  userId={userId}
                  orderNumber={payment.orderNumber}
                  variant="secondary"
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import {
  PAYMENT_SOURCE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  adminPaymentErrorMessage,
  getAdminPayment,
  listAdminPaymentAttempts,
  setAdminManualPayment,
  type AdminPaymentAttempt,
  type AdminPaymentDetail,
} from '../../lib/admin/payments';
import { ORDER_STATUS_LABELS } from '../../lib/admin/orders';
import { PaymentRequestError, reconcilePaystackPayment } from '../../lib/payments/paystack';
import type { OrderPaymentStatus } from '../../lib/supabase';
import { formatAdminDateTime, formatCedis } from '../../lib/admin/format';

type Feedback = { status: 'saved' | 'error'; message: string } | null;

function paymentPillClass(paymentStatus: OrderPaymentStatus): string {
  if (paymentStatus === 'paid') return 'border-ghana-green text-ghana-green';
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
    return 'border-ghana-red/60 text-ghana-red';
  }
  return 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70';
}

/**
 * Admin payment detail (Phase H0.1) — one order's payment record.
 *
 * Two write paths, both admin-only and server-authoritative:
 *   - `setAdminManualPayment` records a manual payment (hard-codes
 *     `payment_source = 'manual'`); the client never sends a payment source.
 *   - `reconcilePaystackPayment` asks the server to re-check the order's
 *     Paystack attempt against Paystack. The browser sends only the order id;
 *     the server performs all verification and the trusted finalizer decides.
 *
 * No money is charged from this page and fulfilment status is never touched:
 * payment and order status remain independent.
 */
export function AdminPaymentDetail() {
  const { orderId = '' } = useParams<{ orderId: string }>();

  const [payment, setPayment] = useState<AdminPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState<AdminPaymentAttempt[]>([]);
  const [reconciling, setReconciling] = useState(false);

  const [statusDraft, setStatusDraft] = useState<OrderPaymentStatus>('unpaid');
  const [reference, setReference] = useState('');
  const [provider, setProvider] = useState('');
  const [channel, setChannel] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<OrderPaymentStatus | null>(null);

  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [detail, attemptRows] = await Promise.all([
        getAdminPayment(orderId),
        // Attempts are additive: a failure here must not break the page.
        listAdminPaymentAttempts(orderId).catch(() => [] as AdminPaymentAttempt[]),
      ]);
      setPayment(detail);
      setAttempts(attemptRows);
      setStatusDraft(detail.paymentStatus);
      setReference(detail.paymentReference ?? '');
      setProvider(detail.paymentProvider ?? '');
      setChannel(detail.paymentChannel ?? '');
    } catch (err) {
      console.error('Admin payment load failed:', err);
      setLoadError(adminPaymentErrorMessage(err, 'Could not load this payment.'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (status: OrderPaymentStatus) => {
    if (!payment || busy) return;

    setBusy(true);
    setFeedback(null);

    try {
      await setAdminManualPayment({
        orderId: payment.id,
        paymentStatus: status,
        reference,
        provider,
        channel,
      });
      const refreshed = await getAdminPayment(payment.id);
      setPayment(refreshed);
      setStatusDraft(refreshed.paymentStatus);
      setReference(refreshed.paymentReference ?? '');
      setProvider(refreshed.paymentProvider ?? '');
      setChannel(refreshed.paymentChannel ?? '');
      setFeedback({
        status: 'saved',
        message: `Payment record saved as ${PAYMENT_STATUS_LABELS[status]}.`,
      });
    } catch (err) {
      console.error('Admin payment update failed:', err);
      setFeedback({ status: 'error', message: adminPaymentErrorMessage(err) });
    } finally {
      setBusy(false);
      setPendingConfirm(null);
    }
  };

  /** `paid` and `refunded` are deliberate, money-related acts — always confirm. */
  const requestSave = () => {
    if (!payment) return;
    if (statusDraft === 'paid' || statusDraft === 'refunded') setPendingConfirm(statusDraft);
    else void apply(statusDraft);
  };

  /** Admin re-check: the server contacts Paystack; the browser sends only the id. */
  const runReconcile = async () => {
    if (!payment || reconciling) return;

    setReconciling(true);
    setFeedback(null);

    try {
      const result = await reconcilePaystackPayment(payment.id);
      await load();
      setFeedback({
        status: 'saved',
        message:
          result.status === 'paid'
            ? `Paystack confirms payment for ${result.orderNumber}.`
            : `Paystack has no completed payment for ${result.orderNumber} yet.`,
      });
    } catch (err) {
      console.error('Re-check Paystack failed:', err);
      setFeedback({
        status: 'error',
        message:
          err instanceof PaymentRequestError
            ? err.message
            : 'We could not re-check this payment. Please try again.',
      });
    } finally {
      setReconciling(false);
    }
  };

  const backLink = (
    <Link
      to="/admin/payments"
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60 transition-colors duration-200 hover:text-ghana-green"
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

  if (loadError || !payment) {
    return (
      <div>
        {backLink}
        <div role="alert" className="mt-6 text-sm text-ghana-red">
          <p>{loadError ?? 'That payment could not be loaded.'}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {backLink}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">Payment</p>
          <h1 className="font-mono text-3xl sm:text-4xl text-ghana-black dark:text-white">
            {payment.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-ghana-black/60 dark:text-white/60">
            Order placed {formatAdminDateTime(payment.createdAt)}
          </p>
        </div>

        <span
          className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 ${paymentPillClass(
            payment.paymentStatus,
          )}`}
        >
          {PAYMENT_STATUS_LABELS[payment.paymentStatus]}
        </span>
      </div>

      {feedback && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={`mt-6 text-sm ${
            feedback.status === 'error' ? 'text-ghana-red' : 'text-ghana-green'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* ------------------------------- Order ---------------------------- */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">Order</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Order number
                </dt>
                <dd className="mt-1 font-mono text-sm text-ghana-black dark:text-white">
                  {payment.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Order status
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {ORDER_STATUS_LABELS[payment.orderStatus]}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Order created
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {formatAdminDateTime(payment.createdAt)}
                </dd>
              </div>
            </dl>

            <p className="mt-5 font-display text-2xl text-ghana-black dark:text-white">
              {formatCedis(payment.totalAmount)}
            </p>

            <Link
              to={`/admin/orders/${payment.id}`}
              className="mt-4 inline-flex text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              Open order record
            </Link>
          </section>

          {/* ----------------------------- Customer --------------------------- */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">Customer</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Name
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.customer.name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white break-all">
                  {payment.customer.email ?? 'Not available'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Phone
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.customer.phone ?? 'Not available'}
                </dd>
              </div>
            </dl>
          </section>

          {/* ------------------------------ Payment --------------------------- */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">
              Payment record
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Status
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {PAYMENT_STATUS_LABELS[payment.paymentStatus]}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Source
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.paymentSource ? PAYMENT_SOURCE_LABELS[payment.paymentSource] : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Provider
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.paymentProvider ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Channel
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.paymentChannel ?? '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Reference
                </dt>
                <dd className="mt-1 font-mono text-sm text-ghana-black dark:text-white break-all">
                  {payment.paymentReference ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Paid at
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.paidAt ? formatAdminDateTime(payment.paidAt) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Payment updated
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {payment.paymentUpdatedAt
                    ? formatAdminDateTime(payment.paymentUpdatedAt)
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* --------------------------- Manual update -------------------------- */}
        <div className="space-y-8">
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">
              Manual update
            </h2>
            <p className="mt-1 flex items-start gap-2 text-xs text-ghana-black/60 dark:text-white/60 leading-relaxed">
              <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-ghana-green" />
              This records a payment manually. No payment is collected by this action.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                  Payment status
                </span>
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as OrderPaymentStatus)}
                  disabled={busy}
                  className="input-field py-2.5 pr-8"
                >
                  {PAYMENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {PAYMENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                  Reference (optional)
                </span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={200}
                  placeholder="Bank / MoMo / transfer reference"
                  className="input-field"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                  Provider (optional)
                </span>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Manual, GCB Bank"
                  className="input-field"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                  Channel (optional)
                </span>
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. bank, mobile_money, cash"
                  className="input-field"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={requestSave}
              disabled={busy}
              className="mt-5 w-full px-5 py-3 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving…' : 'Save payment record'}
            </button>

            <p className="mt-4 text-xs text-ghana-black/50 dark:text-white/50 leading-relaxed">
              Saving sets the source to <span className="font-medium">Manual</span> on the server.
              Optional fields left blank keep their current value. Payment status and order status
              are tracked separately.
            </p>
          </section>

          {/* Phase F3 — Paystack attempts + admin reconciliation. */}
          {attempts.length > 0 && (
            <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Paystack
              </h2>
              <p className="mt-1 text-xs text-ghana-black/60 dark:text-white/60 leading-relaxed">
                {payment.paymentSource === 'paystack'
                  ? 'This order was verified by Paystack.'
                  : 'Paystack attempts recorded for this order. Re-checking contacts Paystack server-side.'}
              </p>

              <ul className="mt-4 space-y-3 text-xs">
                {attempts.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="border-t border-ghana-black/10 dark:border-white/10 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex justify-between gap-4">
                      <span className="break-all font-mono text-ghana-black/80 dark:text-white/80">
                        {attempt.reference}
                      </span>
                      <span className="uppercase tracking-[0.14em] text-ghana-black/60 dark:text-white/60">
                        {attempt.status}
                      </span>
                    </div>
                    <p className="mt-1 text-ghana-black/60 dark:text-white/60">
                      {[
                        attempt.channel,
                        attempt.verifiedAt
                          ? `Verified ${formatAdminDateTime(attempt.verifiedAt)}`
                          : null,
                        attempt.createdAt
                          ? `Created ${formatAdminDateTime(attempt.createdAt)}`
                          : null,
                      ]
                        .filter((part): part is string => Boolean(part))
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>

              {(payment.paymentStatus === 'unpaid' || payment.paymentStatus === 'failed') && (
                <>
                  <button
                    type="button"
                    onClick={() => void runReconcile()}
                    disabled={reconciling}
                    className="mt-5 w-full px-5 py-3 rounded-lg border border-ghana-green text-ghana-green text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-green hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reconciling ? 'Checking with Paystack…' : 'Re-check Paystack'}
                  </button>
                  <p className="mt-3 text-xs text-ghana-black/50 dark:text-white/50 leading-relaxed">
                    Contacts Paystack server-side and only marks the order paid when the transaction
                    verifies. Nothing is charged from here.
                  </p>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingConfirm === 'paid'}
        title="Mark as paid?"
        message={`This marks the order as paid manually. No money will be charged. ${payment.orderNumber} (${formatCedis(
          payment.totalAmount,
        )}) should only be recorded as paid if the payment was actually received.`}
        confirmLabel="Mark as paid"
        busy={busy}
        onConfirm={() => pendingConfirm && void apply(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        open={pendingConfirm === 'refunded'}
        title="Mark as refunded?"
        message="This records the payment as refunded. This does not issue a refund through a payment provider."
        confirmLabel="Mark as refunded"
        danger
        busy={busy}
        onConfirm={() => pendingConfirm && void apply(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}

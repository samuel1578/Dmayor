import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  adminOrderErrorMessage,
  getAdminOrder,
  isTerminalOrderStatus,
  nextOrderStatuses,
  setAdminOrderPaymentStatus,
  setAdminOrderStatus,
  type AdminOrder,
} from '../../lib/admin/orders';
import type { OrderPaymentStatus, OrderStatus } from '../../lib/supabase';
import { formatAdminDateTime, formatCedis } from '../../lib/admin/format';

type Feedback = { status: 'saved' | 'error'; message: string } | null;

/**
 * Admin order detail (Phase E3) — manual payment + fulfilment management.
 *
 * Both mutations go through admin-only RPCs that re-check `is_admin()` and
 * validate server-side; this page only offers options the database will accept.
 *
 * Fulfilment and payment are deliberately separate cards and separate RPCs:
 * marking an order paid never moves it to delivered, and shipping an unpaid
 * order is allowed.
 *
 * No payment provider is involved and no stock is restocked here.
 */
function statusPillClass(status: OrderStatus): string {
  if (status === 'cancelled') return 'border-ghana-red/60 text-ghana-red';
  if (status === 'delivered') return 'border-ghana-green text-ghana-green';
  return 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70';
}

function paymentPillClass(paymentStatus: OrderPaymentStatus): string {
  if (paymentStatus === 'paid') return 'border-ghana-green text-ghana-green';
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
    return 'border-ghana-red/60 text-ghana-red';
  }
  return 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70';
}

export function AdminOrderDetail() {
  const { id = '' } = useParams<{ id: string }>();

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const [paymentDraft, setPaymentDraft] = useState<OrderPaymentStatus | null>(null);
  const [pendingPayment, setPendingPayment] = useState<OrderPaymentStatus | null>(null);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      setOrder(await getAdminOrder(id));
    } catch (err) {
      console.error('Admin order load failed:', err);
      setLoadError(adminOrderErrorMessage(err, 'Could not load this order.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Applies a mutation, then reloads the authoritative row from the database. */
  const runMutation = async (
    operation: (current: AdminOrder) => Promise<void>,
    successMessage: string,
  ) => {
    if (!order || busy) return;

    setBusy(true);
    setFeedback(null);

    try {
      await operation(order);
      setOrder(await getAdminOrder(order.id));
      setPaymentDraft(null);
      setFeedback({ status: 'saved', message: successMessage });
    } catch (err) {
      console.error('Admin order update failed:', err);
      setFeedback({ status: 'error', message: adminOrderErrorMessage(err) });
    } finally {
      setBusy(false);
      setPendingPayment(null);
      setPendingStatus(null);
    }
  };

  const applyPaymentStatus = (next: OrderPaymentStatus) =>
    runMutation(
      (current) => setAdminOrderPaymentStatus(current.id, next),
      `Payment status set to ${PAYMENT_STATUS_LABELS[next]}.`,
    );

  const applyOrderStatus = (next: OrderStatus) =>
    runMutation(
      (current) => setAdminOrderStatus(current.id, next),
      `Order status set to ${ORDER_STATUS_LABELS[next]}.`,
    );

  /** `paid` and `refunded` are deliberate acts — always confirm them first. */
  const requestPaymentStatus = (next: OrderPaymentStatus) => {
    if (!order || next === order.paymentStatus) return;
    if (next === 'paid' || next === 'refunded') setPendingPayment(next);
    else void applyPaymentStatus(next);
  };

  /** Cancellation is destructive-looking and irreversible — confirm it. */
  const requestOrderStatus = (next: OrderStatus) => {
    if (!order || next === order.status) return;
    if (next === 'cancelled') setPendingStatus(next);
    else void applyOrderStatus(next);
  };

  const backLink = (
    <Link
      to="/admin/orders"
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60 transition-colors duration-200 hover:text-ghana-green"
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

  if (loadError || !order) {
    return (
      <div>
        {backLink}
        <div role="alert" className="mt-6 text-sm text-ghana-red">
          <p>{loadError ?? 'That order could not be loaded.'}</p>
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

  const deliveryLines = [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.region,
    order.postalCode,
    order.country,
  ].filter((part): part is string => Boolean(part));

  const allowedNext = nextOrderStatuses(order.status);
  const terminal = isTerminalOrderStatus(order.status);
  const selectedPayment: OrderPaymentStatus = paymentDraft ?? order.paymentStatus;
  const statusHistory = [
    { label: 'Confirmed', value: order.confirmedAt },
    { label: 'Shipped', value: order.shippedAt },
    { label: 'Delivered', value: order.deliveredAt },
    { label: 'Cancelled', value: order.cancelledAt },
  ].filter((entry) => Boolean(entry.value));

  return (
    <div className="max-w-6xl">
      {backLink}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">Order</p>
          <h1 className="font-mono text-3xl sm:text-4xl text-ghana-black dark:text-white">
            {order.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-ghana-black/60 dark:text-white/60">
            Placed {formatAdminDateTime(order.createdAt)} · Last updated{' '}
            {formatAdminDateTime(order.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 ${statusPillClass(
              order.status,
            )}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <span
            className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 ${paymentPillClass(
              order.paymentStatus,
            )}`}
          >
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
        </div>
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
          {/* ----------------------------- Customer --------------------------- */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">Customer</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Name
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {order.customer.name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white break-all">
                  {order.customer.email ?? 'Not available'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Phone
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {order.customer.phone ?? 'Not available'}
                </dd>
              </div>
            </dl>
          </section>

          {/* ------------------------- Delivery snapshot ---------------------- */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">
              Delivery address
            </h2>
            <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
              Snapshot captured at checkout — the customer's saved address may have changed since.
            </p>
            <address className="mt-4 text-sm not-italic leading-relaxed text-ghana-black/80 dark:text-white/80">
              <span className="block font-medium text-ghana-black dark:text-white">
                {order.recipientName}
              </span>
              <span className="block">{order.phone}</span>
              <span className="block">{deliveryLines.join(', ')}</span>
            </address>
            {order.customerNote && (
              <p className="mt-4 border-t border-ghana-black/10 dark:border-white/10 pt-4 text-sm text-ghana-black/70 dark:text-white/70">
                Customer note: {order.customerNote}
              </p>
            )}
          </section>

          {/* ------------------------------- Items ---------------------------- */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg overflow-hidden">
            <div className="border-b border-ghana-black/10 dark:border-white/10 p-5 sm:p-6">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Items ({order.items.length})
              </h2>
              <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
                Historical snapshot — later product or price changes do not affect this order.
              </p>
            </div>

            <ul className="divide-y divide-ghana-black/5 dark:divide-white/5">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-5 sm:p-6">
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-ghana-black/5 dark:bg-white/5">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-medium text-ghana-black dark:text-white">
                      {item.productName}
                    </p>
                    <p className="mt-1 text-xs text-ghana-black/60 dark:text-white/60">
                      {[item.size && `Size ${item.size}`, item.colour].filter(Boolean).join(' · ') ||
                        'No variant details'}
                      {item.variantSku ? ` · SKU ${item.variantSku}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-ghana-black/60 dark:text-white/60">
                      {item.quantity} × {formatCedis(item.unitPrice)}
                    </p>
                  </div>

                  <p className="text-sm font-medium text-ghana-black dark:text-white whitespace-nowrap">
                    {formatCedis(item.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="border-t border-ghana-black/10 dark:border-white/10 p-5 sm:p-6 space-y-2 text-sm">
              <div className="flex justify-between text-ghana-black/70 dark:text-white/70">
                <dt>Subtotal</dt>
                <dd>{formatCedis(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ghana-black/70 dark:text-white/70">
                <dt>Shipping</dt>
                <dd>{formatCedis(order.shippingAmount)}</dd>
              </div>
              <div className="flex justify-between text-ghana-black/70 dark:text-white/70">
                <dt>Tax</dt>
                <dd>{formatCedis(order.taxAmount)}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-ghana-black/10 dark:border-white/10 text-ghana-black dark:text-white">
                <dt className="font-medium">Total</dt>
                <dd className="font-display text-xl">{formatCedis(order.totalAmount)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* ------------------------------ Controls ---------------------------- */}
        <div className="space-y-8">
          {/* Payment */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">
              Payment (manual)
            </h2>
            <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
              Recorded by hand until an automated payment provider exists. Nothing is charged from
              here.
            </p>

            <p className="mt-4 text-sm text-ghana-black/80 dark:text-white/80">
              Current:{' '}
              <span className="font-medium text-ghana-black dark:text-white">
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </span>
            </p>
            {order.paidAt && (
              <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
                Marked paid {formatAdminDateTime(order.paidAt)}
              </p>
            )}

            {/* Phase H0.1 — the full payment record (source/reference/provider/
                channel) is managed in the Admin Payment Center. */}
            <Link
              to={`/admin/payments/${order.id}`}
              className="mt-2 inline-flex text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              Open payment record
            </Link>

            <label className="mt-4 block">
              <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                Set payment status
              </span>
              <select
                value={selectedPayment}
                onChange={(e) => setPaymentDraft(e.target.value as OrderPaymentStatus)}
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

            <button
              type="button"
              onClick={() => requestPaymentStatus(selectedPayment)}
              disabled={busy || selectedPayment === order.paymentStatus}
              className="mt-4 w-full px-5 py-3 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Working…' : 'Update payment status'}
            </button>

            <p className="mt-4 text-xs text-ghana-black/50 dark:text-white/50 leading-relaxed">
              Payment status and order status are tracked separately. Changing one never changes the
              other.
            </p>
          </section>

          {/* Fulfilment */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <h2 className="font-display text-xl text-ghana-black dark:text-white">Fulfilment</h2>
            <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
              Only valid next steps are offered; the database rejects anything else.
            </p>

            <p className="mt-4 text-sm text-ghana-black/80 dark:text-white/80">
              Current:{' '}
              <span className="font-medium text-ghana-black dark:text-white">
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </p>

            {statusHistory.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-ghana-black/50 dark:text-white/50">
                {statusHistory.map((entry) => (
                  <li key={entry.label}>
                    {entry.label} {formatAdminDateTime(entry.value as string)}
                  </li>
                ))}
              </ul>
            )}

            {terminal ? (
              <p className="mt-4 text-sm text-ghana-black/70 dark:text-white/70">
                This order is in a final state — {ORDER_STATUS_LABELS[order.status].toLowerCase()}.
                No further status changes are allowed.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {allowedNext.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => requestOrderStatus(status)}
                    disabled={busy}
                    className={`w-full px-5 py-3 rounded-lg text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      status === 'cancelled'
                        ? 'border border-ghana-red/50 text-ghana-red hover:bg-ghana-red hover:text-white'
                        : 'bg-ghana-green text-white hover:bg-ghana-black'
                    }`}
                  >
                    Mark as {ORDER_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Restock blocker — surfaced, never invented */}
          {order.status === 'cancelled' && (
            <section className="border border-ghana-red/40 rounded-lg p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ghana-red">
                <Info size={16} aria-hidden="true" />
                Stock was not restocked
              </h2>
              <p className="mt-3 text-xs text-ghana-black/70 dark:text-white/70 leading-relaxed">
                Stock for this order was deducted when it was created at checkout. Whether
                cancelling should return that stock to inventory is still an unconfirmed business
                rule, so this screen deliberately performs no restocking.
              </p>
              <p className="mt-3 text-xs text-ghana-black/70 dark:text-white/70 leading-relaxed">
                If the stock needs to go back now, adjust the variant stock in{' '}
                <Link
                  to="/admin/products"
                  className="text-ghana-green hover:text-ghana-black dark:hover:text-white"
                >
                  Products
                </Link>{' '}
                — and confirm the rule before it is automated.
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Payment confirmations — deliberate, money-related acts only */}
      <ConfirmDialog
        open={pendingPayment === 'paid'}
        title="Mark as paid?"
        message={`Record a manual payment for ${order.orderNumber} (${formatCedis(
          order.totalAmount,
        )})? Use this only if the payment was actually received — it records the state, it does not charge anything.`}
        confirmLabel="Mark as paid"
        busy={busy}
        onConfirm={() => pendingPayment && void applyPaymentStatus(pendingPayment)}
        onCancel={() => setPendingPayment(null)}
      />

      <ConfirmDialog
        open={pendingPayment === 'refunded'}
        title="Mark as refunded?"
        message={`Record that ${order.orderNumber} was refunded outside this store? No money is moved from here and the order status is not changed.`}
        confirmLabel="Mark as refunded"
        danger
        busy={busy}
        onConfirm={() => pendingPayment && void applyPaymentStatus(pendingPayment)}
        onCancel={() => setPendingPayment(null)}
      />

      <ConfirmDialog
        open={pendingStatus === 'cancelled'}
        title="Cancel this order?"
        message={`Cancel ${order.orderNumber}? The order status becomes final, the customer sees it as cancelled, and stock is NOT returned to inventory automatically.`}
        confirmLabel="Cancel order"
        danger
        busy={busy}
        onConfirm={() => pendingStatus && void applyOrderStatus(pendingStatus)}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  );
}

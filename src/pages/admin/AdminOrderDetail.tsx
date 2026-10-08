import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import {
  CANCELLATION_REASONS,
  CANCELLATION_REASON_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  adminOrderErrorMessage,
  cancelAdminOrder,
  getAdminOrder,
  isTerminalOrderStatus,
  nextOrderStatuses,
  orderStatusActionLabel,
  paymentSummaryLabel,
  setAdminOrderPaymentStatus,
  setAdminOrderShipment,
  setAdminOrderStatus,
  type AdminOrder,
} from '../../lib/admin/orders';
import { validateCancellationInput } from '../../lib/cancellation';
import {
  SHIPMENT_LIMITS,
  TRACKING_MISSING_WARNING,
  hasShipmentInfo,
  safeTrackingUrl,
  validateTrackingUrl,
  type ShipmentDraft,
} from '../../lib/shipment';
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
 * Payment includes verified Paystack transactions and admin-recorded manual
 * payments. No stock is restocked here.
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

  /* Phase G2 — cancelling always goes through the reason dialog. */
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  /* Phase G1 — shipment editing is local until Save; Cancel discards it. */
  const [shipmentEditing, setShipmentEditing] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState<ShipmentDraft>({
    carrier: '',
    trackingNumber: '',
    trackingUrl: '',
    deliveryNote: '',
  });

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
      // Shipping without tracking stays allowed (local delivery methods often
      // have none) — the missing-tracking note is a warning, never a blocker.
      `Order status set to ${ORDER_STATUS_LABELS[next]}.${
        next === 'shipped' && !hasShipmentInfo(order) ? ` ${TRACKING_MISSING_WARNING}` : ''
      }`,
    );

  /** `paid` and `refunded` are deliberate acts — always confirm them first. */
  const requestPaymentStatus = (next: OrderPaymentStatus) => {
    if (!order || next === order.paymentStatus) return;
    if (next === 'paid' || next === 'refunded') setPendingPayment(next);
    else void applyPaymentStatus(next);
  };

  /** Cancellation is irreversible — it always opens the reason dialog first. */
  const requestOrderStatus = (next: OrderStatus) => {
    if (!order || next === order.status) return;
    if (next === 'cancelled') {
      setCancelError(null);
      setCancelReason('');
      setCancelNote('');
      setCancelDialogOpen(true);
      return;
    }
    void applyOrderStatus(next);
  };

  /**
   * Phase G2 — cancel with a required reason and optional internal note.
   * Runs outside `runMutation` so a validation or database error is shown
   * INSIDE the open dialog (the page-level feedback sits behind its overlay).
   */
  const applyCancellation = () => {
    if (!order || busy) return;

    const validation = validateCancellationInput({ reason: cancelReason, note: cancelNote });
    if (!validation.ok) {
      setCancelError(validation.message);
      return;
    }

    setBusy(true);
    setCancelError(null);
    setFeedback(null);

    void (async () => {
      try {
        await cancelAdminOrder(order.id, { reason: cancelReason, note: cancelNote });
        const updated = await getAdminOrder(order.id);
        setOrder(updated);
        setCancelDialogOpen(false);
        setCancelReason('');
        setCancelNote('');
        setFeedback({
          status: 'saved',
          message: `Order ${order.orderNumber} cancelled. ${
            updated.restockedAt
              ? 'Stock was restored to inventory.'
              : 'Stock was not restored automatically — adjust stock manually if needed.'
          }`,
        });
      } catch (err) {
        console.error('Admin order cancellation failed:', err);
        setCancelError(adminOrderErrorMessage(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  /* ------------------------- Shipment / Tracking ------------------------- */

  const startShipmentEdit = () => {
    if (!order) return;
    setShipmentDraft({
      carrier: order.carrier ?? '',
      trackingNumber: order.trackingNumber ?? '',
      trackingUrl: order.trackingUrl ?? '',
      deliveryNote: order.deliveryNote ?? '',
    });
    setFeedback(null);
    setShipmentEditing(true);
  };

  const cancelShipmentEdit = () => {
    setShipmentEditing(false);
    setFeedback(null);
  };

  const saveShipment = () => {
    if (!order || busy) return;

    // Client-side URL check for immediate feedback; the database enforces the
    // same http(s)-only rule regardless of who writes.
    const urlCheck = validateTrackingUrl(shipmentDraft.trackingUrl);
    if (!urlCheck.ok) {
      setFeedback({ status: 'error', message: urlCheck.message });
      return;
    }

    void runMutation(
      async (current) => {
        await setAdminOrderShipment(current.id, shipmentDraft);
        setShipmentEditing(false);
      },
      'Shipment details saved. Order status and payment status were not changed.',
    );
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
  const shipmentPresent = hasShipmentInfo(order);
  const shipmentLink = safeTrackingUrl(order.trackingUrl);
  const selectedPayment: OrderPaymentStatus = paymentDraft ?? order.paymentStatus;
  // Fulfilment milestones only — the cancellation date lives on the
  // Cancellation card below, so it is deliberately not repeated here.
  const statusHistory = [
    { label: 'Confirmed', value: order.confirmedAt },
    { label: 'Shipped', value: order.shippedAt },
    { label: 'Delivered', value: order.deliveredAt },
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
                  {order.customer.email || 'Not available'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                  Phone
                </dt>
                <dd className="mt-1 text-sm text-ghana-black dark:text-white">
                  {order.customer.phone || 'Not available'}
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
              Contact details are in the Customer section above.
            </p>
            <address className="mt-4 text-sm not-italic leading-relaxed text-ghana-black/80 dark:text-white/80">
              <span className="block font-medium text-ghana-black dark:text-white">
                {order.recipientName}
              </span>
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
              Payment
            </h2>
            <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
              Paystack payments are verified automatically; manual records can still be entered here.
              Nothing is charged from this page.
            </p>

            <p className="mt-4 text-sm text-ghana-black/80 dark:text-white/80">
              Current:{' '}
              <span className="font-medium text-ghana-black dark:text-white">
                {paymentSummaryLabel(order.paymentStatus, order.paymentSource)}
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

            {/* Phase G3 — non-blocking warning. Tracking is never required to
                ship an order; this simply states that none has been recorded. */}
            {!shipmentPresent &&
              (allowedNext.includes('shipped') || order.status === 'shipped') && (
                <p
                  role="status"
                  className="mt-4 border-l-2 border-ghana-green pl-3 text-xs leading-relaxed text-ghana-black/70 dark:text-white/70"
                >
                  {TRACKING_MISSING_WARNING} You can still mark the order shipped — some local
                  delivery methods do not provide tracking numbers.
                </p>
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
                    {orderStatusActionLabel(status)}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Shipment / Tracking — Phase G1. Saved independently of status. */}
          <section className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl text-ghana-black dark:text-white">
                Shipment / Tracking
              </h2>
              {!shipmentEditing && (
                <button
                  type="button"
                  onClick={startShipmentEdit}
                  disabled={busy}
                  className="text-[10px] uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white disabled:opacity-50"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-ghana-black/50 dark:text-white/50">
              Saved separately from order status — adding tracking does not mark the order Shipped,
              and payment is never changed from here.
            </p>

            {shipmentEditing ? (
              <div className="mt-4 space-y-3 border-t border-ghana-black/10 pt-4 dark:border-white/10">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                    Carrier
                  </span>
                  <input
                    type="text"
                    value={shipmentDraft.carrier}
                    maxLength={SHIPMENT_LIMITS.carrier}
                    onChange={(e) => setShipmentDraft((d) => ({ ...d, carrier: e.target.value }))}
                    disabled={busy}
                    placeholder="e.g. DHL, GEX, vendor delivery"
                    className="input-field py-2.5"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                    Tracking number
                  </span>
                  <input
                    type="text"
                    value={shipmentDraft.trackingNumber}
                    maxLength={SHIPMENT_LIMITS.trackingNumber}
                    onChange={(e) =>
                      setShipmentDraft((d) => ({ ...d, trackingNumber: e.target.value }))
                    }
                    disabled={busy}
                    className="input-field py-2.5 font-mono"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                    Tracking link (optional)
                  </span>
                  <input
                    type="url"
                    value={shipmentDraft.trackingUrl}
                    maxLength={SHIPMENT_LIMITS.trackingUrl}
                    onChange={(e) => setShipmentDraft((d) => ({ ...d, trackingUrl: e.target.value }))}
                    disabled={busy}
                    placeholder="https://…"
                    className="input-field py-2.5"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
                    Delivery note (visible to the customer)
                  </span>
                  <textarea
                    value={shipmentDraft.deliveryNote}
                    maxLength={SHIPMENT_LIMITS.deliveryNote}
                    rows={2}
                    onChange={(e) => setShipmentDraft((d) => ({ ...d, deliveryNote: e.target.value }))}
                    disabled={busy}
                    className="input-field py-2.5"
                  />
                </label>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={saveShipment}
                    disabled={busy}
                    className="px-5 py-3 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Saving…' : 'Save shipment'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelShipmentEdit}
                    disabled={busy}
                    className="px-5 py-3 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs font-semibold uppercase tracking-[0.16em] text-ghana-black/70 dark:text-white/70 transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : shipmentPresent ? (
              <dl className="mt-4 space-y-2 border-t border-ghana-black/10 pt-4 text-xs dark:border-white/10">
                {order.carrier && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Carrier</dt>
                    <dd className="text-right text-ghana-black/80 dark:text-white/80">
                      {order.carrier}
                    </dd>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Tracking number</dt>
                    <dd className="break-all text-right font-mono text-ghana-black/80 dark:text-white/80">
                      {order.trackingNumber}
                    </dd>
                  </div>
                )}
                {order.trackingUrl && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Tracking link</dt>
                    <dd className="break-all text-right text-ghana-black/80 dark:text-white/80">
                      {shipmentLink ? (
                        <a
                          href={shipmentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ghana-green hover:text-ghana-black dark:hover:text-white"
                        >
                          Open tracking page
                        </a>
                      ) : (
                        order.trackingUrl
                      )}
                    </dd>
                  </div>
                )}
                {order.deliveryNote && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Delivery note</dt>
                    <dd className="max-w-[60%] text-right text-ghana-black/80 dark:text-white/80">
                      {order.deliveryNote}
                    </dd>
                  </div>
                )}
                {order.trackingUpdatedAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Last saved</dt>
                    <dd className="text-right text-ghana-black/80 dark:text-white/80">
                      {formatAdminDateTime(order.trackingUpdatedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-4 border-t border-ghana-black/10 pt-4 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70">
                No shipment details yet. Enter a carrier and tracking number once the order is on
                its way — you can do this before or after marking the order Shipped.
              </p>
            )}
          </section>

          {/* Cancellation record — Phase G2 (reason, note, dates, stock) */}
          {order.status === 'cancelled' && (
            <section className="border border-ghana-red/40 rounded-lg p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ghana-red">
                <Info size={16} aria-hidden="true" />
                Cancellation
              </h2>

              <dl className="mt-3 space-y-2 text-xs">
                {order.cancelledAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Cancelled</dt>
                    <dd className="text-right text-ghana-black/80 dark:text-white/80">
                      {formatAdminDateTime(order.cancelledAt)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-ghana-black/50 dark:text-white/50">Reason</dt>
                  <dd className="text-right text-ghana-black/80 dark:text-white/80">
                    {order.cancellationReason &&
                    order.cancellationReason in CANCELLATION_REASON_LABELS
                      ? CANCELLATION_REASON_LABELS[
                          order.cancellationReason as keyof typeof CANCELLATION_REASON_LABELS
                        ]
                      : 'Not recorded'}
                  </dd>
                </div>
                {order.cancellationNote && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ghana-black/50 dark:text-white/50">Note</dt>
                    <dd className="max-w-[60%] text-right text-ghana-black/80 dark:text-white/80">
                      {order.cancellationNote}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-ghana-black/50 dark:text-white/50">Stock</dt>
                  <dd className="text-right text-ghana-black/80 dark:text-white/80">
                    {order.restockedAt
                      ? `Restored ${formatAdminDateTime(order.restockedAt)}`
                      : 'Not restored'}
                  </dd>
                </div>
              </dl>

              {!order.restockedAt && (
                <p className="mt-3 text-xs text-ghana-black/70 dark:text-white/70 leading-relaxed">
                  This order was cancelled without an automatic restock (for example a shipped
                  order, or a cancellation recorded through the legacy status action). Stock for
                  this order was deducted at checkout — adjust the variant stock in{' '}
                  <Link
                    to="/admin/products"
                    className="text-ghana-green hover:text-ghana-black dark:hover:text-white"
                  >
                    Products
                  </Link>{' '}
                  if it needs to go back.
                </p>
              )}

              {order.paymentStatus === 'paid' && (
                <p className="mt-3 border-t border-ghana-red/40 pt-3 text-xs font-semibold text-ghana-red">
                  Payment remains recorded as paid. Refunds are handled separately.
                </p>
              )}
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
        open={cancelDialogOpen}
        title="Cancel this order?"
        message={`Cancel ${order.orderNumber}? Cancellation is final — the order becomes Cancelled, which is a terminal state.`}
        confirmLabel="Cancel order"
        danger
        busy={busy}
        onConfirm={applyCancellation}
        onCancel={() => {
          if (busy) return;
          setCancelDialogOpen(false);
          setCancelError(null);
        }}
      >
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
              Reason (required)
            </span>
            <select
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelError(null);
              }}
              disabled={busy}
              className="input-field py-2.5 pr-8"
            >
              <option value="">Select a reason…</option>
              {CANCELLATION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {CANCELLATION_REASON_LABELS[reason]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
              Internal note (optional, Admin only)
            </span>
            <textarea
              value={cancelNote}
              maxLength={500}
              rows={2}
              onChange={(e) => {
                setCancelNote(e.target.value);
                setCancelError(null);
              }}
              disabled={busy}
              className="input-field py-2.5"
            />
          </label>

          {cancelError && (
            <p role="alert" className="text-xs text-ghana-red">
              {cancelError}
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-ghana-black/60 dark:text-white/60">
            {order.status === 'pending' ||
            order.status === 'confirmed' ||
            order.status === 'processing'
              ? 'Stock for this order will be restored to inventory automatically — once only. '
              : 'This order is shipped — stock will NOT be restored automatically; handle shipment and stock manually. '}
            <span className="font-semibold text-ghana-red">
              Cancelling this order does not refund the payment.
            </span>
            {order.paymentStatus === 'paid' &&
              ' It stays recorded as paid until a refund is recorded separately.'}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

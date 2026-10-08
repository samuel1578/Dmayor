import { MapPin } from 'lucide-react';
import { OrderStatusTimeline } from './OrderStatusTimeline';
import { PAYMENT_STATUS_LABELS, formatOrderDate, type OrderDetail } from '../../lib/account/orders';
import { formatGhs } from '../../lib/catalogue/products';
import { ProductImagePlaceholder } from '../ProductImagePlaceholder';
import { PaymentAction } from '../payments/PaymentAction';

/**
 * Shared order body (Phase E2) — used by the E1 order confirmation page and by
 * the account order detail page, so an order is rendered from exactly one place.
 *
 * Every item value comes from the order's SNAPSHOT columns: an archived
 * product, a deleted variant, a renamed product or a new price can never change
 * what this view shows.
 *
 * Fulfilment progress and payment status are displayed as independent domains —
 * one is never inferred from the other.
 */

/** Factual explanation of the recorded payment status (no automation implied). */
const PAYMENT_STATUS_NOTES: Record<OrderDetail['paymentStatus'], string> = {
  unpaid: 'Nothing has been collected for this order yet.',
  paid: 'This order has been marked as paid.',
  failed: 'The last payment attempt for this order did not go through.',
  refunded: 'This order has been marked as refunded.',
};

export function OrderDetailView({ order }: { order: OrderDetail }) {
  const deliveryLines = [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.region,
    order.postalCode,
    order.country,
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="space-y-8">
      {/* ------------------------- Progress + payment ------------------------- */}
      <div className="space-y-4">
        <OrderStatusTimeline status={order.status} />

        <div className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
            Payment status
          </p>
          <p className="mt-2 font-display text-2xl text-ghana-black dark:text-white">
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </p>
          <p className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
            {PAYMENT_STATUS_NOTES[order.paymentStatus]} Payment is recorded separately from order
            progress.
          </p>

          {/* Payment metadata recorded by Admin — shown only when present. */}
          {(order.paymentReference ||
            order.paymentProvider ||
            order.paymentChannel ||
            order.paymentUpdatedAt ||
            order.paidAt) && (
            <dl className="mt-4 space-y-2 border-t border-ghana-black/10 pt-4 text-xs dark:border-white/10">
              {order.paymentReference && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ghana-black/50 dark:text-white/50">Reference</dt>
                  <dd className="break-all text-right font-mono text-ghana-black/80 dark:text-white/80">
                    {order.paymentReference}
                  </dd>
                </div>
              )}
              {(order.paymentProvider || order.paymentChannel) && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ghana-black/50 dark:text-white/50">Method</dt>
                  <dd className="text-right text-ghana-black/80 dark:text-white/80">
                    {[order.paymentProvider, order.paymentChannel]
                      .filter((part): part is string => Boolean(part))
                      .join(' · ')}
                  </dd>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ghana-black/50 dark:text-white/50">Paid</dt>
                  <dd className="text-right text-ghana-black/80 dark:text-white/80">
                    {formatOrderDate(order.paidAt, true)}
                  </dd>
                </div>
              )}
              {order.paymentUpdatedAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ghana-black/50 dark:text-white/50">Payment updated</dt>
                  <dd className="text-right text-ghana-black/80 dark:text-white/80">
                    {formatOrderDate(order.paymentUpdatedAt, true)}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Phase F2 — real Pay Now / Retry Payment. Eligibility (unpaid /
              failed, and not cancelled) is decided by the shared action, which
              renders nothing for paid, refunded or cancelled orders. */}
          <PaymentAction
            orderId={order.id}
            paymentStatus={order.paymentStatus}
            orderStatus={order.status}
            className="mt-4 border-t border-ghana-black/10 pt-4 dark:border-white/10"
          />
        </div>
      </div>

      {/* -------------------------------- Items ------------------------------ */}
      <section
        aria-labelledby="order-items-heading"
        className="overflow-hidden rounded-lg border border-ghana-black/10 dark:border-white/10"
      >
        <div className="border-b border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
          <h2
            id="order-items-heading"
            className="font-display text-2xl text-ghana-black dark:text-white"
          >
            Items ({order.items.length})
          </h2>
        </div>

        <div className="divide-y divide-ghana-black/5 dark:divide-white/5">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-4 p-5 sm:p-6">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-ghana-black/5 dark:bg-white/5">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ProductImagePlaceholder label="No image" />
                )}
              </div>

              <div className="min-w-0 flex-grow">
                {/* Snapshot name only — deliberately not linked, so an archived
                    or renamed product cannot produce a dead or misleading link
                    inside historical order history. */}
                <h3 className="text-base font-semibold text-ghana-black dark:text-white">
                  {item.productName}
                </h3>
                <p className="mt-1 text-sm text-ghana-black/60 dark:text-white/60">
                  {[item.size && `Size ${item.size}`, item.colour].filter(Boolean).join(' · ') ||
                    '—'}
                </p>
                {item.variantSku && (
                  <p className="mt-0.5 text-xs text-ghana-black/45 dark:text-white/45">
                    SKU: {item.variantSku}
                  </p>
                )}
                <p className="mt-1 text-sm text-ghana-black/60 dark:text-white/60">
                  {formatGhs(item.unitPrice)} each · Quantity {item.quantity}
                </p>
              </div>

              <p className="whitespace-nowrap text-lg font-bold text-ghana-black dark:text-white">
                {formatGhs(item.lineTotal)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------- Delivery + totals ------------------------ */}
      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="order-delivery-heading"
          className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10"
        >
          <h2
            id="order-delivery-heading"
            className="flex items-center gap-2 font-display text-2xl text-ghana-black dark:text-white"
          >
            <MapPin size={20} aria-hidden="true" className="text-ghana-green" />
            Delivery address
          </h2>
          <address className="mt-4 text-sm not-italic leading-relaxed text-ghana-black/70 dark:text-white/70">
            <span className="block font-semibold text-ghana-black dark:text-white">
              {order.recipientName}
            </span>
            <span className="block">{order.phone}</span>
            <span className="block">{deliveryLines.join(', ')}</span>
          </address>
          {order.customerNote && (
            <p className="mt-4 border-t border-ghana-black/10 pt-4 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70">
              Note: {order.customerNote}
            </p>
          )}
        </section>

        <section
          aria-labelledby="order-totals-heading"
          className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10"
        >
          <h2
            id="order-totals-heading"
            className="font-display text-2xl text-ghana-black dark:text-white"
          >
            Order total
          </h2>

          <div className="mt-4 space-y-4 border-b border-ghana-black/10 pb-4 dark:border-white/10">
            <div className="flex justify-between text-sm text-ghana-black/70 dark:text-white/70">
              <span>Subtotal</span>
              <span>{formatGhs(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-ghana-black/70 dark:text-white/70">
              <span>Delivery</span>
              <span>{formatGhs(order.shippingAmount)}</span>
            </div>
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-ghana-black/70 dark:text-white/70">
                <span>Tax</span>
                <span>{formatGhs(order.taxAmount)}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="font-display text-xl text-ghana-black dark:text-white">Total</span>
            <span className="font-display text-3xl text-ghana-green">
              {formatGhs(order.totalAmount)}
            </span>
          </div>

          <p className="mt-4 text-xs text-ghana-black/50 dark:text-white/50">
            Recorded in {order.currency}.
          </p>
        </section>
      </div>
    </div>
  );
}

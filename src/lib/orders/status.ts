import type { OrderPaymentStatus, OrderStatus, PaymentSource } from '../supabase';

/**
 * Canonical order status vocabulary (Phase G3).
 *
 * ONE state model and ONE wording map for the whole app. Every surface —
 * Admin queue, Admin order detail, customer lists, customer order detail,
 * timeline and invoice — reads its wording from here, so status text is never
 * re-invented inside a component.
 *
 * Two deliberately separate vocabularies live side by side:
 *
 *   - `ORDER_STATUS_LABELS`      canonical operations wording (Admin, filters,
 *                                machine-facing rows)
 *   - `CUSTOMER_STATUS_LABELS`   customer-facing wording, addressed to the
 *                                shopper ("Preparing your order")
 *
 * Fulfilment and payment stay separate domains: nothing in this module derives
 * one from the other, and `paymentSummaryLabel()` only ever describes payment.
 *
 * Pure data + pure functions, no Supabase import — unit-testable in node.
 */

/* -------------------------------------------------------------------------- */
/* Canonical status model                                                     */
/* -------------------------------------------------------------------------- */

/** The ONLY fulfilment statuses this project uses. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

/** Fulfilment progress order used by the customer timeline (terminal states out). */
export const FULFILMENT_STEPS: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

/** Statuses considered "still on the way" for the Active filter. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
];

/** `delivered` and `cancelled` are final — no outgoing transitions exist. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled'];

/* -------------------------------------------------------------------------- */
/* Fulfilment wording                                                         */
/* -------------------------------------------------------------------------- */

/** Canonical operations labels — Admin surfaces, filters and status columns. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Customer-facing wording — used by every shopper-visible surface. */
export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Order received',
  confirmed: 'Order confirmed',
  processing: 'Preparing your order',
  shipped: 'Order shipped',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};

/** The single helper every customer surface calls — never a local status map. */
export function customerStatusLabel(status: OrderStatus): string {
  return CUSTOMER_STATUS_LABELS[status] ?? CUSTOMER_STATUS_LABELS.pending;
}

/** Buttons offered to the Admin for each valid transition target. */
export const ORDER_STATUS_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm order',
  processing: 'Start processing',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order…',
};

/**
 * The label for one Admin action. Only transition targets are listed, so an
 * unreachable status can never produce a clickable label.
 */
export function orderStatusActionLabel(status: OrderStatus): string {
  return (
    ORDER_STATUS_ACTION_LABELS[status] ?? `Mark as ${ORDER_STATUS_LABELS[status] ?? status}`
  );
}

/* -------------------------------------------------------------------------- */
/* Payment wording                                                            */
/* -------------------------------------------------------------------------- */

/** Payment status — shown independently of fulfilment, never merged with it. */
export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

/** Selectable payment states (all four are records, not automatic transitions). */
export const PAYMENT_STATUS_OPTIONS: readonly OrderPaymentStatus[] = [
  'unpaid',
  'paid',
  'failed',
  'refunded',
];

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  manual: 'Manual',
  paystack: 'Paystack',
};

/** Payment status alone (`Paid`). */
export function paymentStatusLabel(status: OrderPaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status] ?? PAYMENT_STATUS_LABELS.unpaid;
}

/**
 * Payment with its recorded source — e.g. `Paid · Paystack`.
 *
 * Describes the PAYMENT domain only; it never carries fulfilment wording, so
 * "Paid" can never be read as "Confirmed" and "Unpaid" never as "Pending".
 * The source is omitted when there is none, or when the order is unpaid (an
 * unpaid order has no source worth naming).
 */
export function paymentSummaryLabel(
  status: OrderPaymentStatus,
  source?: PaymentSource | null,
): string {
  const label = paymentStatusLabel(status);
  if (!source || status === 'unpaid') return label;
  return `${label} · ${PAYMENT_SOURCE_LABELS[source]}`;
}

import { supabase } from '../supabase';
import type { OrderPaymentStatus, OrderStatus, PaymentSource } from '../supabase';
import { ACTIVE_ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../orders/status';

/**
 * Customer order history data layer (Phase E2).
 *
 * Own orders only: every helper filters by the signed-in user id AND is
 * authorized row-by-row by RLS (`auth.uid() = user_id` on `orders`, plus an
 * ownership subquery policy on `order_items`). A customer changing the URL to
 * someone else's order number gets `null` — the same result as a number that
 * does not exist — so nothing leaks about other people's orders.
 *
 * Historical display reads the SNAPSHOT columns on `order_items` only. Current
 * catalogue values are never substituted, so an archived product, a deleted
 * variant, a renamed product or a new price cannot change a past order.
 *
 * Customers are read-only: there is no update/delete helper anywhere in this
 * file, and the database grants no write access to `orders`/`order_items`.
 *
 * Queries are deliberately small in number and never per-row (no N+1):
 *   - history  → one `orders` select with an embedded `order_items(quantity)`
 *   - recent   → the same select, newest first, limit 1
 *   - count    → a head count (no row payload)
 *   - detail   → one `orders` select with its embedded `order_items`
 */

/* -------------------------------------------------------------------------- */
/* Status domains — re-exported from the single central vocabulary (Phase G3) */
/* -------------------------------------------------------------------------- */

/**
 * Canonical + customer wording, payment wording and the fulfilment step order
 * all live in `src/lib/orders/status.ts`. They are re-exported here so every
 * existing consumer keeps one import path while the wording stays centralised.
 */
export {
  ACTIVE_ORDER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  FULFILMENT_STEPS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_SOURCE_LABELS,
  customerStatusLabel,
  paymentStatusLabel,
  paymentSummaryLabel,
} from '../orders/status';

export type OrderFilter = 'all' | 'active' | 'delivered' | 'cancelled';

export const ORDER_FILTERS: ReadonlyArray<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function orderMatchesFilter(order: OrderSummary, filter: OrderFilter): boolean {
  switch (filter) {
    case 'active':
      return ACTIVE_ORDER_STATUSES.includes(order.status);
    case 'delivered':
      return order.status === 'delivered';
    case 'cancelled':
      return order.status === 'cancelled';
    default:
      return true;
  }
}

/** How many of these orders belong to each filter (for the filter chips). */
export function countOrdersByFilter(orders: OrderSummary[]): Record<OrderFilter, number> {
  const counts: Record<OrderFilter, number> = {
    all: orders.length,
    active: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const order of orders) {
    if (orderMatchesFilter(order, 'active')) counts.active += 1;
    if (orderMatchesFilter(order, 'delivered')) counts.delivered += 1;
    if (orderMatchesFilter(order, 'cancelled')) counts.cancelled += 1;
  }

  return counts;
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/** One line of the history list — no per-row detail payload. */
export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  /** Recorded payment source — combined with status for `Paid · Paystack`. */
  paymentSource: PaymentSource | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  /** Total pieces ordered (sum of quantities). */
  itemCount: number;
  /** Number of distinct lines on the order. */
  lineCount: number;
}

export interface OrderItemDetail {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  productSlug: string | null;
  variantSku: string | null;
  size: string | null;
  colour: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  /** Delivery SNAPSHOT taken at checkout — not the live saved address. */
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  country: string;
  postalCode: string | null;
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** Phase G3 — operational timestamps shown on the customer timeline. */
  shippedAt: string | null;
  deliveredAt: string | null;
  /** Phase H0.1 payment metadata — null until a payment is recorded. */
  paymentReference: string | null;
  paymentProvider: string | null;
  paymentChannel: string | null;
  paymentSource: PaymentSource | null;
  paymentUpdatedAt: string | null;
  /** Set when the order is CURRENTLY marked paid; null otherwise. */
  paidAt: string | null;
  /** Phase G1 shipment fields — null until an Admin saves them. */
  carrier: string | null;
  trackingNumber: string | null;
  /** HTTP(S) only; never rendered as a link when invalid. */
  trackingUrl: string | null;
  deliveryNote: string | null;
  /** Phase G2 cancellation — customer-safe subset only (no note/actor). */
  cancelledAt: string | null;
  /** Constrained reason code; render with customerCancellationReasonText(). */
  cancellationReason: string | null;
  items: OrderItemDetail[];
}

/* -------------------------------------------------------------------------- */
/* Defensive row parsing                                                      */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return value && typeof value === 'object' ? (value as Row) : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asOrderStatus(value: unknown): OrderStatus {
  const text = String(value ?? '');
  return text in ORDER_STATUS_LABELS ? (text as OrderStatus) : 'pending';
}

function asPaymentStatus(value: unknown): OrderPaymentStatus {
  const text = String(value ?? '');
  return text in PAYMENT_STATUS_LABELS ? (text as OrderPaymentStatus) : 'unpaid';
}

function asPaymentSource(value: unknown): PaymentSource | null {
  const text = String(value ?? '');
  return text === 'manual' || text === 'paystack' ? (text as PaymentSource) : null;
}

function mapOrderSummary(value: unknown): OrderSummary | null {
  const row = asRow(value);
  if (!row) return null;

  const orderNumber = asText(row.order_number);
  if (!orderNumber) return null;

  const embedded = Array.isArray(row.order_items) ? row.order_items : [];
  let itemCount = 0;

  for (const entry of embedded) {
    const line = asRow(entry);
    if (!line) continue;
    itemCount += Math.max(0, Math.floor(asNumber(line.quantity)));
  }

  return {
    id: String(row.id ?? ''),
    orderNumber,
    status: asOrderStatus(row.status),
    paymentStatus: asPaymentStatus(row.payment_status),
    paymentSource: asPaymentSource(row.payment_source),
    totalAmount: asNumber(row.total_amount),
    currency: asText(row.currency) ?? 'GHS',
    createdAt: String(row.created_at ?? ''),
    itemCount,
    lineCount: embedded.length,
  };
}

function mapOrderItem(value: unknown): OrderItemDetail | null {
  const row = asRow(value);
  if (!row) return null;

  const id = asText(row.id);
  const productName = asText(row.product_name);
  if (!id || !productName) return null;

  return {
    id,
    productId: asText(row.product_id),
    variantId: asText(row.variant_id),
    productName,
    productSlug: asText(row.product_slug),
    variantSku: asText(row.variant_sku),
    size: asText(row.size),
    colour: asText(row.colour),
    unitPrice: asNumber(row.unit_price),
    quantity: Math.max(0, Math.floor(asNumber(row.quantity))),
    lineTotal: asNumber(row.line_total),
    imageUrl: asText(row.image_url),
  };
}

function mapOrderDetail(value: unknown): OrderDetail | null {
  const row = asRow(value);
  if (!row) return null;

  const rawItems = Array.isArray(row.order_items) ? row.order_items : [];

  return {
    id: String(row.id ?? ''),
    orderNumber: String(row.order_number ?? ''),
    status: asOrderStatus(row.status),
    paymentStatus: asPaymentStatus(row.payment_status),
    subtotal: asNumber(row.subtotal),
    shippingAmount: asNumber(row.shipping_amount),
    taxAmount: asNumber(row.tax_amount),
    totalAmount: asNumber(row.total_amount),
    currency: asText(row.currency) ?? 'GHS',
    recipientName: asText(row.recipient_name) ?? '',
    phone: asText(row.phone) ?? '',
    addressLine1: asText(row.address_line1) ?? '',
    addressLine2: asText(row.address_line2),
    city: asText(row.city) ?? '',
    region: asText(row.region),
    country: asText(row.country) ?? 'Ghana',
    postalCode: asText(row.postal_code),
    customerNote: asText(row.customer_note),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    shippedAt: asText(row.shipped_at),
    deliveredAt: asText(row.delivered_at),
    paymentReference: asText(row.payment_reference),
    paymentProvider: asText(row.payment_provider),
    paymentChannel: asText(row.payment_channel),
    paymentSource: asPaymentSource(row.payment_source),
    paymentUpdatedAt: asText(row.payment_updated_at),
    paidAt: asText(row.paid_at),
    carrier: asText(row.carrier),
    trackingNumber: asText(row.tracking_number),
    trackingUrl: asText(row.tracking_url),
    deliveryNote: asText(row.delivery_note),
    cancelledAt: asText(row.cancelled_at),
    cancellationReason: asText(row.cancellation_reason),
    items: rawItems.map(mapOrderItem).filter((item): item is OrderItemDetail => item !== null),
  };
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** History payload: quantities only, so the list stays a single small query. */
const SUMMARY_SELECT =
  'id, order_number, status, payment_status, payment_source, total_amount, currency, ' +
  'created_at, order_items(quantity)';

const DETAIL_SELECT =
  'id, order_number, status, payment_status, subtotal, shipping_amount, tax_amount, ' +
  'total_amount, currency, recipient_name, phone, address_line1, address_line2, city, ' +
  'region, country, postal_code, customer_note, created_at, updated_at, ' +
  'shipped_at, delivered_at, ' +
  'payment_reference, payment_provider, payment_channel, payment_source, ' +
  'payment_updated_at, paid_at, ' +
  'carrier, tracking_number, tracking_url, delivery_note, ' +
  'cancelled_at, cancellation_reason, ' +
  'order_items(id, product_id, variant_id, product_name, product_slug, variant_sku, size, ' +
  'colour, unit_price, quantity, line_total, image_url)';

/** Newest first. RLS + the user_id filter both scope this to the caller. */
export async function listMyOrders(userId: string): Promise<OrderSummary[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(SUMMARY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(mapOrderSummary)
    .filter((order): order is OrderSummary => order !== null);
}

/** The single most recent order, for the account overview. */
export async function getRecentOrder(userId: string): Promise<OrderSummary | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(SUMMARY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapOrderSummary(data) : null;
}

/** Lightweight count for the account overview (no row payload). */
export async function countMyOrders(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * One order with its line snapshots.
 *
 * Returns `null` for a number that does not exist on this account — including
 * another customer's order, which RLS makes invisible. The caller must show the
 * same "not found" state either way, so nothing about someone else's order is
 * revealed.
 */
export async function getMyOrder(userId: string, orderNumber: string): Promise<OrderDetail | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(DETAIL_SELECT)
    .eq('user_id', userId)
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) throw error;
  return data ? mapOrderDetail(data) : null;
}

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                       */
/* -------------------------------------------------------------------------- */

/** Localised order date, defensive about an unparsable value. */
export function formatOrderDate(value: string, withTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' } : {}),
  });
}

/** "3 items" / "1 item" — reads naturally in lists and headings. */
export function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

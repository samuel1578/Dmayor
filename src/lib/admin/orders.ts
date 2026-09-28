import { supabase } from '../supabase';
import type { OrderPaymentStatus, OrderStatus } from '../supabase';
import { describeMutationError } from './errors';

/**
 * Admin order operations data layer (Phase E3).
 *
 * Every call goes through an admin-only SECURITY DEFINER RPC that re-checks
 * `public.is_admin()` internally (fail closed). No extra table privileges are
 * granted to anyone, and customers keep their E1 read-only access.
 *
 * The two status domains are kept strictly independent: there is no helper that
 * changes both, and nothing here infers fulfilment from payment or vice-versa.
 *
 * There is no payment provider: `setAdminOrderPaymentStatus` records what an
 * Admin observed happening outside the app (bank transfer, MoMo, cash).
 */

/* -------------------------------------------------------------------------- */
/* Shared status vocabulary                                                   */
/* -------------------------------------------------------------------------- */

export {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../account/orders';

/**
 * Allowed fulfilment transitions — the database enforces exactly this map; the
 * UI only offers these options, so an invalid move is never clickable.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** `delivered` and `cancelled` are final — no outgoing transitions exist. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled'];

export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status] ?? [];
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}

/** Selectable payment states (all four are manual records, not transitions). */
export const PAYMENT_STATUS_OPTIONS: readonly OrderPaymentStatus[] = [
  'unpaid',
  'paid',
  'failed',
  'refunded',
];

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  itemCount: number;
  lineCount: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  recipientName: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderItem {
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

export interface AdminOrderCustomer {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  /** Delivery snapshot captured at checkout. */
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
  paidAt: string | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  customer: AdminOrderCustomer;
  items: AdminOrderItem[];
}

export interface AdminOrderStats {
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  unpaid: number;
  paid: number;
  failed: number;
  refunded: number;
  /** SUM(total_amount) over orders currently marked paid — real rows only. */
  paidTotal: number;
}

export interface AdminOrderQuery {
  search?: string;
  status?: OrderStatus | 'all';
  paymentStatus?: OrderPaymentStatus | 'all';
  limit?: number;
  offset?: number;
}

/* -------------------------------------------------------------------------- */
/* Defensive parsing                                                          */
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

function asTimestamp(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asOrderStatus(value: unknown): OrderStatus {
  const text = String(value ?? '');
  return text in ORDER_STATUS_TRANSITIONS ? (text as OrderStatus) : 'pending';
}

function asPaymentStatus(value: unknown): OrderPaymentStatus {
  const text = String(value ?? '');
  return PAYMENT_STATUS_OPTIONS.includes(text as OrderPaymentStatus)
    ? (text as OrderPaymentStatus)
    : 'unpaid';
}

function mapListItem(value: unknown): AdminOrderListItem | null {
  const row = asRow(value);
  if (!row) return null;

  const orderNumber = asText(row.order_number);
  const id = asText(row.id);
  if (!id || !orderNumber) return null;

  return {
    id,
    orderNumber,
    status: asOrderStatus(row.status),
    paymentStatus: asPaymentStatus(row.payment_status),
    subtotal: asNumber(row.subtotal),
    shippingAmount: asNumber(row.shipping_amount),
    taxAmount: asNumber(row.tax_amount),
    totalAmount: asNumber(row.total_amount),
    currency: asText(row.currency) ?? 'GHS',
    itemCount: Math.max(0, Math.floor(asNumber(row.item_count))),
    lineCount: Math.max(0, Math.floor(asNumber(row.line_count))),
    customerName: asText(row.customer_name) ?? asText(row.recipient_name) ?? 'Customer',
    customerEmail: asText(row.customer_email),
    customerPhone: asText(row.customer_phone),
    recipientName: asText(row.recipient_name) ?? '',
    phone: asText(row.phone) ?? '',
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapOrderItem(value: unknown): AdminOrderItem | null {
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

function mapAdminOrder(value: unknown): AdminOrder | null {
  const root = asRow(value);
  if (!root) return null;

  const order = asRow(root.order);
  if (!order) return null;

  const id = asText(order.id);
  const orderNumber = asText(order.order_number);
  if (!id || !orderNumber) return null;

  const customer = asRow(root.customer) ?? {};
  const rawItems = Array.isArray(root.items) ? root.items : [];

  return {
    id,
    orderNumber,
    userId: String(order.user_id ?? ''),
    status: asOrderStatus(order.status),
    paymentStatus: asPaymentStatus(order.payment_status),
    subtotal: asNumber(order.subtotal),
    shippingAmount: asNumber(order.shipping_amount),
    taxAmount: asNumber(order.tax_amount),
    totalAmount: asNumber(order.total_amount),
    currency: asText(order.currency) ?? 'GHS',
    recipientName: asText(order.recipient_name) ?? '',
    phone: asText(order.phone) ?? '',
    addressLine1: asText(order.address_line1) ?? '',
    addressLine2: asText(order.address_line2),
    city: asText(order.city) ?? '',
    region: asText(order.region),
    country: asText(order.country) ?? 'Ghana',
    postalCode: asText(order.postal_code),
    customerNote: asText(order.customer_note),
    createdAt: String(order.created_at ?? ''),
    updatedAt: String(order.updated_at ?? ''),
    paidAt: asTimestamp(order.paid_at),
    confirmedAt: asTimestamp(order.confirmed_at),
    shippedAt: asTimestamp(order.shipped_at),
    deliveredAt: asTimestamp(order.delivered_at),
    cancelledAt: asTimestamp(order.cancelled_at),
    customer: {
      name: asText(customer.name) ?? asText(order.recipient_name) ?? 'Customer',
      email: asText(customer.email),
      phone: asText(customer.phone) ?? asText(order.phone),
    },
    items: rawItems
      .map(mapOrderItem)
      .filter((item): item is AdminOrderItem => item !== null),
  };
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

const ADMIN_ORDER_ERROR_CODES = new Set([
  'not_authorized',
  'order_not_found',
  'invalid_status',
  'invalid_transition',
  'terminal_status',
  'no_change',
]);

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return String(error ?? '');
}

/**
 * Admin order errors follow the `'<code>|<human sentence>'` contract raised by
 * the database functions, so a known code surfaces the sentence the database
 * wrote. Anything else (RLS, session, network) falls back to the shared
 * catalogue error mapper with order-appropriate copy.
 */
export function adminOrderErrorMessage(
  error: unknown,
  fallback = 'Something went wrong while updating this order. Please try again.',
): string {
  const raw = errorText(error).trim();
  const separator = raw.indexOf('|');

  if (separator > 0) {
    const code = raw.slice(0, separator).trim();
    const detail = raw.slice(separator + 1).trim();
    if (ADMIN_ORDER_ERROR_CODES.has(code) && detail.length > 0) return detail;
  }

  return describeMutationError(error, fallback);
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** One paged, filtered slice of the order book (newest first). */
export async function listAdminOrders(query: AdminOrderQuery = {}): Promise<AdminOrderListItem[]> {
  const { data, error } = await supabase.rpc('admin_list_orders', {
    p_search: query.search?.trim() ? query.search.trim() : null,
    p_status: query.status && query.status !== 'all' ? query.status : null,
    p_payment_status:
      query.paymentStatus && query.paymentStatus !== 'all' ? query.paymentStatus : null,
    p_limit: query.limit ?? 50,
    p_offset: query.offset ?? 0,
  });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(mapListItem)
    .filter((order): order is AdminOrderListItem => order !== null);
}

/** One order with its line snapshots and the customer's contact details. */
export async function getAdminOrder(orderId: string): Promise<AdminOrder> {
  const { data, error } = await supabase.rpc('admin_get_order', { p_order_id: orderId });
  if (error) throw error;

  const order = mapAdminOrder(data);
  if (!order) throw new Error('That order could not be loaded.');
  return order;
}

/** Real operational counts — no invented metrics. */
export async function getAdminOrderStats(): Promise<AdminOrderStats> {
  const { data, error } = await supabase.rpc('admin_order_stats');
  if (error) throw error;

  const row = asRow(data) ?? {};

  return {
    total: Math.max(0, Math.floor(asNumber(row.total))),
    pending: Math.max(0, Math.floor(asNumber(row.pending))),
    confirmed: Math.max(0, Math.floor(asNumber(row.confirmed))),
    processing: Math.max(0, Math.floor(asNumber(row.processing))),
    shipped: Math.max(0, Math.floor(asNumber(row.shipped))),
    delivered: Math.max(0, Math.floor(asNumber(row.delivered))),
    cancelled: Math.max(0, Math.floor(asNumber(row.cancelled))),
    unpaid: Math.max(0, Math.floor(asNumber(row.unpaid))),
    paid: Math.max(0, Math.floor(asNumber(row.paid))),
    failed: Math.max(0, Math.floor(asNumber(row.failed))),
    refunded: Math.max(0, Math.floor(asNumber(row.refunded))),
    paidTotal: asNumber(row.paidTotal),
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations (manual, admin-only)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Sets the fulfilment status. The database validates the transition map and
 * records the matching timestamp; an invalid move raises and changes nothing.
 * Payment status is untouched.
 */
export async function setAdminOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
}

/**
 * Records the payment status an Admin observed outside the app. Payment stays
 * independent of fulfilment — this never changes the order status.
 */
export async function setAdminOrderPaymentStatus(
  orderId: string,
  paymentStatus: OrderPaymentStatus,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_payment_status', {
    p_order_id: orderId,
    p_payment_status: paymentStatus,
  });
  if (error) throw error;
}

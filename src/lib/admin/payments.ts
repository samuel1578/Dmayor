import { supabase } from '../supabase';
import type { OrderPaymentStatus, OrderStatus, PaymentSource } from '../supabase';
import { ORDER_STATUS_LABELS } from '../account/orders';
import { describeMutationError } from './errors';

/**
 * Admin payment operations data layer (Phase H0.1).
 *
 * Every call goes through an admin-only SECURITY DEFINER RPC that re-checks
 * `public.is_admin()` internally (fail closed). No extra table privileges are
 * granted to anyone, and customers keep their E1 read-only access.
 *
 * There is no payment provider. A payment record here describes something an
 * Admin observed happening outside the app (bank transfer, MoMo, cash). The
 * database — not the client — sets `payment_source = 'manual'`.
 */

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export {
  PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
} from '../account/orders';

/** Selectable payment states (all four are manual records, not transitions). */
export const PAYMENT_STATUS_OPTIONS: readonly OrderPaymentStatus[] = [
  'unpaid',
  'paid',
  'failed',
  'refunded',
];

/** Allowed attribution values. `paystack` may show zero results until Phase F. */
export const PAYMENT_SOURCE_OPTIONS: readonly PaymentSource[] = ['manual', 'paystack'];

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  manual: 'Manual',
  paystack: 'Paystack',
};

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface AdminPaymentListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  totalAmount: number;
  currency: string;
  paymentStatus: OrderPaymentStatus;
  paymentSource: PaymentSource | null;
  paymentProvider: string | null;
  paymentChannel: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  paymentUpdatedAt: string | null;
  createdAt: string;
}

export interface AdminPaymentCustomer {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface AdminPaymentDetail {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  totalAmount: number;
  currency: string;
  paymentStatus: OrderPaymentStatus;
  paymentSource: PaymentSource | null;
  paymentProvider: string | null;
  paymentChannel: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  paymentUpdatedAt: string | null;
  createdAt: string;
  customer: AdminPaymentCustomer;
}

export interface AdminPaymentQuery {
  search?: string;
  paymentStatus?: OrderPaymentStatus | 'all';
  paymentSource?: PaymentSource | 'all';
  limit?: number;
  offset?: number;
}

export interface ManualPaymentInput {
  orderId: string;
  paymentStatus: OrderPaymentStatus;
  /** Blank/omitted leaves the stored reference unchanged. */
  reference?: string | null;
  /** Blank/omitted leaves the stored provider unchanged. */
  provider?: string | null;
  /** Blank/omitted leaves the stored channel unchanged. */
  channel?: string | null;
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

function asPaymentStatus(value: unknown): OrderPaymentStatus {
  const text = String(value ?? '');
  return PAYMENT_STATUS_OPTIONS.includes(text as OrderPaymentStatus)
    ? (text as OrderPaymentStatus)
    : 'unpaid';
}

function asPaymentSource(value: unknown): PaymentSource | null {
  const text = String(value ?? '');
  return PAYMENT_SOURCE_OPTIONS.includes(text as PaymentSource) ? (text as PaymentSource) : null;
}

function asOrderStatus(value: unknown): OrderStatus {
  const text = String(value ?? '');
  return text in ORDER_STATUS_LABELS ? (text as OrderStatus) : 'pending';
}

function mapListItem(value: unknown): AdminPaymentListItem | null {
  const row = asRow(value);
  if (!row) return null;

  const id = asText(row.id);
  const orderNumber = asText(row.order_number);
  if (!id || !orderNumber) return null;

  return {
    id,
    orderNumber,
    customerName: asText(row.customer_name) ?? 'Customer',
    customerEmail: asText(row.customer_email),
    totalAmount: asNumber(row.total_amount),
    currency: asText(row.currency) ?? 'GHS',
    paymentStatus: asPaymentStatus(row.payment_status),
    paymentSource: asPaymentSource(row.payment_source),
    paymentProvider: asText(row.payment_provider),
    paymentChannel: asText(row.payment_channel),
    paymentReference: asText(row.payment_reference),
    paidAt: asTimestamp(row.paid_at),
    paymentUpdatedAt: asTimestamp(row.payment_updated_at),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapDetail(value: unknown): AdminPaymentDetail | null {
  const root = asRow(value);
  if (!root) return null;

  const order = asRow(root.order);
  if (!order) return null;

  const id = asText(order.id);
  const orderNumber = asText(order.order_number);
  if (!id || !orderNumber) return null;

  const customer = asRow(root.customer) ?? {};

  return {
    id,
    orderNumber,
    orderStatus: asOrderStatus(order.status),
    totalAmount: asNumber(order.total_amount),
    currency: asText(order.currency) ?? 'GHS',
    paymentStatus: asPaymentStatus(order.payment_status),
    paymentSource: asPaymentSource(order.payment_source),
    paymentProvider: asText(order.payment_provider),
    paymentChannel: asText(order.payment_channel),
    paymentReference: asText(order.payment_reference),
    paidAt: asTimestamp(order.paid_at),
    paymentUpdatedAt: asTimestamp(order.payment_updated_at),
    createdAt: String(order.created_at ?? ''),
    customer: {
      name: asText(customer.name) ?? 'Customer',
      email: asText(customer.email),
      phone: asText(customer.phone),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

const ADMIN_PAYMENT_ERROR_CODES = new Set([
  'not_authorized',
  'order_not_found',
  'invalid_status',
  'no_change',
  'reference_too_long',
  'provider_too_long',
  'channel_too_long',
]);

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return String(error ?? '');
}

/**
 * Payment errors follow the `'<code>|<human sentence>'` contract raised by the
 * database functions, so a known code surfaces the server-authored sentence.
 * Anything else (RLS, session, network) falls back to the shared mapper.
 */
export function adminPaymentErrorMessage(
  error: unknown,
  fallback = 'Something went wrong while updating this payment. Please try again.',
): string {
  const raw = errorText(error).trim();
  const separator = raw.indexOf('|');

  if (separator > 0) {
    const code = raw.slice(0, separator).trim();
    const detail = raw.slice(separator + 1).trim();
    if (ADMIN_PAYMENT_ERROR_CODES.has(code) && detail.length > 0) return detail;
  }

  return describeMutationError(error, fallback);
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** One paged, filtered slice of the payment queue (newest orders first). */
export async function listAdminPayments(
  query: AdminPaymentQuery = {},
): Promise<AdminPaymentListItem[]> {
  const { data, error } = await supabase.rpc('admin_list_payments', {
    p_search: query.search?.trim() ? query.search.trim() : null,
    p_payment_status:
      query.paymentStatus && query.paymentStatus !== 'all' ? query.paymentStatus : null,
    p_payment_source:
      query.paymentSource && query.paymentSource !== 'all' ? query.paymentSource : null,
    p_limit: query.limit ?? 50,
    p_offset: query.offset ?? 0,
  });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(mapListItem)
    .filter((payment): payment is AdminPaymentListItem => payment !== null);
}

/** Payment-focused detail for one order (not the whole order payload). */
export async function getAdminPayment(orderId: string): Promise<AdminPaymentDetail> {
  const { data, error } = await supabase.rpc('admin_get_payment', { p_order_id: orderId });
  if (error) throw error;

  const payment = mapDetail(data);
  if (!payment) throw new Error('That payment could not be loaded.');
  return payment;
}

/* -------------------------------------------------------------------------- */
/* Mutations (manual, admin-only)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Records a manual payment. The database sets `payment_source = 'manual'`
 * server-side; the client cannot choose it. Optional metadata is only written
 * when supplied — blank/null leaves the stored value unchanged. No money moves
 * and no external call is made.
 */
export async function setAdminManualPayment(input: ManualPaymentInput): Promise<void> {
  const { error } = await supabase.rpc('admin_set_manual_payment', {
    p_order_id: input.orderId,
    p_payment_status: input.paymentStatus,
    p_reference: input.reference?.trim() ? input.reference.trim() : null,
    p_provider: input.provider?.trim() ? input.provider.trim() : null,
    p_channel: input.channel?.trim() ? input.channel.trim() : null,
  });
  if (error) throw error;
}

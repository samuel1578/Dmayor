import { supabase } from '../supabase';
import type { OrderPaymentStatus, OrderStatus, PaymentSource } from '../supabase';

/**
 * Customer payment center data layer (Phase H0.2).
 *
 * Payment records are DERIVED from the customer's OWN order rows — there is no
 * separate customer-readable transaction table. Every read filters by the
 * signed-in user id AND is authorized row-by-row by the existing `orders` RLS
 * policy (`auth.uid() = user_id`). A customer editing the URL to another
 * customer's order number gets `null` — the same result as a number that does
 * not exist — so nothing leaks about other people's payments.
 *
 * Read-only: there is no update/delete helper anywhere in this file, and the
 * database grants no customer write access to `orders`. Payment status is
 * changed by Admin only (Phase H0.1).
 *
 * Payments can be completed through Paystack (initialized/verified server-side
 * by the Edge Functions) or recorded manually by an authorised Admin; this
 * module only ever READS the resulting order metadata.
 *
 * Queries are deliberately small and never per-row (no N+1): the list is one
 * select; the detail is one select; the recent payment reuses the list select
 * with `limit 1`.
 */

/* -------------------------------------------------------------------------- */
/* Status domains                                                             */
/* -------------------------------------------------------------------------- */

export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

/** Selectable payment states (all four are manual records, not transitions). */
export const PAYMENT_STATUS_OPTIONS: readonly OrderPaymentStatus[] = [
  'unpaid',
  'paid',
  'failed',
  'refunded',
];

export type PaymentFilter = 'all' | OrderPaymentStatus;

export const PAYMENT_FILTERS: ReadonlyArray<{ id: PaymentFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'paid', label: 'Paid' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

export function paymentMatchesFilter(payment: CustomerPayment, filter: PaymentFilter): boolean {
  return filter === 'all' ? true : payment.paymentStatus === filter;
}

/** How many of these payments belong to each filter (for the filter chips). */
export function countMyPaymentsByStatus(
  payments: CustomerPayment[],
): Record<PaymentFilter, number> {
  const counts: Record<PaymentFilter, number> = {
    all: payments.length,
    unpaid: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
  };

  for (const payment of payments) {
    counts[payment.paymentStatus] += 1;
  }

  return counts;
}

/* -------------------------------------------------------------------------- */
/* Display helpers — honest labels, never fabricated values                   */
/* -------------------------------------------------------------------------- */

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  manual: 'Manual',
  paystack: 'Paystack',
};

/** `Manual` / `Paystack`, or an honest neutral label when nothing is recorded. */
export function paymentSourceLabel(source: PaymentSource | null): string {
  return source ? PAYMENT_SOURCE_LABELS[source] : 'Not recorded';
}

export function paymentProviderLabel(provider: string | null): string {
  return provider ?? 'Not connected';
}

export function paymentChannelLabel(channel: string | null): string {
  return channel ?? 'Not recorded';
}

export function paymentReferenceLabel(reference: string | null): string {
  return reference ?? '—';
}

/** Headline for the recorded payment state (text, never colour-only). */
export const PAYMENT_STATE_TITLES: Record<OrderPaymentStatus, string> = {
  unpaid: 'Payment outstanding',
  paid: 'Payment received',
  failed: 'Payment failed',
  refunded: 'Refund recorded',
};

/**
 * A plain sentence describing what the recorded state means. For manual
 * records this is explicit that nothing was processed automatically.
 */
export function paymentStateNote(
  payment: Pick<
    CustomerPayment,
    'paymentStatus' | 'paymentSource' | 'paymentProvider' | 'paymentChannel' | 'paymentReference' | 'paidAt'
  >,
): string {
  const manual = payment.paymentSource === 'manual';

  switch (payment.paymentStatus) {
    case 'paid':
      return manual
        ? 'This payment was recorded manually — it was not processed by an online payment provider.'
        : 'This order has been marked as paid.';
    case 'failed':
      return 'The last payment attempt for this order did not go through.';
    case 'refunded':
      return manual
        ? 'This is a recorded status only — no automated refund was issued through a payment provider.'
        : 'This order has been marked as refunded.';
    default:
      return 'No payment has been recorded for this order yet.';
  }
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface CustomerPayment {
  id: string;
  orderNumber: string;
  /** Fulfilment status — displayed alongside, never merged with payment. */
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
  return text === 'pending' ||
    text === 'confirmed' ||
    text === 'processing' ||
    text === 'shipped' ||
    text === 'delivered' ||
    text === 'cancelled'
    ? (text as OrderStatus)
    : 'pending';
}

function asPaymentStatus(value: unknown): OrderPaymentStatus {
  const text = String(value ?? '');
  return PAYMENT_STATUS_OPTIONS.includes(text as OrderPaymentStatus)
    ? (text as OrderPaymentStatus)
    : 'unpaid';
}

function asPaymentSource(value: unknown): PaymentSource | null {
  const text = String(value ?? '');
  return text === 'manual' || text === 'paystack' ? (text as PaymentSource) : null;
}

function mapPayment(value: unknown): CustomerPayment | null {
  const row = asRow(value);
  if (!row) return null;

  const id = asText(row.id);
  const orderNumber = asText(row.order_number);
  if (!id || !orderNumber) return null;

  return {
    id,
    orderNumber,
    orderStatus: asOrderStatus(row.status),
    totalAmount: asNumber(row.total_amount),
    currency: asText(row.currency) ?? 'GHS',
    paymentStatus: asPaymentStatus(row.payment_status),
    paymentSource: asPaymentSource(row.payment_source),
    paymentProvider: asText(row.payment_provider),
    paymentChannel: asText(row.payment_channel),
    paymentReference: asText(row.payment_reference),
    paidAt: asText(row.paid_at),
    paymentUpdatedAt: asText(row.payment_updated_at),
    createdAt: String(row.created_at ?? ''),
  };
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

const PAYMENT_SELECT =
  'id, order_number, status, total_amount, currency, payment_status, ' +
  'payment_source, payment_provider, payment_channel, payment_reference, ' +
  'paid_at, payment_updated_at, created_at';

/** Newest first. RLS + the user_id filter both scope this to the caller. */
export async function listMyPayments(userId: string): Promise<CustomerPayment[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(PAYMENT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(mapPayment)
    .filter((payment): payment is CustomerPayment => payment !== null);
}

/** The single most recent order's payment record, for the account overview. */
export async function getRecentPayment(userId: string): Promise<CustomerPayment | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(PAYMENT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPayment(data) : null;
}

/**
 * One payment record, by order number.
 *
 * Returns `null` for a number that does not exist on this account — including
 * another customer's order, which RLS makes invisible. The caller must show the
 * same "not found" state either way, so nothing about someone else's payment is
 * revealed.
 */
export async function getMyPayment(
  userId: string,
  orderNumber: string,
): Promise<CustomerPayment | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(PAYMENT_SELECT)
    .eq('user_id', userId)
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPayment(data) : null;
}

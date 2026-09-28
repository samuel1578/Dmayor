import { supabase } from '../supabase';
import type { OrderPaymentStatus, OrderStatus } from '../supabase';

/**
 * Phase E1 checkout / order data layer.
 *
 * All commerce maths happens in the database:
 *   - `preview_cart_order()`      read-only, server-authoritative preview
 *   - `create_order_from_cart()`  the single atomic order-creation path
 *
 * The browser never sends prices, stock, totals, status or payment_status, and
 * the tables are read-only for customers (RLS: own orders only, no writes).
 * There is no payment provider — every order is created `unpaid`.
 *
 * Reading orders back (history, one order, counts) lives in
 * `src/lib/account/orders.ts` (Phase E2); this module stays checkout-only.
 */

/* -------------------------------------------------------------------------- */
/* Status narrowing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Defensive narrowing of what the RPC returns. Labels, the status timeline and
 * the read queries all live in `lib/account/orders.ts` — this module only
 * deals with checkout.
 */
const ORDER_STATUS_VALUES: readonly string[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const PAYMENT_STATUS_VALUES: readonly string[] = ['unpaid', 'paid', 'failed', 'refunded'];

function asOrderStatus(value: unknown): OrderStatus {
  const text = String(value ?? '');
  return ORDER_STATUS_VALUES.includes(text) ? (text as OrderStatus) : 'pending';
}

function asPaymentStatus(value: unknown): OrderPaymentStatus {
  const text = String(value ?? '');
  return PAYMENT_STATUS_VALUES.includes(text) ? (text as OrderPaymentStatus) : 'unpaid';
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/** Provisional delivery/tax config the server priced the cart with. */
export interface CheckoutSettings {
  shippingFlatFee: number;
  freeShippingThreshold: number | null;
  taxRate: number;
  pricesIncludeTax: boolean;
  /**
   * False until the business confirms the real shipping/tax rules. The UI must
   * disclose that the current amounts are unconfirmed defaults — it never
   * presents them as a policy.
   */
  rulesConfirmed: boolean;
}

export interface CheckoutLine {
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
  /** Server-authored reason this line cannot be ordered, or null when fine. */
  issue: string | null;
  purchasable: boolean;
}

export interface CheckoutPreview {
  currency: string;
  settings: CheckoutSettings;
  lines: CheckoutLine[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  purchasableQuantity: number;
  /** Human-readable reasons checkout is blocked (invalid lines, empty cart). */
  blockers: string[];
}

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
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

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * PostgREST returns the database error message verbatim. The checkout
 * functions raise `'<code>|<human sentence>'`, so a known code means the part
 * after the pipe is a server-authored sentence we can show as-is.
 */
const CHECKOUT_ERROR_CODES = new Set([
  'not_authenticated',
  'config_missing',
  'address_required',
  'note_too_long',
  'cart_empty',
  'product_unavailable',
  'variant_unavailable',
  'variant_product_mismatch',
  'insufficient_stock',
]);

const CHECKOUT_FALLBACK =
  'We could not place your order just now. Nothing was charged and your cart is unchanged — please try again.';

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return String(error ?? '');
}

export function checkoutErrorMessage(error: unknown): string {
  const raw = errorText(error).trim();
  const separator = raw.indexOf('|');

  if (separator > 0) {
    const code = raw.slice(0, separator).trim();
    const detail = raw.slice(separator + 1).trim();
    if (CHECKOUT_ERROR_CODES.has(code) && detail.length > 0) return detail;
  }

  if (/fetch|network|timeout/i.test(raw)) {
    return 'Network error — check your connection and try again. Your order was not created.';
  }

  return CHECKOUT_FALLBACK;
}

/* -------------------------------------------------------------------------- */
/* Preview (read-only)                                                        */
/* -------------------------------------------------------------------------- */

function mapLine(value: unknown): CheckoutLine | null {
  const row = asRow(value);
  if (!row) return null;

  const productName = asText(row.productName);
  const variantId = asText(row.variantId);
  if (!productName || !variantId) return null;

  return {
    productId: asText(row.productId),
    variantId,
    productName,
    productSlug: asText(row.productSlug),
    variantSku: asText(row.variantSku),
    size: asText(row.size),
    colour: asText(row.colour),
    unitPrice: asNumber(row.unitPrice),
    quantity: Math.max(0, Math.floor(asNumber(row.quantity))),
    lineTotal: asNumber(row.lineTotal),
    imageUrl: asText(row.imageUrl),
    issue: asText(row.issue),
    purchasable: row.purchasable !== false,
  };
}

/**
 * Server-authoritative snapshot of the authenticated cart: current prices,
 * current stock, delivery totals and every reason checkout is blocked.
 * Read-only — nothing is reserved or decremented. Use it for display AND for
 * the final revalidation before "Place Order" is enabled.
 */
export async function previewCartOrder(): Promise<CheckoutPreview> {
  const { data, error } = await supabase.rpc('preview_cart_order');
  if (error) throw error;

  const root = asRow(data) ?? {};
  const settings = asRow(root.settings) ?? {};
  const rawLines = Array.isArray(root.lines) ? root.lines : [];
  const rawBlockers = Array.isArray(root.blockers) ? root.blockers : [];

  const threshold = settings.freeShippingThreshold;

  return {
    currency: asText(root.currency) ?? 'GHS',
    settings: {
      shippingFlatFee: asNumber(settings.shippingFlatFee),
      freeShippingThreshold:
        threshold === null || threshold === undefined ? null : asNumber(threshold),
      taxRate: asNumber(settings.taxRate),
      pricesIncludeTax: settings.pricesIncludeTax !== false,
      rulesConfirmed: settings.rulesConfirmed === true,
    },
    lines: rawLines
      .map(mapLine)
      .filter((line): line is CheckoutLine => line !== null),
    subtotal: asNumber(root.subtotal),
    shipping: asNumber(root.shipping),
    tax: asNumber(root.tax),
    total: asNumber(root.total),
    purchasableQuantity: Math.max(0, Math.floor(asNumber(root.purchasableQuantity))),
    blockers: rawBlockers
      .map((blocker) => (typeof blocker === 'string' ? blocker.trim() : ''))
      .filter((blocker) => blocker.length > 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Place order (atomic RPC)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Creates the order transactionally. The server revalidates products, variants,
 * stock and prices, computes every total, snapshots the delivery address,
 * decrements variant stock and clears the cart — all or nothing.
 *
 * No payment provider is involved: the created order is always `unpaid`.
 */
export async function placeOrder(addressId: string): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc('create_order_from_cart', {
    p_address_id: addressId,
  });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [data];
  const row = asRow(rows[0]);
  if (!row || !asText(row.order_number)) {
    throw new Error('checkout: the order was created but the server returned no order reference.');
  }

  return {
    orderId: String(row.order_id ?? ''),
    orderNumber: String(row.order_number),
    status: asOrderStatus(row.status),
    paymentStatus: asPaymentStatus(row.payment_status),
    subtotal: asNumber(row.subtotal),
    shippingAmount: asNumber(row.shipping_amount),
    taxAmount: asNumber(row.tax_amount),
    totalAmount: asNumber(row.total_amount),
    currency: asText(row.currency) ?? 'GHS',
  };
}


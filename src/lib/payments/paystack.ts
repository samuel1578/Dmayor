/**
 * Client-safe Paystack module (Phase F1 contract, wired up in Phase F2).
 *
 * The browser NEVER talks to Paystack directly and never sees the secret key.
 * It calls the `initialize-payment` / `verify-payment` Edge Functions, which
 * return only the safe shapes below. The amount, currency, email and identity
 * are always derived server-side — the client sends `{ orderId }` or
 * `{ reference }` and nothing else.
 *
 * The server contract is enforced in `supabase/functions/_shared/http.ts`
 * (error codes) and `supabase/functions/_shared/types.ts` (success payloads).
 */

import { supabase } from '../supabase';
import type { OrderPaymentStatus, OrderStatus } from '../supabase';

/* -------------------------------------------------------------------------- */
/* Contract types                                                             */
/* -------------------------------------------------------------------------- */

/** Every error code the payment Edge Functions can return. */
export type PaymentErrorCode =
  | 'method_not_allowed'
  | 'not_authenticated'
  | 'invalid_request'
  | 'order_not_found'
  | 'order_not_owned'
  | 'already_paid'
  | 'order_not_payable'
  | 'payment_initialize_failed'
  | 'payment_attempt_not_found'
  | 'payment_verify_failed'
  | 'payment_amount_mismatch'
  | 'payment_currency_mismatch'
  | 'payment_reference_mismatch'
  | 'payment_conflict'
  | 'server_configuration_error';

const PAYMENT_ERROR_TEXT: Record<PaymentErrorCode, string> = {
  method_not_allowed: 'This action is not available right now.',
  not_authenticated: 'Please sign in to continue.',
  invalid_request: 'Something went wrong with that request. Please try again.',
  order_not_found: 'That order could not be found.',
  order_not_owned: 'We could not open that order.',
  already_paid: 'Payment has already been received for this order.',
  order_not_payable: 'This order cannot currently be paid online.',
  payment_initialize_failed: 'We could not start the payment. Please try again.',
  payment_attempt_not_found: 'We could not find that payment.',
  payment_verify_failed: 'We could not verify this payment. Please try again.',
  payment_amount_mismatch: 'The payment amount did not match this order. Please contact support.',
  payment_currency_mismatch:
    'The payment currency did not match this order. Please contact support.',
  payment_reference_mismatch:
    'The payment did not match this order. Please contact support.',
  payment_conflict:
    'This order already has a payment recorded from another source. Please contact support.',
  server_configuration_error: 'The payment service is temporarily unavailable. Please try again later.',
};

/** The safe payload returned by `initialize-payment`. */
export interface InitializePaymentResult {
  reference: string;
  authorizationUrl: string;
  attemptId: string;
}

/** The safe payload returned by `verify-payment`. */
export interface VerifyPaymentResult {
  /** The order's payment state after verification. */
  status: 'paid' | 'unpaid';
  /** The detailed attempt outcome. */
  outcome: 'success' | 'already_verified' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: string | null;
}

export interface ParsedPaymentError {
  code: PaymentErrorCode | null;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit-tested, no network)                                     */
/* -------------------------------------------------------------------------- */

function isErrorCode(value: unknown): value is PaymentErrorCode {
  return typeof value === 'string' && value in PAYMENT_ERROR_TEXT;
}

/**
 * Normalises an Edge Function error payload into a predictable code plus
 * customer-safe copy. Unknown shapes fall back to a generic message — a raw
 * provider payload is never surfaced.
 */
export function parsePaymentError(
  payload: unknown,
  fallback = 'Something went wrong with this payment. Please try again.',
): ParsedPaymentError {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (isErrorCode(record.error)) {
      const message =
        typeof record.message === 'string' && record.message.trim().length > 0
          ? record.message.trim()
          : PAYMENT_ERROR_TEXT[record.error];
      return { code: record.error, message };
    }
  }

  return { code: null, message: fallback };
}

/** The exact body sent to `initialize-payment` — order id only, never money. */
export function buildInitializeBody(orderId: string): { orderId: string } {
  return { orderId };
}

/** The exact body sent to `verify-payment` — reference only, never a status. */
export function buildVerifyBody(reference: string): { reference: string } {
  return { reference };
}

export type PaymentActionKind = 'pay_now' | 'retry';

export interface PaymentAction {
  kind: PaymentActionKind;
  label: string;
}

/**
 * Client-side eligibility (UX only — the server stays authoritative).
 *
 *   unpaid  → Pay Now
 *   failed  → Retry Payment
 *   paid / refunded → no action
 *   cancelled order → no action (no new cancellation policy is introduced)
 */
export function paymentActionFor(
  paymentStatus: OrderPaymentStatus,
  orderStatus: OrderStatus,
): PaymentAction | null {
  if (orderStatus === 'cancelled') return null;
  if (paymentStatus === 'unpaid') return { kind: 'pay_now', label: 'Pay Now' };
  if (paymentStatus === 'failed') return { kind: 'retry', label: 'Retry Payment' };
  return null;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class PaymentRequestError extends Error {
  readonly code: PaymentErrorCode | null;

  constructor(code: PaymentErrorCode | null, message: string) {
    super(message);
    this.name = 'PaymentRequestError';
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Single-flight guard (prevents double submit from one UI action)            */
/* -------------------------------------------------------------------------- */

export interface PaymentGuard {
  readonly busy: boolean;
  /** Runs `task` only when idle; a concurrent call resolves to `undefined`. */
  run<T>(task: () => Promise<T>): Promise<T | undefined>;
}

export function createPaymentGuard(): PaymentGuard {
  let busy = false;

  return {
    get busy() {
      return busy;
    },
    async run<T>(task: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await task();
      } finally {
        busy = false;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Edge Function transport                                                    */
/* -------------------------------------------------------------------------- */

async function readErrorPayload(error: unknown): Promise<unknown> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      return await context.json();
    } catch {
      return null;
    }
  }
  return null;
}

async function invokePaymentFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const payload = await readErrorPayload(error);
    const parsed = parsePaymentError(payload);
    console.error(`Payment function "${name}" failed:`, parsed.code ?? 'unknown');
    throw new PaymentRequestError(parsed.code, parsed.message);
  }

  if (!data || typeof data !== 'object') {
    throw new PaymentRequestError(
      null,
      'We received an unexpected response from the payment service.',
    );
  }

  return data as T;
}

/* -------------------------------------------------------------------------- */
/* Client API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Starts a new Paystack attempt for an order and returns the hosted-checkout
 * URL. The caller redirects with `window.location.assign(...)`. The browser
 * sends only the order id; the server derives the amount.
 */
export async function initializePaystackPayment(
  orderId: string,
): Promise<InitializePaymentResult> {
  const result = await invokePaymentFunction<InitializePaymentResult>(
    'initialize-payment',
    buildInitializeBody(orderId),
  );

  if (typeof result.reference !== 'string' || typeof result.authorizationUrl !== 'string') {
    throw new PaymentRequestError(null, 'We could not start the payment. Please try again.');
  }

  return result;
}

/**
 * Asks the server to verify a Paystack reference server-to-server. The order is
 * only marked paid by that trusted server path — never from the callback URL.
 */
export async function verifyPaystackPayment(reference: string): Promise<VerifyPaymentResult> {
  const result = await invokePaymentFunction<VerifyPaymentResult>(
    'verify-payment',
    buildVerifyBody(reference),
  );

  if (
    (result.status !== 'paid' && result.status !== 'unpaid') ||
    typeof result.orderNumber !== 'string'
  ) {
    throw new PaymentRequestError(null, 'We could not verify this payment. Please try again.');
  }

  return result;
}

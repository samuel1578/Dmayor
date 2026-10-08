/**
 * Callback helpers (Phase F2).
 *
 * The `/payment/callback` return URL is only used to obtain the provider
 * REFERENCE. Everything else in the query string is ignored — status, amount,
 * email, order number and metadata from the URL are never trusted. The
 * reference is then verified server-to-server.
 */

import type { PaymentErrorCode, VerifyPaymentResult } from './paystack';

/** Every normalized state the callback page can render. */
export type CallbackOutcome =
  | 'verifying'
  | 'success'
  | 'failed'
  | 'pending'
  | 'invalid_reference'
  | 'verification_error'
  | 'conflict';

/**
 * Reads the usable Paystack reference from a query string: `reference` first,
 * then the `trxref` fallback. Returns null when neither is present. Never reads
 * any other parameter.
 */
export function extractCallbackReference(search: string): string | null {
  if (!search) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const reference = params.get('reference')?.trim();
  if (reference) return reference;

  const trxref = params.get('trxref')?.trim();
  if (trxref) return trxref;

  return null;
}

/** Maps a verified server result to a normalized callback outcome. */
export function callbackOutcomeFromVerifyResult(result: VerifyPaymentResult): CallbackOutcome {
  if (result.status === 'paid') return 'success';
  if (result.outcome === 'failed' || result.outcome === 'abandoned') return 'failed';
  return 'pending';
}

/** Maps a server error code to a normalized callback outcome. */
export function callbackOutcomeFromError(code: PaymentErrorCode | null): CallbackOutcome {
  if (code === 'payment_conflict') return 'conflict';
  if (code === 'payment_attempt_not_found') return 'invalid_reference';
  return 'verification_error';
}

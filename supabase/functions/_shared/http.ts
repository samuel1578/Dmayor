/**
 * HTTP response + error contract for the F1 Edge Functions.
 *
 * Every failure returns `{ "error": "<code>", "message": "<human sentence>" }`
 * with a predictable code from ERROR_CODES. Raw provider payloads, secrets and
 * stack traces are never returned to the caller — details are logged server-side
 * instead.
 */

/** The predictable error codes shared with the client contract. */
export const ERROR_CODES = {
  method_not_allowed: 405,
  not_authenticated: 401,
  invalid_request: 400,
  order_not_found: 404,
  order_not_owned: 403,
  already_paid: 409,
  order_not_payable: 409,
  payment_initialize_failed: 502,
  payment_attempt_not_found: 404,
  payment_verify_failed: 502,
  payment_amount_mismatch: 409,
  payment_currency_mismatch: 409,
  payment_reference_mismatch: 409,
  payment_conflict: 409,
  server_configuration_error: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  method_not_allowed: 'This endpoint only accepts POST requests.',
  not_authenticated: 'Please sign in to continue.',
  invalid_request: 'The request was not valid.',
  order_not_found: 'That order could not be found.',
  order_not_owned: 'That order does not belong to your account.',
  already_paid: 'This order has already been paid.',
  order_not_payable: 'This order can no longer be paid online.',
  payment_initialize_failed: 'We could not start this payment. Please try again.',
  payment_attempt_not_found: 'That payment attempt could not be found.',
  payment_verify_failed: 'We could not verify this payment. Please try again.',
  payment_amount_mismatch: 'The payment amount did not match this order.',
  payment_currency_mismatch: 'The payment currency did not match this order.',
  payment_reference_mismatch: 'The payment reference did not match this attempt.',
  payment_conflict:
    'This order already has a payment recorded from another source. Please contact support.',
  server_configuration_error: 'Payment is not configured yet. Please try again later.',
};

export function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** A predictable error response. */
export function fail(
  code: ErrorCode,
  message: string | undefined,
  cors: Record<string, string>,
): Response {
  return jsonResponse(
    { error: code, message: message ?? DEFAULT_MESSAGES[code] },
    ERROR_CODES[code],
    cors,
  );
}

/** Parses a JSON object body defensively; returns null for anything else. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

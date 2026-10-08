/**
 * Reconcile-payment pure helpers (Phase F3).
 *
 * The Admin may identify an order (or a reference); every authoritative value
 * (amount, status, currency, source) is obtained server-side by contacting
 * Paystack. Any such fields in the request body are ignored.
 */

export interface ReconcileInput {
  orderId: string | null;
  reference: string | null;
}

/** Reads ONLY the identifying fields; everything else in the body is ignored. */
export function parseReconcileInput(payload: unknown): ReconcileInput {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { orderId: null, reference: null };
  }

  const record = payload as Record<string, unknown>;

  const orderId =
    typeof record.orderId === 'string' && record.orderId.trim().length > 0
      ? record.orderId.trim()
      : null;

  const reference =
    typeof record.reference === 'string' && record.reference.trim().length > 0
      ? record.reference.trim()
      : null;

  return { orderId, reference };
}

/** Fail closed: only an explicit boolean `true` from the admin check passes. */
export function isAdminAuthorized(isAdmin: unknown): boolean {
  return isAdmin === true;
}

/**
 * Cancellation vocabulary & validation (Phase G2).
 *
 * Pure logic shared by the Admin cancel dialog and the customer order view.
 * Deliberately has NO Supabase import, so it stays unit-testable in the node
 * environment.
 *
 * Domain rules encoded here (mirrored server-side in migration 014):
 *   - the reason is a constrained text code — NOT a reference table, not free
 *     text — and it is required when cancelling through the Admin UI
 *   - the note is optional, internal (Admin-only), max 500 characters
 *   - the customer only ever sees a friendly rendering of the code; the
 *     internal note and `cancelled_by` are never exposed
 *   - cancellation never implies a refund: payment state is a separate domain
 */

/** Reason codes — identical to the CHECK constraint in migration 014. */
export const CANCELLATION_REASONS = [
  'customer_request',
  'item_unavailable',
  'duplicate_order',
  'payment_issue',
  'operational_issue',
  'other',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/** Admin-facing labels (the dialog and the Admin detail card). */
export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  customer_request: 'Customer request',
  item_unavailable: 'Item unavailable',
  duplicate_order: 'Duplicate order',
  payment_issue: 'Payment issue',
  operational_issue: 'Operational issue',
  other: 'Other',
};

/**
 * Customer-safe wording for each reason. `null` means "show nothing" — the
 * customer gets the cancellation date only, never an internal explanation and
 * never the free-text note.
 */
const CUSTOMER_CANCELLATION_REASON_TEXT: Record<CancellationReason, string | null> = {
  customer_request: 'Cancelled at the customer’s request.',
  item_unavailable: 'An item in this order became unavailable.',
  duplicate_order: 'This order was a duplicate.',
  payment_issue: 'There was a problem with the payment for this order.',
  operational_issue: 'The store could not fulfil this order.',
  other: null,
};

/** Internal note limit — identical to the DB constraint. */
export const CANCELLATION_NOTE_MAX = 500;

export function isCancellationReason(value: unknown): value is CancellationReason {
  return (
    typeof value === 'string' && (CANCELLATION_REASONS as readonly string[]).includes(value)
  );
}

/** Friendly customer-facing sentence for a stored reason code, or null. */
export function customerCancellationReasonText(
  reason: string | null | undefined,
): string | null {
  if (!isCancellationReason(reason)) return null;
  return CUSTOMER_CANCELLATION_REASON_TEXT[reason];
}

/** Raw form values for the Admin cancel dialog. */
export interface CancellationDraft {
  reason: string;
  note: string;
}

export type CancellationValidation =
  | { ok: true; reason: CancellationReason; note: string | null }
  | { ok: false; message: string };

/**
 * Validates the cancel dialog input: a known reason code is required, the
 * note is optional (blank → null) and capped at CANCELLATION_NOTE_MAX.
 * Mirrors the checks inside `admin_cancel_order` so the Admin gets instant
 * feedback while the database remains the authority.
 */
export function validateCancellationInput(
  draft: Partial<CancellationDraft>,
): CancellationValidation {
  const reason = typeof draft.reason === 'string' ? draft.reason.trim() : '';
  const note = typeof draft.note === 'string' ? draft.note.trim() : '';

  if (reason.length === 0) {
    return { ok: false, message: 'Choose a cancellation reason.' };
  }

  if (!isCancellationReason(reason)) {
    return { ok: false, message: 'Choose a cancellation reason from the list.' };
  }

  if (note.length > CANCELLATION_NOTE_MAX) {
    return {
      ok: false,
      message: `Cancellation note must be ${CANCELLATION_NOTE_MAX} characters or fewer.`,
    };
  }

  return { ok: true, reason, note: note.length > 0 ? note : null };
}

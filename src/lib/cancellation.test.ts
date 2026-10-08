import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_NOTE_MAX,
  CANCELLATION_REASON_LABELS,
  CANCELLATION_REASONS,
  customerCancellationReasonText,
  isCancellationReason,
  validateCancellationInput,
} from './cancellation';

/**
 * Phase G2 — cancellation vocabulary & validation.
 *
 * Covers the pure parts of required tests 13 (cancellation reason stored) and
 * 14 (internal note never exposed to the customer), plus the reason/note
 * validation rules mirrored from migration 014.
 */

describe('reason vocabulary', () => {
  it('is exactly the constrained set documented in migration 014', () => {
    expect([...CANCELLATION_REASONS]).toEqual([
      'customer_request',
      'item_unavailable',
      'duplicate_order',
      'payment_issue',
      'operational_issue',
      'other',
    ]);
  });

  it('has an admin label for every reason code', () => {
    for (const reason of CANCELLATION_REASONS) {
      expect(CANCELLATION_REASON_LABELS[reason]).toBeTruthy();
    }
    expect(Object.keys(CANCELLATION_REASON_LABELS).sort()).toEqual(
      [...CANCELLATION_REASONS].sort(),
    );
  });

  it('recognises only known codes', () => {
    expect(isCancellationReason('customer_request')).toBe(true);
    expect(isCancellationReason('made_up_reason')).toBe(false);
    expect(isCancellationReason(null)).toBe(false);
    expect(isCancellationReason(undefined)).toBe(false);
  });
});

describe('cancel input validation', () => {
  it('requires a reason', () => {
    expect(validateCancellationInput({ reason: '', note: '' })).toEqual({
      ok: false,
      message: 'Choose a cancellation reason.',
    });
    expect(validateCancellationInput({}).ok).toBe(false);
  });

  it('rejects an unknown reason code', () => {
    const result = validateCancellationInput({ reason: 'because_i_said_so', note: '' });
    expect(result.ok).toBe(false);
  });

  it('trims the reason and note, blank note becomes null', () => {
    const result = validateCancellationInput({
      reason: '  item_unavailable  ',
      note: '   ',
    });
    expect(result).toEqual({ ok: true, reason: 'item_unavailable', note: null });
  });

  it('keeps a meaningful note and enforces its length limit', () => {
    const ok = validateCancellationInput({
      reason: 'operational_issue',
      note: '  Van broke down.  ',
    });
    expect(ok).toEqual({
      ok: true,
      reason: 'operational_issue',
      note: 'Van broke down.',
    });

    const tooLong = validateCancellationInput({
      reason: 'other',
      note: 'x'.repeat(CANCELLATION_NOTE_MAX + 1),
    });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.message).toContain(String(CANCELLATION_NOTE_MAX));

    const atLimit = validateCancellationInput({
      reason: 'other',
      note: 'x'.repeat(CANCELLATION_NOTE_MAX),
    });
    expect(atLimit.ok).toBe(true);
  });
});

describe('customer-safe reason text', () => {
  it('renders friendly wording for every code except `other`', () => {
    expect(customerCancellationReasonText('customer_request')).toBe(
      'Cancelled at the customer’s request.',
    );
    expect(customerCancellationReasonText('item_unavailable')).toBe(
      'An item in this order became unavailable.',
    );
    expect(customerCancellationReasonText('duplicate_order')).toBe(
      'This order was a duplicate.',
    );
    expect(customerCancellationReasonText('payment_issue')).toBe(
      'There was a problem with the payment for this order.',
    );
    expect(customerCancellationReasonText('operational_issue')).toBe(
      'The store could not fulfil this order.',
    );
    // `other` and anything unknown show nothing — never free text.
    expect(customerCancellationReasonText('other')).toBeNull();
    expect(customerCancellationReasonText('some_internal_detail')).toBeNull();
    expect(customerCancellationReasonText(null)).toBeNull();
    expect(customerCancellationReasonText(undefined)).toBeNull();
  });
});

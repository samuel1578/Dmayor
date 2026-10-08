import { describe, expect, it } from 'vitest';
import { isAdminAuthorized, parseReconcileInput } from './reconcile.ts';

describe('isAdminAuthorized (fail closed)', () => {
  it('authorizes only an explicit boolean true', () => {
    expect(isAdminAuthorized(true)).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAdminAuthorized(false)).toBe(false);
    expect(isAdminAuthorized(undefined)).toBe(false);
    expect(isAdminAuthorized(null)).toBe(false);
    expect(isAdminAuthorized('true')).toBe(false);
    expect(isAdminAuthorized(1)).toBe(false);
    expect(isAdminAuthorized({})).toBe(false);
  });
});

describe('parseReconcileInput', () => {
  it('reads only the identifying fields', () => {
    expect(parseReconcileInput({ orderId: ' order-1 ', reference: ' ref-1 ' })).toEqual({
      orderId: 'order-1',
      reference: 'ref-1',
    });
  });

  it('ignores client-supplied amount/status/currency/source', () => {
    const parsed = parseReconcileInput({
      orderId: 'order-1',
      amount: 999999,
      status: 'paid',
      currency: 'USD',
      payment_source: 'paystack',
      paymentStatus: 'paid',
    });

    // Only orderId/reference are ever read; nothing authoritative comes from the body.
    expect(parsed).toEqual({ orderId: 'order-1', reference: null });
    expect(Object.keys(parsed).sort()).toEqual(['orderId', 'reference']);
  });

  it('returns nulls for missing/blank/garbage bodies', () => {
    expect(parseReconcileInput(null)).toEqual({ orderId: null, reference: null });
    expect(parseReconcileInput('nope')).toEqual({ orderId: null, reference: null });
    expect(parseReconcileInput([])).toEqual({ orderId: null, reference: null });
    expect(parseReconcileInput({ orderId: '', reference: '   ' })).toEqual({
      orderId: null,
      reference: null,
    });
  });
});

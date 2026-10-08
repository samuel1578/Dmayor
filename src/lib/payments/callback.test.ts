import { describe, expect, it } from 'vitest';
import {
  callbackOutcomeFromError,
  callbackOutcomeFromVerifyResult,
  extractCallbackReference,
} from './callback';
import type { VerifyPaymentResult } from './paystack';

function makeResult(partial: Partial<VerifyPaymentResult>): VerifyPaymentResult {
  return {
    status: 'unpaid',
    outcome: 'pending',
    reference: 'ref',
    orderId: 'order',
    orderNumber: 'TPS-2026-000001',
    amount: 250,
    currency: 'GHS',
    channel: null,
    paidAt: null,
    ...partial,
  };
}

describe('extractCallbackReference', () => {
  it('reads the reference parameter', () => {
    expect(extractCallbackReference('?reference=abc123')).toBe('abc123');
  });

  it('falls back to trxref when reference is absent or blank', () => {
    expect(extractCallbackReference('?trxref=xyz789')).toBe('xyz789');
    expect(extractCallbackReference('?reference=&trxref=xyz789')).toBe('xyz789');
  });

  it('prefers reference over trxref', () => {
    expect(extractCallbackReference('?reference=first&trxref=second')).toBe('first');
  });

  it('returns null when no usable reference is present', () => {
    expect(extractCallbackReference('')).toBeNull();
    expect(extractCallbackReference('?status=success&amount=999999')).toBeNull();
  });

  it('never trusts other callback parameters', () => {
    expect(extractCallbackReference('?status=success&amount=0&email=a@b.c&orderNumber=X')).toBeNull();
  });
});

describe('callbackOutcomeFromVerifyResult', () => {
  it('maps a verified paid result to success', () => {
    expect(callbackOutcomeFromVerifyResult(makeResult({ status: 'paid', outcome: 'success' }))).toBe(
      'success',
    );
    expect(
      callbackOutcomeFromVerifyResult(makeResult({ status: 'paid', outcome: 'already_verified' })),
    ).toBe('success');
  });

  it('maps a failed / abandoned provider result to failed', () => {
    expect(callbackOutcomeFromVerifyResult(makeResult({ outcome: 'failed' }))).toBe('failed');
    expect(callbackOutcomeFromVerifyResult(makeResult({ outcome: 'abandoned' }))).toBe('failed');
  });

  it('maps a still-unconfirmed result to pending', () => {
    expect(callbackOutcomeFromVerifyResult(makeResult({ outcome: 'pending' }))).toBe('pending');
  });
});

describe('callbackOutcomeFromError', () => {
  it('maps payment_conflict to conflict', () => {
    expect(callbackOutcomeFromError('payment_conflict')).toBe('conflict');
  });

  it('maps a missing local attempt to invalid_reference', () => {
    expect(callbackOutcomeFromError('payment_attempt_not_found')).toBe('invalid_reference');
  });

  it('maps everything else (including no code) to verification_error', () => {
    expect(callbackOutcomeFromError('payment_verify_failed')).toBe('verification_error');
    expect(callbackOutcomeFromError(null)).toBe('verification_error');
  });
});

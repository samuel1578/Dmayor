import { describe, expect, it, vi } from 'vitest';
import { verifyAndFinalize, type FinalizeDeps } from './finalization.ts';
import type { PaystackVerifyResult } from './paystack.ts';

const ATTEMPT = { id: 'attempt-1', reference: 'TPSPAY-TPS-2026-000001-aaaa' };
const ORDER = { id: 'order-1', total_amount: 700, currency: 'GHS' };

function verifySuccess(overrides: Partial<NonNullable<PaystackVerifyResult['data']>> = {}): PaystackVerifyResult {
  return {
    ok: true,
    raw: { fixture: true },
    message: null,
    data: {
      reference: ATTEMPT.reference,
      status: 'success',
      amountMinor: 70000,
      currency: 'GHS',
      channel: 'card',
      ...overrides,
    },
  };
}

function deps(verify: FinalizeDeps['verify'], record: FinalizeDeps['record']): FinalizeDeps {
  return { verify, record };
}

async function run(
  verify: FinalizeDeps['verify'],
  record: FinalizeDeps['record'],
) {
  return verifyAndFinalize(deps(verify, record), { attempt: ATTEMPT, order: ORDER });
}

describe('verifyAndFinalize — amount / currency / reference validation', () => {
  it('amount mismatch does NOT finalize and is not paid', async () => {
    const record = vi.fn();
    const result = await run(async () => verifySuccess({ amountMinor: 100 }), record);

    expect(result.code).toBe('payment_amount_mismatch');
    expect(record).not.toHaveBeenCalled();
  });

  it('currency mismatch does NOT finalize and is not paid', async () => {
    const record = vi.fn();
    const result = await run(async () => verifySuccess({ currency: 'NGN' }), record);

    expect(result.code).toBe('payment_currency_mismatch');
    expect(record).not.toHaveBeenCalled();
  });

  it('reference mismatch does NOT finalize and is not paid', async () => {
    const record = vi.fn();
    const result = await run(async () => verifySuccess({ reference: 'OTHER-REF' }), record);

    expect(result.code).toBe('payment_reference_mismatch');
    expect(record).not.toHaveBeenCalled();
  });
});

describe('verifyAndFinalize — provider non-success', () => {
  it('a failed provider result never marks paid and never finalizes', async () => {
    const record = vi.fn();
    const result = await run(async () => verifySuccess({ status: 'failed' }), record);

    expect(result.code).toBe('failed');
    expect(record).not.toHaveBeenCalled();
  });

  it('an abandoned provider result is reported as abandoned', async () => {
    const result = await run(async () => verifySuccess({ status: 'abandoned' }), vi.fn());
    expect(result.code).toBe('abandoned');
  });

  it('a still-pending provider result is reported as pending', async () => {
    const result = await run(async () => verifySuccess({ status: 'pending' }), vi.fn());
    expect(result.code).toBe('pending');
  });
});

describe('verifyAndFinalize — trusted finalizer outcomes', () => {
  it('marks paid through the trusted finalizer on verified success', async () => {
    const record = vi.fn(async () => ({ outcome: 'success', paidAt: '2026-10-08T00:00:00.000Z' }));
    const result = await run(async () => verifySuccess(), record);

    expect(result.code).toBe('paid');
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: ATTEMPT.id,
        reference: ATTEMPT.reference,
        amountMinor: 70000,
        currency: 'GHS',
      }),
    );
  });

  it('an already-successful attempt is idempotent (already_verified)', async () => {
    const record = vi.fn(async () => ({ outcome: 'already_verified' }));
    const result = await run(async () => verifySuccess(), record);

    expect(result.code).toBe('already_verified');
  });

  it('a manual-payment conflict is reported as payment_conflict (never overwritten)', async () => {
    const result = await run(async () => verifySuccess(), async () => ({ outcome: 'conflict' }));
    expect(result.code).toBe('payment_conflict');
  });

  it('a different-Paystack-reference conflict is reported as payment_conflict', async () => {
    // The trusted RPC returns the same conflict outcome for order_paid_by_other_reference.
    const result = await run(async () => verifySuccess(), async () => ({ outcome: 'conflict' }));
    expect(result.code).toBe('payment_conflict');
  });
});

describe('verifyAndFinalize — callback/webhook race idempotency', () => {
  it('callback-first then webhook: the second run reports already_verified, no error', async () => {
    let calls = 0;
    const record = vi.fn(async () => {
      calls += 1;
      return { outcome: calls === 1 ? 'success' : 'already_verified' };
    });

    const first = await run(async () => verifySuccess(), record);
    const second = await run(async () => verifySuccess(), record);

    expect(first.code).toBe('paid');
    expect(second.code).toBe('already_verified');
  });

  it('webhook-first then callback: the second run reports already_verified, no error', async () => {
    let calls = 0;
    const record = vi.fn(async () => {
      calls += 1;
      return { outcome: calls === 1 ? 'success' : 'already_verified' };
    });

    const first = await run(async () => verifySuccess(), record);
    const second = await run(async () => verifySuccess(), record);

    expect(first.code).toBe('paid');
    expect(second.code).toBe('already_verified');
  });
});

describe('verifyAndFinalize — transient failures', () => {
  it('a provider verify failure is transient and never finalizes', async () => {
    const record = vi.fn();
    const result = await run(async () => ({ ok: false, data: null, raw: null, message: 'network' }), record);

    expect(result.code).toBe('payment_verify_failed');
    expect(result.transient).toBe(true);
    expect(record).not.toHaveBeenCalled();
  });

  it('a thrown verify error is transient', async () => {
    const result = await run(async () => {
      throw new Error('boom');
    }, vi.fn());

    expect(result.code).toBe('payment_verify_failed');
    expect(result.transient).toBe(true);
  });

  it('a thrown finalizer error is transient', async () => {
    const result = await run(async () => verifySuccess(), async () => {
      throw new Error('rpc down');
    });

    expect(result.code).toBe('payment_verify_failed');
    expect(result.transient).toBe(true);
  });
});

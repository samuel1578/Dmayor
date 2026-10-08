import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Supabase client is mocked so the pure logic (and the request bodies) can
// be tested without a network, a real session or real env values.
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../supabase', () => ({
  supabase: { functions: { invoke } },
}));

import {
  PaymentRequestError,
  buildInitializeBody,
  buildVerifyBody,
  createPaymentGuard,
  initializePaystackPayment,
  parsePaymentError,
  paymentActionFor,
  verifyPaystackPayment,
} from './paystack';

beforeEach(() => {
  invoke.mockReset();
});

describe('paymentActionFor', () => {
  it('offers Pay Now for an unpaid order', () => {
    expect(paymentActionFor('unpaid', 'pending')).toEqual({ kind: 'pay_now', label: 'Pay Now' });
  });

  it('offers Retry Payment for a failed payment', () => {
    expect(paymentActionFor('failed', 'processing')).toEqual({
      kind: 'retry',
      label: 'Retry Payment',
    });
  });

  it('offers no action once paid', () => {
    expect(paymentActionFor('paid', 'confirmed')).toBeNull();
  });

  it('offers no action once refunded', () => {
    expect(paymentActionFor('refunded', 'pending')).toBeNull();
  });

  it('offers no action for a cancelled order', () => {
    expect(paymentActionFor('unpaid', 'cancelled')).toBeNull();
    expect(paymentActionFor('failed', 'cancelled')).toBeNull();
  });
});

describe('Edge Function request bodies', () => {
  it('sends only the order id to initialize-payment', async () => {
    invoke.mockResolvedValue({
      data: { reference: 'ref', authorizationUrl: 'https://checkout.paystack.com/x', attemptId: 'a' },
      error: null,
    });

    await initializePaystackPayment('order-123');

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('initialize-payment', { body: { orderId: 'order-123' } });
    expect(Object.keys(buildInitializeBody('order-123'))).toEqual(['orderId']);
  });

  it('sends only the reference to verify-payment', async () => {
    invoke.mockResolvedValue({
      data: {
        status: 'paid',
        outcome: 'success',
        reference: 'ref',
        orderId: 'o',
        orderNumber: 'TPS-2026-000001',
        amount: 250,
        currency: 'GHS',
        channel: 'card',
        paidAt: '2026-10-08T00:00:00.000Z',
      },
      error: null,
    });

    await verifyPaystackPayment('ref-1');

    expect(invoke).toHaveBeenCalledWith('verify-payment', { body: { reference: 'ref-1' } });
    expect(Object.keys(buildVerifyBody('ref-1'))).toEqual(['reference']);
  });
});

describe('initialize error mapping', () => {
  it('throws a typed PaymentRequestError carrying the server code', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: async () => ({ error: 'order_not_owned', message: 'We could not open that order.' }),
        },
      },
    });

    const error = await initializePaystackPayment('order-1').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(PaymentRequestError);
    expect((error as PaymentRequestError).code).toBe('order_not_owned');
    expect((error as PaymentRequestError).message).toBe('We could not open that order.');
  });
});

describe('parsePaymentError', () => {
  it('maps a known code to its customer-safe copy when no message is sent', () => {
    expect(parsePaymentError({ error: 'already_paid', message: '' })).toEqual({
      code: 'already_paid',
      message: 'Payment has already been received for this order.',
    });
  });

  it('prefers the server-authored message when present', () => {
    expect(parsePaymentError({ error: 'order_not_payable', message: 'Custom copy.' })).toEqual({
      code: 'order_not_payable',
      message: 'Custom copy.',
    });
  });

  it('falls back for an unknown shape', () => {
    const parsed = parsePaymentError('not-an-object');
    expect(parsed.code).toBeNull();
    expect(parsed.message.length).toBeGreaterThan(0);
  });
});

describe('createPaymentGuard', () => {
  it('runs a task once and ignores a concurrent second call', async () => {
    const guard = createPaymentGuard();
    let release!: () => void;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const first = guard.run(task);
    const second = guard.run(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(guard.busy).toBe(true);

    release();
    await first;
    await expect(second).resolves.toBeUndefined();
    expect(guard.busy).toBe(false);
  });

  it('runs again after the previous task settles', async () => {
    const guard = createPaymentGuard();
    const task = vi.fn(async () => 1);

    await expect(guard.run(task)).resolves.toBe(1);
    await expect(guard.run(task)).resolves.toBe(1);
    expect(task).toHaveBeenCalledTimes(2);
  });
});

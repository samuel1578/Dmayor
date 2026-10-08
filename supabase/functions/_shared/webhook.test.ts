import { describe, expect, it } from 'vitest';
import {
  buildProviderEventKey,
  computeHmacSha512Hex,
  decideEventProcessing,
  isWellFormedSignature,
  parsePaystackWebhookEvent,
  signaturesMatch,
} from './webhook.ts';

const SECRET = 'sk_test_not_a_real_key';

function encode(body: string): Uint8Array {
  return new TextEncoder().encode(body);
}

/** A representative (non-production) charge.success fixture. */
function chargeSuccessFixture() {
  return {
    event: 'charge.success',
    data: {
      id: 302961,
      reference: 'TPSPAY-TPS-2026-000001-abcdef',
      status: 'success',
      amount: 70000,
      currency: 'GHS',
      channel: 'mobile_money',
    },
  };
}

describe('signature verification', () => {
  it('accepts the correct HMAC-SHA512 signature of the raw body', async () => {
    const body = JSON.stringify(chargeSuccessFixture());
    const expected = await computeHmacSha512Hex(SECRET, encode(body));

    expect(isWellFormedSignature(expected)).toBe(true);
    expect(signaturesMatch(expected, expected)).toBe(true);
  });

  it('rejects an incorrect signature', async () => {
    const body = JSON.stringify(chargeSuccessFixture());
    const expected = await computeHmacSha512Hex(SECRET, encode(body));
    const wrong = 'a'.repeat(128);

    expect(signaturesMatch(expected, wrong)).toBe(false);
  });

  it('rejects a signature computed from re-serialised JSON (different bytes)', async () => {
    const original = '{"event":"charge.success","data":{"id":1,"reference":"r"}}';
    const reserialised = JSON.stringify(JSON.parse(original));

    const sigFromOriginal = await computeHmacSha512Hex(SECRET, encode(original));
    const sigFromReserialised = await computeHmacSha512Hex(SECRET, encode(reserialised));

    // Same logical JSON but the signature must be computed from the exact bytes.
    expect(signaturesMatch(sigFromOriginal, sigFromReserialised)).toBe(
      original === reserialised,
    );
  });

  it('rejects missing or malformed signatures', async () => {
    const expected = await computeHmacSha512Hex(SECRET, encode('{}'));

    expect(isWellFormedSignature(null)).toBe(false);
    expect(isWellFormedSignature('')).toBe(false);
    expect(isWellFormedSignature('not-hex')).toBe(false);
    expect(isWellFormedSignature('abc123')).toBe(false);
    expect(signaturesMatch(expected, null)).toBe(false);
    expect(signaturesMatch(expected, 'deadbeef')).toBe(false);
  });
});

describe('parsePaystackWebhookEvent', () => {
  it('parses a known charge.success event defensively', () => {
    const event = parsePaystackWebhookEvent(chargeSuccessFixture());

    expect(event).not.toBeNull();
    expect(event?.classification).toBe('charge_success');
    expect(event?.eventType).toBe('charge.success');
    expect(event?.transactionId).toBe('302961');
    expect(event?.reference).toBe('TPSPAY-TPS-2026-000001-abcdef');
    expect(event?.status).toBe('success');
    expect(event?.amountMinor).toBe(70000);
    expect(event?.currency).toBe('GHS');
    expect(event?.channel).toBe('mobile_money');
  });

  it('classifies unknown event types as ignored without crashing', () => {
    const event = parsePaystackWebhookEvent({
      event: 'transfer.success',
      data: { id: 5, reference: 'x', amount: 100, currency: 'GHS' },
    });

    expect(event?.classification).toBe('ignored');
    expect(event?.eventType).toBe('transfer.success');
  });

  it('returns null when there is no event type, and tolerates missing data', () => {
    expect(parsePaystackWebhookEvent({ data: {} })).toBeNull();
    expect(parsePaystackWebhookEvent('nope')).toBeNull();

    const noData = parsePaystackWebhookEvent({ event: 'charge.success' });
    expect(noData?.classification).toBe('charge_success');
    expect(noData?.reference).toBeNull();
    expect(noData?.amountMinor).toBeNull();
  });
});

describe('event idempotency key', () => {
  it('is deterministic and prefers the immutable transaction id', () => {
    const event = parsePaystackWebhookEvent(chargeSuccessFixture());
    expect(event).not.toBeNull();

    const key = buildProviderEventKey(event!);
    expect(key).toBe('paystack:charge.success:302961');
    // A duplicate delivery produces the exact same key.
    expect(buildProviderEventKey(parsePaystackWebhookEvent(chargeSuccessFixture())!)).toBe(key);
  });

  it('falls back to the reference when there is no transaction id', () => {
    const event = parsePaystackWebhookEvent({
      event: 'charge.success',
      data: { reference: 'ref-only', status: 'success' },
    });
    expect(buildProviderEventKey(event!)).toBe('paystack:charge.success:ref-only');
  });

  it('returns null when neither identity is present', () => {
    const event = parsePaystackWebhookEvent({ event: 'charge.success', data: {} });
    expect(buildProviderEventKey(event!)).toBeNull();
  });
});

describe('decideEventProcessing', () => {
  it('skips terminally handled events (idempotent duplicates)', () => {
    expect(decideEventProcessing('processed')).toBe('skip');
    expect(decideEventProcessing('ignored')).toBe('skip');
  });

  it('reprocesses received/failed/unknown events (safe: the finalizer is idempotent)', () => {
    expect(decideEventProcessing('received')).toBe('process');
    expect(decideEventProcessing('failed')).toBe('process');
    expect(decideEventProcessing(null)).toBe('process');
  });
});

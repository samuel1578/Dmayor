/**
 * Paystack webhook pure helpers (Phase F3).
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested. The HTTP handler computes the HMAC from the EXACT raw request body
 * (never from re-serialised JSON), parses defensively (no `any`) and derives a
 * deterministic idempotency key from the provider's immutable transaction id.
 */

export type WebhookClassification = 'charge_success' | 'ignored';

export interface PaystackWebhookEvent {
  eventType: string;
  classification: WebhookClassification;
  /** Immutable Paystack transaction id (data.id), string-normalised. */
  transactionId: string | null;
  reference: string | null;
  /** Provider status, lower-cased (e.g. success | failed | abandoned). */
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  channel: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asTrimmedText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim().length > 0 ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

/**
 * Parses a Paystack webhook body defensively. Returns null for shapes we cannot
 * even identify an event type from; the caller treats that as an ignored event.
 */
export function parsePaystackWebhookEvent(payload: unknown): PaystackWebhookEvent | null {
  const root = asRecord(payload);
  if (!root) return null;

  const eventType = asText(root.event)?.trim();
  if (!eventType) return null;

  const data = asRecord(root.data) ?? {};
  const status = asText(data.status)?.toLowerCase() ?? null;

  return {
    eventType,
    classification: eventType === 'charge.success' ? 'charge_success' : 'ignored',
    transactionId: asTrimmedText(data.id),
    reference: asText(data.reference),
    status,
    amountMinor: asInteger(data.amount),
    currency: asText(data.currency)?.toUpperCase() ?? null,
    channel: asText(data.channel),
  };
}

/**
 * The deterministic idempotency key. Uses the immutable transaction id when
 * present, falling back to the reference. Never uses a timestamp or random
 * value, so a duplicate delivery of the same event produces the same key.
 */
export function buildProviderEventKey(event: PaystackWebhookEvent): string | null {
  const eventType = event.eventType.trim();
  if (!eventType) return null;

  const identity = event.transactionId ?? event.reference;
  if (!identity) return null;

  return `paystack:${eventType}:${identity}`;
}

/* -------------------------------------------------------------------------- */
/* Signature (HMAC SHA-512)                                                   */
/* -------------------------------------------------------------------------- */

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** HMAC SHA-512 of the raw body, hex-encoded (Paystack's signature format). */
export async function computeHmacSha512Hex(
  secret: string,
  rawBody: Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, rawBody);
  return bytesToHex(new Uint8Array(signature));
}

/** A well-formed lowercase hex string of the expected SHA-512 length (128). */
export function isWellFormedSignature(value: string | null): boolean {
  return typeof value === 'string' && /^[0-9a-f]{128}$/i.test(value.trim());
}

/** Constant-time comparison of two equal-length hex strings. */
function constantTimeEqual(a: string, b: string): boolean {
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

/** True only when both are well-formed and byte-for-byte equal. */
export function signaturesMatch(expectedHex: string, providedHex: string | null): boolean {
  if (!isWellFormedSignature(expectedHex) || !isWellFormedSignature(providedHex)) return false;
  return constantTimeEqual(expectedHex.trim().toLowerCase(), (providedHex as string).trim().toLowerCase());
}

/* -------------------------------------------------------------------------- */
/* Idempotency decision                                                       */
/* -------------------------------------------------------------------------- */

export type EventDecision = 'process' | 'skip';

/**
 * `processed` / `ignored` events are terminally handled → skip.
 * `received` / `failed` / unknown → (re)process. This is safe because the
 * trusted finalizer (record_paystack_payment) is itself idempotent and
 * conflict-aware, so reprocessing never double-writes.
 */
export function decideEventProcessing(existingStatus: string | null): EventDecision {
  if (existingStatus === 'processed' || existingStatus === 'ignored') return 'skip';
  return 'process';
}

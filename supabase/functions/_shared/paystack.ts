/**
 * Server-to-server Paystack client for the F1 Edge Functions.
 *
 * The secret key is read from the Edge Function secret store and is never
 * returned to a caller. Every Paystack payload is parsed defensively — the raw
 * JSON shape is never trusted, so a provider change cannot inject arbitrary
 * values into the payment flow.
 */

import { requireEnv } from './env.ts';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function secretKey(): string {
  return requireEnv('PAYSTACK_SECRET_KEY');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/* -------------------------------------------------------------------------- */
/* Initialize                                                                 */
/* -------------------------------------------------------------------------- */

export interface PaystackInitializeInput {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface PaystackInitializeData {
  reference: string;
  authorizationUrl: string;
  accessCode: string | null;
}

export interface PaystackInitializeResult {
  ok: boolean;
  data: PaystackInitializeData | null;
  /** Raw payload retained for support/diagnosis; never sent to the client. */
  raw: unknown;
  message: string | null;
}

/** Parses an initialize response without trusting its shape. */
export function parseInitializeResponse(raw: unknown): PaystackInitializeData | null {
  const root = asRecord(raw);
  if (!root || root.status !== true) return null;

  const data = asRecord(root.data);
  if (!data) return null;

  const reference = asText(data.reference);
  const authorizationUrl = asText(data.authorization_url);
  if (!reference || !authorizationUrl) return null;

  return { reference, authorizationUrl, accessCode: asText(data.access_code) };
}

export async function initializeTransaction(
  input: PaystackInitializeInput,
): Promise<PaystackInitializeResult> {
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
  } catch (error) {
    return { ok: false, data: null, raw: null, message: `network:${String(error)}` };
  }

  const raw = await response.json().catch(() => null);
  const data = parseInitializeResponse(raw);
  const root = asRecord(raw);
  const message = root ? asText(root.message) : null;

  return { ok: response.ok && data !== null, data, raw, message };
}

/* -------------------------------------------------------------------------- */
/* Verify                                                                     */
/* -------------------------------------------------------------------------- */

export interface PaystackVerifyData {
  reference: string;
  /** Provider status, e.g. success | failed | abandoned | ongoing | pending. */
  status: string;
  amountMinor: number;
  currency: string;
  channel: string | null;
}

export interface PaystackVerifyResult {
  ok: boolean;
  data: PaystackVerifyData | null;
  raw: unknown;
  message: string | null;
}

/** Parses a verify response without trusting its shape. */
export function parseVerifyResponse(raw: unknown): PaystackVerifyData | null {
  const root = asRecord(raw);
  if (!root || root.status !== true) return null;

  const data = asRecord(root.data);
  if (!data) return null;

  const reference = asText(data.reference);
  const status = asText(data.status);
  const currency = asText(data.currency);
  const amountMinor = typeof data.amount === 'number' ? data.amount : Number(data.amount);

  if (!reference || !status || !currency || !Number.isFinite(amountMinor)) return null;

  return {
    reference,
    status: status.toLowerCase(),
    amountMinor,
    currency,
    channel: asText(data.channel),
  };
}

export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  let response: Response;
  try {
    response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${secretKey()}` },
      },
    );
  } catch (error) {
    return { ok: false, data: null, raw: null, message: `network:${String(error)}` };
  }

  const raw = await response.json().catch(() => null);
  const data = parseVerifyResponse(raw);
  const root = asRecord(raw);
  const message = root ? asText(root.message) : null;

  return { ok: response.ok && data !== null, data, raw, message };
}

/**
 * Shared verified-payment finalization (Phase F3).
 *
 * This is the one TS logic path the NEW F3 entry points (paystack-webhook and
 * reconcile-payment) share. It performs only the pre-checks and then delegates
 * the actual order write to the SAME trusted database primitive F1/F2 use:
 * `public.record_paystack_payment(...)` (service-role only, atomic, idempotent
 * and conflict-aware). No second order-write implementation exists.
 *
 * It is pure with respect to IO — verify and record are injected — so every
 * branch (mismatch, conflict, failed, already-verified …) is unit testable
 * without network or database.
 */

import { toMinorUnits } from './money.ts';
import type { PaystackVerifyResult } from './paystack.ts';

export type VerifyFn = (reference: string) => Promise<PaystackVerifyResult>;

export interface RecordPaymentParams {
  attemptId: string;
  reference: string;
  amountMinor: number;
  currency: string;
  channel: string | null;
  providerResponse: unknown;
  verifiedAt: string;
}

export interface RecordPaymentResult {
  outcome: string;
  paidAt?: string | null;
}

export type RecordFn = (params: RecordPaymentParams) => Promise<RecordPaymentResult>;

export type FinalizeCode =
  | 'paid'
  | 'already_verified'
  | 'unpaid'
  | 'failed'
  | 'abandoned'
  | 'pending'
  | 'payment_reference_mismatch'
  | 'payment_amount_mismatch'
  | 'payment_currency_mismatch'
  | 'payment_conflict'
  | 'payment_verify_failed'
  | 'payment_attempt_not_found'
  | 'order_not_found';

export interface FinalizeResult {
  code: FinalizeCode;
  /** True when retrying could plausibly succeed (network/RPC/provider outage). */
  transient: boolean;
  providerStatus?: string;
  channel?: string | null;
  amountMinor?: number;
  currency?: string;
  paidAt?: string | null;
}

export interface FinalizeInput {
  attempt: { id: string; reference: string };
  order: { id: string; total_amount: number | string; currency: string };
}

export interface FinalizeDeps {
  verify: VerifyFn;
  record: RecordFn;
}

function providerNonSuccessCode(status: string): FinalizeCode {
  if (status === 'failed') return 'failed';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'pending' || status === 'ongoing' || status === 'processing') return 'pending';
  return 'unpaid';
}

/**
 * Verifies a Paystack reference server-to-server and, ONLY on a verified
 * success with matching reference/amount/currency, records the payment through
 * the trusted finalizer. Never marks an order paid from a webhook payload alone.
 */
export async function verifyAndFinalize(
  deps: FinalizeDeps,
  input: FinalizeInput,
): Promise<FinalizeResult> {
  let verified: PaystackVerifyResult;
  try {
    verified = await deps.verify(input.attempt.reference);
  } catch {
    return { code: 'payment_verify_failed', transient: true };
  }

  if (!verified.ok || !verified.data) {
    return { code: 'payment_verify_failed', transient: true };
  }

  const data = verified.data;

  if (data.reference !== input.attempt.reference) {
    return { code: 'payment_reference_mismatch', transient: false, providerStatus: data.status };
  }

  const expectedMinor = toMinorUnits(input.order.total_amount, input.order.currency);
  if (data.amountMinor !== expectedMinor) {
    return {
      code: 'payment_amount_mismatch',
      transient: false,
      providerStatus: data.status,
      amountMinor: data.amountMinor,
    };
  }

  if (data.currency.toUpperCase() !== input.order.currency.toUpperCase()) {
    return { code: 'payment_currency_mismatch', transient: false, providerStatus: data.status };
  }

  if (data.status !== 'success') {
    return {
      code: providerNonSuccessCode(data.status),
      transient: false,
      providerStatus: data.status,
      channel: data.channel,
    };
  }

  let recorded: RecordPaymentResult;
  try {
    recorded = await deps.record({
      attemptId: input.attempt.id,
      reference: input.attempt.reference,
      amountMinor: data.amountMinor,
      currency: data.currency,
      channel: data.channel,
      providerResponse: verified.raw ?? null,
      verifiedAt: new Date().toISOString(),
    });
  } catch {
    return { code: 'payment_verify_failed', transient: true, providerStatus: data.status };
  }

  switch (recorded.outcome) {
    case 'success':
      return {
        code: 'paid',
        transient: false,
        providerStatus: data.status,
        channel: data.channel,
        amountMinor: data.amountMinor,
        currency: data.currency,
        paidAt: recorded.paidAt ?? null,
      };
    case 'already_verified':
      return {
        code: 'already_verified',
        transient: false,
        providerStatus: data.status,
        channel: data.channel,
        amountMinor: data.amountMinor,
        currency: data.currency,
        paidAt: recorded.paidAt ?? null,
      };
    case 'conflict':
      return { code: 'payment_conflict', transient: false, providerStatus: data.status };
    case 'amount_mismatch':
      return { code: 'payment_amount_mismatch', transient: false, providerStatus: data.status };
    case 'currency_mismatch':
      return { code: 'payment_currency_mismatch', transient: false, providerStatus: data.status };
    case 'reference_mismatch':
      return { code: 'payment_reference_mismatch', transient: false, providerStatus: data.status };
    case 'attempt_not_found':
      return { code: 'payment_attempt_not_found', transient: false };
    case 'order_not_found':
      return { code: 'order_not_found', transient: false };
    default:
      // Includes the RPC transport error outcome — retryable.
      return { code: 'payment_verify_failed', transient: true, providerStatus: data.status };
  }
}

/**
 * Minimal structural client so this module never imports the Supabase runtime
 * (keeps it testable); the Edge Function passes its service client.
 */
export interface RecordRpcClient {
  // PromiseLike (not Promise) so the Supabase client's thenable rpc builder is
  // structurally assignable without importing the runtime here.
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Calls the trusted finalizer RPC and normalises its jsonb outcome. */
export async function recordVerifiedPayment(
  client: RecordRpcClient,
  params: RecordPaymentParams,
): Promise<RecordPaymentResult> {
  const { data, error } = await client.rpc('record_paystack_payment', {
    p_attempt_id: params.attemptId,
    p_reference: params.reference,
    p_amount_minor: params.amountMinor,
    p_currency: params.currency,
    p_channel: params.channel,
    p_provider_response: params.providerResponse,
    p_verified_at: params.verifiedAt,
  });

  if (error) {
    console.error('record_paystack_payment failed:', error.message);
    return { outcome: 'rpc_error' };
  }

  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const outcome = typeof record?.outcome === 'string' ? record.outcome : 'rpc_error';
  const paidAt = typeof record?.paid_at === 'string' ? record.paid_at : null;

  return { outcome, paidAt };
}

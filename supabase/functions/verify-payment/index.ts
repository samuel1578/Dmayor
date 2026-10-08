/**
 * verify-payment — F1 server-to-server Paystack verification.
 *
 * Input (the ONLY accepted body): { "reference": "..." }
 *
 * No status, amount or currency is ever trusted from the client. The function
 *   1. authenticates the caller from the Authorization bearer token
 *   2. finds the local payment_attempts row by reference
 *   3. verifies the caller owns the attempt's order
 *   4. calls Paystack Transaction Verify server-to-server
 *   5. compares the provider response against the local reference, the order
 *      total (in minor units) and the order currency — rejecting mismatches
 *   6. records the outcome atomically via record_paystack_payment (idempotent,
 *      and refuses to overwrite a manual payment)
 *
 * A successful verification sets orders.payment_status = 'paid' with
 * payment_source = 'paystack', the real reference/channel and paid_at. It never
 * touches fulfilment status — paid does not mean confirmed.
 */

import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { ConfigError } from '../_shared/env.ts';
import { fail, jsonResponse, readJsonObject } from '../_shared/http.ts';
import { toMinorUnits } from '../_shared/money.ts';
import { verifyTransaction } from '../_shared/paystack.ts';
import { createServiceClient, requireAuthenticatedUser } from '../_shared/supabase.ts';
import type {
  OrderPaymentRow,
  PaymentAttemptRow,
  PaymentAttemptStatus,
  VerifyPaymentPayload,
} from '../_shared/types.ts';

const ORDER_SELECT =
  'id, order_number, user_id, status, payment_status, payment_source, ' +
  'payment_reference, payment_channel, paid_at, total_amount, currency';
const ATTEMPT_SELECT =
  'id, order_id, user_id, provider, reference, status, amount, currency, channel, ' +
  'authorization_url, access_code, provider_response, verified_at, created_at, updated_at';

interface RecordPaymentOutcome {
  outcome?: string;
  paid_at?: string;
}

/** Maps a Paystack verify status to our internal attempt status. */
function mapAttemptStatus(providerStatus: string): PaymentAttemptStatus {
  if (providerStatus === 'failed') return 'failed';
  if (providerStatus === 'abandoned') return 'abandoned';
  return 'pending';
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') return preflightResponse(cors);
  if (req.method !== 'POST') return fail('method_not_allowed', undefined, cors);

  try {
    // 1. Authenticated caller only.
    const user = await requireAuthenticatedUser(req);
    if (!user) return fail('not_authenticated', undefined, cors);

    // 2. Minimal input: only the reference.
    const body = await readJsonObject(req);
    const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
    if (!reference) return fail('invalid_request', 'A reference is required.', cors);

    // 3. Find the local attempt by reference.
    const service = createServiceClient();
    const { data: attemptData, error: attemptError } = await service
      .from('payment_attempts')
      .select(ATTEMPT_SELECT)
      .eq('reference', reference)
      .maybeSingle();

    if (attemptError) throw attemptError;
    if (!attemptData) return fail('payment_attempt_not_found', undefined, cors);

    const attempt = attemptData as PaymentAttemptRow;

    // 4. Load the order and verify ownership on BOTH sides.
    const { data: orderData, error: orderError } = await service
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', attempt.order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!orderData) return fail('order_not_found', undefined, cors);

    const order = orderData as OrderPaymentRow;
    if (attempt.user_id !== user.id || order.user_id !== user.id) {
      return fail('order_not_owned', undefined, cors);
    }

    // Idempotency short-circuit: this exact verified attempt is already the
    // order's recorded Paystack attribution, so do not re-write anything.
    if (
      attempt.status === 'success' &&
      order.payment_status === 'paid' &&
      order.payment_source === 'paystack' &&
      order.payment_reference === attempt.reference
    ) {
      const payload: VerifyPaymentPayload = {
        status: 'paid',
        outcome: 'already_verified',
        reference: attempt.reference,
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(order.total_amount),
        currency: order.currency,
        channel: order.payment_channel ?? attempt.channel,
        paidAt: order.paid_at ?? attempt.verified_at,
      };
      return jsonResponse(payload, 200, cors);
    }

    // 5. Paystack Transaction Verify (server-to-server).
    const result = await verifyTransaction(attempt.reference);
    if (!result.ok || !result.data) {
      console.error('verify-payment: Paystack verify failed', result.message);
      return fail('payment_verify_failed', undefined, cors);
    }
    const verified = result.data;

    // 6. Reject provider mismatches before any write.
    if (verified.reference !== attempt.reference) {
      return fail('payment_reference_mismatch', undefined, cors);
    }

    const expectedMinor = toMinorUnits(order.total_amount, order.currency);
    if (verified.amountMinor !== expectedMinor) {
      console.error(
        'verify-payment: amount mismatch',
        `expected=${expectedMinor}`,
        `received=${verified.amountMinor}`,
      );
      return fail('payment_amount_mismatch', undefined, cors);
    }

    if (verified.currency.toUpperCase() !== order.currency.toUpperCase()) {
      return fail('payment_currency_mismatch', undefined, cors);
    }

    // 7a. Provider reports success — record it atomically.
    if (verified.status === 'success') {
      const { data: rpcData, error: rpcError } = await service.rpc('record_paystack_payment', {
        p_attempt_id: attempt.id,
        p_reference: attempt.reference,
        p_amount_minor: verified.amountMinor,
        p_currency: verified.currency,
        p_channel: verified.channel,
        p_provider_response: result.raw ?? null,
        p_verified_at: new Date().toISOString(),
      });

      if (rpcError) {
        console.error('verify-payment: record_paystack_payment failed', rpcError.message);
        return fail('payment_verify_failed', undefined, cors);
      }

      const outcome = (rpcData as RecordPaymentOutcome | null)?.outcome ?? '';

      if (outcome === 'conflict') {
        console.error('verify-payment: payment conflict', (rpcData as RecordPaymentOutcome)?.outcome);
        return fail('payment_conflict', undefined, cors);
      }
      if (outcome === 'amount_mismatch') return fail('payment_amount_mismatch', undefined, cors);
      if (outcome === 'currency_mismatch') return fail('payment_currency_mismatch', undefined, cors);
      if (outcome === 'reference_mismatch') {
        return fail('payment_reference_mismatch', undefined, cors);
      }
      if (outcome === 'attempt_not_found') {
        return fail('payment_attempt_not_found', undefined, cors);
      }
      if (outcome === 'order_not_found') return fail('order_not_found', undefined, cors);
      if (outcome !== 'success' && outcome !== 'already_verified') {
        console.error('verify-payment: unexpected record outcome', outcome);
        return fail('payment_verify_failed', undefined, cors);
      }

      // Re-read the written order state so the payload is exact.
      const { data: paidOrder } = await service
        .from('orders')
        .select('id, order_number, total_amount, currency, payment_channel, paid_at')
        .eq('id', order.id)
        .maybeSingle();

      const payload: VerifyPaymentPayload = {
        status: 'paid',
        outcome: outcome === 'already_verified' ? 'already_verified' : 'success',
        reference: attempt.reference,
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(paidOrder?.total_amount ?? order.total_amount),
        currency: String(paidOrder?.currency ?? order.currency),
        channel: (paidOrder?.payment_channel as string | null) ?? verified.channel,
        paidAt: (paidOrder?.paid_at as string | null) ?? new Date().toISOString(),
      };
      return jsonResponse(payload, 200, cors);
    }

    // 7b. Provider reports failed / abandoned / still pending — never mark paid.
    if (attempt.status !== 'success') {
      await service
        .from('payment_attempts')
        .update({
          status: mapAttemptStatus(verified.status),
          channel: verified.channel,
          provider_response: result.raw ?? null,
        })
        .eq('id', attempt.id);
    }

    const outcome: VerifyPaymentPayload['outcome'] =
      verified.status === 'failed'
        ? 'failed'
        : verified.status === 'abandoned'
          ? 'abandoned'
          : 'pending';

    const payload: VerifyPaymentPayload = {
      status: 'unpaid',
      outcome,
      reference: attempt.reference,
      orderId: order.id,
      orderNumber: order.order_number,
      amount: Number(order.total_amount),
      currency: order.currency,
      channel: verified.channel,
      paidAt: null,
    };
    return jsonResponse(payload, 200, cors);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('verify-payment: missing configuration', error.key);
      return fail('server_configuration_error', undefined, cors);
    }
    console.error('verify-payment: unexpected failure', error);
    return fail('payment_verify_failed', undefined, cors);
  }
});

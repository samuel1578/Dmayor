/**
 * reconcile-payment — Phase F3 (Admin only).
 *
 * Gives an authorised Admin a way to re-check a known Paystack attempt against
 * Paystack when the customer closed the browser, the callback never arrived, or
 * a webhook failed. The BACKEND contacts Paystack; the client only identifies
 * an order (or a reference). Amount/status/currency/source in the body are
 * ignored.
 *
 * Security: the caller must be the authenticated owner of an admin session
 * (public.is_admin() is evaluated with the CALLER's token, fail closed). The
 * order is only marked paid through the same trusted primitive as F1/F2.
 */

import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { ConfigError } from '../_shared/env.ts';
import { fail, jsonResponse, readJsonObject, type ErrorCode } from '../_shared/http.ts';
import { recordVerifiedPayment, verifyAndFinalize, type FinalizeResult } from '../_shared/finalization.ts';
import { verifyTransaction } from '../_shared/paystack.ts';
import { createServiceClient, createUserClient, requireAuthenticatedUser } from '../_shared/supabase.ts';
import { isAdminAuthorized, parseReconcileInput } from '../_shared/reconcile.ts';
import type { ReconcilePaymentPayload } from '../_shared/types.ts';

const ATTEMPT_SELECT = 'id, order_id, user_id, provider, reference, status, currency, verified_at';
const ORDER_SELECT = 'id, order_number, user_id, payment_status, payment_source, payment_reference, payment_channel, paid_at, total_amount, currency';

/** Finalizer outcomes that map to an HTTP error (vs a normal unpaid result). */
function mapFinalizeFailure(result: FinalizeResult): ErrorCode | null {
  switch (result.code) {
    case 'payment_conflict':
      return 'payment_conflict';
    case 'payment_amount_mismatch':
      return 'payment_amount_mismatch';
    case 'payment_currency_mismatch':
      return 'payment_currency_mismatch';
    case 'payment_reference_mismatch':
      return 'payment_reference_mismatch';
    case 'payment_attempt_not_found':
      return 'payment_attempt_not_found';
    case 'order_not_found':
      return 'order_not_found';
    case 'payment_verify_failed':
      return 'payment_verify_failed';
    default:
      return null;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') return preflightResponse(cors);
  if (req.method !== 'POST') return fail('method_not_allowed', undefined, cors);

  try {
    // 1. Authenticated caller only.
    const user = await requireAuthenticatedUser(req);
    if (!user) return fail('not_authenticated', undefined, cors);

    // 2. Admin authority, evaluated with the caller's token (fail closed).
    const userClient = createUserClient(req);
    const adminCheck = await userClient.rpc('is_admin');
    if (adminCheck.error || !isAdminAuthorized(adminCheck.data)) {
      console.warn('reconcile-payment: non-admin attempt', user.id);
      return fail('not_authorized', undefined, cors);
    }

    // 3. Identify the target. Only these fields are read; everything else ignored.
    const body = await readJsonObject(req);
    const { orderId, reference } = parseReconcileInput(body);
    if (!orderId && !reference) {
      return fail('invalid_request', 'Provide an orderId or a reference.', cors);
    }

    const service = createServiceClient();

    // 4. Find the Paystack attempt.
    let attempt: Record<string, unknown> | null = null;
    if (reference) {
      const { data, error } = await service
        .from('payment_attempts')
        .select(ATTEMPT_SELECT)
        .eq('reference', reference)
        .maybeSingle();
      if (error) throw error;
      attempt = data;
    } else {
      const { data, error } = await service
        .from('payment_attempts')
        .select(ATTEMPT_SELECT)
        .eq('order_id', orderId as string)
        .eq('provider', 'paystack')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      attempt = data;
    }

    if (!attempt) return fail('payment_attempt_not_found', undefined, cors);

    const attemptId = attempt.id as string;
    const attemptReference = attempt.reference as string;

    // 5. Load the order.
    const { data: orderData, error: orderError } = await service
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', attempt.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!orderData) return fail('order_not_found', undefined, cors);

    const order = orderData as Record<string, unknown>;
    const resolvedOrderId = order.id as string;
    const orderNumber = order.order_number as string;

    // If both identifiers were supplied, they must agree.
    if (orderId && resolvedOrderId !== orderId) {
      return fail('invalid_request', 'That reference does not belong to that order.', cors);
    }

    // Idempotency short-circuit: already the recorded Paystack attribution.
    if (
      attempt.status === 'success' &&
      order.payment_status === 'paid' &&
      order.payment_source === 'paystack' &&
      order.payment_reference === attemptReference
    ) {
      const payload: ReconcilePaymentPayload = {
        status: 'paid',
        outcome: 'already_verified',
        orderId: resolvedOrderId,
        orderNumber,
        reference: attemptReference,
        amount: Number(order.total_amount),
        currency: String(order.currency),
        channel: (order.payment_channel as string | null) ?? null,
        paidAt: (order.paid_at as string | null) ?? null,
        attemptStatus: 'success',
      };
      return jsonResponse(payload, 200, cors);
    }

    // 6. Server-to-server verify + trusted finalize.
    const result = await verifyAndFinalize(
      {
        verify: verifyTransaction,
        record: (params) => recordVerifiedPayment(service, params),
      },
      {
        attempt: { id: attemptId, reference: attemptReference },
        order: {
          id: resolvedOrderId,
          total_amount: order.total_amount as number | string,
          currency: order.currency as string,
        },
      },
    );

    // Failure codes that map to an HTTP error.
    const failureCode = mapFinalizeFailure(result);
    if (failureCode) return fail(failureCode, undefined, cors);

    // 7. Re-read fresh state for the payload.
    const { data: freshAttempt } = await service
      .from('payment_attempts')
      .select('status, channel, verified_at')
      .eq('id', attemptId)
      .maybeSingle();
    const { data: freshOrder } = await service
      .from('orders')
      .select('total_amount, currency, payment_channel, paid_at')
      .eq('id', resolvedOrderId)
      .maybeSingle();

    const paid = result.code === 'paid' || result.code === 'already_verified';

    const payload: ReconcilePaymentPayload = {
      status: paid ? 'paid' : 'unpaid',
      outcome: paid
        ? result.code === 'already_verified'
          ? 'already_verified'
          : 'success'
        : result.code === 'failed' || result.code === 'abandoned'
          ? result.code
          : 'pending',
      orderId: resolvedOrderId,
      orderNumber,
      reference: attemptReference,
      amount: Number(freshOrder?.total_amount ?? order.total_amount),
      currency: String(freshOrder?.currency ?? order.currency),
      channel: (freshOrder?.payment_channel as string | null) ?? (freshAttempt?.channel as string | null) ?? null,
      paidAt: (freshOrder?.paid_at as string | null) ?? null,
      attemptStatus: (freshAttempt?.status as string | undefined) ?? null,
    };

    return jsonResponse(payload, 200, cors);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('reconcile-payment: missing configuration', error.key);
      return fail('server_configuration_error', undefined, cors);
    }
    console.error('reconcile-payment: unexpected failure', error);
    return fail('payment_verify_failed', undefined, cors);
  }
});

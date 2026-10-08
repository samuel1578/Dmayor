/**
 * initialize-payment — F1 Paystack server-side initialization.
 *
 * Input (the ONLY accepted body): { "orderId": "<uuid>" }
 *
 * The browser never supplies an amount, currency, email, total, user id or
 * payment source. Everything authoritative is derived server-side from the
 * authenticated caller and the order row:
 *   1. authenticate the caller from the Authorization bearer token
 *   2. load the order and verify the caller owns it
 *   3. reject orders that are already paid / refunded / cancelled
 *   4. read total_amount + currency from the order
 *   5. take the customer email from the authenticated user record
 *   6. create a unique server-side reference and a local payment_attempts row
 *   7. convert the amount to Paystack minor units (safe decimal conversion)
 *   8. call Paystack Transaction Initialize server-to-server
 *   9. store the returned authorization_url / access_code / raw payload
 *  10. return only { reference, authorizationUrl, attemptId }
 *
 * The Paystack secret key never leaves this function and is never returned.
 */

import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { ConfigError } from '../_shared/env.ts';
import { fail, jsonResponse, readJsonObject } from '../_shared/http.ts';
import { toMinorUnits } from '../_shared/money.ts';
import { initializeTransaction } from '../_shared/paystack.ts';
import { buildCallbackUrl, buildReference } from '../_shared/reference.ts';
import { createServiceClient, requireAuthenticatedUser } from '../_shared/supabase.ts';
import type { OrderPaymentRow } from '../_shared/types.ts';

const ORDER_SELECT = 'id, order_number, user_id, status, payment_status, total_amount, currency';

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') return preflightResponse(cors);
  if (req.method !== 'POST') return fail('method_not_allowed', undefined, cors);

  try {
    // 1. Authenticated caller only — identity comes from the bearer token.
    const user = await requireAuthenticatedUser(req);
    if (!user) return fail('not_authenticated', undefined, cors);

    // 2. Minimal input: only the order id.
    const body = await readJsonObject(req);
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) return fail('invalid_request', 'An orderId is required.', cors);

    // 3. Load the order with the privileged client, then verify ownership.
    const service = createServiceClient();
    const { data: orderData, error: orderError } = await service
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!orderData) return fail('order_not_found', undefined, cors);

    const order = orderData as OrderPaymentRow;
    if (order.user_id !== user.id) return fail('order_not_owned', undefined, cors);

    // 4. Eligibility — a cancelled/terminal order must not be paid online.
    if (order.payment_status === 'paid') return fail('already_paid', undefined, cors);
    if (order.payment_status === 'refunded' || order.status === 'cancelled') {
      return fail('order_not_payable', undefined, cors);
    }

    // 5. Trusted customer email (from the authenticated user, not the body).
    const email = user.email?.trim();
    if (!email) {
      return fail(
        'payment_initialize_failed',
        'Your account has no email address, so a payment cannot be started.',
        cors,
      );
    }

    // 6. Trusted amount + currency, converted without floating point.
    const amountMinor = toMinorUnits(order.total_amount, order.currency);

    // 7. Callback URL from SITE_URL (throws ConfigError when missing).
    const callbackUrl = buildCallbackUrl();

    // 8. Unique, server-generated reference + local attempt row.
    const reference = buildReference(order.order_number);

    const { data: attempt, error: attemptError } = await service
      .from('payment_attempts')
      .insert({
        order_id: order.id,
        user_id: user.id,
        provider: 'paystack',
        reference,
        status: 'initialized',
        amount: order.total_amount,
        currency: order.currency,
      })
      .select('id, reference')
      .single();

    if (attemptError || !attempt) {
      console.error('initialize-payment: attempt insert failed', attemptError);
      return fail('payment_initialize_failed', undefined, cors);
    }

    // 9. Paystack Transaction Initialize (server-to-server).
    const result = await initializeTransaction({
      email,
      amountMinor,
      currency: order.currency,
      reference: attempt.reference,
      callbackUrl,
      // Non-sensitive identifiers only — informational, never a proof of payment.
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        payment_attempt_id: attempt.id,
      },
    });

    if (!result.ok || !result.data) {
      console.error('initialize-payment: Paystack initialize failed', result.message);
      await service
        .from('payment_attempts')
        .update({ status: 'failed', provider_response: result.raw ?? null })
        .eq('id', attempt.id);
      return fail('payment_initialize_failed', undefined, cors);
    }

    // 10. Store the returned values (raw payload kept server-side for support).
    await service
      .from('payment_attempts')
      .update({
        status: 'pending',
        authorization_url: result.data.authorizationUrl,
        access_code: result.data.accessCode,
        provider_response: result.raw ?? null,
      })
      .eq('id', attempt.id);

    // 11. Safe client payload only.
    return jsonResponse(
      {
        reference: attempt.reference,
        authorizationUrl: result.data.authorizationUrl,
        attemptId: attempt.id,
      },
      200,
      cors,
    );
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('initialize-payment: missing configuration', error.key);
      return fail('server_configuration_error', undefined, cors);
    }
    console.error('initialize-payment: unexpected failure', error);
    return fail('payment_initialize_failed', undefined, cors);
  }
});

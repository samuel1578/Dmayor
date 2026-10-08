/**
 * paystack-webhook — Phase F3.
 *
 * Called by Paystack (server-to-server), NOT by a customer. It therefore does
 * NOT use Supabase auth; its security boundary is the Paystack HMAC-SHA512
 * signature over the EXACT raw request body. Deploy with JWT verification off
 * for this function only (see supabase/config.toml).
 *
 * Flow:
 *   1. read the RAW body (never req.json() first)
 *   2. verify x-paystack-signature (fail closed; no DB write on failure)
 *   3. parse the event defensively
 *   4. derive a deterministic provider_event_key and register it idempotently
 *   5. for charge.success, locate the local attempt by reference
 *   6. verify the transaction server-to-server and validate
 *      reference/amount/currency against the local attempt + order
 *   7. finalize through the SAME trusted primitive as F1/F2
 *      (record_paystack_payment), then record the event outcome
 *
 * A webhook payload ALONE can never mark an order paid. Duplicate deliveries and
 * callback/webhook races are safe because event registration and the finalizer
 * are both idempotent.
 */

import { ConfigError, requireEnv } from '../_shared/env.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { recordVerifiedPayment, verifyAndFinalize, type FinalizeResult } from '../_shared/finalization.ts';
import { verifyTransaction } from '../_shared/paystack.ts';
import {
  buildProviderEventKey,
  computeHmacSha512Hex,
  decideEventProcessing,
  isWellFormedSignature,
  parsePaystackWebhookEvent,
  signaturesMatch,
} from '../_shared/webhook.ts';

type EventStatus = 'received' | 'processed' | 'ignored' | 'failed';

interface ServiceClient {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): PromiseLike<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }>;
      };
    };
    select(columns: string): {
      eq(column: string, value: unknown): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    update(row: Record<string, unknown>): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mapOutcome(result: FinalizeResult): {
  status: EventStatus;
  httpStatus: number;
  errorCode: string | null;
  errorMessage: string | null;
} {
  switch (result.code) {
    case 'paid':
    case 'already_verified':
      return { status: 'processed', httpStatus: 200, errorCode: null, errorMessage: null };
    case 'payment_conflict':
      return {
        status: 'failed',
        httpStatus: 200,
        errorCode: 'payment_conflict',
        errorMessage: 'Order already has a different payment record; kept for Admin review.',
      };
    case 'payment_amount_mismatch':
    case 'payment_currency_mismatch':
    case 'payment_reference_mismatch':
      return { status: 'failed', httpStatus: 200, errorCode: result.code, errorMessage: null };
    case 'payment_attempt_not_found':
    case 'order_not_found':
      return { status: 'ignored', httpStatus: 200, errorCode: result.code, errorMessage: null };
    case 'failed':
    case 'abandoned':
    case 'pending':
    case 'unpaid':
      return {
        status: 'ignored',
        httpStatus: 200,
        errorCode: null,
        errorMessage: `provider_${result.code}`,
      };
    case 'payment_verify_failed':
    default:
      return {
        status: 'failed',
        httpStatus: result.transient ? 500 : 200,
        errorCode: 'payment_verify_failed',
        errorMessage: null,
      };
  }
}

async function finalizeEvent(
  service: ServiceClient,
  eventId: string | null,
  status: EventStatus,
  errorCode: string | null,
  errorMessage: string | null,
): Promise<void> {
  if (!eventId) return;
  try {
    const { error } = await service
      .from('payment_events')
      .update({
        processing_status: status,
        error_code: errorCode,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    if (error) console.error('paystack-webhook: event update failed', error.message);
  } catch (err) {
    console.error('paystack-webhook: event update threw', err);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // 1. Raw body first — the signature must be computed from the exact bytes.
  let rawBytes: Uint8Array;
  try {
    rawBytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  // 2. Signature verification (fail closed).
  let secret: string;
  try {
    secret = requireEnv('PAYSTACK_SECRET_KEY');
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('paystack-webhook: missing PAYSTACK_SECRET_KEY');
      return json({ error: 'server_configuration_error' }, 500);
    }
    throw error;
  }

  const providedSignature = req.headers.get('x-paystack-signature');
  let expectedSignature: string;
  try {
    expectedSignature = await computeHmacSha512Hex(secret, rawBytes);
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  if (!isWellFormedSignature(providedSignature) || !signaturesMatch(expectedSignature, providedSignature)) {
    console.warn('paystack-webhook: rejected invalid signature');
    return json({ error: 'invalid_signature' }, 401);
  }

  // 3. Parse only AFTER the signature is verified.
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const event = parsePaystackWebhookEvent(payload);
  if (!event) {
    console.warn('paystack-webhook: unparseable event');
    return json({ status: 'ignored', reason: 'unparseable' }, 200);
  }

  const eventKey = buildProviderEventKey(event);
  if (!eventKey) {
    console.warn('paystack-webhook: event without identity', event.eventType);
    return json({ status: 'ignored', reason: 'no_identity' }, 200);
  }

  const service = createServiceClient() as unknown as ServiceClient;

  // 4. Idempotent registration. Duplicate delivery → same key → unique violation.
  let eventId: string | null = null;

  const inserted = await service
    .from('payment_events')
    .insert({
      provider: 'paystack',
      event_type: event.eventType,
      provider_event_key: eventKey,
      payment_reference: event.reference,
      provider_transaction_id: event.transactionId,
      processing_status: 'received',
      payload,
    })
    .select('id')
    .single();

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const existing = await service
        .from('payment_events')
        .select('id, processing_status')
        .eq('provider_event_key', eventKey)
        .maybeSingle();

      if (existing.error) {
        console.error('paystack-webhook: duplicate lookup failed', existing.error.message);
        return json({ error: 'server_error' }, 500);
      }

      eventId = (existing.data?.id as string | undefined) ?? null;
      const existingStatus = (existing.data?.processing_status as string | undefined) ?? null;
      const decision = decideEventProcessing(existingStatus);

      console.log('paystack-webhook: duplicate delivery', {
        event_type: event.eventType,
        reference: event.reference,
        processing_status: existingStatus,
        decision,
      });

      if (decision === 'skip') {
        return json({ status: 'duplicate', processing_status: existingStatus }, 200);
      }
      // received/failed → reprocess safely (the finalizer is idempotent).
    } else {
      console.error('paystack-webhook: event insert failed', inserted.error.message);
      return json({ error: 'server_error' }, 500);
    }
  } else {
    eventId = (inserted.data?.id as string | undefined) ?? null;
  }

  // 5. Unsupported events are acknowledged and ignored.
  if (event.classification !== 'charge_success') {
    await finalizeEvent(service, eventId, 'ignored', null, `unsupported_event:${event.eventType}`);
    console.log('paystack-webhook: ignored unsupported event', event.eventType);
    return json({ status: 'ignored', event_type: event.eventType }, 200);
  }

  if (!event.reference) {
    await finalizeEvent(service, eventId, 'ignored', 'payment_attempt_not_found', 'charge.success without reference');
    return json({ status: 'ignored', reason: 'no_reference' }, 200);
  }

  // 6. Locate the local attempt by reference (never by email/order number/metadata).
  const attemptResult = await service
    .from('payment_attempts')
    .select('id, order_id, reference, currency, status')
    .eq('reference', event.reference)
    .maybeSingle();

  if (attemptResult.error) {
    console.error('paystack-webhook: attempt lookup failed', attemptResult.error.message);
    await finalizeEvent(service, eventId, 'failed', 'server_error', attemptResult.error.message);
    return json({ error: 'server_error' }, 500);
  }

  if (!attemptResult.data) {
    await finalizeEvent(service, eventId, 'ignored', 'payment_attempt_not_found', 'no local attempt for reference');
    console.warn('paystack-webhook: unknown reference', event.reference);
    return json({ status: 'ignored', reason: 'unknown_reference' }, 200);
  }

  const attempt = attemptResult.data;
  const attemptId = attempt.id as string;

  const orderResult = await service
    .from('orders')
    .select('id, total_amount, currency')
    .eq('id', attempt.order_id)
    .maybeSingle();

  if (orderResult.error) {
    console.error('paystack-webhook: order lookup failed', orderResult.error.message);
    await finalizeEvent(service, eventId, 'failed', 'server_error', orderResult.error.message);
    return json({ error: 'server_error' }, 500);
  }

  if (!orderResult.data) {
    await finalizeEvent(service, eventId, 'failed', 'order_not_found', 'attempt order missing');
    return json({ status: 'ignored', reason: 'order_not_found' }, 200);
  }

  const order = orderResult.data;
  const orderId = order.id as string;

  // Link the event to the attempt/order for operational visibility.
  try {
    await service
      .from('payment_events')
      .update({ payment_attempt_id: attemptId, order_id: orderId })
      .eq('id', eventId);
  } catch (err) {
    console.error('paystack-webhook: event link update threw', err);
  }

  // 7. Server-side verify + trusted finalize.
  const result = await verifyAndFinalize(
    {
      verify: verifyTransaction,
      record: (params) => recordVerifiedPayment(service, params),
    },
    {
      attempt: { id: attemptId, reference: attempt.reference as string },
      order: {
        id: orderId,
        total_amount: order.total_amount as number | string,
        currency: order.currency as string,
      },
    },
  );

  // 8. Persist the outcome and respond.
  const mapping = mapOutcome(result);
  await finalizeEvent(service, eventId, mapping.status, mapping.errorCode, mapping.errorMessage);

  console.log('paystack-webhook: processed', {
    event_type: event.eventType,
    reference: event.reference,
    code: result.code,
    processing_status: mapping.status,
    http_status: mapping.httpStatus,
  });

  return json({ status: mapping.status, code: result.code }, mapping.httpStatus);
});

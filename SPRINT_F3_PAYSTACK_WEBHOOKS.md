# Phase F3 — Paystack Webhooks & Reconciliation

Phase F3 adds the reliability layer: an order no longer depends on the customer
returning to `/payment/callback`. Paystack now independently drives the
authoritative path via a signed webhook, plus an Admin reconciliation action for
recovery.

**Status:** Implemented locally. **NOT deployed** — the migration, the two Edge
Functions and the Paystack dashboard URL still need manual steps (see
_Deployment_). Nothing was deployed remotely by this work.

---

## Scope

In scope:

- Forward migration `012_paystack_webhook_reconciliation.sql` (webhook event store).
- `paystack-webhook` Edge Function (raw-body HMAC verification, idempotent processing).
- `reconcile-payment` Edge Function (Admin-only, server-side re-check).
- Per-function JWT config (`supabase/config.toml`).
- Small Admin Payment Detail additions (attempt info + Re-check action).
- Correcting now-false Admin payment copy.
- Focused unit tests for the pure F3 logic.

Out of scope (explicitly not done): emails, shipment/tracking, stock restocking,
refund automation, customer cancellation, discounts, live keys, telco logos,
fulfilment automation, automatic order confirmation, subscriptions/recurring
billing, and any Admin dashboard/page redesign.

---

## Existing F1/F2 Architecture

F3 reuses everything from F1/F2:

- `initialize-payment` / `verify-payment` Edge Functions.
- `public.payment_attempts` + the trusted `public.record_paystack_payment(...)`
  finalizer (migration 011) — **the only write path that can mark an order paid**.
- The F2 customer callback `/payment/callback` (unchanged).

F3 introduces **no second finalization implementation**: the webhook and the
reconcile function both call `record_paystack_payment(...)` (service-role only,
atomic, idempotent, conflict-aware), exactly as `verify-payment` does. The shared
TS pre-check logic lives in `_shared/finalization.ts` and is used by the two new
entry points.

---

## Webhook Endpoint

- Function: `supabase/functions/paystack-webhook/index.ts`.
- Public URL (production): `https://jhvtkqqtipbocdtcnijl.supabase.co/functions/v1/paystack-webhook`
- Called server-to-server by Paystack — **not** by a customer, so it does **not**
  use Supabase auth. Its security boundary is the Paystack signature.

Because Paystack cannot send a Supabase JWT, JWT verification is disabled for
**this function only** via `supabase/config.toml`:

```toml
[functions.paystack-webhook]
verify_jwt = false
```

Every other function keeps the default (`verify_jwt = true`). The equivalent
one-off deploy flag is `supabase functions deploy paystack-webhook --no-verify-jwt`.

---

## Signature Verification

The handler:

1. reads the **raw** request body with `await req.arrayBuffer()` (never
   `req.json()` first);
2. reads the `x-paystack-signature` header;
3. computes the expected **HMAC-SHA512** of those exact bytes using
   `PAYSTACK_SECRET_KEY`;
4. rejects missing/malformed/mismatched signatures with `401` and writes nothing;
5. only **after** verification does it `JSON.parse` the same bytes.

The comparison is constant-time and requires a well-formed 128-char hex value.
The secret is never logged.

---

## Event Storage

Migration `012_paystack_webhook_reconciliation.sql` adds `public.payment_events`
(one row per provider webhook delivery):

`id`, `provider`, `event_type`, `provider_event_key` (**unique**),
`payment_reference`, `provider_transaction_id`, `order_id`,
`payment_attempt_id`, `processing_status` (received/processed/ignored/failed),
`payload` (jsonb, backend-only), `error_code`, `error_message`, `received_at`,
`processed_at`, `created_at`.

- RLS is enabled with **no policies** and all grants revoked from
  `public`/`anon`/`authenticated`: customers can never read or write it. Only the
  service role writes it.
- Raw payloads are never exposed to a client. `admin_list_payment_events(uuid,
  integer)` provides an admin-only, payload-free operational read.

---

## Idempotency

- The idempotency key is **deterministic**: `paystack:<event_type>:<transaction_id>`,
  falling back to the reference when there is no transaction id. Never a
  timestamp or random value, so a duplicate delivery produces the same key.
- `provider_event_key` is UNIQUE. The handler inserts the event; on a duplicate
  key it looks up the existing row and:
  - `processed` / `ignored` → returns `200` immediately (harmless duplicate).
  - `received` / `failed` → reprocesses. This is safe because the trusted
    finalizer is itself idempotent and conflict-aware.
- Because both event registration and the finalizer are idempotent, duplicate
  webhook deliveries and callback/webhook races never double-write.

---

## charge.success Flow

```
Paystack
  → POST /functions/v1/paystack-webhook          (raw body)
  → verify x-paystack-signature (HMAC-SHA512)     (fail closed → 401)
  → parse event defensively
  → deterministic provider_event_key → register event idempotently
  → locate payment_attempts by REFERENCE          (never email/order/metadata)
  → Paystack /transaction/verify/:reference       (server-to-server)
  → validate reference == attempt.reference
    amount(minor) == orders.total_amount * 100
    currency == orders.currency
    provider status == success
  → record_paystack_payment(...)  (trusted, atomic, idempotent, conflict-aware)
  → orders: payment_status='paid', source='paystack', provider='Paystack',
            real reference/channel, paid_at (preserved if set)
  → update payment_events.processing_status
```

Only a **verified** transaction can mark an order paid. The webhook payload
alone is never sufficient.

---

## Server Verification

The webhook (and reconciliation) always call Paystack's verify endpoint before
applying the final Paid state, then re-check reference, amount (minor units, via
the same `toMinorUnits` helper F1 uses — no second money conversion), currency
and success status, and finally delegate to `record_paystack_payment`. Mismatches
are recorded on the event (`payment_amount_mismatch`,
`payment_currency_mismatch`, `payment_reference_mismatch`) and never mark the
order paid.

---

## Callback/Webhook Race Handling

Either may arrive first:

- **Callback first** → the order is already `paid` with the Paystack source and
  this reference. The later webhook's verify+finalize returns `already_verified`;
  `paid_at` is preserved, no duplicate record is created, no error is raised.
- **Webhook first** → the order is already `paid`. The later callback's
  `verify-payment` short-circuits and returns the same successful state.

One payment produces one logical finalization. Duplicate deliveries of the same
`charge.success` are deduplicated by `provider_event_key` and acknowledged with
`200`.

---

## Manual vs Paystack Conflicts

The H0/F1 rule is preserved. If an order was already recorded as
`payment_source = 'manual'` and a valid Paystack success arrives, the trusted
finalizer returns `conflict`; the webhook records the event as `failed` with
`error_code = payment_conflict` (evidence retained for Admin investigation) and
does **not** overwrite the manual attribution. The same applies when the order is
already paid via a **different** Paystack reference — treated as a reconciliation
conflict / possible duplicate payment, both attempts preserved, nothing refunded
automatically.

---

## Reconciliation

`reconcile-payment` (`supabase/functions/reconcile-payment/index.ts`) lets an
authorised Admin re-check a known attempt against Paystack when the callback
never arrived or a webhook failed.

- Requires an authenticated session **and** `public.is_admin()` evaluated with
  the caller's token (fail closed → `403 not_authorized`).
- The client sends only `{ orderId }` (or `{ reference }`). Amount, status,
  currency and source in the body are ignored — the backend contacts Paystack
  itself, and an Admin can never simply assert "Paystack says paid".
- It finds the order's latest Paystack attempt, calls the same verify-and-finalize
  core, and only marks the order paid through `record_paystack_payment`.

---

## Admin Changes

- **Admin Payment Detail** (`/admin/payments/:orderId`): a small "Paystack"
  section now lists the order's attempts (reference, status, channel, verified /
  created timestamps — **no raw payload**), and shows a **Re-check Paystack**
  button only when at least one Paystack attempt exists and the payment is
  `unpaid` or `failed`. The button calls `reconcile-payment` and reloads the
  detail. The manual-record flow is unchanged.
- **Corrected stale copy** (now false, since Paystack is integrated):
  - Admin dashboard: "Payment status is maintained manually — there is no
    automated payment provider yet…" → "Payment status reflects both verified
    Paystack transactions and authorised manual updates…"
  - Admin dashboard: "Payment records are entered by hand. No payment provider is
    connected…" → "Paystack payments are verified automatically. Manual payment
    records can still be entered by authorised administrators…"
  - Admin dashboard Deferred list: "Automated payments & receipts" → "Automated
    receipts" (payments are no longer deferred; receipts still are).
  - Admin payments list: header copy and the empty `paystack` filter message
    ("… arrive in Phase F.") corrected.
  - Admin order detail: section "Payment (manual)" → "Payment"; note rewritten.
  - Admin orders list: "Payment and fulfilment are recorded manually." → payment
    now includes verified Paystack transactions.
  - Stale internal doc comments in `src/lib/admin/payments.ts`,
    `src/lib/admin/orders.ts`, `src/lib/account/payments.ts`,
    `src/pages/account/AccountPayments.tsx`, `src/pages/OrderConfirmation.tsx`.
  - No unrelated Deferred items were changed; no claim of automated receipts.

No Admin dashboard or payment page was redesigned.

---

## Security

- The webhook cannot be authenticated through client input — it fails closed
  unless the HMAC-SHA512 signature over the raw body matches.
- An invalid signature cannot mutate the database (verification precedes parsing
  and every write).
- The secret key stays server-side (Edge Function secrets); nothing is added to
  the client.
- A webhook payload alone cannot mark an order paid — server verification is
  mandatory.
- Reference, amount and currency are all validated; mismatches never mark paid.
- Duplicate events and callback/webhook races are idempotent.
- Manual attribution is never silently overwritten (conflict retained for review).
- Service-role writes remain server-only; customers have zero access to
  `payment_events`; reconciliation requires admin authority; the client cannot
  supply an authoritative amount/status.

---

## Files Changed

New:

- `supabase/migrations/012_paystack_webhook_reconciliation.sql`
- `supabase/functions/paystack-webhook/index.ts`
- `supabase/functions/reconcile-payment/index.ts`
- `supabase/functions/_shared/webhook.ts`
- `supabase/functions/_shared/finalization.ts`
- `supabase/functions/_shared/reconcile.ts`
- `supabase/functions/_shared/webhook.test.ts`
- `supabase/functions/_shared/finalization.test.ts`
- `supabase/functions/_shared/reconcile.test.ts`
- `supabase/config.toml`
- `SPRINT_F3_PAYSTACK_WEBHOOKS.md` (this document)

Modified:

- `supabase/functions/_shared/http.ts` — added `not_authorized`.
- `supabase/functions/_shared/types.ts` — `ReconcilePaymentPayload`.
- `src/lib/payments/paystack.ts` — `reconcilePaystackPayment`,
  `ReconcilePaymentResult`, `buildReconcileBody`, `not_authorized`.
- `src/lib/admin/payments.ts` — `AdminPaymentAttempt`, `listAdminPaymentAttempts`.
- `src/pages/admin/AdminPaymentDetail.tsx` — attempts + Re-check Paystack.
- `src/pages/admin/AdminDashboard.tsx`, `AdminPayments.tsx`,
  `AdminOrderDetail.tsx`, `AdminOrders.tsx` — corrected copy.
- `src/lib/admin/orders.ts`, `src/lib/account/payments.ts`,
  `src/pages/account/AccountPayments.tsx`, `src/pages/OrderConfirmation.tsx` —
  corrected comments.
- `vitest.config.ts` — include `supabase/functions/**/*.test.ts`.
- `SPRINT_LOG.md` — concise summary entry.

---

## Verification

- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0, 0 errors (same 4 pre-existing warnings).
- `npm test` → **56 tests passed / 5 files**, covering all 18 required cases
  (signature valid/invalid/missing, known/unknown events, duplicate idempotency,
  callback/webhook race both ways, amount/currency/reference mismatch,
  manual-conflict, different-reference conflict, already-verified idempotency,
  admin authorization, reconciliation ignores client values, failed
  reconciliation never marks paid, successful reconciliation uses the shared
  finalizer).
- `npm run build` → exit 0.
- **Deno / Supabase CLI are NOT installed** in this environment, so `deno check`
  and `deno lint` could not be run on the Edge Functions — reported as a
  limitation. All Edge Function files were syntax-checked with the project's
  bundled esbuild (`npx esbuild <file> --format=esm`); all pass.
- No screenshots, Playwright, Puppeteer or browser automation. No real Paystack
  API calls in tests (provider responses are faked at the injected boundary).
- The migration was not executed (manual, as with all migrations here).

---

## Deployment

Nothing below was performed by this work.

1. Apply the migration in the Supabase SQL editor:
   `supabase/migrations/012_paystack_webhook_reconciliation.sql` (after `011`).
2. Confirm the secret already exists: `PAYSTACK_SECRET_KEY`. `SITE_URL` is not
   required by the webhook.
3. Deploy the functions. Because `supabase/config.toml` sets
   `verify_jwt = false` for the webhook, a normal deploy applies it; if your CLI
   ignores config.toml, pass the flag:
   ```
   supabase functions deploy paystack-webhook --no-verify-jwt
   supabase functions deploy reconcile-payment
   ```
4. Add the webhook URL in the Paystack dashboard (see below).

**Deployed remotely:** no. **Implemented locally:** yes.

---

## Paystack Dashboard Setup

Paystack → Settings → API Keys & Webhooks → **Webhook URL**:

```
https://jhvtkqqtipbocdtcnijl.supabase.co/functions/v1/paystack-webhook
```

This must be added manually; it was not added automatically.

---

## Manual Test Procedure

Shortest production Test Mode scenario:

1. Ensure `012` is applied, `paystack-webhook` (with verify_jwt off) and
   `reconcile-payment` are deployed, and the webhook URL is in Paystack.
2. Place an order and pay with a Paystack **test success** card, then **close the
   browser before the callback** (or block `/payment/callback`).
3. In seconds the webhook should mark the order **Paid** (Source: Paystack, real
   reference/channel, `paid_at`). Confirm in Admin → Payments; reload the
   customer payment page to see the fresh state.
4. In the Paystack dashboard, **resend** the same `charge.success` webhook →
   the function returns `200` and creates no duplicate row/change; the event is
   recorded as a duplicate.
5. Admin → Payment → open an unpaid/failed order with a Paystack attempt →
   **Re-check Paystack**. Confirm it contacts Paystack and either marks the order
   paid (if the transaction succeeded) or reports unpaid.
6. Conflict path: Admin-mark an order Paid (manual), then deliver a valid
   `charge.success` for it → the order stays manual, the event is recorded as
   `failed`/`payment_conflict`, and the payment is not overwritten.

---

## Deferred Beyond F3

- Emails / receipts (still deferred).
- Refunds automation, customer cancellation, restock-on-cancel.
- Shipment/tracking fields (Phase G).
- Live Paystack keys.
- Any fulfilment automation — paid never auto-confirms an order.

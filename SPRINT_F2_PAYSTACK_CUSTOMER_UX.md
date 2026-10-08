# Phase F2 — Customer Paystack UX

Phase F2 activates the customer payment experience on top of the F1 server-side
plumbing: the customer can now start a Paystack payment, they are returned to
`/payment/callback`, and the server verifies the payment before anything is
marked paid.

**Status:** Complete (local). The migration/functions from F1 still need to be
deployed — see _Manual Test Procedure_.

---

## Scope

In scope:

- Activating **Pay Now** (unpaid) and **Retry Payment** (failed).
- The `/payment/callback` return route and its verification states.
- A shared `PaymentAction` component (single initialization path).
- Client Edge Function API + pure helpers, with focused unit tests.

Out of scope (explicitly **not** done):

- No webhook / signature verification / reconciliation (F3).
- No Paystack secret in `Vite`/React; no direct client Paystack API calls.
- No client-side order marking; no direct writes to `orders`/`payment_attempts`.
- No change to Admin manual payments, stock, fulfilment, order creation or
  checkout.
- No emails, discounts, shipment tracking or telco branding.
- No live keys — Test Mode only.

---

## Existing F1 Dependency

F2 depends entirely on F1:

- `supabase/functions/initialize-payment` → `{ reference, authorizationUrl, attemptId }`.
- `supabase/functions/verify-payment` → normalized `{ status, outcome, … }`.
- `public.payment_attempts` and `record_paystack_payment` (the only paid write path).

F2 adds **no** migration and changes **no** Edge Function.

---

## Customer Payment Flow

```
Order (payment outstanding)
  → Pay Now
  → initialize-payment  { orderId }
  → window.location.assign(authorizationUrl)
  → Paystack hosted checkout
  → /payment/callback?reference=…
  → verify-payment  { reference }
  → Payment Detail (/account/payments/:orderNumber) reflects the paid state
```

The order always exists before payment starts. Amount, currency, email and
identity are derived server-side; the browser sends `orderId` only.

---

## Pay Now

Active on every surface that renders the shared payment view:

- `/account/payments/:orderNumber` (payment detail).
- `/account/orders/:orderNumber` (order detail, via `OrderDetailView`).
- `/order-confirmation/:orderNumber` (via `OrderDetailView`).

Eligibility is decided by `paymentActionFor(paymentStatus, orderStatus)`:
`unpaid` → **Pay Now**. On click the button is disabled immediately, shows
**"Preparing secure payment…"**, calls `initialize-payment` with `{ orderId }`,
validates the returned `authorizationUrl`, and performs a deliberate full-page
redirect (`window.location.assign`). No popup, no Paystack Inline JS, no public
key.

---

## Retry Payment

`failed` → **Retry Payment**. It uses the identical code path, so it creates a
**new** server-side attempt and a **new** reference (the F1 server never reuses
a reference). The customer is not shown any implementation detail that differs
between Pay Now and Retry.

---

## Callback Route

`/payment/callback` is registered in `src/App.tsx` inside the customer
`AuthenticatedRoute` (and outside the Admin tree). It reads the reference via
`extractCallbackReference(location.search)`:

1. `reference`
2. fallback `trxref`
3. neither → **invalid reference** state

No other query parameter (status, amount, email, order number, metadata) is ever
read. The reference is passed to `verify-payment`; only the trusted server result
decides what is displayed. The URL keeps the reference so a refresh re-verifies.

The Vercel SPA rewrite already supports this path — no hosting change was made.

---

## Verification States

The callback page renders seven normalized states:

| State | When | Actions |
|---|---|---|
| `verifying` | On load, before the server answers | – |
| `success` | `verify-payment` → `status: paid` | View Payment, View Order |
| `failed` | provider `failed` / `abandoned` | View Payment, View Order |
| `pending` | not yet confirmed (e.g. `pending`) | Check Again, View Payment |
| `verification_error` | network/server failure (not a declined payment) | Try Verification Again, View Payment |
| `invalid_reference` | no usable reference in the URL | Go to Payments |
| `conflict` | `payment_conflict` (manual vs Paystack) | View Payment, View Order |

Success details show order number, amount, reference, provider (`Paystack`) and
channel when present — all from the trusted server payload, never the URL.
`Check Again` re-calls the same verify endpoint once (guarded); no aggressive
polling, and no new attempt is created.

---

## Authentication Return Flow

`verify-payment` requires an authenticated user. If Paystack returns the customer
to `/payment/callback` without a Supabase session, `AuthenticatedRoute` sends
them to `/login` **with the full destination preserved** — it now passes
`pathname + search + hash` as `from`, so the `?reference=…` survives the sign-in
round trip. After signing in (or up) the customer returns to the same callback
URL and verification resumes. Only the reference (no secret) is carried in the
return path; no separate payment auth system was added.

---

## Manual vs Paystack

Manual payments are untouched: `payment_source = 'manual'` still comes from the
Admin RPC, and the customer surfaces already show the `Manual` source with
"Recorded manually". A Paystack verification that lands on a manually-paid order
returns `payment_conflict` and the callback shows the **needs review** state —
F2 never resolves attribution client-side and never overwrites a manual record.

---

## Security Invariants

- No Paystack secret under `src/`; the client reads only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`.
- The browser sends **only** `orderId` (initialize) or `reference` (verify) —
  amount/currency/email/user id are never sent.
- The callback trusts **only** the reference from the URL; the verify result is
  server-authored.
- Success UI appears **only** after `verify-payment` returns `status: paid`; the
  order is never marked paid client-side.
- No client `update`/`insert`/`delete` on `orders` or `payment_attempts`.
- Ownership is still enforced inside the Edge Functions (verified server-side).
- One UI action cannot start two payments (single-flight guard + disabled button).
- Manual attribution remains protected (conflict state, no client write).

---

## Files Changed

New:

- `src/lib/payments/callback.ts` — reference extraction + outcome mapping.
- `src/components/payments/PaymentAction.tsx` — shared Pay Now / Retry action.
- `src/pages/PaymentCallback.tsx` — `/payment/callback` with all states.
- `src/lib/payments/paystack.test.ts`, `src/lib/payments/callback.test.ts`.
- `vitest.config.ts`
- `SPRINT_F2_PAYSTACK_CUSTOMER_UX.md` (this document)

Modified:

- `src/lib/payments/paystack.ts` — client API (`initializePaystackPayment`,
  `verifyPaystackPayment`), pure `paymentActionFor`, `parsePaymentError`,
  request-body builders, `PaymentRequestError`, `createPaymentGuard`.
- `src/components/account/OrderDetailView.tsx` — activates the shared action
  (covers order detail + order confirmation).
- `src/pages/account/AccountPaymentDetail.tsx` — activates Pay Now / Retry.
- `src/pages/OrderConfirmation.tsx` — comment updated (action now live).
- `src/App.tsx` — `/payment/callback` route.
- `src/components/auth/AuthenticatedRoute.tsx` — preserve query/hash in `from`.
- `package.json` — `test` / `test:watch` scripts, `vitest` dev dependency.
- `SPRINT_LOG.md` — concise summary entry.

---

## Verification

- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0, **0 errors** (same 4 pre-existing warnings in
  `src/contexts/*`).
- `npm test` (vitest) → **24 tests passed** across 2 files, covering all 15
  required cases: unpaid→Pay Now, failed→Retry, paid/refunded/cancelled→no
  action, `reference` extraction, `trxref` fallback, missing→invalid, initialize
  sends `orderId` only, double-submit guard, verified success/failed/pending/
  conflict mapping, and initialization error mapping.
- `npm run build` → exit 0.
- No screenshots, Playwright, Puppeteer or browser automation. No real Paystack
  transaction in unit tests.

---

## Manual Test Procedure

Before testing, F1 must be deployed and the secrets present:

1. Apply `supabase/migrations/011_paystack_payment_foundation.sql`.
2. Confirm Edge Function secrets: `PAYSTACK_SECRET_KEY`,
   `SITE_URL=https://theproxyshop.vercel.app`.
3. Deploy the functions (once): `supabase functions deploy initialize-payment`
   and `supabase functions deploy verify-payment`.
4. Ensure the deployed frontend is at the production URL so the Paystack callback
   (`https://theproxyshop.vercel.app/payment/callback`) matches.

Shortest Test Mode scenario:

1. Sign in as a customer, place an order (or open an existing unpaid one).
2. Open the order → **Pay Now** → complete the Paystack **test** card
   (success) → you land on `/payment/callback`.
3. Confirm **Payment successful**, then **View Payment** → status **Paid**,
   source **Paystack**, real reference/channel, paid date.
4. Re-run `verify-payment` (reload the callback URL) → still Paid, no duplicate
   write; `paid_at` unchanged.
5. Use a Paystack **failed** test path → callback shows **Payment was not
   completed**; the order stays unpaid; **Retry Payment** starts a new attempt
   with a new reference.
6. Admin-mark an unpaid order Paid (manual), then verify a Paystack reference for
   it → **This payment needs review** (conflict); the manual record is unchanged.

---

## Deferred to F3

- `paystack-webhook` + signature verification.
- Idempotent webhook-event storage and background reconciliation (e.g. "callback
  lost, webhook arrives later").
- Mismatch/ops views. F2 verification is customer-initiated only.

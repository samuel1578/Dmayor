# Phase F1 — Paystack Payment Plumbing

Phase F1 builds the **server-side** Paystack foundation only. It adds the
payment-attempt ledger, the two Edge Functions that talk to Paystack, and the
types/contract. It deliberately does **not** touch the customer UX (F2) or add
any webhook/reconciliation processing (F3).

**Status:** Complete (local). The migration and the Edge Functions are **not
deployed** by this sprint — see _Manual Deployment Steps_.

---

## Scope

In scope:

- Forward migration `011_paystack_payment_foundation.sql` creating
  `public.payment_attempts`, its RLS/grants, an admin read RPC and the atomic
  `record_paystack_payment` write RPC.
- Edge Functions `initialize-payment` and `verify-payment`.
- Shared Edge Function utilities (`_shared/`).
- TypeScript types for the attempt model + the client-safe contract.

Out of scope (explicitly **not** done):

- No customer "Pay Now" / "Retry Payment" activation (still disabled).
- No `/payment/callback` route.
- No webhook / reconciliation (no `paystack-webhook`).
- No emails (Brevo) — deferred until DNS/domain control exists.
- No stock, fulfilment, order-status or cancellation changes.
- No Paystack secret in `src/`, in `VITE_*`, in Vercel client env, in GitHub or
  anywhere the browser can read.

---

## Architecture

```
Browser (F2 later)
  │  POST { orderId }            POST { reference }
  ▼
initialize-payment  ──►  Paystack /transaction/initialize
  │  (server-side secret)             │ authorization_url, access_code
  │  writes payment_attempts ◄────────┘
  ▼
returns { reference, authorizationUrl, attemptId }

Browser returns to /payment/callback (F2)
  │  POST { reference }
  ▼
verify-payment  ──►  Paystack /transaction/verify/:reference
  │  (server-to-server)                │ amount, currency, status, channel
  │  compares against local attempt + order
  │  calls record_paystack_payment() ◄─┤ (atomic, idempotent, service-role only)
  ▼
returns { status: paid|unpaid, outcome, ... }
```

- The browser only ever receives safe payloads; it never sees the secret key.
- `payment_attempts` is written **only** by the Edge Functions using the
  service role. Customers get read-only, column-limited SELECT of their own rows.
- Marking an order paid happens only through `record_paystack_payment`, which is
  revoked from `anon`/`authenticated` and granted to `service_role` only.

---

## Migration

**File:** `supabase/migrations/011_paystack_payment_foundation.sql` (new,
forward-only; `001`–`010` untouched).

Creates:

- `public.payment_attempts` (one row per external payment initialization).
- A `BEFORE UPDATE` trigger (`set_updated_at()` reuse) for `updated_at`.
- RLS: one customer SELECT policy (`auth.uid() = user_id`); **no** customer
  INSERT/UPDATE/DELETE policies.
- Column-level SELECT grants for `authenticated` that exclude `access_code` and
  `provider_response`.
- `public.admin_list_payment_attempts(uuid, integer)` — admin-only read
  (fail-closed on `public.is_admin()`); prepared for a future support/Admin view.
- `public.record_paystack_payment(...)` — the single verified-success write path
  (see _Verify Flow_ and _Idempotency_).

The migration is safe to re-run (`create ... if not exists`, guarded drops) and
issues `notify pgrst, 'reload schema'` at the end.

---

## payment_attempts

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `default gen_random_uuid()` | |
| `order_id` | `uuid not null` → `orders(id) on delete restrict` | |
| `user_id` | `uuid not null` → `auth.users(id) on delete restrict` | |
| `provider` | `text not null default 'paystack'` | |
| `reference` | `text not null unique` | server-generated, immutable per attempt |
| `status` | `text not null default 'initialized'` | `initialized` \| `pending` \| `success` \| `failed` \| `abandoned` |
| `amount` | `numeric(12,2) not null` (`>= 0`) | the order total at initialization |
| `currency` | `text not null default 'GHS'` | |
| `channel` | `text null` | real channel when Paystack supplies one |
| `authorization_url` | `text null` | returned by Paystack initialize |
| `access_code` | `text null` | server-only (not granted to customers) |
| `provider_response` | `jsonb null` | server-only, for support/diagnosis |
| `verified_at` | `timestamptz null` | set once, on verified success |
| `created_at` / `updated_at` | `timestamptz not null default now()` | |

Indexes: `order_id`, `user_id`, `created_at desc`. `reference` is uniquely
indexed by its constraint.

**Status domain** is deliberately small — only states the implementation uses.
**Multiple attempts per order are expected** (abandoned → failed → success), and
historical attempts are never deleted.

### F3 forward-compatibility decision

No generic webhook/event-idempotency table is added in F1. The attempt ledger is
sufficient now: `UNIQUE(reference)` is the idempotency anchor and
`status` / `provider_response` / `verified_at` let F3 process webhook events
idempotently. F3 can add a dedicated event table in its own forward migration
without reworking this schema. (**Documented decision, per spec §24.**)

---

## Initialize Flow

**Function:** `supabase/functions/initialize-payment/index.ts`.

### What the browser sends

```json
{ "orderId": "<uuid>" }
```

Nothing else is accepted. No amount, currency, email, total, user id or payment
source is read from the body.

### What the server derives

1. Authenticates the caller from the `Authorization` bearer token
   (`requireAuthenticatedUser`).
2. Loads the order with the service client and verifies `order.user_id === user.id`
   → `order_not_owned` when it is someone else's, `order_not_found` when absent.
3. Rejects `payment_status = 'paid'` (`already_paid`) and rejects `refunded` or a
   `cancelled` order (`order_not_payable`). Eligible states: `unpaid`, `failed`.
4. Reads `orders.total_amount` and `orders.currency` — the only authoritative
   money values.
5. Takes the customer email from the authenticated user record, never the body.
6. Builds a unique server reference `TPSPAY-<orderNumber>-<32 hex>` and inserts a
   `payment_attempts` row (`status = 'initialized'`).
7. Converts the amount to minor units with `toMinorUnits` (string + `BigInt`, no
   floating-point multiplication): `GHS 250.00 → 25000`.
8. Calls Paystack `POST /transaction/initialize` server-to-server with the
   trusted email, amount, currency, reference, callback URL
   (`${SITE_URL}/payment/callback`) and non-sensitive metadata
   (`order_id`, `order_number`, `payment_attempt_id`).
9. Stores `authorization_url`, `access_code` (and the raw payload for support)
   and moves the attempt to `status = 'pending'`. On failure the attempt is
   marked `failed` and `payment_initialize_failed` is returned.
10. Returns **only**:

```json
{ "reference": "…", "authorizationUrl": "…", "attemptId": "…" }
```

---

## Verify Flow

**Function:** `supabase/functions/verify-payment/index.ts`.

**Input:** `{ "reference": "…" }` — no status or amount is accepted.

1. Authenticates the caller from the bearer token.
2. Finds the local `payment_attempts` row by `reference`
   (`payment_attempt_not_found` if absent).
3. Loads the order and verifies ownership on both attempts and order
   (`order_not_owned`).
4. If the attempt is already `success` **and** the order is paid via Paystack
   with this exact reference → returns `already_verified` immediately without a
   network call or any write.
5. Calls Paystack **`GET /transaction/verify/:reference`** server-to-server.
6. Rejects, before any write:
   - provider reference ≠ local reference → `payment_reference_mismatch`
   - provider minor amount ≠ `toMinorUnits(order.total_amount, order.currency)`
     → `payment_amount_mismatch`
   - provider currency ≠ order currency → `payment_currency_mismatch`
7. On `status = 'success'`, calls `record_paystack_payment(...)` (service role)
   which, inside one transaction with row locks:
   - re-checks reference, amount, currency against the database,
   - protects manual attribution,
   - sets the attempt to `success` + `verified_at`,
   - sets `orders.payment_status = 'paid'`, `payment_source = 'paystack'`,
     `payment_provider = 'Paystack'`, `payment_reference`, `payment_channel`
     (when supplied) and `paid_at` (preserving an existing value).
8. On `failed` / `abandoned` / other, updates the attempt status only
   (`failed` / `abandoned` / `pending`) and **never** marks the order paid.
9. Returns the safe, normalised result:

```json
{
  "status": "paid" | "unpaid",
  "outcome": "success" | "already_verified" | "failed" | "abandoned" | "pending",
  "reference": "…", "orderId": "…", "orderNumber": "…",
  "amount": 0, "currency": "GHS", "channel": "card" | null, "paidAt": "…" | null
}
```

**Fulfilment is never touched.** `paid` does not mean `confirmed`; nothing here
writes `orders.status`.

---

## Security

- **Secrets server-side only.** `PAYSTACK_SECRET_KEY` and the service-role key
  are read from Edge Function secrets via `Deno.env` and are never returned.
  Verified: no `PAYSTACK` match anywhere under `src/`, and the only client env
  reads are `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Amount is server-derived.** The client cannot supply it; Paystack gets
  `toMinorUnits(orders.total_amount, orders.currency)`.
- **Identity is server-derived.** `user_id` from the body is never read; the
  caller comes from the bearer token, and order ownership is checked before any
  privileged write.
- **Payment cannot be fabricated from the callback/query string.** Both
  functions ignore query/body status values and rely on a server-to-server
  Paystack verify plus a database re-check of reference/amount/currency.
- **Customer reads are column-limited.** `authenticated` may select only the safe
  columns of its own attempts; `access_code` and `provider_response` are not
  granted.
- **`record_paystack_payment` is `service_role`-only.** It is revoked from
  `public`, `anon` and `authenticated`, so a browser session cannot mark an order
  paid.
- **CORS is an allow-list**, not `*`: the storefront origin, the configured
  `SITE_URL` origin and local dev origins only.

### Error contract

`method_not_allowed`, `not_authenticated`, `invalid_request`, `order_not_found`,
`order_not_owned`, `already_paid`, `order_not_payable`,
`payment_initialize_failed`, `payment_attempt_not_found`,
`payment_verify_failed`, `payment_amount_mismatch`, `payment_currency_mismatch`,
`payment_reference_mismatch`, `payment_conflict`, `server_configuration_error`.

Failures return `{ "error": "<code>", "message": "<human sentence>" }`. Raw
provider payloads, secrets and stack traces are only logged server-side.

---

## Idempotency

- **Reference is unique** (`UNIQUE(reference)`); retries create a **new**
  attempt with a **new** reference — a failed/abandoned reference is never
  reused.
- **Repeated verification is safe.** A successfully verified attempt short-
  circuits to `already_verified` (no network call, no write). `record_paystack_payment`
  also returns `already_verified` when it sees the same attempt already recorded.
- **`paid_at` is never reset** — it is only set via `coalesce(paid_at, …)`.
- **Concurrency** is handled with `SELECT … FOR UPDATE` row locks on the attempt
  and the order inside `record_paystack_payment`.

---

## Manual vs Paystack Attribution

- The E3/H0.1 manual flow is unchanged: `admin_set_manual_payment()` still sets
  `payment_source = 'manual'` server-side.
- `record_paystack_payment()` refuses to convert an order that is already paid
  as manual: it returns `outcome = 'conflict'`, and `verify-payment` maps that to
  the `payment_conflict` error. Reversing it requires a deliberate Admin action,
  not a Paystack verification.
- It also returns `conflict` when the order is paid via a **different** Paystack
  reference, so a second payment cannot silently overwrite the first.
- On success the successful attempt becomes the payment attribution via the
  existing columns — no duplicate `paystack_*` columns were added.

---

## Environment / Secrets

Expected Edge Function secrets:

| Secret | Purpose |
|---|---|
| `PAYSTACK_SECRET_KEY` | Paystack server-to-server auth (already stored) |
| `SITE_URL` | Builds `${SITE_URL}/payment/callback` |

Provided automatically by the Supabase runtime: `SUPABASE_URL`,
`SUPABASE_ANON_KEY` (the code also accepts `SUPABASE_PUBLISHABLE_KEY`) and
`SUPABASE_SERVICE_ROLE_KEY` (also accepts `SUPABASE_SECRET_KEY`).

`SITE_URL` must resolve to `https://theproxyshop.vercel.app` so the callback
becomes `https://theproxyshop.vercel.app/payment/callback`. If it is missing,
the functions fail clearly with `server_configuration_error`. No secret was
added to `.env.example` (the file does not exist and was not created).

---

## Files Changed

New:

- `supabase/migrations/011_paystack_payment_foundation.sql`
- `supabase/functions/deno.json`
- `supabase/functions/_shared/env.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/http.ts`
- `supabase/functions/_shared/supabase.ts`
- `supabase/functions/_shared/money.ts`
- `supabase/functions/_shared/reference.ts`
- `supabase/functions/_shared/paystack.ts`
- `supabase/functions/_shared/types.ts`
- `supabase/functions/initialize-payment/index.ts`
- `supabase/functions/verify-payment/index.ts`
- `src/lib/payments/paystack.ts`
- `SPRINT_F1_PAYSTACK_PLUMBING.md` (this document)

Modified:

- `src/lib/supabase.ts` — `PaymentAttemptStatus`, `PaymentAttemptRow`,
  `PaymentAttemptInsert/Update` (= `never`) and the `payment_attempts` table
  entry.
- `eslint.config.js` — ignore `supabase/functions` (Deno runtime, not the Vite
  app).
- `SPRINT_LOG.md` — concise summary entry.

---

## Verification

- `npm run typecheck` → exit 0 (clean).
- `npm run lint` → exit 0, **0 errors** (same 4 pre-existing warnings in
  `src/contexts/*`).
- `npm run build` → exit 0.
- Edge Function TypeScript: the Deno toolchain is **not installed** in this
  environment (`deno` and `supabase` CLI both absent), so `deno check` could not
  be run. All Edge Function files were at least syntax/transform checked with the
  project's bundled esbuild (`npx esbuild <file> --format=esm`) — all pass. A
  separate `supabase/functions/deno.json` is provided so `deno check` /
  `deno lint` work where Deno is available.
- Static security review (grep): no `PAYSTACK` in `src/`; no `service_role` key
  in `src/` (only a prose mention in `src/lib/orders/invoice.ts`); no client-
  supplied authority fields read in the functions; no `/payment/callback` route
  created; Pay Now / Retry buttons still `disabled`.
- The migration was **not executed** (all migrations in this repo are manual).
- No screenshots, Playwright, Puppeteer or browser automation.

---

## Manual Deployment Steps

Nothing below was performed by this sprint.

1. In the Supabase SQL editor, run
   `supabase/migrations/011_paystack_payment_foundation.sql` (after `010`).
2. Confirm Edge Function secrets exist: `PAYSTACK_SECRET_KEY` (already set) and
   `SITE_URL = https://theproxyshop.vercel.app`.
3. Deploy the functions (from the repo root, with the Supabase CLI):
   ```
   supabase functions deploy initialize-payment
   supabase functions deploy verify-payment
   ```
   The `_shared/` folder is bundled automatically and is not deployed as a
   function.
4. Test in Paystack **Test Mode**: call `initialize-payment` with a real unpaid
   order id and the caller's access token, open the returned `authorizationUrl`,
   pay with a Paystack test card, then call `verify-payment` with the returned
   `reference` and confirm the order becomes `paid` with
   `payment_source = 'paystack'`.
5. Confirm the Paystack dashboard callback URL is still
   `https://theproxyshop.vercel.app/payment/callback`.

---

## Deferred to F2

- Activating customer **Pay Now** / **Retry Payment** (`OrderDetailView`,
  `AccountPaymentDetail`, `OrderConfirmation`).
- The `/payment/callback` route + its verified result UX (it must tolerate
  repeat visits and forged query params and must render from a `verify-payment`
  call, never from the URL).
- Client data layer that invokes `initialize-payment` / `verify-payment` and
  consumes `src/lib/payments/paystack.ts`.

The buttons remain **disabled** after F1.

---

## Deferred to F3

- `paystack-webhook` with signature verification.
- Idempotent webhook-event storage (a dedicated event table, if needed).
- Reconciliation / mismatch views for "callback lost, webhook arrives later".
- No webhook processing exists in F1.

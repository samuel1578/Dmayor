# Phase G2 — Cancellation & Stock Lifecycle

Phase G2 implements the first confirmed stock-lifecycle rule in this project:
when an eligible order is cancelled, the stock deducted at checkout is restored
**exactly once** — atomically, behind an Admin-only RPC, with a required
cancellation reason.

**Status:** Implemented locally. **NOT deployed** — migration `014` is written
but never executed by this work (all migrations in this repo are applied
manually). See _Manual Deployment Steps_. Nothing was deployed remotely by this
work.

---

## Scope

In scope:

- Forward migration `014_order_cancellation_stock_lifecycle.sql` (cancellation
  columns + constraints + `admin_cancel_order`).
- Exactly-once, atomic stock restoration for eligible cancellations
  (authoritative variant restock + legacy aggregate sync).
- Required cancellation reason (constrained code) + optional internal note.
- Admin cancel dialog and cancellation record card; customer cancellation
  display (date + customer-safe reason).
- Pure client helpers (`src/lib/cancellation.ts`) + focused tests (27 new;
  118 total, all 15 required cases).

Out of scope (explicitly **not** done): automatic refunds, Paystack refund
API, customer self-cancellation, courier integrations, email notifications,
Collections, Blog, unpaid-order expiry, and any page redesign.

### Owner decisions taken before building

1. **Shipped → Cancelled stays allowed** (009 semantics unchanged) but **never
   auto-restocks** — the goods are already out the door, so inventory is
   handled manually outside the app; `restocked_at` stays NULL. The spec's
   "stop and report" flag was raised and resolved this way.
2. **Reason enforcement is UI-level only** — the Admin UI always cancels
   through `admin_cancel_order` (reason required), while
   `admin_set_order_status` keeps its original reason-less cancel path
   untouched. Consequence: a cancellation made through that legacy path does
   **not** auto-restock and records no reason (surfaced in the Admin card as
   "Reason: Not recorded" / "Stock: Not restored").

---

## Existing Stock Model

Confirmed before building (nothing guessed):

- **Authoritative inventory:** `product_variants.stock` (integer,
  `product_variants_stock_check CHECK (stock >= 0)`), from migration 001.
- **Legacy aggregate:** `products.stock` (`products_stock_check CHECK >= 0`) is
  explicitly non-authoritative, re-derived as `coalesce(sum(active variant
  stock), 0)` — the exact strategy of `create_order_from_cart()` step 13.
- **Deduction point:** checkout, in one atomic transaction — 008 step 12
  (`update product_variants … set stock = stock - quantity` from the order
  lines) then step 13 (legacy sync for the touched products), then step 14
  (cart cleared). Stock is therefore **already gone** by the time an order can
  be cancelled — which is why a cancellation that never restocks leaks
  inventory.
- **Variant link on the order:** `order_items.variant_id` (nullable FK,
  `ON DELETE SET NULL`) is always populated at checkout because cart lines
  require a variant (006/D2). Restock uses this identifier — **never**
  size/colour/SKU text reconstruction.
- **Transitions (009):** `pending|confirmed|processing|shipped → cancelled`
  were already allowed; `delivered` and `cancelled` are terminal. Migration 009
  deliberately performed no restock and instructed: *"When the rule is
  confirmed, implement restock as a separate, idempotent migration/RPC (guarded
  so it can never run twice)."* Migration 014 is that migration.
- **G1 shipment fields** (`carrier`, `tracking_number`, `tracking_url`,
  `delivery_note`, `tracking_updated_at`) are untouched; a cancelled order
  simply keeps whatever was recorded.
- **Timestamps:** `cancelled_at` already exists (009) and is backfilled on the
  cancel transition.

---

## Cancellation Rules

| From | To cancelled | Auto-restock |
| --- | --- | --- |
| `pending` | allowed (reason required in UI) | **yes** |
| `confirmed` | allowed | **yes** |
| `processing` | allowed | **yes** |
| `shipped` | allowed (owner decision) | **no** — manual handling outside the app |
| `delivered` | **rejected** (`terminal_status`) | n/a |
| `cancelled` | **rejected** (`no_change`) — terminal | n/a (never runs) |

- Restock eligibility is exactly `{pending, confirmed, processing}` **AND**
  `restocked_at IS NULL`.
- Cancellation is never reversible: no path returns a cancelled order to a
  live status (both RPCs reject it).
- Reason (UI path): `customer_request | item_unavailable | duplicate_order |
  payment_issue | operational_issue | other` — a constrained text code with a
  CHECK constraint, deliberately **not** a reference table. The note is
  optional and capped at 500 characters.
- `cancelled` can also be reached through the untouched legacy
  `admin_set_order_status` path (reason-less, restock-less) — permitted by the
  owner decision above and reported in the Admin card.

---

## Migration

`supabase/migrations/014_order_cancellation_stock_lifecycle.sql` —
forward-only, never re-run automatically, safe to re-run (everything guarded):

1. **Preconditions** — `orders`, `order_items`, `product_variants`,
   `products`, `is_admin()`, `admin_set_order_status` must exist.
2. **Four nullable columns**: `restocked_at`, `cancellation_reason`,
   `cancellation_note`, `cancelled_by uuid → auth.users(id) ON DELETE SET
   NULL` (each commented).
3. **Three CHECK constraints** (guarded via `pg_constraint`): reason code set,
   note ≤ 500, and `restocked_at IS NULL OR status = 'cancelled'`.
4. **`admin_cancel_order(uuid, text, text)`** — the cancellation + restock RPC.
5. **Grants** (revoke `public`/`anon`, grant `authenticated`) + `notify pgrst,
   'reload schema'` + confirmation notice.

No existing function is dropped or redefined, no payment column is touched, no
table-level privilege is added, and no backfill is needed (all columns
nullable).

---

## Exactly-Once Restock

`admin_cancel_order(p_order_id, p_reason, p_note default null)` returns
`setof public.orders`:

1. Fail closed: `if not coalesce(public.is_admin(), false) then raise …`
   **before anything else** (`SECURITY DEFINER`, `search_path = public,
   pg_temp`, `<code>|<sentence>` errors: `not_authorized`,
   `invalid_cancellation_reason`, `invalid_cancellation_note`,
   `order_not_found`, `terminal_status`, `no_change`).
2. Validate reason (required, known code) and note (≤ 500).
3. **Lock the row `FOR UPDATE`**, then read `status` + `restocked_at`.
4. Reject `cancelled` (`no_change`) and `delivered` (`terminal_status`).
5. Compute `v_do_restock := status IN ('pending','confirmed','processing') AND
   restocked_at IS NULL`.
6. Cancel: `status='cancelled'`, `cancelled_at=coalesce(cancelled_at, now())`,
   `cancellation_reason`, `cancellation_note`, `cancelled_by=auth.uid()`.
7. If eligible, in the **same transaction**:
   - restore authoritative stock: `update product_variants … + sum(quantity)`
     from `order_items` **grouped by `variant_id`** (lines whose variant was
     deleted are skipped — there is nothing to restore);
   - re-derive legacy `products.stock` with the identical checkout strategy
     (`sum` of the product's **active** variant stock, `coalesce(…,0)`) for the
     products on those lines;
   - stamp `restocked_at = now()` guarded by `AND restocked_at IS NULL`.

Idempotency therefore has three independent layers: the row lock, the
terminal-state rejection before any write, and the marker itself. A repeat or
concurrent cancellation can never move stock twice. The DB never trusts any
client-side flag.

---

## Paid vs Unpaid Cancellation

Payment and cancellation remain separate domains:

- The RPC **never assigns `payment_status` or `paid_at`** and never calls any
  payment function (test-asserted). Cancelling a **paid** order keeps it
  `paid`.
- No Paystack refund API, no automatic refund, no refund button — refunds stay
  an explicitly recorded act (Admin payment centre), as before.
- The Admin UI states this in the dialog (**"Cancelling this order does not
  refund the payment."**, plus "It stays recorded as paid until a refund is
  recorded separately." when the order is paid) and repeats it on the
  cancellation card: **"Payment remains recorded as paid. Refunds are handled
  separately."**
- Unpaid cancellations change nothing about payment state either.

---

## Admin UX

No page redesign — additive changes on `/admin/orders/:id` only:

- **Cancel order…** button in the Fulfilment card (same red style as before)
  now opens a `ConfirmDialog` (extended with an optional content slot;
  existing dialogs are unaffected) that contains:
  - **Reason (required)** select with the six codes;
  - **Internal note (optional, Admin only)** textarea (maxLength 500);
  - in-dialog validation errors (reason required; DB errors surface here too);
  - eligibility copy: eligible orders are told *"Stock … will be restored to
    inventory automatically — once only."*, shipped orders are told *"stock
    will NOT be restored automatically; handle shipment and stock manually."*;
  - the refund warning for all orders, strengthened when the order is paid.
- **Cancellation record card** (replaces the stale "Stock was not restocked"
  blocker from E3, whose premise G2 resolves) for cancelled orders: Cancelled
  (date), Reason (label or "Not recorded"), Note, Stock ("Restored <date>" or
  "Not restored" + a Products link for manual adjustment), and the paid-order
  refund notice.
- Status/payment cards, shipment section and the rest of the page are
  unchanged.

---

## Customer UX

- The shared `OrderDetailView` (order confirmation + account order pages)
  shows a compact **Cancellation** block under the status timeline when the
  order is cancelled: *"Cancelled on <date>."* plus a **customer-safe**
  sentence derived from the reason code (e.g. "An item in this order became
  unavailable.").
- `other` and any unknown code render **no reason text** — only the date.
- Never exposed to customers: `cancellation_note` (internal), `cancelled_by`,
  `restocked_at` — asserted by test: the customer query selects
  `cancelled_at, cancellation_reason` and nothing more.
- The timeline itself is untouched: `Pending → Confirmed → Processing →
  Shipped → Delivered` with the existing terminal cancelled block.

---

## Concurrency

- Row lock (`SELECT … FOR UPDATE`) is taken **before every decision**, so two
  admins cancelling the same order serialise: the first commits the restock,
  the second sees `status = 'cancelled'` and is rejected with `no_change`
  before any stock write.
- The restock, the legacy sync and the `restocked_at` stamp are one atomic
  transaction (a single RPC call) — a failure rolls back the cancellation too.
- The stamp is additionally guarded (`AND restocked_at IS NULL`) and the
  constraint `restocked_at IS NULL OR status = 'cancelled'` documents the
  invariant.
- Client-side busy/disabled state exists only to stop double-clicks in the UI;
  **idempotency never depends on it**.

---

## Security

- **Customers:** read-only. Cancellation data reaches them through the same
  own-order RLS query (SELECT only); no new grants or policies; the internal
  note and actor are never selected; customers have no cancel path (no
  self-cancellation).
- **Admins:** `admin_cancel_order` is `authenticated`-only (`public`/`anon`
  revoked) and fails closed on `public.is_admin()`. `cancelled_by` records
  `auth.uid()`.
- Stock writes happen only inside that SECURITY DEFINER RPC; the app has no
  client-side stock write path anywhere.
- No secrets, no Edge Functions, no payment-code changes.

---

## Files Changed

| File | Change |
| --- | --- |
| `supabase/migrations/014_order_cancellation_stock_lifecycle.sql` | **new** — cancellation columns, constraints, `admin_cancel_order` |
| `src/lib/cancellation.ts` | **new** — reason codes/labels, customer-safe text, `validateCancellationInput` |
| `src/lib/cancellation.test.ts` | **new** — vocabulary/validation/customer-text tests |
| `src/lib/orders.cancellation.test.ts` | **new** — the 15 required cases (static SQL + mocked client) |
| `src/lib/supabase.ts` | `OrderRow` + 5 cancellation columns |
| `src/lib/admin/orders.ts` | `AdminOrder` cancellation fields + mapper, `cancelAdminOrder`, error codes `invalid_cancellation_reason`/`invalid_cancellation_note`, reason re-exports |
| `src/lib/account/orders.ts` | `OrderDetail.cancelledAt`/`cancellationReason`, `DETAIL_SELECT` extended (date + reason only), mapper |
| `src/components/admin/ConfirmDialog.tsx` | optional `children` slot + focus guard for a disabled confirm button |
| `src/pages/admin/AdminOrderDetail.tsx` | cancel dialog (reason + note + warnings), cancellation record card, "Cancel order…" button |
| `src/components/account/OrderDetailView.tsx` | customer cancellation block (date + safe reason) |
| `SPRINT_LOG.md` | appended G2 entry only |

Unchanged: `admin_set_order_status` / `admin_set_order_payment_status` (009 /
010 semantics preserved), `OrderStatusTimeline`, checkout, payments (F1–F3),
G1 shipment code, migrations 001–013.

---

## Verification

```bash
npm run typecheck > /tmp/tc.log 2>&1; echo "typecheck exit=$?"   # exit=0
npm run lint      > /tmp/lint.log 2>&1; echo "lint exit=$?"      # exit=0 (4 pre-existing warnings in src/contexts/*)
npm test          > /tmp/test.log 2>&1; echo "test exit=$?"      # exit=0 — 9 files, 118 tests passed (91 before + 27 new)
npm run build     > /tmp/build.log 2>&1; echo "build exit=$?"    # exit=0
```

Coverage of the fifteen required cases (test file → name):

| # | Case | Test |
| --- | --- | --- |
| 1 | pending cancel restores stock | `orders.cancellation.test.ts` "1. cancelling a pending order restores stock" |
| 2 | confirmed cancel restores stock | "2. cancelling a confirmed order restores stock" |
| 3 | processing cancel restores stock | "3. …" (+ exact eligibility set) |
| 4 | repeat cancellation does not restore twice | "4. a repeat cancellation cannot restore stock twice" |
| 5 | concurrent/repeated invocation idempotent | "5. concurrent invocations serialise on a row lock" |
| 6 | cancelled order is terminal | "6. cancelled is terminal …" |
| 7 | delivered cannot cancel | "7. a delivered order cannot be cancelled" |
| 8 | shipped cannot simple-cancel (as adopted) | "8. shipped cancellation is allowed but never auto-restocks" |
| 9 | paid cancellation does not mark Refunded | "9. cancelling a paid order does not mark it refunded" + "9b" client path |
| 10 | unpaid cancellation leaves payment unchanged | "10. … (no payment params)" |
| 11 | variant stock restored correctly | "11. variant stock is restored through the captured variant_id only" |
| 12 | legacy product stock synchronized | "12. legacy products.stock is synchronized with the checkout strategy" |
| 13 | cancellation reason stored | "13. the cancellation reason is stored as a constrained code" + "13b" + `cancellation.test.ts` |
| 14 | internal note not exposed to customer | "14. … never selected for customers" |
| 15 | restocked_at set only once | "15. restocked_at is stamped only once" |

**Limitations (reported, not passes):** Deno/Supabase CLI are unavailable
(`deno check`/`deno lint` never run; no Edge Function changes to esbuild-check)
and **no SQL executed anywhere** — migration 014 is verified by construction,
static assertions against its text and review only. No screenshots, Playwright,
Puppeteer or any browser automation.

Security greps: no secrets under `src/`; `src/lib/account/orders.ts` has no
write call; migration 014 issues no table write grants; customer query excludes
`cancellation_note`/`cancelled_by`/`restocked_at`.

---

## Manual Deployment Steps

1. Apply `supabase/migrations/014_order_cancellation_stock_lifecycle.sql`
   **manually** (Supabase SQL editor or `supabase db push`), after 001–013.
   - Expected notice: `Phase G2 cancellation stock lifecycle applied. …`
   - No existing function is dropped or redefined by this file.
2. Confirm the four columns exist (`\d public.orders`) and
   `admin_cancel_order` is callable by `authenticated` only.
3. Deploy the frontend — no new env vars, Edge Functions or config changes.
4. Re-run `npm run typecheck && npm run lint && npm test && npm run build`.

---

## Manual Test Procedure

Admin (`/admin/orders/:id`):

1. Open a **pending** order → **Cancel order…** → dialog appears with no
   reason preselected → confirm without choosing one → blocked with "Choose a
   cancellation reason."
2. Choose a reason, add an optional note → confirm → order becomes Cancelled;
   feedback says stock was restored; the Cancellation card shows date, reason,
   note and `Stock: Restored <time>`.
3. Verify the variant stock actually increased (Products → variant) and the
   legacy product total equals the sum of its active variants.
4. Repeat with a **confirmed** and a **processing** order (same result).
5. Cancel a **shipped** order → allowed, but feedback + card say stock was
   **not** restored; refund warning shown.
6. Try to cancel a **delivered** order → no cancel button (terminal); calling
   the RPC directly returns `terminal_status`.
7. Attempt a second cancellation of an already-cancelled order → rejected
   (`no_change`); stock does not move again (test the same order twice).
8. Cancel a **paid** order → dialog shows "Cancelling this order does not
   refund the payment."; afterwards payment status is still **Paid** and the
   card shows "Payment remains recorded as paid. Refunds are handled
   separately."
9. Cancel an **unpaid** order → payment status still **Unpaid**.
10. Try two browser sessions cancelling the same order (or double-submit) →
    exactly one succeeds; stock restored once.

Customer (`/account/orders/:orderNumber`):

11. Cancelled order shows the Cancelled status, a Cancellation block with the
    date and a friendly reason sentence (`other` → date only).
12. Confirm the customer page shows **no** internal note, no admin actor, no
    restock marker.
13. Non-cancelled orders show no Cancellation block; the timeline is unchanged.
14. Another customer's order still returns "not found" (RLS unchanged).

---

## Deferred to G3

- **Server-side reason enforcement** — folding the legacy
  `admin_set_order_status` cancel path into `admin_cancel_order` (owner chose
  UI-level enforcement for G2) so every cancellation carries a reason and
  restocks.
- **Shipped-order policy** — whether shipped → cancelled should be blocked
  outright, and whether/when a shipped cancellation should restock.
- Unpaid-order expiry + restock, customer self-cancellation, restock on other
  terminal paths (each needs its own decision + migration).
- Refund automation (Paystack refund API), returns/RMA workflow.
- Cancellation audit history beyond the single `cancelled_at`/`cancelled_by`
  pair.

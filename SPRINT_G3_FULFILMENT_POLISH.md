# Phase G3 — Fulfilment UX & Operational Polish

**Date:** 2026-10-08
**Status:** Implemented locally; NOT deployed
**Predecessors:** `SPRINT_G1_SHIPMENT_TRACKING.md`, `SPRINT_G2_CANCELLATION_STOCK.md`

---

## Scope

**Built in this sprint**

- One canonical status/payment vocabulary module used by every surface.
- Required customer wording for all six fulfilment statuses.
- Refined customer timeline (delivered date, textual stage captions, `aria-current`).
- Tightened Admin fulfilment controls: shared action labels, non-blocking
  "no tracking information" warning, de-duplicated milestone list, labelled
  Payment/Fulfilment rows, `Paid · Paystack`-style payment summary.
- De-duplication of wording/UI that had drifted (local label maps, repeated
  cancelled row, repeated phone line, ambiguous "Status" column).
- An invalid-route state (404) for public and Admin paths.
- Focus fallback in `ConfirmDialog`; stale payment copy on the confirmation page.
- `src/lib/orders.fulfilment.test.ts` — all 10 required cases.

**Deliberately NOT built** (unchanged from the G1/G2 deferral lists)

- Courier APIs, carrier webhooks, live status polling, maps, label generation.
- Email/SMS notifications.
- Returns/refunds automation, collections, blog, discount codes.
- Any new order status, transition or database migration.
- Page redesigns, screenshots, Playwright/Puppeteer (not installed here).

---

## Status Vocabulary — one source of wording

New module: **`src/lib/orders/status.ts`** — pure data + pure functions, no
Supabase runtime import, so it is unit-testable in node.

| Export | Purpose |
| --- | --- |
| `ORDER_STATUSES` | the only six statuses: `pending, confirmed, processing, shipped, delivered, cancelled` |
| `FULFILMENT_STEPS` | timeline order (terminal states excluded) |
| `ACTIVE_ORDER_STATUSES` / `TERMINAL_ORDER_STATUSES` | filters and terminality |
| `ORDER_STATUS_LABELS` | canonical operations wording (Admin, filters, columns) |
| `CUSTOMER_STATUS_LABELS` + `customerStatusLabel()` | shopper-facing wording |
| `ORDER_STATUS_ACTION_LABELS` + `orderStatusActionLabel()` | Admin button text per reachable transition |
| `PAYMENT_STATUS_LABELS`, `PAYMENT_STATUS_OPTIONS`, `PAYMENT_SOURCE_LABELS` | payment domain |
| `paymentStatusLabel()`, `paymentSummaryLabel()` | `Paid` / `Paid · Paystack` |

### Required customer wording (verbatim)

| Status | Customer wording |
| --- | --- |
| pending | **Order received** |
| confirmed | **Order confirmed** |
| processing | **Preparing your order** |
| shipped | **Order shipped** |
| delivered | **Delivered** |
| cancelled | **Order cancelled** |

Operations wording (`Pending`, `Confirmed`, `Processing`, `Shipped`,
`Delivered`, `Cancelled`) is unchanged and is still what the Admin queue,
filters and status columns show.

### Re-exports (no duplicated maps remain)

`src/lib/account/orders.ts`, `src/lib/admin/orders.ts`,
`src/lib/account/payments.ts` and `src/lib/admin/payments.ts` now
**re-export** the shared maps instead of declaring their own `pending: …` /
`paid: …` literals. The pre-existing local constants were deleted.

### Payment vs fulfilment

`paymentSummaryLabel(status, source)` describes payment only:
`Paid · Paystack`, `Paid · Manual`, `Refunded · Paystack`; an unpaid order
never carries a source (`Unpaid`). No payment label contains a fulfilment word
and no fulfilment label contains a payment word — asserted in tests 5 and 5b.

---

## Customer Timeline

`src/components/account/OrderStatusTimeline.tsx`:

- Stages and the cancelled branch read `customerStatusLabel()` — never a local
  map and never the Admin wording.
- Stage captions are text (`Done` / `Current` / `Upcoming`), not colour alone.
- `aria-current="step"` marks the current stage for assistive tech.
- The cancelled status and a `Cancelled on <date>` line are a separate branch.
- A `Delivered on <date>` line is rendered **only** when `delivered_at` exists.

## Customer Surfaces

- `AccountOrders` list row: `Fulfilment: Preparing your order` +
  `Payment: Paid · Paystack`.
- `AccountOverview` recent-order card: the same two labelled spans.
- `AccountOrderDetail` payment bar: `Payment: …` summary label (payment record
  link only — fulfilment stays in the timeline above).
- `AccountPaymentDetail` related order: `Fulfilment: <customer wording>`.
- `OrderDetailView`: payment headline uses `paymentSummaryLabel`; a `Source`
  row appears only when a source exists.
- Invoice (`src/lib/orders/invoice.ts`): order-status row uses customer wording.
- **Tracking gating (refines G1):** the customer Shipment card renders only
  when `showTrackingFor(status, shippedAt)` is true — hidden while
  `pending/confirmed/processing`, shown from `shipped` onward (and whenever a
  `shipped_at` stamp exists).
- Data needed for the above (`payment_source`, `shipped_at`, `delivered_at`)
  was added to `SUMMARY_SELECT` / `DETAIL_SELECT` and the mappers. **All three
  columns already exist** (013/014) — no migration.

---

## Admin Fulfilment Controls

`src/pages/admin/AdminOrderDetail.tsx`:

- Transition buttons use `orderStatusActionLabel()`:
  `Confirm order`, `Start processing`, `Mark shipped`, `Mark delivered`,
  `Cancel order…` (instead of `Mark as Processing`).
- **Non-blocking tracking warning** (exact string, from
  `TRACKING_MISSING_WARNING`): shown in the Fulfilment card when no shipment
  data exists and the order is either shippable or already shipped —
  > `No tracking information has been added.`

  It is rendered as `role="status"`, never `role="alert"`, and never disables
  the ship button; the same sentence is appended to the success feedback when
  marking an order shipped. Shipping without tracking remains fully allowed
  (local delivery methods often have none).
- Milestone list now shows Confirmed / Shipped / Delivered only — the
  cancelled date belongs to the Cancellation card and is no longer shown twice.
- Payment card `Current:` line uses `paymentSummaryLabel(...)` with the order's
  recorded source (`AdminOrder.paymentSource`, read from `admin_get_order`'s
  `to_jsonb(o)` payload — no RPC change).
- Delivery address no longer repeats the phone number (the Customer card above
  owns contact details, with a `Not available` fallback for blank values).

`src/pages/admin/AdminOrders.tsx`:

- Column header `Status` → **`Fulfilment`**; `Payment` column unchanged.
- Mobile cards show two explicitly labelled rows (Fulfilment / Payment)
  instead of two anonymous pills.

---

## Invalid Route State

New `src/pages/NotFound.tsx` — reuses the existing dashed-card empty-state
pattern: `404`, "Page not found", and exactly one way back (`Back to home` +
`Continue shopping` publicly, `Back to overview` inside `/admin`).

`src/App.tsx` gains `<Route path="*" element={<NotFound />} />` in two places:
inside the public `Layout` (catches every unknown customer URL) and inside
`AdminLayout` (keeps the admin shell). `/admin/login` is a sibling route and is
unaffected. No 404 route existed before — unknown paths rendered a blank area.

---

## Accessibility & Stale Copy

- `ConfirmDialog` (`src/components/admin/ConfirmDialog.tsx`): focus now falls
  back to the dialog panel (`tabIndex={-1}`) whenever the confirm button cannot
  take focus (busy/disabled) — previously focus silently dropped to `<body>`.
  The effect also re-runs when `busy` changes.
- `OrderConfirmation`: "No payment has been taken." is now conditional — it
  only appears while the order is actually `unpaid`, since this page is also
  the Paystack return target; paid orders say the payment has been recorded.

---

## Tests

New `src/lib/orders.fulfilment.test.ts` — **14 tests**, static assertions
against migration 009 and against source files, plus the pure module (mocked
Supabase, no network/browser).

| # | Required case | Test |
| --- | --- | --- |
| 1 | Exactly six statuses; `packed`/`dispatched`/`out_for_delivery` appear nowhere in `src` | `1.` + `1b.` |
| 2 | Required customer wording verbatim; shopper surfaces never reference `ORDER_STATUS_LABELS` | `2.` + `2b.` |
| 3 | Admin transition buttons use shared action labels; unreachable status has no label | `3.` |
| 4 | Client transition map equals the database block (009 lines 294–297); terminal states empty | `4.` + `4b.` |
| 5 | Payment wording never carries fulfilment wording; `Paid · Paystack`; status RPC sends only id+status | `5.` + `5b.` |
| 6 | `No tracking information has been added.` exact; warning non-blocking (`role="status"`) | `6.` |
| 7 | Tracking hidden until shipped/later (`showTrackingFor`) | `7.` |
| 8 | No component/page redefines a status or payment label map | `8.` |
| 9 | Payment and fulfilment shown as two labelled rows, never merged | `9.` |
| 10 | Invalid route renders a real state (404 route wired in `App.tsx`) | `10.` |

---

## Files Changed

**New:** `src/lib/orders/status.ts`, `src/lib/orders.fulfilment.test.ts`,
`src/pages/NotFound.tsx`, `SPRINT_G3_FULFILMENT_POLISH.md`.

**Modified:** `src/lib/shipment.ts` (`TRACKING_MISSING_WARNING`,
`showTrackingFor`), `src/lib/account/orders.ts` (selects + mappers + re-exports),
`src/lib/account/payments.ts`, `src/lib/admin/orders.ts` (`AdminOrder.paymentSource`,
mapper, re-exports, `orderStatusActionLabel`), `src/lib/admin/payments.ts`,
`src/lib/orders/invoice.ts`, `src/components/account/OrderStatusTimeline.tsx`,
`src/components/account/OrderDetailView.tsx`, `src/components/admin/ConfirmDialog.tsx`,
`src/pages/account/AccountOrders.tsx`, `src/pages/account/AccountOverview.tsx`,
`src/pages/account/AccountOrderDetail.tsx`, `src/pages/account/AccountPaymentDetail.tsx`,
`src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminOrderDetail.tsx`,
`src/pages/OrderConfirmation.tsx`, `src/App.tsx`, `SPRINT_LOG.md`.

**Migration:** none. Nothing in this sprint needs a schema or RPC change.

---

## Verification

- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0, 0 errors (same 4 pre-existing warnings in `src/contexts/*`).
- `npm test` — **132 passed / 10 files** (118 before + 14 new).
- `npm run build` — exit 0 (existing >500 kB chunk warning unchanged).
- No SQL executed anywhere; no Deno / Supabase CLI available here.
- No screenshots or browser automation (not installed in this environment).

---

## Manual Test Procedure

Admin (`/admin/orders/:id`):

1. Open a **processing** order → buttons read `Mark shipped` / `Cancel order…`,
   and with no tracking data the notice "No tracking information has been
   added." is visible but the ship button still works.
2. Mark it shipped without tracking → success feedback repeats the
   warning sentence; the order is `Shipped`.
3. Confirm the milestone list shows Confirmed/Shipped/Delivered and the
   cancelled date is only on the Cancellation card.
4. Payment card reads `Paid · Paystack` (or `Unpaid`); the phone appears once,
   under Customer.
5. `/admin/orders` column header reads `Fulfilment`; on a phone-width viewport
   both pills carry labels.

Customer:

6. `/account/orders` → `Fulfilment: Preparing your order` and
   `Payment: Paid · Paystack`.
7. Order detail before `shipped` → no Shipment card; from `shipped` → card
   appears; timeline shows `Delivered on <date>` only after delivery.
8. `/order-confirmation/:orderNumber` for a paid order → no "No payment has
   been taken" sentence.
9. Visit `/does-not-exist` and `/admin/does-not-exist` → both render the
   404 state (admin one inside the admin shell).
10. Open a cancellation dialog, disable confirm (busy) → keyboard focus stays
    inside the dialog.

---

## Deferred

- Courier APIs / webhooks / label printing / multi-parcel shipments.
- Email and SMS notifications ("Your order has shipped").
- Returns, refunds automation, collections, blog, discount codes.
- Server-side enforcement of cancellation reasons (G2 owner decision stands).
- Unpaid-order expiry, customer self-cancellation.
- Shipment event history / audit beyond the single `tracking_updated_at`.
- Any new order state (would need a migration + owner decision).

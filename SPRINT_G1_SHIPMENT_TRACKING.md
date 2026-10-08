# Phase G1 — Shipment & Tracking Foundation

Phase G1 adds the manual shipment/tracking data model and its two surfaces: an
Admin edit flow on the order detail page and a customer-facing tracking block
on the order page. It is deliberately a foundation only — no courier
integration, no automation, no notifications.

**Status:** Implemented locally. **NOT deployed** — migration `013` is written
but never executed by this work (all migrations in this repo are applied
manually). See _Manual Deployment Steps_. Nothing was deployed remotely by this
work.

---

## Scope

In scope:

- Forward migration `013_order_tracking_foundation.sql` (nullable shipment
  columns + constraints).
- Admin-only RPC `public.admin_set_order_shipment(...)` — the only writer of
  the shipment fields.
- `admin_list_orders(...)` redefined to also return `carrier` and
  `tracking_number` (return type change ⇒ drop + recreate inside 013).
- Compact **Shipment / Tracking** section on `/admin/orders/:id` with
  edit / save / cancel.
- Subtle tracking indicator on the shipped rows of the Admin order queue.
- Customer tracking block on the shared order body (`OrderDetailView`), used by
  both `/order-confirmation/:orderNumber` and `/account/orders/:orderNumber`.
- Pure client helpers (`src/lib/shipment.ts`) + focused unit tests (35 new
  tests; 91 total).

Out of scope (explicitly **not** done): cancellation restocking, automatic
delivery updates, courier APIs, email notifications, SMS, customer
cancellation, refunds automation, fulfilment automation, Collections, Blog,
live courier progress, shipment-event history, and any page redesign.

---

## Existing Order Architecture

Confirmed before building (nothing duplicated):

- `public.orders` (migration 008) already separates **two domains**:
  `status` = fulfilment (`pending → confirmed → processing → shipped →
  delivered`, plus terminal `cancelled`) and `payment_status` = payment
  (`unpaid | paid | failed | refunded`). Operational timestamps `paid_at`,
  `confirmed_at`, `shipped_at`, `delivered_at`, `cancelled_at` came in 009.
- Fulfilment transitions live in `admin_set_order_status(uuid, text)` (009,
  redefined by 010 for payments only) with a fixed transition map; payment
  writes live in `admin_set_manual_payment(...)` / 010's delegating
  `admin_set_order_payment_status(...)`.
- **No shipment fields existed**: `PRE_FGH_READINESS.md` §Tracking Fields had
  already recorded `carrier`, `tracking_number`, `tracking_url`,
  `delivery_note` as missing. `customer_note` is the customer's own checkout
  note and is untouched. `tracking_updated_at` did not exist either.
- Customers hold **SELECT-only** access to their own orders (`auth.uid() =
  user_id` policy, all write grants revoked — 008 §6). Admin writes run only
  through SECURITY DEFINER RPCs gated by `public.is_admin()`.

Successful payment still does **not** advance fulfilment; nothing in G1
connects payment, status and shipment.

---

## Migration

`supabase/migrations/013_order_tracking_foundation.sql` — forward-only, never
re-run automatically, safe to re-run (every statement guarded/idempotent):

1. **Preconditions** — `public.orders`, `public.is_admin()` and the 009
   `admin_list_orders` signature must exist.
2. **Five nullable columns** on `public.orders` (see below), each with a
   `COMMENT ON COLUMN`.
3. **Four CHECK constraints** (guarded via `pg_constraint` lookups — Postgres
   has no `ADD CONSTRAINT IF NOT EXISTS`).
4. **`admin_set_order_shipment(...)`** — new RPC.
5. **`admin_list_orders` drop + recreate** with two appended columns.
6. **Grants** (revoke `public`/`anon`, grant `authenticated`) + `notify pgrst,
   'reload schema'` + confirmation `notice`.

Because `CREATE OR REPLACE` cannot change a function's return type, adding
`carrier`/`tracking_number` to the order queue required dropping the 009
definition. The full function is redefined inside 013 with identical search,
filters, clamping, grouping, ordering and `is_admin()` gate — **009 itself is
never edited** (forward-only rule respected). `admin_get_order` needed no
change: it already returns `to_jsonb(o)`, so the new columns flow through
automatically.

Migrations are applied manually in this environment; `013` has **not** been
executed anywhere by this work.

---

## Shipment Fields

| Column | Type | Rule |
| --- | --- | --- |
| `carrier` | `text null` | trimmed, ≤ 120 chars. Free text — **no carrier enum invented** |
| `tracking_number` | `text null` | trimmed, ≤ 120 chars |
| `tracking_url` | `text null` | trimmed, ≤ 500, must match `^https?://[^[:space:]]+$` — `javascript:`, `data:`, `file:`, `ftp:` etc. rejected |
| `delivery_note` | `text null` | trimmed, ≤ 500 chars. Shown to the customer (documented below) |
| `tracking_updated_at` | `timestamptz null` | written on every successful save — current state, not an audit log |

- All nullable, all additive: no backfill, no default, no NOT NULL, no index
  needed.
- Validation exists **twice on purpose**: the RPC raises
  `invalid_shipment|<sentence>` for a friendly error, and the CHECK constraints
  guarantee the same rule for any other write path (future migration, console
  edit, Edge Function).
- Whitespace-only input becomes `NULL` (a cleared field), never `''`.
- No courier-specific columns, no shipment-event table, no FK to carriers.

---

## Admin Shipment Management

**RPC** — `admin_set_order_shipment(p_order_id uuid, p_carrier text, p_tracking_number text, p_tracking_url text, p_delivery_note text)`
returns `setof public.orders`:

- Fails closed: `if not coalesce(public.is_admin(), false) then raise exception
  'not_authorized|…'` **before any write**; `SECURITY DEFINER`, `set search_path
  = public, pg_temp`; errors follow the `<code>|<sentence>` contract
  (`not_authorized`, `invalid_shipment`, `order_not_found`).
- The `UPDATE` assigns **exactly five columns**: `carrier`, `tracking_number`,
  `tracking_url`, `delivery_note`, `tracking_updated_at`. It never reads or
  writes `status`, `payment_status`, `paid_at`, `shipped_at`, any stock column
  or any payment column — asserted by a test.
- Row locked via plain `UPDATE … WHERE id = p_order_id`; `IF NOT FOUND` →
  `order_not_found`.

**Uncoupled from status (§5).** The Admin may save tracking first and mark the
order Shipped later, or the reverse — in neither direction is one required for
the other, and `admin_set_order_status` remains the only status writer.

**UI** — compact section in the right-hand controls column of
`AdminOrderDetail` (below Fulfilment, no redesign):

- **Display mode**: rows only for values that exist (Carrier / Tracking number
  / Tracking link / Delivery note / Last saved) plus an **Edit** button; when
  nothing is saved it shows one explanatory line instead of empty labels. The
  tracking link renders as an external link only when it passes validation.
- **Edit mode**: four inputs (`maxLength` mirrors the DB limits) with **Save
  shipment** / **Cancel**; Cancel simply discards the local draft. The URL is
  validated client-side before the RPC is called, so an unsafe scheme never
  reaches the database; a database rejection still surfaces through the shared
  error mapper (`invalid_shipment` → its sentence).
- Reuses the existing patterns: `input-field`, `Feedback`
  (`saved`/`error`), `runMutation` → reload authoritative row.

**Queue** — `AdminOrders` shows one subtle line under the status pill **only
for shipped orders that have tracking**: the tracking number, or
`"<carrier> · Tracking added"` when only a carrier is recorded. Nothing else
about the list changed.

---

## Customer Tracking

- `OrderDetailView` (shared by the confirmation and account pages) renders a
  new **Shipment** card directly under the status timeline — i.e. next to the
  Shipped stage — via the new `src/components/account/OrderShipment.tsx`.
- **Renders nothing when no shipment data exists** (no empty labels), driven by
  `hasShipmentInfo()`.
- Shows Carrier and Tracking number (when present), the delivery note
  (labelled "Delivery note:", keeping it customer-appropriate), and a
  **Track package** button when a valid link exists.
- **Link safety**: `safeTrackingUrl()` re-validates on render — only `http(s)`
  URLs are ever emitted as `href`; invalid schemes degrade to no link rather
  than a clickable one. External link uses
  `target="_blank" rel="noopener noreferrer"`.
- **Timeline untouched**: `Pending → Confirmed → Processing → Shipped →
  Delivered` still renders from `OrderStatusTimeline` exactly as before; G1
  adds no courier progress, no map, no "out for delivery" — the card says
  "Tracking details recorded on this order — not live courier tracking."
- Visibility is **not** gated on fulfilment status (§5: no coupling): whatever
  shipment data exists on the customer's own order is what they see.
- Delivery-note decision: `delivery_note` is customer-visible by design (it is
  the only note field and §7 lists it as customer-visible); the Admin form
  labels it "(visible to the customer)" so operators keep it
  customer-appropriate. Revisit in G2 if an internal-only note is wanted.

---

## Security

- **Customers: read-only.** Shipment columns ride the existing own-order RLS
  policy (`auth.uid() = user_id`, SELECT only). Migration 013 grants **no**
  `INSERT`/`UPDATE`/`DELETE` to anyone and adds no policy. Customers have no
  client helper that writes anything (`src/lib/account/orders.ts` contains no
  `.insert/.update/.upsert/.delete` call — asserted by a test).
- **Admins: RPC only.** The shipment columns are writable exclusively through
  `admin_set_order_shipment`, which fails closed on `public.is_admin()`.
  Grants: `authenticated` only (`public`/`anon` revoked).
- **Unsafe URLs** are rejected server-side (RPC + CHECK constraint) and again
  client-side before rendering, so a stored `javascript:` URL can never become
  a clickable link for a customer.
- No secrets, no service-role keys, no new Edge Functions; no changes to
  payment code or payment columns.

---

## Files Changed

| File | Change |
| --- | --- |
| `supabase/migrations/013_order_tracking_foundation.sql` | **new** — columns, constraints, `admin_set_order_shipment`, `admin_list_orders` redefinition, grants |
| `src/lib/shipment.ts` | **new** — pure helpers: `SHIPMENT_LIMITS`, `normalizeShipmentInput`, `validateTrackingUrl`, `safeTrackingUrl`, `hasShipmentInfo`, `customerTrackingCta` |
| `src/lib/orders.shipment.test.ts` | **new** — RPC/migration tests (1–4, 7, 8) |
| `src/lib/shipment.test.ts` | **new** — validation/display tests (5, 6, 9, 10) |
| `src/lib/supabase.ts` | `OrderRow` + 5 shipment columns |
| `src/lib/admin/orders.ts` | `AdminOrder`/`AdminOrderListItem` shipment fields + mappers, `setAdminOrderShipment`, `invalid_shipment` error code |
| `src/lib/account/orders.ts` | `OrderDetail` shipment fields, `DETAIL_SELECT` extended, mapper |
| `src/pages/admin/AdminOrderDetail.tsx` | Shipment / Tracking section (view + edit/save/cancel) |
| `src/pages/admin/AdminOrders.tsx` | subtle tracking line under shipped rows |
| `src/components/account/OrderShipment.tsx` | **new** — customer tracking card |
| `src/components/account/OrderDetailView.tsx` | renders `OrderShipment` under the timeline |
| `SPRINT_LOG.md` | appended G1 entry only |

Unchanged: `OrderStatusTimeline.tsx`, all payment/F1–F3 files, checkout,
migrations 001–012, `AdminPaymentDetail`, invoice.

---

## Verification

Run from the repo root (exit status preserved through the log file):

```bash
npm run typecheck > /tmp/tc.log 2>&1; echo "typecheck exit=$?"   # exit=0
npm run lint      > /tmp/lint.log 2>&1; echo "lint exit=$?"      # exit=0 (4 pre-existing warnings in src/contexts/*)
npm test          > /tmp/test.log 2>&1; echo "test exit=$?"      # exit=0 — 7 files, 91 tests passed (56 before + 35 new)
npm run build     > /tmp/build.log 2>&1; echo "build exit=$?"    # exit=0
```

Test coverage of the ten required cases:

| # | Case | Test |
| --- | --- | --- |
| 1 | Admin can save tracking | `orders.shipment.test.ts` "1. Admin can save tracking…" (+ "1b" clearing) |
| 2 | Non-admin cannot save tracking | "2. non-admin cannot save tracking…" + "2b" fail-closed gate before the write |
| 3 | Saving does not change order status | "3." asserts the `UPDATE` sets exactly the five shipment columns |
| 4 | Saving does not change payment status | "4." asserts no `payment_status`/`paid_at` in the RPC (+ "4b" migration adds only shipment columns) |
| 5 | Valid HTTPS accepted | `shipment.test.ts` "accepts a valid HTTPS URL" |
| 6 | Invalid schemes rejected | "rejects the unsafe or malformed link …" (javascript:, data:, file:, ftp:, vbscript:, protocol-relative, …) |
| 7 | Customer sees tracking on own order | "7. customer sees tracking on their own order" (columns selected + `user_id` scope) |
| 8 | Customer cannot mutate tracking | "8. customer cannot mutate tracking" (no client write path, no new grants, ownership policy intact) |
| 9 | Missing tracking renders cleanly | "missing tracking renders cleanly…" |
| 10 | Shipped + tracking shows CTA | "shipped order with tracking shows the customer tracking CTA" |

**Limitations (reported, not passes):** the Deno and Supabase CLIs are not
installed in this environment, so `deno check`/`deno lint` never run and there
are no Edge Function changes to esbuild-check. More importantly, **no SQL
executed anywhere** — migration 013 is verified by construction, static
assertions and review only. No screenshots, Playwright, Puppeteer or any
browser automation was used.

Security review greps: no secrets under `src/`; `src/lib/account/orders.ts`
has no write call; migration 013 issues no table write grants; no client writes
to `orders`.

---

## Manual Deployment Steps

1. Apply `supabase/migrations/013_order_tracking_foundation.sql` **manually**
   (Supabase SQL editor or `supabase db push`), in order, after 001–012.
   - Expected notice: `Phase G1 shipment foundation applied. Orders: …`.
   - The `drop function … admin_list_orders(…)` + recreate is intentional and
     safe; PostgREST reloads via the `notify pgrst` at the end of the file.
2. Confirm the new columns exist (`\d public.orders`) and that
   `admin_set_order_shipment` is callable by `authenticated` only.
3. Deploy the frontend (`vercel.json` / `npm run build` output) — no new env
   vars, no new Edge Functions, no config changes required.
4. Re-run `npm run typecheck && npm run lint && npm test && npm run build`
   after applying, if anything changed.

---

## Manual Test Procedure

Admin (`/admin/orders/:id`):

1. Open an order → **Shipment / Tracking** shows "No shipment details yet" →
   click **Edit**.
2. Enter carrier, tracking number, a valid `https://…` tracking link and a
   delivery note → **Save shipment** → success message states status/payment
   were not changed; rows appear with "Last saved".
3. Confirm the order's Fulfilment status and Payment status pills did **not**
   change after saving.
4. Paste `javascript:alert(1)` (or any non-http scheme) into Tracking link →
   Save → blocked client-side with the http(s) message; if forced past the
   client, the database rejects it and no value is stored.
5. Clear a field (e.g. delivery note) → Save → row disappears (value cleared).
6. **Cancel** while editing → draft discarded, stored values unchanged.
7. Non-admin session (or expired admin): the RPC returns `not_authorized` and
   nothing is written.
8. Mark an order **Shipped** with no tracking → allowed; add tracking to an
   order **before** it is shipped → allowed (independent actions).
9. `/admin/orders`: shipped orders with tracking show the small line under the
   status pill; other statuses show nothing.

Customer (`/account/orders/:orderNumber` and `/order-confirmation/…`):

10. Order without shipment data → no Shipment card, no empty labels; timeline
    unchanged (Pending → Confirmed → Processing → Shipped → Delivered).
11. Order with shipment data → Shipment card under the timeline shows carrier,
    tracking number, delivery note and a **Track package** button that opens
    the carrier page in a new tab with `rel="noopener noreferrer"`.
12. Another customer's order number → still "not found" (RLS unchanged).
13. Customer session: no UI and no API path exists to edit any shipment field.

---

## Deferred to G2

- Customer-facing **lifecycle rules** (from `PRE_FGH_READINESS.md`): restock
  on cancellation (exactly once), unpaid-order expiry + restock, optional
  customer cancellation — each a separate, deliberate migration because they
  are business decisions.
- Deciding whether `delivery_note` should split into internal vs
  customer-visible notes.
- Whether the queue/list should gain a "tracking missing" flag for shipped
  orders.
- Shipment history/audit (who changed what, when) beyond the single
  `tracking_updated_at` stamp.

---

## Deferred to G3

- Courier APIs, automated carrier webhook events, live status polling, maps.
- Email/SMS shipping notifications ("Your order has shipped").
- Label generation, pickup scheduling, multi-parcel shipments.
- Returns/refunds automation.

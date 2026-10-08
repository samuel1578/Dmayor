# Proxy Shop — Pre-F/G/H Readiness

Investigation-only report. No code, migrations, policies, routes or business rules were changed. Evidence gathered 2026-09-28 from the repository at `main` (post-E4) plus the live deployment.

---

## Executive Summary

- **Stack:** Vite + React 18 SPA, React Router 7, Supabase (Postgres + Auth + RLS), Vercel hosting, `jspdf@^4.2.1` for invoices. No server runtime of our own yet.
- **Payments:** 100% manual. No Paystack dependency (0 hits in `package-lock.json`), no key, no secret store, no Edge Function, no callback route, no webhook, no reference/provider/transaction fields.
- **Orders:** E1's atomic `create_order_from_cart` RPC remains the only order-creation path; it is server-authoritative for prices, stock and totals, and customers have read-only access enforced by RLS *and* revoked write grants.
- **Stock:** decremented at **order creation** (before payment). **Cancelled orders do not restock** — deliberate, because the business rule is still unconfirmed.
- **One production-critical finding:** the live deployment returns **HTTP 404 for every route except `/`** (`/shop`, `/checkout`, `/order-confirmation/TPS-2026-000001` all verified 404). `public/_redirects` is a Netlify-only file that Vercel ignores, there is no `vercel.json`, and `vite.config.ts` uses `base: './'`. No deep link, refresh, bookmark, shared link or — crucially — future Paystack callback URL can work until this is fixed. **Status (sprint `Vercel SPA Deep-Link Routing Fix`):** fixed in the repo — `vercel.json` rewrite added and `base: '/'` set; **re-verify against production after the next Vercel deploy.**
- **Bundle:** one eager **840.51 kB** JS chunk (gzip 234.57 kB) containing every route, Admin included. No `React.lazy` anywhere. Route splitting is justified.
- **Schema gaps for F/G:** payment reference/provider/channel/source, idempotency ledger, shipment fields, restock marker. **No migration is required for H1** as scoped.
- **Repo is not self-contained:** `003` is missing and the Phase A migration that creates `profiles`/`is_admin()`/the signup trigger is not in the repository, while `005`/`009` depend on it.

---

## Phase F — Paystack Readiness

### Current State

**How an order is created.** `public.create_order_from_cart(p_address_id uuid, p_customer_note text)` (`supabase/migrations/008_orders_checkout_foundation.sql:450`) — `SECURITY DEFINER`, `set search_path = public, pg_temp`, refuses unauthenticated callers (`v_user uuid := auth.uid()`), and in one transaction: loads the authenticated cart, verifies every product and variant is active, verifies the variant belongs to the product, row-locks each variant (`… order by v.id for update of v`), checks stock, resolves current effective prices, computes subtotal + shipping + tax from `commerce_settings`, snapshots the selected address and every line into `orders`/`order_items`, decrements `product_variants.stock` (guarded by `stock >= 0`), re-derives `products.stock` for Admin compatibility, clears the cart, and returns the order id + order number. Failures raise named exceptions (`not_authenticated`, `cart_empty`, `product_unavailable`, `variant_unavailable`, `variant_product_mismatch`, `insufficient_stock`, `address_required`) which `src/lib/checkout/orders.ts` maps to customer-facing copy.

**Where payment status lives.** `public.orders.payment_status` — constrained to `unpaid | paid | failed | refunded`, default `unpaid`, with `paid_at timestamptz` added in `009`. The `orders_total_matches_parts_check` constraint guarantees `total_amount = subtotal + shipping_amount + tax_amount`, and `orders_amounts_check` keeps every amount non-negative. Fulfilment `status` is a separate domain (`pending|confirmed|processing|shipped|delivered|cancelled`) and is never merged with payment.

**How Admin changes payment status.** Only `public.admin_set_order_payment_status(p_order_id uuid, p_status text)` (`009:342`) — `SECURITY DEFINER`, `search_path = public, pg_temp`, fail-closed `if not coalesce(public.is_admin(), false)`, validates against the allowed set, sets `paid_at` only while paid and clears it otherwise, and writes no transaction record. The UI is `/admin/orders/:id` (select + "Update payment status"), with `paid`/`refunded` behind a `ConfirmDialog` whose copy states that nothing is charged. `execute` is granted to `authenticated` only (revoked from `public`/`anon`); the internal admin check is the real boundary.

**Absent by inspection:**
- payment reference field — **none**
- provider / channel / method / authorization field — **none**
- payment attempt or transaction table — **none**
- callback route — **none** (no `/payment/*` route exists in `src/App.tsx`)
- webhook endpoint — **none**
- Edge Functions folder — **none** (`supabase/` contains only `migrations/`)
- Paystack dependency, key or config — **none**; `.env` holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- secret-bearing env surface — **none exists at all** (relevant: there is currently nowhere safe to put a Paystack secret)

**Server-only money config already exists.** `public.commerce_settings` has RLS enabled with **no policies** and `revoke all` from `public`/`anon`/`authenticated`: shipping and tax rules are readable only inside the checkout RPCs, never by the browser. `order_number_seq` is likewise revoked from every client role.

### Missing Pieces

1. **Transaction initialization** — no server-side entry point. Needs a Supabase Edge Function that accepts only an order identifier, re-reads `total_amount` from `orders` server-side, and calls Paystack with the secret key.
2. **Secure secret storage** — no server secret surface exists; `PAYSTACK_SECRET_KEY` must live in Edge Function secrets, never in a `VITE_*` variable.
3. **Callback handling** — no callback route. The deep-link 404 that made any callback URL unloadable is **fixed in the repo** (SPA rewrite + `base: '/'`), so only the route itself remains (see H1).
4. **Webhook handling** — no endpoint and no signature-verification code.
5. **Transaction verification** — no server-to-server verify call; without it there is no trustworthy proof of payment.
6. **Idempotency** — no unique reference column and no processed-event ledger; a duplicated webhook would currently have nothing to check against.
7. **Reference storage** — nowhere to persist the Paystack reference, so a payment cannot be tied back to an order for support or reconciliation.
8. **Provider/channel storage** — needed to distinguish card vs MoMo vs bank vs manual, and to know which channel actually succeeded.
9. **Amount verification** — nothing compares an incoming amount/currency against `orders.total_amount` (the CHECK constraint only proves internal arithmetic).
10. **Retrying unpaid orders** — no way to re-initiate payment for an existing unpaid order, and no idempotency, so a naive retry risks duplicates.
11. **Distinguishing manual-paid from Paystack-paid** — a `paid` status currently carries no attribution; adding a `payment_source` (`manual|paystack`) field is a prerequisite for trustworthy reconciliation.
12. **Failed/abandoned payment** — `failed` exists as a manual status only; there is no abandoned state, no attempt counter, no automatic reconciliation.
13. **Environment separation** — no test/live mode concept and no webhook secret.
14. **Adjacent gap** — no email/notification surface exists at all, so "payment confirmed" receipts have no home yet (payment reminder/manual-transfer instructions on `/checkout` — currently generic and inconclusive — share this gap).

### Recommended F1 / F2 / F3 split

**F1 — Payment plumbing (no visible customer change).**
Prerequisite: the H1 deep-link fix, so a callback URL can be loaded at all. Then: Edge Functions scaffold + secrets; forward migration (proposed `010_payment_foundation.sql`) adding `payment_reference` (unique, nullable), `payment_provider`, `payment_channel`, `payment_source`, and a payment-event/attempt table for idempotency and verification results; `initialize-payment` (reads amount from the order, never from the client) and `verify-payment` (server-side verify, then writes `paid`/`failed`); extend the admin RPC to record `payment_source = 'manual'` and the acting admin.

**F2 — Customer payment UX.**
"Pay Now" for an existing unpaid order (on `/order-confirmation/:orderNumber` and `/account/orders/:orderNumber`, not on the initial Place Order step, so the order record exists first); `/payment/callback` returning to a verified result; retry for failed/abandoned payments; clear terminal states and honest copy for each.

**F3 — Reconciliation and operations.**
`paystack-webhook` with signature verification writing idempotently into the event ledger; a mismatch view (attempteds vs recorded status); explicit manual-vs-automatic attribution in Admin; handling of "callback lost, webhook arrives later". F3 stays payment-only — no fulfilment automation, no emails.

---

## Phase G — Fulfilment & Operations Readiness

### Stock / Cancellation

**When stock is decremented.** At **order creation**, inside `create_order_from_cart` — i.e. before any payment exists. An unpaid `pending` order has already reduced inventory.

**Authoritative source.** `product_variants.stock`. `products.stock` is re-derived afterwards from `SUM(active variant stock)` for Admin compatibility only, and must be re-synced by any future stock-changing path or Admin stock will drift.

**Does cancellation restock?** **No.** There is no `restocked_at`, no inventory-adjustment table, no compensating movement. `/admin/orders/:id` deliberately shows a "Stock was not restocked" blocker rather than silently moving inventory, because the rule is unconfirmed.

**Who can cancel.** Admin only (`admin_set_order_status` → `cancelled`). No customer cancellation exists anywhere in the codebase.

**Could a naive restock double-restock?** Not today (nothing restocks), but the risk is real the moment one is added: the only current protection is the transition map (`delivered` and `cancelled` are terminal, so a second cancel raises). Two more hazards: `create_order_from_cart` has no compensating path, and `orders.user_id … on delete cascade` means deleting the customer removes the order that a restock marker would live on.

**Legacy `products.stock`.** Still synced for Admin compatibility — a restock must re-run the same sync.

**Minimum architecture (options, not a decision):**
- **Option A (smallest, recommended shape):** add a nullable `restocked_at timestamptz` to `orders`; in the `* → cancelled` transition, `select … from orders where id = p_order_id for update` and restock only when `restocked_at is null`, then set it — exactly-once, transaction-safe, no new table.
- **Option B (auditable):** an `order_inventory_events` ledger with a unique key per `(order_id, 'cancelled_restock')`; same guarantee, more surface.
- **Option C (rule-dependent):** move the decrement itself from order creation to payment confirmation. This changes established E1 behaviour and interacts with expiry — do not adopt implicitly.
- **Unpaid-order expiry** needs a scheduled job (pg_cron or a cron Edge Function) that cancels expired unpaid orders and reuses the same restock path, so it depends on the marker existing first.
- **Safest place for restock:** the admin status RPC, because it is already transactional, admin-gated and the only path that can reach `cancelled`. `create_order_from_cart` needs no restock logic.

### Tracking Fields

**Already exist:** `shipped_at`, `delivered_at`, `paid_at`, `confirmed_at`, `cancelled_at` (all `009`), plus the full delivery snapshot on `orders` and `customer_note`.

**Missing:** courier/carrier name, tracking number, tracking URL, shipment reference, and an admin delivery note (the `customer_note` is the customer's own note, not an operational field). No shipment-event history exists.

**Is a new migration needed?** Yes — a forward migration adding nullable `carrier text`, `tracking_number text`, `tracking_url text`, `delivery_note text` to `orders`. Additive and nullable, so it is cheap and needs no backfill; no new index is required.

**Where the fields should live (Admin):** written by a new admin-only RPC next to `admin_set_order_status` (e.g. `admin_set_order_shipment(order_id, carrier, tracking_number, tracking_url, delivery_note)`), fail-closed on `public.is_admin()`, same `search_path` and grant pattern as the `009` functions, rendered as a card on `/admin/orders/:id`.

**Where customers should see them:** `/account/orders/:orderNumber` (and `/order-confirmation/:orderNumber` while the order is young) inside the delivery block — not inside the timeline.

**Can "Order progress" consume them without redesign?** **Yes.** The timeline is driven by the status string and the `*_at` timestamps; an optional carrier/tracking line beneath it (with a link only when a URL exists) is additive. It must not be relabelled as live tracking.

### Recommended G1 / G2 split

**G1 — Shipment fields (data + Admin only).** Migration for the nullable shipment columns; admin RPC + UI card; keep `shipped_at`/`delivered_at` semantics and the existing transition map untouched; no customer-visible change beyond data being stored.

**G2 — Customer tracking + lifecycle rules.** Render carrier/tracking on the customer detail page when present; then, once the owner answers the open questions, implement restock-on-cancel (exactly once), unpaid-order expiry + restock, and optionally customer cancellation. G2 must be a separate, deliberate migration — the restock rule is a business decision, not an implementation detail.

---

## Phase H — Launch Hardening Readiness

### Performance

Build evidence (`npm run build`, 2026-09-28):

| Asset | Size | Gzip |
|---|---|---|
| `index-*.js` (all routes, eager) | **840.51 kB** | 234.57 kB |
| `index-*.css` | 67.81 kB | 12.46 kB |
| `jspdf.es.min` (on demand) | 416.17 kB | 136.52 kB |
| `html2canvas.esm` (on demand) | 201.42 kB | 48.03 kB |
| `index.es` (on demand) | 150.96 kB | 51.68 kB |
| `purify.es` (on demand) | 29.40 kB | 11.31 kB |
| `logo.png` | 730.92 kB | — |
| `founder.png` | 654.77 kB | — |
| `logodark.png` | 262.77 kB | — |
| `FAVICON.png` | 216.55 kB | — |
| `logo-header.png` | 109.87 kB | — |
| `public/og-image.png` | 901.15 kB | — |

- **All route groups are eagerly imported.** `App.tsx` statically imports Home, Shop, ProductDetail, About, Blog, Contact, Cart, Checkout, OrderConfirmation, CustomerLogin, CustomerSignup, five Account pages and seven Admin pages. The only dynamic import in the app is jsPDF inside the invoice generator.
- **Admin is in the initial storefront load** — a first-time visitor to `/` downloads the entire admin surface. Account, Checkout and Orders are in the initial load too.
- **Largest chunks:** the single eager 840.51 kB bundle, then the on-demand jsPDF group (416.17 + 201.42 + 150.96 + 29.40 ≈ 798 kB, only on an invoice click).
- **Largest assets:** the old large-logo situation is **still material** — `Footer` imports the 730.92 kB `logo.png` on every page (dark theme), `logodark.png` (262.77 kB) is pulled by Navbar/Footer, `FAVICON.png` (216.55 kB) is the favicon, and `founder.png` (654.77 kB) loads on `/about`. Roughly 1 MB of PNG can be on a single storefront page.
- **Best lazy candidates, in order:** (1) Admin area — layout plus seven pages, never needed by a storefront visitor; (2) Account area plus Checkout/OrderConfirmation; (3) About/Blog/Contact; (4) heavy assets inside lazy routes, plus compression/WebP/SVG for the logos and `og-image.png`.

Vite itself emits the warning on every build: *"Some chunks are larger than 500 kB after minification. Consider: Using dynamic import() to code-split the application"* — the eager bundle is 68% over Vite's own threshold.

**Conclusion: route splitting justified.** Every visitor pays for 840.51 kB of JS (234.57 kB gzip) that is mostly not theirs, and the fix is route-level `React.lazy`/`Suspense` boundaries plus asset compression — no architectural change.

### Security / RLS

**Customer isolation — enforced in both directions (grants *and* policies):**

| Surface | Enforcement |
|---|---|
| `profiles` | RLS select/update `auth.uid() = id`; INSERT/DELETE revoked; UPDATE granted **only on `full_name, phone`** (column-level); role escalation blocked by the `profiles_guard_update` trigger |
| `cart_items` | Four policies all `auth.uid() = user_id` to `authenticated`; `anon`/PUBLIC revoked entirely (guest cart is localStorage-only) |
| `customer_addresses` | CRUD policies `auth.uid() = user_id`, plus a partial unique index guaranteeing one default per user |
| `orders` | One SELECT policy `auth.uid() = user_id`; INSERT/UPDATE/DELETE revoked — customers physically cannot write orders |
| `order_items` | SELECT only where the parent order's `user_id = auth.uid()`; writes revoked |
| catalogue | Public SELECT policies restricted to active rows (`001`) + admin CRUD policies (`004`) |
| `commerce_settings` | RLS on, **no policies**, all grants revoked — browser-invisible |

Customer A cannot read or write customer B's profile, cart, addresses or orders at either layer. On top of RLS, `src/lib/account/orders.ts` filters by session `user_id` and returns the *same* not-found state as a non-existent order, so a hand-edited URL leaks nothing — not even existence.

**Admin boundaries.** Every admin read and write goes through the five `009` RPCs, each beginning `if not coalesce(public.is_admin(), false) then raise exception` (fail-closed). Catalogue admin writes (`004`) are policy-based on `is_admin()`. **No admin path relies on frontend guards alone.** `AdminRoute` and `AuthenticatedRoute` are convenience only.

**SECURITY DEFINER review (7 functions, all with `set search_path = public, pg_temp`):**

| Function | Purpose | Caller check | Trusts caller-supplied user id? | Server-authoritative? |
|---|---|---|---|---|
| `preview_cart_order()` (`008`) | server-side cart/totals preview | `auth.uid()` → raises `not_authenticated` | no | yes — prices, stock and totals re-read from the DB |
| `create_order_from_cart(uuid, text)` (`008`) | atomic checkout | `auth.uid()` required; `p_address_id` must belong to that user | no | yes — all money and inventory computed server-side |
| `admin_list_orders(text, text, text, int, int)` (`009`) | admin search/list | `is_admin()` fail-closed | n/a (filters only) | n/a |
| `admin_get_order(uuid)` (`009`) | admin detail | `is_admin()` | n/a — reading any order is the point | n/a |
| `admin_set_order_status(uuid, text)` (`009`) | fulfilment transitions | `is_admin()` | n/a — validated against the transition map | status only from the allowed set |
| `admin_set_order_payment_status(uuid, text)` (`009`) | manual payment | `is_admin()` | n/a | status from the allowed set; sets/clears `paid_at` |
| `admin_order_stats()` (`009`) | dashboard counts | `is_admin()` | n/a | aggregates real rows only |

Non-definer helpers reviewed: `set_updated_at()` (plain trigger, no privilege use) and `profiles_guard_update()` (plain trigger; see Low below).

**Grants.** `execute` on both checkout functions and all five admin functions is granted to `authenticated` only, revoked from `public`/`anon`. `commerce_settings` and `order_number_seq` are revoked from every client role. `orders`/`order_items` grant SELECT only. Nothing unexpectedly broad was found; the widest grants are `cart_items` (CRUD to `authenticated`, correctly scoped by RLS) and `profiles` (select + two-column update).

**Secrets.** `.env` contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; it is listed in `.gitignore:23`; zero matches for `service_role` or `paystack`. No secret is bundled into the client.

**Issues by severity:**
- **Critical:** none found in the schema, policy or grant layer.
- **High:** (1) production deep links return 404 for every route except `/` — an availability/correctness issue rather than an RLS one, but it makes the app effectively single-entry and blocks Paystack callbacks (**fixed in the repo** by `vercel.json` + `base: '/'`; confirm on production after deploy); (2) **no server-side secret store exists yet**, recorded now so Phase F does not put a Paystack secret into a `VITE_*` variable.
- **Medium:** (1) `admin_set_order_payment_status` lets any admin set `paid` with no reference and no attribution — F's `payment_source` field should close this; (2) no admin action log, so an incorrect manual status change leaves no trace; (3) `orders.user_id … on delete cascade` removes order history when a customer is deleted, which is an accounting/reconciliation risk.
- **Low:** `profiles_guard_update` blocks role escalation by inspecting `current_user`; if a future SECURITY DEFINER function ever updates `profiles.role`, `current_user` becomes the owner and the guard passes silently (no such function exists today). Also Low: `AuthenticatedRoute` preserves only `location.pathname`, dropping query/hash from the intended destination.

### Production Environment

**Current frontend env vars (both client-safe, the only ones the app reads):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env` is gitignored; **there is no `.env.example`**, and no other env access exists in `src` (`import.meta.env` touches only these two).

**Future server-only vars (do not create yet — they belong to Supabase Edge Function secrets, never Vercel client env):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_PUBLIC_KEY` (only if an inline client flow is chosen), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a `SITE_URL` used to build the callback URL.

**Vercel — exact env vars that must exist:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, scoped to Production and Preview. No service-role key and no Paystack secret may ever be added to Vercel's client environment. Build command `npm run build`, output `dist`.

**Hosting config gap (at investigation time):** there was **no `vercel.json`**, and `public/_redirects` (a Netlify convention, ignored by Vercel) is the only rewrite present. Combined with `base: './'` in `vite.config.ts` — which emits `./assets/index-*.js` — the SPA fallback is both missing and, once added, would still resolve assets against the wrong directory on multi-segment paths. Both must change together. **Status (sprint `Vercel SPA Deep-Link Routing Fix`):** both changed — `vercel.json` now rewrites `/(.*)` to `/index.html` (filesystem files still win, so `/assets/*` is preserved) and `base: '/'` emits root-absolute `/assets/...`; `public/_redirects` intentionally left in place, still inert.

**Supabase Auth URLs** (permanent public domain is `https://theproxyshop.vercel.app`):
- Site URL: `https://theproxyshop.vercel.app`
- Redirect allow-list: `https://theproxyshop.vercel.app/**` and `http://localhost:5173/**` (for local development)
- Explicit production URLs that should be covered: `https://theproxyshop.vercel.app/**` covers `/account`, `/account/orders`, `/checkout`, `/order-confirmation/*` and the future `/payment/callback`; list `/login` and `/signup` explicitly if the dashboard prefers exact entries.
- Note: `supabase.auth.signUp` is called **without `emailRedirectTo`** and there is **no password-reset flow anywhere**, so confirmation/reset emails (if enabled) would fall back to the Site URL.

### Failure Paths

| # | Scenario | Current behaviour | Status | Phase |
|---|---|---|---|---|
| 1 | Cart stock changes before checkout | preview surfaces it, Place Order revalidates, RPC re-checks stock under lock | protected | — |
| 2 | Price changes before checkout | totals recomputed server-side at preview and again at Place Order | protected | — |
| 3 | Two users buy the last item | `for update of v` row locks + stock check + `stock >= 0`; the loser receives `insufficient_stock` | protected | — |
| 4 | Order creation fails midway | single transaction — order, items, stock and cart clear all roll back | protected | — |
| 5 | Cart clearing fails | the clear is inside the same transaction, so it cannot partially apply; only the post-success UI refresh can fail, leaving a stale badge until reload (cosmetic) | mostly protected | H |
| 6 | Customer refreshes order confirmation | the read query re-runs by order number, **but the URL itself returns 404 in production** | **not protected** | H1 |
| 7 | Payment callback visited twice | no callback exists yet | n/a | F2 |
| 8 | Webhook delivered twice | no webhook exists | n/a | F3 |
| 9 | Callback succeeds, browser closes before return | order stays `unpaid` until an admin marks it — correct today, insufficient once automation exists | manual by design | F3 |
| 10 | Payment succeeds, webhook arrives later | same as above; nothing reconciles automatically | n/a | F3 |
| 11 | Admin marks payment incorrectly | allowed and unaudited; `paid_at` is set/cleared correctly, ConfirmDialog is the only friction | partly protected | G/H decision |
| 12 | Order cancelled after stock was deducted | nothing is restocked; an explicit blocker is shown | by design | G2 |
| 13 | Customer opens another customer's order number | RLS plus session filter → identical not-found state, no existence leak | protected | — |
| 14 | Expired/invalid session during checkout | the RPC raises `not_authenticated`; page guards redirect to `/login`; nothing is written | protected | — |
| 15 | Network failure during order placement | generic error, cart intact; a lost response cannot duplicate the order because the cart was cleared in the same transaction, so a retry fails with `cart_empty`. Re-adding items then creates a legitimate new order. An explicit idempotency key is still wanted for payment initialisation | protected (incidentally) | F1 |

### Invoice

- **Data source:** `src/lib/orders/invoice.ts`. `downloadOrderInvoice(order)` builds from an already-loaded `OrderDetail`; `downloadOrderInvoiceByNumber(userId, orderNumber)` fetches through `getMyOrder(userId, …)` — the customer's normal RLS-scoped query — then builds. No URL parameters, no service role, no bypass.
- **Uses order snapshots:** yes. Lines come from `order_items` (`product_name`, `size`, `colour`, `variant_sku`, `unit_price`, `quantity`, `line_total`) and delivery from the order's address snapshot. The catalogue is never consulted, so a renamed, repriced, archived or deleted product cannot alter a past document.
- **Reflects current state at download time:** yes. The PDF is generated fresh on every click — nothing is generated or stored at checkout — so an Admin change to payment or fulfilment appears in the next download.
- **Unpaid invoice is clearly unpaid:** yes. A bordered banner reads `PAYMENT STATUS: UNPAID` (or `FAILED` / `REFUNDED`) as **text, not colour alone**, order and payment status are both printed in the order block, and the footer states "This document does not confirm payment." for any non-paid state. Paid documents carry the paid banner instead of that line.
- **Totals come from the order record:** yes — `order.subtotal`, `order.shippingAmount`, `order.taxAmount` (only when > 0), `order.totalAmount` and `order.currency`, i.e. the same record the CHECK constraint guarantees is internally consistent.
- **Another customer's invoice cannot be fetched:** correct — RLS plus the `user_id` filter; a missing order throws a generic message. No order data is ever accepted from a URL.
- **Unsafe mechanisms:** none. No screenshots, no page rasterising, no `html2canvas` over the UI, no third-party PDF service. The PDF is built from structured data with dynamically-imported jsPDF.
- **Bundle impact:** the eager bundle is unaffected (jsPDF is dynamic), but a first invoice click pulls ~798 kB (jspdf + html2canvas + purify + index.es). Acceptable, worth noting for H2.
- **Correctness issues flagged:** none affecting payment honesty. Presentational notes only: jsPDF's standard fonts are ASCII-only, so the cedi sign is transliterated to `GHS` (deliberate), and product images are not embedded in the PDF (they are shown in the on-screen order views).

### Auth Redirects

- **Return-to-intended-route works.** `AuthenticatedRoute` navigates to `/login` with `state={{ from: location.pathname }}`; `CustomerLogin` reads that state, defaults to `/account`, and after a successful sign-in navigates there with `replace`; the signup link forwards the same state; `CustomerSignup` also navigates to the intended destination once a session exists. Login and signup are both correct for a guest who clicked "Proceed to Checkout".
- **`/checkout` survives the auth redirect:** yes (path only). If a query string is ever added to `/checkout`, it would be dropped — relevant when the Paystack return URL carries parameters, so F should plan for it.
- **Absolute/hardcoded development URLs:** none in `src` — no `localhost`, no `127.0.0.1`, no `window.location.origin`, no third-party domain. `index.html` canonical and OG tags correctly use `https://theproxyshop.vercel.app/`.
- **Production routes that break on refresh:** **all of them except `/`** — verified 404 for `/shop`, `/checkout` and `/order-confirmation/TPS-2026-000001`. This is the highest-priority fix in the whole report. **Status:** fixed in the repo (sprint `Vercel SPA Deep-Link Routing Fix`); hard-refresh re-verification still pending a production deploy.
- **Does `public/_redirects` cover SPA routing?** No — it is Netlify-only syntax that Vercel ignores, and its `/collections → /shop 301` rule points at a route `App.tsx` does not define.
- **Paystack callback path to create in Phase F:** a stable, single-segment `/payment/callback` (loadable only once the SPA fallback exists). It must tolerate being visited twice, by a different session, or with missing/forged parameters, and must verify server-side.
- **Supabase Auth redirect URLs to configure:** Site URL `https://theproxyshop.vercel.app`; allow-list `https://theproxyshop.vercel.app/**` plus `http://localhost:5173/**`; and no `emailRedirectTo` is passed in code today.

### Placeholder Claims

Searched `src` for shipping guarantees, delivery times, free returns, tax claims, payment-provider claims, security claims, promo/discount claims and fake tracking language. **No "secure checkout", "free returns", "fast shipping", "nationwide delivery" or tax-percentage claims remain** — E1's cleanup holds. Remaining unsupported copy:

| File | Copy | Supported by current functionality? | Recommended action |
|---|---|---|---|
| `src/components/Footer.tsx` | "We accept" + Visa / Mastercard / MTN MoMo / **Paystack** badges | **No** — no payment collection of any kind exists | **Remove or defer** until Phase F ships; the Paystack badge is a false claim today |
| `src/components/Footer.tsx` | Shop links "New Arrivals", "Best Sellers", "**Sale**" → `href="#"` | No — no sale or discount mechanism exists | Remove "Sale"; point the others at real routes or remove |
| `src/components/Footer.tsx` | "FAQ", "Shipping & Returns", "Size Guide", "Terms & Conditions", "Careers" → `href="#"` | No — the pages do not exist, and "Shipping & Returns" implies a policy that is unconfirmed | Defer until the pages and policies exist |
| `src/components/Footer.tsx` | Social links Instagram / Facebook / Twitter → `href="#"` | No real accounts linked | Defer |
| `src/pages/Contact.tsx` | Submit handler awaits a 1-second `setTimeout` then shows "Thank you! We'll get back to you soon." | **No** — nothing is sent or stored; the message is silently discarded | **Must fix before launch**: real endpoint, or an honest interim (mailto/WhatsApp) |
| `src/pages/Home.tsx`, `src/pages/Blog.tsx` | Newsletter email inputs | Partly — `newsletter_subscribers` has a public INSERT policy; verify the forms actually write | Verify, then keep or remove |
| `src/lib/aboutContent.ts` | `pendingImageUrl` pointing at a Pinterest pin page | No — not a direct image URL | Defer (cosmetic; the page already falls back) |
| `src/pages/Cart.tsx` | Subtotal-only totals (the old ₵50 delivery and "Tax (10%)" placeholders were removed in E1) | Correct — matches the server totals on `/checkout` | Keep |
| `index.html` | Canonical / OG / Twitter absolute URLs | Yes | Keep |
| `public/og-image.png` | 901.15 kB image | Yes, but heavy | Compress (H2) |
| `index.html` | Google Fonts loaded from `fonts.googleapis.com` | Yes, but an external rendering/privacy dependency | Keep, or self-host later |

### Recommended H1 / H2 / H3 split

**H1 — Deployability (blocking, no new features).**
Fix the every-route 404: add `vercel.json` with a SPA rewrite and change `vite.config.ts` to `base: '/'` — **done (sprint `Vercel SPA Deep-Link Routing Fix`); the remaining H1 step is the hard-refresh-verify every route after deploy**, and re-verify the guest → login → `/checkout` → confirmation chain at the real URL. Replace the Contact form's fake success with something honest. Remove the false payment badges (and "Sale") from the footer. Register the Supabase Auth Site URL and redirect allow-list; confirm the two Vercel env vars. Smallest, highest-value chunk — and it unblocks Phase F.

**H2 — Performance and polish.**
Route-level `React.lazy` with a `Suspense` fallback, Admin first, then Account/Checkout/Orders. Compress or replace `logo.png` (730.92 kB), `founder.png` (654.77 kB), `FAVICON.png` (216.55 kB) and `og-image.png` (901.15 kB) with WebP/SVG and lazy-load the About asset. Optionally stop jsPDF's html2canvas/purify companions from being fetched for a text-only document. Re-measure with the same build command.

**H3 — Hardening and housekeeping.**
A real 404/error route; `.env.example`; password reset; session-expiry UX during checkout; an admin action log; CI running `typecheck`, `lint` and `build` (no `.github/workflows` exists today); documentation of the missing `003`/Phase A migration; and the remaining footer/nav dead links.

---

## Database / Migration Gaps

Genuine gaps discovered, in priority order:

1. **The repo cannot rebuild the database from scratch.** `supabase/migrations/003_*.sql` is absent and the Phase A migration that creates `profiles`, `is_admin()` and the signup trigger is not in this repository, yet `005`, `006` and `009` depend on it — `009` explicitly raises if `public.is_admin()` is missing. A new environment therefore needs out-of-repo SQL that is not versioned here.
2. **No payment reference / provider / channel / source columns**, and no payment attempt or webhook-event ledger — Phase F.
3. **No shipment fields** (`carrier`, `tracking_number`, `tracking_url`, `delivery_note`) — Phase G1.
4. **No restock marker** (`restocked_at`) and no inventory-adjustment ledger — Phase G2, and only after the owner confirms the rule.
5. **No payment attribution:** `paid_at` records when, but not by whom or through which channel.
6. **No scheduled-job surface** (pg_cron or cron function) for unpaid-order expiry.
7. **`orders.user_id` is `on delete cascade`** — deleting a customer erases their order history, which conflicts with any reconciliation, refund or restock flow.
8. **No migration needed for H1 or for the invoice** — verified: presentation and deployability changes only.

---

## Production Configuration Checklist

**Vercel → Environment Variables (Production *and* Preview):**
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Never `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY` or any other secret as a `VITE_*` variable

**Vercel → hosting / build:**
- [x] Add `vercel.json` with a SPA rewrite to `/index.html` (excluding `/assets/*`) — done (sprint `Vercel SPA Deep-Link Routing Fix`); the rewrite is `/(.*)` → `/index.html`, and Vercel serves filesystem files first, so `/assets/*` needs no exclusion
- [x] Change `vite.config.ts` `base: './'` → `base: '/'` — done (same sprint); `dist/index.html` now emits `/assets/...`
- [ ] Confirm build command `npm run build` and output directory `dist` (repo side confirmed in `package.json`/`vite.config.ts`; confirm the Vercel project settings match)
- [ ] Decide whether to keep `public/_redirects` (inert on Vercel); `/collections → /shop` has no matching route
- [ ] Hard-refresh test every route after deploying: `/`, `/shop`, `/product/:slug`, `/about`, `/blog`, `/contact`, `/cart`, `/checkout`, `/order-confirmation/:orderNumber`, `/account/*`, `/admin/*` — **blocked until Vercel redeploys the fix**

**Supabase → Auth → URL configuration:**
- [ ] Site URL: `https://theproxyshop.vercel.app`
- [ ] Additional redirect URLs: `https://theproxyshop.vercel.app/**`, `http://localhost:5173/**`
- [ ] Decide the email-confirmation policy (no `emailRedirectTo` is passed in code)

**Supabase → database:**
- [ ] Apply `008_orders_checkout_foundation.sql`, then `009_admin_order_operations.sql`, in order
- [ ] Confirm `public.is_admin()` exists (Phase A) before `009`; run `notify pgrst, 'reload schema';` afterwards if PostgREST does not see the new tables or functions
- [ ] Confirm `commerce_settings` values match the owner's shipping/tax answers before charging anyone
- [ ] Locate and archive the out-of-repo Phase A / `003` SQL

**Supabase → Edge Functions (Phase F, later):**
- [ ] Secrets: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`
- [ ] Deploy `initialize-payment`, `verify-payment` and (F3) `paystack-webhook`

**Paystack dashboard (Phase F, later):**
- [ ] Callback URL `https://theproxyshop.vercel.app/payment/callback`
- [ ] Webhook URL `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`
- [ ] Separate test and live keys

**Repository:**
- [ ] Add `.env.example` documenting the two public keys only
- [ ] Add a CI workflow running `npm run typecheck && npm run lint && npm run build`

---

## Decisions Still Required From Owner

**Carried over from E1–E3 (still unanswered, so the code keeps its disclosed defaults):**
1. **Shipping** — is the former ₵50 real? Fixed fee, by city/region, or free above a threshold? (`commerce_settings` is still 0.)
2. **Tax** — is the 10% real, and are catalogue prices tax-inclusive or tax-exclusive? (Currently 0% with `prices_include_tax = true`.)
3. **Stock reservation** — deduct at order creation (current behaviour), or only when payment is confirmed?
4. **Payment before Paystack** — how will customers actually pay (bank transfer, MoMo, cash, manual confirmation), and which channels launch first?
5. **Unpaid expiry** — auto-expire after 24h/48h, or admin-cancelled only?
6. **Cancellation** — may customers cancel pending orders themselves?
7. **Delivery** — fixed national delivery, region-based pricing, or pickup?
8. **Returns** — is "free returns within 30 days" an actual policy? (Nothing in the code claims it now.)
9. **Payment reference** — should Admin record a MoMo/bank reference and note?
10. **Shipment tracking** — will a courier name and tracking number be entered manually?

**New from this investigation:**
11. Should marking Paid automatically move Pending → Confirmed, or stay fully independent?
12. Should Paid → Unpaid reversal be a normal action, or require a special one?
13. What should happen to stock when an **unpaid** order is cancelled (today: nothing)?
14. Should a cancelled paid order become Refunded automatically, or stay Paid until a refund is confirmed?
15. Do we need internal Admin notes per order, and an Admin action log?
16. Which statuses should customers see versus internal-only ones?
17. Which real inbox or channel should the Contact form deliver to once it stops being a mock?
18. Should the footer keep payment-method badges before any payment method exists?
19. Should deleting a customer account be allowed to erase their order history (currently `on delete cascade`), or should orders be retained?

---

## Priority Matrix

**Must before real payments:**
- ~~Fix every-route 404 (SPA rewrite + `base: '/'`)~~ **done in repo** (sprint `Vercel SPA Deep-Link Routing Fix`) — re-verify in production after deploy; a Paystack callback URL could not be loaded before this
- Create a real server-side secret store (Supabase Edge Function secrets) and keep secrets out of `VITE_*`
- Add `payment_reference`, `payment_source`/`payment_provider`/`payment_channel` and an idempotency ledger
- Verify amounts server-side against `orders.total_amount` before any payment is accepted
- Owner decisions 1–5 (shipping, tax, stock timing, payment channel, expiry) — these determine what is charged and when inventory moves

**Must before launch:**
- Fix every-route 404 and verify every route by hard refresh — **fix committed, production hard-refresh verification still pending deploy**
- Stop the Contact form silently discarding messages
- Remove the false payment-method badges (and "Sale") from the footer
- Register Supabase Auth Site URL and redirect allow-list
- Confirm Vercel env vars exist; add `.env.example`
- Apply `008` then `009` on the production project
- Resolve the shipping/tax values — 0 delivery and 0 tax are what customers would be charged today

**Can defer:**
- Route-level code splitting and image compression (H2)
- Shipment carrier/tracking fields (G1) until couriers are actually used
- Restock-on-cancel and unpaid-order expiry automation (G2) until decisions 3, 5 and 13 are answered
- 404 route, CI workflow, password reset, admin action log, remaining footer dead links (H3)
- Newsletter polish, About image, `og-image.png` compression

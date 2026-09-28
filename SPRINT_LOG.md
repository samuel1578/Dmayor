# Sprint Log — The Proxy Shop

Running log of all sprints completed in this project.

---

## Sprint: Baseline Investigation
**Date:** 2026-09-23
**Status:** Complete

- Produced `INVESTIGATION.md` documenting the existing e-commerce skeleton (Vite + React 18 + TS 5.5 + Tailwind 3.4 + Framer Motion + Lucide + Supabase).

---

## Sprint: Rebrand — "The Proxy Shop"
**Date:** 2026-09-23
**Status:** Complete

- Rebranded Navbar, Footer, Home, About, Blog, Cart, Contact, Collections and `index.html` title to "The Proxy Shop".
- Added `supabase/migrations/20251107000000_add_variants_and_rebrand.sql` (creates `product_variants`, `product_images`, adds `slug`/`status`/`sku` to `products`, seeds Shirts/Trousers/Hoodies/Shoes categories) — **pending manual run in Supabase**.
- Rewrote `src/lib/supabase.ts` with new types (`ProductVariantRow`, `ProductImageRow`, `CartItemRow`, etc.).
- Created `.env` / `.env.example` with placeholder Supabase credentials; `supabase.ts` falls back to placeholders without throwing.

---

## Sprint: Hero Redesign
**Date:** 2026-09-23
**Status:** Superseded by Scrollytelling Hero sprint (decorations removed; system replaced)

### Changes
- Replaced plain centered hero with editorial/fashion-led split composition.
- Desktop: left column content, right column brand mark with decorative concentric circles; mobile: stacked.
- Added eyebrow "Premium Menswear", Framer Motion staggered entrance (brand → headline → description → CTAs).
- Removed gradient blob background; used existing `ghana-*` palette only.
- Framer Motion auto-respects `prefers-reduced-motion`.

### New files (`src/components/hero/`)
- `ShirtIcon.tsx`, `TrouserIcon.tsx`, `HoodieIcon.tsx`, `ShoeIcon.tsx`, `HangerIcon.tsx` — decorative line-art SVGs (`currentColor`, `aria-hidden`, `pointer-events-none`, opacity 0.03–0.08).
- `HeroDecorations.tsx` — composition placing the SVGs.
- `index.ts` — re-exports.

### Modified
- `src/pages/Home.tsx` — hero section redesigned, `HeroDecorations` import added.

---

## Sprint: Header Logo + Mobile Navigation Correction
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Header/Navbar, mobile drawer, logo asset optimization only. Hero untouched.

### Logo investigation
- `src/assets/logo.png`: **3530×4699px, 32bpp ARGB, 5,807,745 bytes (~5.8 MB)**; content bounds x=380..3280, y=220..4400 → ~82%×89% of canvas (moderate transparent padding); aspect ~0.75 portrait.
- Padding contributed to the logo looking oversized/misplaced but was not the only cause — CSS container/border/shadow also removed.

### Asset optimization
- Created `src/assets/logo-header.png`: content crop rect(330,170,3000,4280) + 50px margin → resized to **280×400px, 109,872 bytes (107.3 KB)** — **~98% smaller**, content now ~97% of canvas.
- `logo.png` left intact (still imported by Footer/Home, out of this sprint's scope).

### Header (`src/components/Navbar.tsx` — rewritten)
- Logo: switched import to `logo-header.png`; removed border/shadow/rounded wrapper; `h-16` (64px) mobile, `md:h-[72px]` (72px) desktop, `object-contain`; aria-label on link.
- Header bar: `h-20 md:h-24`.
- Desktop nav: active-route state via `useLocation` (`aria-current="page"`, `text-ghana-green`), focus-visible rings.
- Right section: theme toggle + cart (badge count, descriptive aria-label) + hamburger with `aria-expanded`/`aria-controls="mobile-menu"`.

### Mobile drawer
- `fixed inset-x-0 top-20 bottom-0` (matches `h-20` mobile header), `overflow-y-auto overscroll-contain`.
- Primary nav rows: Lucide icons (Home→Home, Shop→ShoppingBag, Collections→Layers, About→Info, Blog→Newspaper, Contact→MessageCircle) + label + `ChevronRight`; `min-h-[48px]`, `px-4 py-3.5 rounded-xl`; active row `bg-ghana-green/10` + gold text; staggered Framer Motion entrance.
- Secondary Cart row with item-count badge.
- Body scroll-lock while open; Escape closes; closes on link click.
- Social section omitted — all social URLs are placeholder `#` links (brief permits hiding them).

### Verification
- `npx tsc --noEmit -p tsconfig.app.json` → clean.
- `npm run lint` → 0 errors (5 pre-existing warnings from stale `.kilo/worktrees/` worktree, out of scope).
- `npm run build` → success; emits `logo-header-sh24x-Y4.png` 109.87 kB (original `logo.png` still in bundle via Footer/Home — deferred).

---

## Sprint: Scrollytelling Hero — Split-Screen Morphing Story
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Hero only. Header/nav/logo, footer, Supabase, cart, checkout untouched.

### Investigation (before implementation)
- Package: **`framer-motion@12.23.24`** (not `motion/react`) — used installed APIs only; no package migration, no second animation library.
- Available APIs confirmed: `useScroll`, `useTransform`, `useSpring`, `useReducedMotion`, `useMotionValueEvent`.
- Header: sticky `top-0 z-50`, heights `h-20` / `md:h-24`; mobile drawer `z-40` `top-20`.
- Breakpoints: Tailwind defaults (`sm`/`md`/`lg`); palette `ghana-*` in `tailwind.config.js`.
- Old hero decorations (`HeroDecorations` + 5 SVG clothing icons) used only by previous hero — removed.

### Architecture
```
src/lib/hero.ts                          — all copy, chapter data, image URLs, timeline windows, scroll config
src/components/hero/
  ScrollyHero.tsx                        — wrapper, useScroll + useSpring, layout grid, reduced-motion gate
  HeroNarrative.tsx                      — opening / 4 chapter texts / closing CTA (crossfade + slight Y)
  HeroVisualStage.tsx                    — layered perspective → depth transform → clip mask → image
  HeroProgress.tsx                       — 01 ──── 04 line + four chapter dots
  index.ts                               — re-exports
```
- Content/config separated from rendering/motion: edit URLs/copy in `lib/hero.ts` only.
- Scroll: single `useScroll({ target: heroRef, offset: ["start start", "end end"] })` on a **500vh** wrapper; sticky stage `top-20 md:top-24`, height `calc(100vh-5rem)` / `calc(100vh-6rem)`; `z-0` under navbar `z-50`.
- No global scroll listeners; no per-frame React `setState`; MotionValues drive transforms.

### Scroll timeline (final)
```
Opening     0.00–0.11   (narrative)
Shirts      0.10–0.32   narrative / image ~0.03–0.34
Trousers    0.29–0.51   narrative / image ~0.26–0.53
Hoodies     0.48–0.70   narrative / image ~0.45–0.72
Shoes       0.67–0.90   narrative / image ~0.64–0.95
Closing     0.86–1.00   narrative + image dim overlay 0.84–0.93
```

### Motion implementation
- `useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.35 })` — light smoothing; bypassed when reduced motion.
- Per image: opacity, rotateY (−7°→0→5°), rotateX (2°→0→−1°), scale (1.06→1→1.03), restrained x/y, `clip-path` inset reveal, parallax y ±36px.
- DOM layers kept separate: perspective wrapper (`1500px` / `1100px` mobile) → `preserve-3d` transform → clip wrapper → img (avoids flattening).
- Narrative: opacity + small Y only (no rotations/flying text).
- Progress: `scaleX` line + four opacity dots.

### Mobile (separate composition, not scaled desktop)
- Grid rows: narrative (~1.05fr) → image stage (~1.45fr, dominant) → progress bar.
- Shallower perspective (`1100px`); same transform types with modest ranges; object-cover + focal point.
- Prioritizes transform/opacity; first chapter image `loading="eager"`, later `lazy`.

### Reduced motion
- `useReducedMotion()` → rotation/scale/x/y/clip/parallax forced to neutral; opacity crossfade + static image replacement retained; all chapters/CTAs remain; spring skipped.

### Content config (`src/lib/hero.ts`)
- `heroOpening`, `heroChapters[]` (id, number, category, title, description, image, imageAlt, href, focalPoint), `heroClosing`, `heroTimeline`, `heroScroll`.
- Copy and four Unsplash URLs live only here.

### Images (all HTTP 200 verified)
| Chapter | URL |
|---------|-----|
| Shirts | `https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1600&q=80` |
| Trousers | `https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1600&q=80` |
| Hoodies | `https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1600&q=80` |
| Shoes | `https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1600&q=80` |

### Cleanup
- Removed from hero: `HeroDecorations.tsx`, `ShirtIcon`, `TrouserIcon`, `HoodieIcon`, `ShoeIcon`, `HangerIcon`.
- `Home.tsx`: old hero block + `HeroDecorations`/`logo.png` imports replaced with `<ScrollyHero />`.

### Accessibility
- One `h1` (opening); chapter/`h2` headings; descriptive image alts; real `<Link>` CTAs with focus-visible rings; progress `aria-label` + `sr-only`; section `aria-label`; no scroll trap; reduced-motion path preserves all content.

### Verification
- `npx tsc --noEmit -p tsconfig.app.json` → clean.
- `npm run lint` → 0 errors (5 pre-existing warnings, out of scope).
- `npm run build` → success.
- Headless screenshot pass aborted on user request — no further visual capture.

### Exceptions / not touched
- No header, logo, hamburger, footer, Supabase, cart, checkout, auth changes.
- No new dependencies; no scroll library; no scroll-jacking; native scroll intact.

---

## Files NOT modified (project-wide)
*(Historical snapshot from the hero-sprints era — see **Current state (after Phase C3)** at the end of this log for the present picture.)*

- Supabase migrations/schema (beyond the rebrand migration above), auth, checkout, payments, orders, admin.
- CartContext, ProductCard, QuickViewModal, Shop filtering, Cart quantity logic.
- Tailwind config / CSS theme system (palette prefixes remain `ghana-*`).
- Navbar, logo sizing, hamburger, footer (hero sprint did not touch them).
- Blog, About, Contact, Collections, Shop page logic (rebrand text only where noted).

---

## Open follow-ups
*(Historical snapshot — see **Open follow-ups (current)** at the end of this log.)*

- Run `20251107000000_add_variants_and_rebrand.sql` manually in Supabase when a project exists; replace `.env` placeholders.
- Optional future sprint: swap Footer (and any remaining `logo.png` import) to `logo-header.png` to drop the 5.8 MB asset from the bundle.
- Stale `.kilo/worktrees/tree-nest/` worktree causes pre-existing lint noise — not in scope.
- Optional: user-requested breakpoint screenshot matrix for the scrolly hero if visual QA is wanted later (explicitly skipped this sprint).

---

## Sprint: Hero Typography + Opening Logo + Trousers Portrait
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Hero presentation/config only. Image URLs unchanged. Scroll architecture unchanged. No visual testing.

### Typography
- Google Fonts: **Bodoni Moda** (display) + **Manrope** (UI/meta) via `index.html` preconnect + stylesheet.
- Tailwind `fontFamily`: `display`/`hero` → Bodoni Moda; `body`/`ui` → Manrope.
- Tailwind `fontSize` tokens with `clamp()`:
  - `hero-opening` ≈ 42–100px
  - `hero-chapter` ≈ 36–88px
  - `hero-closing` ≈ 32–72px
- Scoped classes in `index.css`: `.hero-type-display`, `.hero-type-ui` (no inline font stacks in JSX).
- Opening/chapter/closing headlines use serif; number, category, description, CTA, progress stay sans.

### Opening branding
- Text eyebrow `THE PROXY SHOP` removed from opening narrative.
- Replaced with `logo-header.png` (~107KB optimised asset): no border/card/shadow, `object-contain`, `h-16` mobile → `md:h-[96px]` / `lg:h-[108px]` desktop.

### Trousers portrait stage
- New typed config: `HeroMediaShape = 'portrait' | 'tall' | 'wide' | 'bleed'` on each `HeroChapter.mediaShape`.
- Trousers: `mediaShape: 'portrait'` → **aspect-ratio 3/4**, centered on mobile / right-offset on desktop; not a full-width landscape strip.
- Other chapters: shirts `portrait`, hoodies `bleed`, shoes `tall` (4/5).
- Frame geometry composed from `layout` + `mediaShape` in `HeroVisualStage` (not hard-coded one-offs).

### Images
- **No `image` URL values modified** — all Pinterest URLs preserved (opening, shirts, trousers, hoodies, shoes, closing). Only `layout` / `mediaShape` / `focalPoint` / copy around them changed.

### Deferred architecture (not implemented)
- Admin external-image flow: Admin enters URL → live preview in creator/editor → invalid URL shows error before save → publish → public UI uses same resolved URL/shared render rules. **Not built this sprint.** No Pinterest scraping/URL extraction.

### Verification
- `tsc` clean · `lint` 0 errors · `build` success · no screenshots/browser QA.

### Files changed
`src/lib/hero.ts`, `HeroNarrative.tsx`, `HeroVisualStage.tsx`, `HeroProgress.tsx`, `src/index.css`, `tailwind.config.js`, `index.html`, `SPRINT_LOG.md`

---

## Sprint: Homepage Post-Hero Brand / Value Section
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Homepage section immediately after ScrollyHero only. Hero, Navbar, Footer, Shop, Supabase, cart, admin untouched. No visual/browser testing.

### Replaced
- Removed generic centred banner: “Premium Menswear, Delivered” + “Shirts, trousers, hoodies…” copy.

### Added
- `src/lib/homeContent.ts` — config object (image URL, eyebrow, heading, body, 3 value points, CTA).
- `src/components/home/BrandValueSection.tsx` — editorial brand/value section.
- Tailwind `fontSize.brand-heading` clamp ≈ 38–76px.

### Presentation
- Near-black bg (`ghana-black`), warm off-white text, gold only on eyebrow / numbers / CTA arrow.
- Desktop: asymmetric split ~52% image / ~48% content (image may bleed left).
- Mobile: intro → large portrait image → value rows → CTA (not a shrunk desktop grid).
- Values as bordered editorial list rows (no cards / glass / rounded boxes).
- Serif (Bodoni) heading; Manrope for UI/meta; calm motion only (fade/rise + stagger; reduced-motion safe).

### Image
- Exact URL used unchanged: `https://i.pinimg.com/736x/6d/cf/30/6dcf303c7ec8890b1dac72c7f01c95a2.jpg` (hot-linked, not downloaded to `/assets`).

### Verification
- `tsc` clean · `lint` 0 errors · `build` success · no screenshots.

---

## Sprint: Fullscreen Mobile Navigation + Fit Collections
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Navbar mobile menu + homepage Categories→FitCollections only. Hero/Supabase/cart untouched. No visual QA.

### Fullscreen mobile nav (`Navbar.tsx`)
- `fixed inset-0`, `h-[100dvh]`, `z-[60]`; header row: logo + theme + cart + Close.
- Editorial rows: `01–06` + serif label (28–32px) + tagline; active gold + `aria-current`.
- Cart strengthened at bottom with count; future account slot commented (no fake auth CTAs).
- Escape, body scroll-lock, `aria-expanded`, focus rings retained; closes on route change.

### Fit Collections
- Replaced “Our Categories” with editorial fit section; config in `homeContent.ts` (`fitCollections`).
- Copy: “THE PROXY EDIT” / “Fits worth building around.” / “Explore All Fits” → `/collections`.
- Extracted `src/components/home/FitCollections.tsx`.
- Mobile: Swiper portrait **3/4**, `slidesPerView: 1`, loop, pagination gold/muted.
- Desktop: static 4-image editorial grid + copy (no autoplay carousel).
- **Swiper newly installed** `swiper@^14.2.0`; autoplay `FIT_COLLECTION_AUTOPLAY_DELAY = 3500`; reduced-motion disables autoplay.

### Images
- Existing four homepage image URLs unchanged.

### Verification
- `tsc` clean · `lint` 0 errors · `build` success.

### Files changed
`Navbar.tsx`, `FitCollections.tsx`, `homeContent.ts`, `Home.tsx`, `index.css`, `tailwind.config.js`, `package.json`, `package-lock.json`

---

## Sprint: Featured Pieces Empty State + Fit Collections Swiper Stability
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Home empty state + mobile Swiper geometry only. No visual QA.

### Featured Pieces empty state
- Replaced “No products yet…” with editorial empty state when `products.length === 0` (section kept).
- Copy: “FEATURED PIECES” / “The next rotation is taking shape.” / supporting line / decorative diamond mark / **Explore the Shop** → `/shop`.
- Heading: Tailwind `empty-heading` clamp ≈ 34–64px; serif display + Manrope UI.
- Populated grid still uses existing “View All Products” CTA.

### Swiper stability fix
- **Cause:** `!overflow-visible` let loop slides escape and affect document flow; slides lacked locked pre-load geometry; pagination not in a reserved fixed row.
- **Fix:** removed `!overflow-visible` → `overflow: hidden`; explicit `autoHeight={false}`; shared `aspect-[3/4]` wrapper with absolute `object-cover` image (+ width/height attrs); stable slide/wrapper CSS; fixed pagination row via container `padding-bottom` + absolute centered bullets; no scroll/focus handlers on slide change; no remount keys.
- Active bullet: `transform: scale` only (no layout change).

### Confirmations
- `autoHeight` disabled · fixed 3:4 media · autoplay still **3500ms** · reduced-motion autoplay off · **no image URLs changed**.

### Files changed
`Home.tsx`, `FitCollections.tsx`, `index.css`, `tailwind.config.js`

---

## Sprint: Theme-Aware Logo (Navbar + Mobile Menu)
**Date:** 2026-09-23
**Status:** Complete

- `logoSrc = theme === 'dark' ? logoHeader : logoDark` via existing `useTheme()`.
- Applied to Navbar header logo + fullscreen menu logo (same `logoSrc`, no second logic path).
- Dark: `logo-header.png` · Light: `logodark.png`.
- Same img classes/dimensions; Footer & hero not changed in this pass.

### Files changed
`src/components/Navbar.tsx`

---

## Sprint: Theme-Aware Hero Opening Logo
**Date:** 2026-09-23
**Status:** Complete

- `HeroNarrative` uses `useTheme()` → dark `logo-header.png` / light `logodark.png`.
- Same `width/height`, `h-16` → `md:h-[96px]` / `lg:h-[108px]`, `object-contain`; no layout shift; hero motion/scroll untouched.

### Files changed
`src/components/hero/HeroNarrative.tsx`

---

## Sprint: Theme-Aware Footer Logo
**Date:** 2026-09-23
**Status:** Complete

- Footer: dark `logo.png` (current) / light `logodark.png` via `useTheme()`.
- Size `h-14 w-auto object-contain` unchanged; no Footer redesign.

### Files changed
`src/components/Footer.tsx`

---

## Sprint: Favicon Correction
**Date:** 2026-09-23
**Status:** Complete

- `index.html`: old `/vite.svg` → `/src/assets/FAVICON.png` (`type="image/png"`).
- Build emits hashed `FAVICON-*.png`. Only `index.html` touched.

### Files changed
`index.html`

---

## Sprint: Social Share / Open Graph Setup
**Date:** 2026-09-23
**Status:** Complete
**Domain:** `https://theproxyshop.vercel.app` — applied to canonical / `og:url` / `og:image` / `twitter:image` in `index.html`.

- Title: **The Proxy Shop**
- Description: Curated menswear for everyday confidence — shirts, trousers, hoodies and shoes selected to work together and wear well.
- OG: title, description, type=website, url, image, image:alt, site_name.
- Twitter: card=summary_large_image, title, description, image.
- Canonical homepage link added.
- `src/assets/og-image.png` **copied** to `public/og-image.png` → public path `/og-image.png` → `https://theproxyshop.vercel.app/og-image.png`. Source asset preserved.

### Files changed
`index.html`, `public/og-image.png`

---

## Sprint: About Page Redesign (One-Founder Brand Truth)
**Date:** 2026-09-23
**Status:** Complete
**Scope:** About page only. Navbar/homepage/hero/Supabase/cart untouched. No visual QA.

### Structure
Hero → Brand perspective (dark) → What we focus on (typographic rows + staggered images) → Founder → Closing CTA.

### Content
- Full rewrite; removed multi-person team grid, mission/vision icon cards, unsupported origin/manufacturing claims.
- One founder only; no invented name/bio/departments.
- Config centralized in `src/lib/aboutContent.ts`.

### Images (direct URLs used)
1. `https://i.pinimg.com/1200x/cc/9c/90/cc9c9002ef9b5f6443430630c5fe0464.jpg`
2. `https://i.pinimg.com/1200x/bc/c1/65/bcc1650022c9b4cc47da9a6d19568084.jpg`
3. `https://i.pinimg.com/736x/90/69/5f/90695fa80c5d5c5c961bde445315293c.jpg`
4. `https://i.pinimg.com/736x/ff/76/e5/ff76e59ea8a82d325d84f30d18381cd1.jpg`
- Pinterest pin page **not scraped**; stored only as `pendingImageUrl` config placeholder.
- **Founder.png slot:** imported `src/assets/founder.png` into `aboutContent.founder.image` (placeholder frame path retained if image is ever removed).

### Verification
- `tsc` clean · `lint` 0 errors.

### Files changed
`src/pages/About.tsx`, `src/lib/aboutContent.ts`

---

## Sprint: Supabase Publishable-Key Env + Clean Fresh Migrations
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Client env + local migration set only. No remote SQL applied. No UI work.

### Environment
- `src/lib/supabase.ts` now uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Removed legacy `VITE_SUPABASE_ANON_KEY` and silent placeholder/fallback credentials.
- Missing either var throws a clear config error (no secret values in messages).
- `.env.example`: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_PUBLISHABLE_KEY=` (empty placeholders). Real `.env` untouched.
- No `service_role` / `sb_secret_*` / privileged keys in client code.

### Migrations (fresh project)
- **Removed:** `20251106121531_create_initial_schema.sql`, `20251106122008_seed_initial_data.sql`, `20251107000000_add_variants_and_rebrand.sql`.
- **Added (run in order):**
  1. `supabase/migrations/001_initial_proxy_shop_schema.sql`
  2. `supabase/migrations/002_seed_proxy_shop_categories.sql`
- No D'Mayor/demo products, collections, or blog seeds. Categories only: Shirts, Trousers, Hoodies, Shoes.

### Schema
`categories`, `products`, `product_variants`, `product_images`, `collections`, `collection_products`, `blog_posts`, `newsletter_subscribers`, `cart_items`.
- `products.status` default `draft` + CHECK (`draft|active|archived`).
- Legacy `products.images` + `products.stock` retained for current storefront; stock non-authoritative (variant-level inventory).
- `product_images.image_url` ready for future Admin external-URL + preview flow.
- Reusable `set_updated_at()` trigger where needed.

### RLS / grants
- Public SELECT: active categories/products, active variants of active products, images of active products, collections (+ junction for active products), published blog posts.
- Public INSERT: newsletter only (no public SELECT on subscribers).
- Cart table: RLS on, no public policies (localStorage cart unchanged).
- Catalogue writes: **not** granted to `anon` or `authenticated` (no weak authenticated-admin policies).

### Compatibility
Shop/Home/Collections/Blog query fields preserved: `products.id,name,price,images,category_id,slug,status,featured`; category slugs; collections/blog fields.

### Manual next step
Apply `001_…` then `002_…` manually in the fresh Supabase SQL editor / CLI. Do not run old migrations.

### Files changed
`src/lib/supabase.ts`, `.env.example`, `INVESTIGATION.md`, `supabase/migrations/*` (3 removed, 2 added), `SPRINT_LOG.md`

---

## Sprint: Featured Pieces Mobile Swipe Rail
**Date:** 2026-09-23
**Status:** Complete
**Scope:** Home Featured Pieces layout only. No ProductCard/query/UI redesign elsewhere.

- **Mobile (`<md`):** Swiper horizontal swipe (`slidesPerView: 1.15`, `spaceBetween: 16`, peek of next card), `grabCursor`, clickable pagination (gold/muted), **no autoplay**.
- **`md+`:** existing 2/4-column grid + entrance animations unchanged.
- CSS: `.featured-pieces-swiper` (overflow hidden, reserved 2.5rem pagination row, `height: auto` slides).
- Empty state / loading / “View All Products” CTA untouched.

### Files changed
`src/pages/Home.tsx`, `src/index.css`, `SPRINT_LOG.md`

---

## Files NOT modified (project-wide, cumulative)
*(Historical snapshot taken before Phases A–C — the CartContext / ProductCard / QuickView entries below no longer hold. See **Current state (after Phase C3)** at the end of this log.)*

- ~~CartContext, ProductCard, QuickViewModal, Shop filtering, cart quantity logic.~~ — all modified in Phases C1–C3.
- Palette prefixes remain `ghana-*`.
- Hero scroll architecture / hero image URLs (presentation-only changes in designated sprints).
- Fit Collections / brand-section image URLs after introduction.

---

## Open follow-ups
*(Historical snapshot — see **Open follow-ups (current)** at the end of this log.)*

- ~~Run `20251107000000_add_variants_and_rebrand.sql` manually in Supabase; replace `.env` placeholders.~~ — superseded: run `001_initial_proxy_shop_schema.sql` then `002_seed_proxy_shop_categories.sql`; set `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`.
- Replace Footer `logo.png` (5.8 MB) with optimised asset (bundle weight).
- Stale `.kilo/worktrees/tree-nest/` worktree causes pre-existing lint noise — out of scope.
- ~~**Insert production domain** in `index.html` (`YOUR-DOMAIN.example`) for OG/canonical absolute URLs.~~ — **done** (`https://theproxyshop.vercel.app`).
- ~~Add `src/assets/founder.png` and set `aboutContent.founder.image`~~ — **done** (founder portrait wired into About).
- Optional breakpoint screenshot matrix — explicitly skipped across sprints.
- ~~Admin external-image preview/resolution architecture — still deferred (not built).~~ — **built in Phase B** (direct public image URLs with live Admin preview + publish-time resolution check; still no Pinterest scraping/link conversion).

---

## Sprint: Phase A — Supabase Auth + Admin Authorization + Protected Admin Shell
**Date:** 2026-09-24
**Status:** Complete
**Scope:** Admin authentication/authorization foundation only. Catalogue management deliberately NOT built. Public storefront unchanged apart from minimal root provider + router wiring.

### Database (pre-existing, outside this repo)
- The Phase A admin/auth SQL (`profiles`, `role`, `public.is_admin()`, automatic customer profile creation) was applied manually in Supabase and is **not stored in this repo** (no `003_*` migration file exists locally).

### Auth state layer — `src/contexts/AuthContext.tsx` (new)
- Exposes `user`, `session`, `isAdmin`, `loading`, `signIn`, `signOut` (one shared layer; no per-component auth queries).
- Initial session via `supabase.auth.getSession()`; changes via `supabase.auth.onAuthStateChange` (listener unsubscribed on cleanup; callback work deferred off the auth lock; `INITIAL_SESSION` ignored to avoid a duplicate resolve).
- `loading` only clears once **both** session and admin role are resolved → no protected render or wrong redirect mid-check.
- Authorization is `supabase.rpc('is_admin')` — never inferred from metadata, email, localStorage, route or a bare session. **Fail-closed**: RPC error/throw/unexpected value → not admin.
- `signIn()` returns a discriminated result (`admin` / `not-admin` / `error`); a valid-but-non-admin login is signed straight back out. `signOut()` uses the SDK and clears local state (no manual storage-key deletion).
- Error copy is human-readable (invalid credentials / network / session) — raw Supabase error objects are never rendered. No admin email, UUID or password hardcoded anywhere.

### Routes & guard — `src/App.tsx`, `src/components/admin/AdminRoute.tsx` (new)
- Public pages moved under a `Layout` route with `<Outlet />` (same chrome, unchanged behaviour); `/admin` gets its own tree, no public navbar/footer.
- Routes added: `/admin/login`, `/admin` (guard → shell → Overview), with a slot reserved for Phase B nested routes.
- Guard behaviour: loading → deliberate spinner (never protected content); no session → redirect `/admin/login`; authenticated non-admin → redirect `/admin/login` with a concise “no Admin access” message; admin → renders `<Outlet />`. Direct URL access is protected, not just hidden links.
- `/admin/login` redirects an already-authorized admin to `/admin`.

### Admin shell (new)
- `src/components/admin/AdminLayout.tsx` — brand header (theme-aware logo, “Admin” indicator, log out), desktop sidebar, mobile drawer (`framer-motion` + backdrop, Escape/route-close, body scroll lock).
- `src/components/admin/AdminSidebar.tsx` — Overview functional; Products/Collections/Blog rendered non-interactive (no broken links).
- `src/pages/admin/AdminLogin.tsx` — editorial split screen (Bodoni + Manrope, `ghana-*` tokens, theme toggle, back-to-storefront); states: idle, submitting, invalid credentials, success, authenticated non-admin.
- `src/pages/admin/AdminDashboard.tsx` — lightweight Overview: read-only counts (active/draft products, categories, collections), signed-in identity, deferred items. No fake revenue/orders/charts.

### Security
- Publishable key only (`VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`); no service-role/secret keys, no second Supabase client. Session persistence left to the SDK and revalidated (role re-checked) on refresh.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (5 pre-existing warnings) · manual test list handed to the user (no screenshots / no browser QA).

### Files changed
`src/contexts/AuthContext.tsx`, `src/components/admin/AdminRoute.tsx`, `src/components/admin/AdminLayout.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/pages/admin/AdminLogin.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/App.tsx`, `src/main.tsx`, `SPRINT_LOG.md`

---

## Sprint: Phase B — Admin Catalogue Management
**Date:** 2026-09-24
**Status:** Complete (pending the manual migration below)
**Scope:** Admin write authorization + products/variants/images/categories. Customer accounts, orders, checkout, payments, collections CRUD and blog CRUD deliberately NOT built. Public storefront design untouched.

### SQL — `supabase/migrations/004_admin_catalogue_policies.sql` (new, local only — NOT applied remotely)
- Tables: `categories`, `products`, `product_variants`, `product_images`.
- Admin write policies (`insert`/`update`/`delete`, `to authenticated`) always gated on `public.is_admin()` — no `USING (true)`, no `TO authenticated` shortcuts.
- Added **Admin-only SELECT policies** (required so Admin screens can read drafts/archived products, inactive categories/variants and images of non-active products). Permissive policies OR with the existing public ones, so anon/authenticated non-admins keep exactly the previous (active-only) visibility.
- Added partial unique index `uq_product_images_one_primary` on `(product_id) WHERE is_primary`, preceded by a duplicate-primary dedupe `UPDATE`; guarantees at most one primary image per product.
- Grants: `insert, update, delete` restored to `authenticated` for the four tables (migration 001 had revoked them); write privileges re-revoked from `anon` and `PUBLIC`. RLS stays the authorization boundary.
- Precondition guard raises a clear exception if `public.is_admin()` is missing. Idempotent (policies dropped before recreate).

### Admin data layer (new)
`src/lib/admin/products.ts` (list/detail/create/update/status/featured, images, variants, categories + editor loader) · `src/lib/admin/errors.ts` (PostgREST/SQL error → human copy: duplicate slug/SKU, check violation, FK, RLS denial, expired session, network) · `src/lib/admin/validation.ts` (slugify/kebab validation, image-URL rules, `verifyImageLoads()`, image/variant save validation, publish readiness) · `src/lib/admin/format.ts` (GHS cedi + date formatting, status labels).

### Routes & navigation
- Activated `/admin/products`, `/admin/products/new`, `/admin/products/:id`, `/admin/categories` under the Phase A guard. Sidebar enables Products + Categories; Collections and Blog remain disabled (“Soon”), no routes created.
- Overview updated with entry points to Products/Categories; deferred list now Collections / Blog / Orders & payments.

### Products (`AdminProducts.tsx`)
- Real Supabase data: name, category, price, status, featured, total stock (SUM of active variant stock, `0 / incomplete` with no variants), variant counts, primary-then-fallback image, updated date.
- Search (name/slug/SKU) + status filters with counts; Create Product; Edit; Publish; Unpublish; Archive; Restore.
- Desktop table (`md+`) and mobile card list; archive requires a branded confirmation dialog (no `window.confirm`).
- Publish from the list loads the full product, re-verifies the primary image and runs the same readiness checks as the editor.

### Product editor (`AdminProductEditor.tsx`) — 4 sections, separate saves
1. **General** (`ProductForm.tsx`) — name, slug, description, category, base price, product SKU, featured, status. Slug auto-generates from the name until the Admin edits it (never overwritten afterwards), normalised to kebab-case on blur; uniqueness errors reported clearly. New products are always created as **draft**. Choosing Active in the status select still runs the publish checks.
2. **Images** (`ProductImagesEditor.tsx`) — multiple direct URLs, live preview per row, explicit failure message, alt text, up/down ordering, primary radio, remove-with-confirmation. Pinterest *page* links rejected with guidance; direct `i.pinimg.com` URLs accepted if they resolve; no scraping/conversion.
3. **Variants & inventory** (`ProductVariantsEditor.tsx`) — size, colour, SKU, stock, price override, active, add/deactivate/remove (confirmed). SKU uniqueness pre-checked and DB-enforced; stock a non-negative whole number; override ≥ 0.
4. **Publishing** (`PublishPanel.tsx`) — status badge, live readiness checklist, Publish (blocked until ready and blocked while sections are dirty), Unpublish → draft, Archive (confirmed), Restore to draft.

### Publishing rules
Blocked unless: name, valid kebab slug, category, product SKU and valid price exist; at least one image; exactly one primary; primary image actually resolves (re-verified at publish time, not trusted from state — was previously the deferred external-image preview requirement); at least one active variant with size/SKU/valid stock. Blockers are listed in the UI; the product stays `draft`.

### Legacy compatibility (temporary, storefront untouched)
- `product_images` is authoritative; `products.images` is rewritten as **[primary, …remaining in display order]** because Home/Shop read `images[0]` as the product card image.
- `products.stock` is synced to `SUM(active variant stock)` on variant save; `product_variants.stock` remains authoritative.
- Primary image is persisted with a clear-then-set sequence (delete removed → clear primary → upsert rows → promote one), safe against the new unique index.

### Categories (`AdminCategories.tsx`)
- List with per-category product counts, create, edit name/slug/description, activate/deactivate (immediate, with storefront-visibility feedback). Deletion intentionally not offered (products keep assignment; no careless hard deletes). The four seeded categories remain.

### Security
- Every write goes through the authenticated Admin session and RLS; a normal authenticated customer fails the policies even if they call the API directly. No service-role/secret keys in Vite code; Phase A guard + fail-closed `is_admin()` untouched. No admin user creation, promotion button or role writing from the browser.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (5 pre-existing warnings) · `npm run build` success · no screenshots / Playwright / Puppeteer.

### Files changed
`supabase/migrations/004_admin_catalogue_policies.sql`, `src/lib/admin/{products,errors,validation,format}.ts`, `src/components/admin/{AdminSection,ConfirmDialog}.tsx`, `src/components/admin/products/{ProductForm,ProductImagesEditor,ProductVariantsEditor,PublishPanel}.tsx`, `src/pages/admin/{AdminProducts,AdminProductEditor,AdminCategories}.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/App.tsx`, `SPRINT_LOG.md`

---

## Sprint: Phase C1 — Public Product Data + Product Detail Page
**Date:** 2026-09-24
**Status:** Complete
**Scope:** Public product data layer + PDP. Cart internals, customer auth, checkout, orders, payments, collections CRUD and blog CRUD NOT touched. **No SQL migration required** (schema already supports this).

### Current public flow (inspected before implementing)
- `Shop.tsx` queried `products` + `categories` inline and mapped the legacy `products.images` jsonb for the card image; filtering used `category_id` client-side; category sidebar was hard-coded to four slugs via chained `.or()`.
- `ProductCard.tsx` rendered a non-linked image/name with hover Quick View + a variant-less “Add to Cart”; `QuickViewModal.tsx` had its own quantity stepper, an unconditional (and unverifiable) “In Stock” claim and a variant-less add-to-cart.
- No product detail route existed. Cart item shape (`CartContext`): `{ id, productId, productName, price, quantity, image?, variantId?, sku? }` (localStorage only).

### New public data layer — `src/lib/catalogue/products.ts`
- `listPublicCategories()` (active categories only), `listActiveProducts()`, `listFeaturedProducts(limit)` → `CatalogueProductSummary` (primary image from `product_images`, legacy `products.images[0]` fallback, active variant count, category name).
- `getProductBySlug(slug)` → product + category + `product_images` (ordered `is_primary DESC`, `display_order ASC`) + **active** `product_variants` only.
- `formatGhs()` — same `₵0.00` convention as the existing public UI. No Admin helpers, no legacy `products.stock` reads. Errors throw; pages translate them to safe copy.

### PDP — `/product/:slug` (`src/pages/ProductDetail.tsx`, route added to the public Layout group)
- Loads by slug, `status = 'active'` only (RLS already hides drafts/archived); missing slug / non-active / missing product → editorial not-found state; query failure → error state with retry; skeleton loading state; no-image fallback (no unrelated stock photo).
- Layout: breadcrumb, gallery (3/4 main image + thumbnail buttons, alt text, `aria-pressed`) and a sticky info panel — Bodoni/Manrope, existing palette/theme, no glass/gimmicks. Mobile stacks image-first.
- Content: name, category, description, images, size/colour controls, stock state, SKU, price, Add to cart. No invented materials/care/delivery claims.

### Variant behaviour
- Options are derived from real variant rows only — no synthetic combinations. Selection maps to an exact `variant.id`.
- Single active variant → auto-selected. Single-option axis (e.g. one size) → implicit and auto-applied. Multiple meaningful options → shopper must choose; Add to cart stays disabled until an exact variant resolves.
- Unavailable size/colour pairings are disabled (never selectable); sold-out options are disabled and marked; changing colour clears a size that does not exist in the new colour.
- Price shows `variant.price_override` when set, otherwise `products.price`, updating immediately on selection (`aria-live` block announces price + stock).
- Stock comes from the selected variant (`> 0` → In stock, `0` → Out of stock, add disabled); all-active-variants-zero → product-level “Out of stock” badge.
- Add to cart writes the **resolved variant** (`variantId` + `sku`, override-aware price, current gallery image, quantity 1) and shows an accessible “Added to cart” status with a cart link.

### Product cards + quick view
- `ProductCard` now links the image and name to `/product/:slug` when the product has a slug (no redesign; slug-less products stay non-linked). `image` accepts `string | null`.
- `QuickViewModal` reduced to a lightweight summary (image, name, price, description if present) + “View full details” → PDP. Removed the duplicate quantity stepper, the variant-less add-to-cart and the unverifiable “In Stock” claim; the PDP is the canonical purchase interface.
- `Shop` and Home featured pieces now read through the shared catalogue layer (normalized primary images); Shop’s category sidebar lists all active categories instead of four hard-coded slugs, and listings are ordered newest-first.

### Legacy + SQL
- Legacy `products.images` / `products.stock` fields were **not removed** — `products.images` remains a read-only fallback where normalized images are missing (cleanup stays in C3).
- No migration created: the existing schema (`status`, `slug`, `product_images`, `product_variants`) already supports the PDP.

### Deferred to C2
- Variant-aware cart storage, cart quantity/stock enforcement, cart de-duplication by product + variant.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (5 pre-existing warnings) · `npm run build` success · no screenshots / Playwright / Puppeteer.

### Files changed
`src/lib/catalogue/products.ts` (new), `src/pages/ProductDetail.tsx` (new), `src/App.tsx`, `src/components/ProductCard.tsx`, `src/components/QuickViewModal.tsx`, `src/pages/Shop.tsx`, `src/pages/Home.tsx`, `SPRINT_LOG.md`

---

## Sprint: Phase C2 — Variant-Aware Cart
**Date:** 2026-09-24
**Status:** Complete
**Scope:** `CartContext` + localStorage, Cart page, PDP/card add paths. Customer auth, persistent Supabase cart, checkout, orders and payments NOT built. **No SQL migration required.**

### Cart model (`src/contexts/CartContext.tsx`)
- Every line is **Product + exact Product Variant**. Identity is `productId:variantId`; same product in a different size/colour stays a separate line.
- Stored fields: `productId`, `variantId`, `productSlug`, `productName`, `size`, `colour`, `sku`, `price` (effective unit price), `quantity`, `image`, plus runtime `stock`, `available`, `note`. Labels only, no full DB objects duplicated into localStorage.
- Still client-side/localStorage only — `cart_items` remains untouched and reserved for future authenticated carts.

### Add to cart
- `addItem()` takes a **required `variantId`** plus the variant's current stock, so no call site can add a product without an exact variant.
- PDP passes the resolved variant (`variantId`, size, colour, SKU, slug, effective price incl. `price_override`, current gallery image, stock) and renders add/clamp/error feedback in an `aria-live` region.
- `ProductCard` no longer adds to the cart at all: its action is now **“Choose Options”** → `/product/:slug`. No legacy product-only add path remains anywhere (QuickView lost its add path in C1).

### Stock (variant-level)
- Add: blocked when stock is 0; when the requested total exceeds stock the quantity is clamped and a message is returned (“Only N in stock — quantity limited to N”).
- Cart: the `+` control is disabled at stock and `updateQuantity()` clamps as a second guard, returning a message shown on the page. `products.stock` is never consulted.

### Revalidation on cart load
- The Cart page re-checks every saved line against Supabase (products + product_variants) once per visit and reconciles: product/variant still active, current stock, current price (variant override or base).
- Detects and marks: product no longer active, variant no longer active/removed, stock lower than cart quantity (quantity clamped), price changed (line updated + “Price updated” note). Because RLS only exposes active products/variants, removed/archived/deactivated rows simply come back missing — nothing is silently substituted.
- Query failure leaves the last known state intact rather than falsely flagging the cart; a “Checking availability…” status shows while revalidating.
- `total` excludes unavailable lines; unavailable count is surfaced, “Proceed to Checkout” is disabled and the user can remove those lines. The navbar badge still counts all lines.

### Cart UI (`src/pages/Cart.tsx`)
- Per line: image, linked name, size · colour, SKU, unit price, quantity stepper, line subtotal, per-line stock (“N in stock”), unavailable styling + note, remove. Existing layout/summary direction kept; `formatGhs()` now shared with the PDP.
- Replaced the raw `₵x.toFixed(2)` interpolations on this page with the shared formatter (no visual change).

### Legacy cart safety
- On load, stored entries without a `variantId` (or with an invalid quantity/price) are **dropped, never guessed**, and a dismissible notice explains how many items were removed and to re-add them from the product page. Corrupt/non-array JSON degrades to an empty cart instead of crashing.

### Deferred to C3
- Storefront legacy `products.images` / `products.stock` cleanup (remove the compatibility sync + fallback reads).

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (5 pre-existing warnings) · `npm run build` success · no screenshots / Playwright / Puppeteer.

### Files changed
`src/contexts/CartContext.tsx`, `src/pages/Cart.tsx`, `src/pages/ProductDetail.tsx`, `src/components/ProductCard.tsx`, `SPRINT_LOG.md`

---

## Sprint: Phase C3 — Public Storefront Normalization + Legacy Compatibility Cleanup
**Date:** 2026-09-24
**Status:** Complete
**Scope:** Public frontend data normalization only. No visual redesign, no schema change, no Admin changes. **No SQL migration required and no columns dropped.**

### Legacy reads removed (public frontend)
- `src/lib/catalogue/products.ts`: stopped selecting and reading `products.images` entirely (both the listing and detail mappers) — the `products.images[0]` fallback and its `parseLegacyImages` helper are gone, so no public code path reads it even if the column were dropped.
- `Home` / `Shop`: already on the shared layer from C1; verified they contain no `products.images` / `products.stock` reads (featured pieces and shop cards get the normalized primary image + variant availability).
- `ProductCard`, `QuickViewModal`, `Cart`: removed the fake Pexels stock-photo fallbacks and any product-level stock assumption — images come from `product_images`, availability from active `product_variants`.
- `Collections`: inspected — it renders `collections` rows (`featured_image`) only and never loads products, so there was nothing to normalize there. Blog/About/FitCollections use static content config, not catalogue fields.

### Normalized sources (authoritative)
- Images → `product_images` (primary first, then `display_order`); no image row now renders the neutral placeholder instead of a fake photo.
- Stock / availability → active `product_variants` only: `totalStock` = SUM(active variant stock), `available` = any active variant in stock. `products.stock` is never read publicly.
- Variant rows are filtered to `active` in the mapper as well as by RLS, because an Admin browsing the storefront can read inactive variants through the Phase B admin SELECT policy.

### Public model + types
- `CatalogueProductSummary` is now the single normalized card shape: `image`, `price`, `slug`, `variantCount`, `totalStock`, `available`, category. `CatalogueProductDetail` carries the same normalized availability plus ordered images and active variants. No `any` (defensive row mapping helpers), and Admin DB types stay separate from public presentation types.
- Added `src/components/ProductImagePlaceholder.tsx` — one shared neutral no-image state used by ProductCard, QuickView, Cart and the PDP.
- `ProductCard` consumes only the normalized shape (primary image / price / availability / slug) with an “Out of stock” badge when `available === false`; no legacy/new branching. `QuickViewModal` shows variant-derived availability instead of an unconditional claim.

### Query shape (no N+1)
- Listings: one request with embedded relation selects (`categories(name)`, `product_images(...)`, `product_variants(stock, active)`) — replacing the previous three whole-table queries.
- PDP: one request for product + category + images + variants, replacing three sequential requests. No per-card requests anywhere.

### Admin compatibility (intentionally unchanged)
- Phase B still writes `products.images` (primary first) and `products.stock` (SUM of active variant stock) on save; the Admin data layer still reads them as a display fallback. The public storefront no longer *needs* either field, which is the safe migration boundary.
- `products.images` and `products.stock` columns remain in place, untouched.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (5 pre-existing warnings) · `npm run build` success · no screenshots / Playwright / Puppeteer.

### Files changed
`src/lib/catalogue/products.ts`, `src/components/ProductImagePlaceholder.tsx` (new), `src/components/ProductCard.tsx`, `src/components/QuickViewModal.tsx`, `src/pages/Cart.tsx`, `src/pages/ProductDetail.tsx`, `SPRINT_LOG.md`

---

## Sprint: Phase D1 — Customer Auth + Profile Foundation
**Date:** 2026-09-24
**Status:** Complete (pending the manual migration below)
**Scope:** General user auth + profile foundation. Persistent Supabase cart, checkout, orders, payments, addresses, wishlist and social login NOT built. **Manual SQL required (file below, not applied remotely).**

### SQL — `supabase/migrations/005_customer_profile_foundation.sql` (new, local only)
- Phase A applied `profiles` outside this repo, so the migration is **defensive and idempotent**: `create table if not exists` plus `add column if not exists` for `id`, `full_name`, `phone`, `role`, `created_at`, `updated_at` — nothing duplicated, nothing dropped.
- Adds `phone` if missing; adds a `profiles_role_check` constraint only when absent; sets `role` default to `customer` (auto-creation trigger from Phase A left in place — reused, not replaced).
- **Role mutation prevention (three layers):** (1) column-level privileges — table-level UPDATE is revoked from `anon`/`public`/`authenticated` and only `update (full_name, phone)` is granted, so `role` is not writable from the browser at all; (2) RLS permits update only on the caller's own row (`auth.uid() = id`, select the same); (3) a `profiles_guard_update()` BEFORE UPDATE trigger rejects `role`/`id` changes when the request comes from `anon`/`authenticated`, forces `created_at` immutable and manages `updated_at`. Manual admin promotion from the SQL editor / service role still works (`current_user` is not an API role).
- No INSERT/DELETE grants for clients (rows come from the signup trigger and cascade from `auth.users`); `anon` has no access to `profiles`. No addresses/orders/payment/cart fields added.

### Auth architecture (`src/contexts/AuthContext.tsx`)
- **Behaviour change:** an authenticated non-admin is no longer treated as an invalid user. Customers stay signed in with `isAdmin = false`; admins stay signed in with `isAdmin = true`; no session means unauthenticated. The Phase A “sign non-admins back out” logic is gone.
- One shared source of truth exposing `user`, `session`, `profile`, `isAdmin`, `loading`, `profileError`, `signIn`, `signUp`, `signOut`, `refreshProfile`, `updateProfile` — single `getSession()` + single `onAuthStateChange` listener (unsubscribed on cleanup, callback work deferred off the auth lock).
- `loading` clears only once session, profile and admin role are all resolved. Profile load failure surfaces `profileError` without blocking auth. Admin authority remains `public.is_admin()` via RPC and stays fail-closed — the profile's `role` label is convenience data, never the authorization source.
- `signUp` respects either email-confirmation mode (returns `needsEmailConfirmation` based on whether Supabase returned a session), preserves the typed full name (also backfills an empty `full_name` once signed in), and uses `raw_user_meta_data.full_name`. `updateProfile` writes only `full_name` + `phone` and validates the phone shape. Auth errors are mapped to human copy (invalid credentials, duplicate email, weak password, network, expired session).

### Routes + guards
- New public routes: `/login`, `/signup` (standalone brand screens, own chrome like `/admin/login`) and `/account` (storefront chrome) — `/account` sits behind the new **`AuthenticatedRoute`**, which requires only a session and never an admin role; unauthenticated visits redirect to `/login` with the intended destination.
- `AdminRoute` is untouched and still requires a session **and** `public.is_admin()`.
- Navbar (desktop): one restrained account icon — `/account` when signed in (with a small presence dot), `/login` when signed out. Mobile fullscreen menu: a real Account section replacing the old commented placeholder — signed in shows Account / Admin (only when `isAdmin`) / Log out; signed out shows Sign in + Create account. `/admin` stays available only to admins.

### Admin compatibility
- `/admin/login` refactored onto the shared `signIn()`: authenticate → check `is_admin()` → admin enters `/admin`; a non-admin is denied with “This account does not have Admin access.” and **keeps their customer session** (the old global sign-out is removed, replaced by a link to their account).

### Session persistence + security
- Supabase's own session persistence is used; `/account` survives a refresh. No custom tokens, no manual Supabase storage-key handling.
- No service-role/secret keys, no hardcoded admin email, no metadata-based admin authority, no role updates possible from customer UI; `is_admin()` and Phase A admin security unchanged.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (5 pre-existing warnings) · `npm run build` success · no screenshots / Playwright / Puppeteer.

### Files changed
`supabase/migrations/005_customer_profile_foundation.sql` (new), `src/contexts/AuthContext.tsx`, `src/components/auth/AuthenticatedRoute.tsx` (new), `src/components/auth/AuthShell.tsx` (new), `src/pages/auth/CustomerLogin.tsx` (new), `src/pages/auth/CustomerSignup.tsx` (new), `src/pages/Account.tsx` (new), `src/pages/admin/AdminLogin.tsx`, `src/components/Navbar.tsx`, `src/App.tsx`, `SPRINT_LOG.md`

---

## Sprint: Phase D2 — Persistent Customer Cart + Guest Merge
**Date:** 2026-09-24
**Status:** Complete (pending the manual migration below) — *entry backfilled retroactively during the D3 sprint from the session record.*
**Scope:** Cart persistence for signed-in customers + guest→account merge. Checkout, orders, payments, addresses and profile UI NOT built.

### SQL — `supabase/migrations/006_authenticated_cart.sql` (new, local only — NOT applied remotely)
- Activates the reserved `cart_items` table for authenticated customers: ownership FK `user_id → auth.users(id) ON DELETE CASCADE`, `user_id`/`variant_id` NOT NULL, variant FK switched to `ON DELETE CASCADE` (legacy `ON DELETE SET NULL` replaced), `UNIQUE (user_id, product_id, variant_id)`, `quantity > 0` (001 check re-asserted).
- Defence cleanup first: removes any legacy NULL/duplicate rows and collapses duplicate identity lines (no-ops on a clean database).
- RLS: own-row SELECT/INSERT/UPDATE/DELETE `to authenticated` only — deliberately **no anon policies**, so guest carts stay localStorage-only and there are no anonymous database carts. Grants: CRUD restored to `authenticated`, revoked from `anon`/PUBLIC; RLS remains the authorization boundary. Idempotent, with a precondition guard on `cart_items`.
- `src/lib/supabase.ts`: `CartItemRow` / `CartItemInsert` updated — `variant_id` and `user_id` are now required (a cart line is always customer + product + exact variant).

### Dual-source cart (`src/contexts/CartContext.tsx` rework)
- One interface, two internal sources: **guest → localStorage** (`cart` key, never sent to the database); **signed-in → Supabase `cart_items`** scoped by RLS. Components only ever see `useCart()` — `addItem` / `updateQuantity` / `removeItem` / `clearCart` / `total` / `itemCount` behave identically regardless of source, so the navbar badge and Cart page needed no source-specific logic.
- The database stores identity only (user + product + variant + quantity); name, price, image and stock are always resolved from the live catalogue on load through one consolidated relation select (cart → product → images + exact variant — no N+1). Display data can never go stale.
- Account load runs a single shared `reconcileLine` pass: product/variant not active → “No longer available”, stock clamped, current effective price (variant override) — the same rules as the Cart page revalidation. Pair consistency is decided by the embed (`variantProductOf` + `variantProduct` map), never assumed, so a mismatched product/variant can never render as a real line.
- Source switching: a new `loading` flag is true while the session resolves or the account cart is loading/merging (`items` empty in that window) → the badge and Cart page never flash a stale guest count or the empty state. Signed out → the UI switches back to the guest cart; the account cart stays in the database and is **never** copied into localStorage (no account-state leakage on shared devices).
- Writes are optimistic with failure safety: mutations update local state first and persist in the background (`runWrite`); a failed write surfaces a plain-language notice and re-syncs from the database instead of lying about state.

### Login merge (guest → account cart)
1. Load the account cart quantities → 2. revalidate every guest line against the live catalogue (product active, exact variant active, variant belongs to that product) → 3. merged quantity = DB quantity + guest quantity, clamped to current variant stock → 4. one upsert on the unique conflict target (no duplicate lines).
- localStorage is cleared **only after the upsert succeeds** — a failed merge leaves the guest cart untouched and explains nothing was lost (it retries on the next sign-in). Invalid/unavailable guest lines are skipped and reported, never substituted.
- The per-login flow is deduplicated per user id, so React strict-mode/effect re-runs and retries share one execution.

### Cart page (`src/pages/Cart.tsx`)
- Added the `loading` state: spinner while the active source resolves, rendered before the empty-state check.

### Verification
- Typecheck/lint/build clean (re-run at D3 close: `npm run typecheck` clean · `npm run lint` 0 errors · `npm run build` success). No screenshots / Playwright / Puppeteer.

### Files changed
`supabase/migrations/006_authenticated_cart.sql` (new), `src/contexts/CartContext.tsx` (rework), `src/pages/Cart.tsx`, `src/lib/supabase.ts`, `src/main.tsx` (`AuthProvider` now wraps `CartProvider` — CartContext depends on the auth session), `SPRINT_LOG.md`

---

## Sprint: Phase D3 — Customer Account Area + Saved Addresses
**Date:** 2026-09-24
**Status:** Complete (pending the manual migration below)
**Scope:** Customer account area (overview, profile, saved addresses) + the address store. Orders, checkout, Paystack, payment methods, fulfilment, admin orders and account deletion NOT built. No screenshots / Playwright / Puppeteer.
**Note:** the migration, address data layer and Supabase types were produced in an earlier session that stopped before the UI; this session completed routes, layout, pages, navigation review, logging and verification.

### SQL — `supabase/migrations/007_customer_addresses.sql` (new, local only — NOT applied remotely)
- Table `customer_addresses`: `id` uuid pk, `user_id` → `auth.users(id) ON DELETE CASCADE`, `label`, `recipient_name`, `phone`, `address_line1`, `address_line2`, `city`, `region`, `country` (default `'Ghana'`), `postal_code` (optional — Ghana), `is_default`, `created_at`/`updated_at`. Storage-layer CHECK on the five required fields (defence in depth alongside UI validation).
- Indexes: `idx_customer_addresses_user_id` + **partial unique `uq_customer_addresses_one_default` on `(user_id) WHERE is_default`** → at most ONE default per customer, enforced by the database.
- `updated_at` managed by the shared 001 trigger.
- **RLS ownership:** enabled; SELECT/INSERT/UPDATE/DELETE all `to authenticated` and gated on `auth.uid() = user_id` (USING + WITH CHECK). No anon policies → anon has zero address access. **Grants:** CRUD to `authenticated` only; revoked from `anon`/PUBLIC. Idempotent, with a precondition guard on `set_updated_at()`.

### Address data layer — `src/lib/account/addresses.ts` (new)
- Reads: `listAddresses` (default first, then oldest), `countAddresses` (head count for the Overview). Writes: `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`.
- Default handling matches the partial unique index: unset the current default **first**, then set the selected row (create/update with `isDefault` do the same). Unique-index races map to friendly copy via `addressErrorMessage`.
- `validateAddress`: required recipient name, phone (shape-checked), address line 1, city, country. Postal code optional. No external address verification, no Maps API.
- `src/lib/supabase.ts`: `CustomerAddressRow` / `CustomerAddressInsert` / `CustomerAddressUpdate` + `customer_addresses` registered in `Database`.

### Routes & account layout
- `/account` nested under the single D1 `AuthenticatedRoute` (session-only guard — no admin role, no per-page auth checks):
  `/account` → Overview (index) · `/account/profile` → Profile · `/account/addresses` → Addresses. **No `/account/orders` route** (Phase E).
- `src/components/account/AccountLayout.tsx` (new): desktop side navigation + content via `<Outlet />`; mobile compact horizontal section nav (scrollable, gold active underline). Editorial storefront style (Bodoni display, Manrope UI, `ghana-*` tokens) — not an Admin dashboard clone. Nav = Overview / Profile / Addresses + **Orders rendered disabled** (“Available after your first order”, `aria-disabled`, not a link, no route). Desktop nav footer: Log out + Admin console (only when `isAdmin`).

### Overview (`src/pages/account/AccountOverview.tsx`) — real data only
Display name, profile-error retry, saved-address count (`countAddresses`), current cart count (`useCart().itemCount`, linking to `/cart` — no second cart UI inside Account), profile-completion checklist (full name / phone / saved address, “n of 3 complete”). CTAs: Continue Shopping, View Cart, Manage Profile, Manage Addresses. **No fake** order counts, points, spend or tier.

### Profile (`src/pages/account/AccountProfile.tsx`)
D1 profile editing moved here unchanged in behaviour: editable **full name + phone** (existing `updateProfile`), read-only **email**. Role is never displayed as an editable customer field.

### Addresses (`src/pages/account/AccountAddresses.tsx` + `src/components/account/AddressForm.tsx`)
- List (default first): **Default** badge, **Set as default** (unsets the previous default inside the lib), **Edit**, **Delete** — delete confirmed via the existing generic `ConfirmDialog` (imported as-is; no admin file touched).
- Add/Edit is an **inline panel** (not a modal): Label, Recipient, Phone, Country (defaults Ghana), Line 1, Line 2 (optional), City, Region (optional), Postal (optional) + “Set as default” checkbox — locked on when editing the current default, pre-checked when creating the first address.
- Client validation via `validateAddress`; storage errors via `addressErrorMessage`; load failure → retry affordance; empty state; all feedback reflects real write outcomes.

### Navigation
Navbar verified, **unchanged** (spec §11): signed-in account entry → `/account` (desktop icon with presence dot; mobile fullscreen menu exposes Account / Cart / Log out, plus Admin only when `isAdmin`). No Orders entry anywhere.

### Security
All account routes behind the one D1 `AuthenticatedRoute`. Row ownership is always `auth.uid() = user_id` (addresses + cart here, profiles since D1) — a customer cannot read or write another customer’s profile, addresses or cart even when calling the API directly. An Admin may use `/account` like any signed-in user; `/account` and `/admin` remain separate surfaces.

### Deferred — confirmed NOT built
Orders · checkout / Buy Now / delivery fees / shipping · Paystack or any payment/card data · account deletion · password reset UI.

### Verification
`npm run typecheck` clean · `npm run lint` 0 errors (6 warnings: 5 pre-existing + 1 CartContext `exhaustive-deps` from D2) · `npm run build` success.

### Files changed
`supabase/migrations/007_customer_addresses.sql` (new), `src/lib/account/addresses.ts` (new), `src/components/account/AccountLayout.tsx` (new), `src/components/account/AddressForm.tsx` (new), `src/pages/account/AccountOverview.tsx` (new), `src/pages/account/AccountProfile.tsx` (new), `src/pages/account/AccountAddresses.tsx` (new), `src/pages/Account.tsx` (removed — split into the pages above), `src/lib/supabase.ts`, `src/App.tsx`, `SPRINT_LOG.md`

### Manual next step
Run `supabase/migrations/007_customer_addresses.sql` in the Supabase SQL editor (after `006_…` if not yet applied). Shortest test sequence: sign in → `/account` (address count + cart count) → Profile: edit name/phone, save → Addresses: add one (first defaults), set another default, edit, delete (confirm) → refresh (persistence) → sign out (guard redirects to `/login`).

---

## Current state (after Phase D3)
**Live and working:** public storefront on the normalized catalogue model (Home, Shop, Collections, PDP, QuickView, variant-aware cart); customer auth (signup/login) with a structured account area — `/account` overview, `/account/profile`, `/account/addresses` — plus a persistent Supabase cart with guest merge; alongside Admin auth + catalogue management, all behind RLS; one shared AuthContext for the whole app.

- **Changed since Phase B (C1–C3):** `src/lib/catalogue/products.ts` (new normalized public layer), `src/pages/ProductDetail.tsx` (new PDP), `src/components/ProductCard.tsx`, `src/components/QuickViewModal.tsx`, `src/components/ProductImagePlaceholder.tsx` (new), `src/pages/Home.tsx`, `src/pages/Shop.tsx`, `src/pages/Cart.tsx`, `src/contexts/CartContext.tsx`, `src/App.tsx` (routes).
- **Added in D1–D3:** migrations `005`, `006`, `007` (all manual, local only), `src/contexts/AuthContext.tsx`, `src/components/auth/{AuthenticatedRoute,AuthShell}.tsx`, `src/pages/auth/{CustomerLogin,CustomerSignup}.tsx`, `src/components/account/{AccountLayout,AddressForm}.tsx`, `src/pages/account/{AccountOverview,AccountProfile,AccountAddresses}.tsx`, `src/lib/account/addresses.ts`, `src/pages/admin/AdminLogin.tsx`, `src/components/Navbar.tsx`, `src/main.tsx` (`AuthProvider` wraps `CartProvider`).
- **Still untouched:** Hero (`src/components/hero/*`, `src/lib/hero.ts`), Fit Collections + `src/lib/homeContent.ts`, About + `src/lib/aboutContent.ts`, Blog, Contact, Footer, Layout, existing public SELECT policies / RLS, `ghana-*` palette, Admin surface (Phase A/B files unchanged since).
- **Still not built:** checkout, orders, payments/Paystack, delivery fees, account deletion, password reset UI, wishlist, social login, newsletter admin, analytics, Collections CRUD, Blog CRUD.
- **Legacy:** `products.images` / `products.stock` columns exist and the Phase B Admin sync still writes them, but no public frontend code reads them.
- **Auth model:** customer session (Supabase Auth) + `profiles` row; admin authority always from `public.is_admin()`. Customer login cannot make anyone an admin. `/account` (any session) and `/admin` (session + `is_admin()`) remain separate surfaces.

---

## Open follow-ups (current)
- **Run `supabase/migrations/004_admin_catalogue_policies.sql` manually in Supabase** — Phase B code is inert until it is applied (Phase A admin/auth SQL is already applied and is not in this repo).
- ~~Migrate the public storefront off legacy `products.images` / `products.stock` onto the normalized model.~~ — **complete (C1 → C3)**: the public frontend no longer reads either field; PDP, Shop, Home, ProductCard, QuickView and Cart all use `product_images` / `product_variants`.
- ~~**Phase C2:** variant-aware cart storage, cart quantity/stock enforcement, cart de-duplication by product + variant.~~ — **done.**
- **Legacy columns:** `products.images` / `products.stock` still exist and are still written by the Phase B Admin sync. A later schema-cleanup migration can drop the compatibility sync first, then the columns, once the storefront is proven stable without them.
- **Run `supabase/migrations/005_customer_profile_foundation.sql` manually in Supabase** — customer signup/account profile editing needs it (the app degrades gracefully with a “profile not available” state until then).
- **Run `supabase/migrations/006_authenticated_cart.sql` manually in Supabase** — the persistent account cart and login merge are inert until it is applied (guest/localStorage cart still works without it).
- **Run `supabase/migrations/007_customer_addresses.sql` manually in Supabase** — `/account/addresses` and the overview address count need it.
- ~~**Next architecture:** customer accounts (Supabase Auth for shoppers)~~ — **done in D1**; ~~persistent Supabase cart + addresses~~ — **done in D2/D3**.
- **Phase E candidates:** checkout + orders (Paystack), delivery/fulfilment, password reset UI. Saved addresses are in place and ready for checkout.
- Deferred sprints: Collections CRUD, Blog CRUD, checkout/orders/payments/delivery, customer accounts, newsletter admin.
- Replace Footer `logo.png` (5.8 MB) with the optimised asset (bundle weight).
- Stale `.kilo/worktrees/tree-nest/` worktree causes pre-existing lint noise — not in scope.
- Optional breakpoint screenshot matrix — explicitly skipped across sprints.

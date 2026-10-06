# Sprint Log — The Proxy Shop

Running log of all sprints completed in this project.

**Repository:** https://github.com/samuel1578/Dmayor

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
> **Superseded — see “Open follow-ups (current — after Phase E4)” at the end of this file.** The list below is kept as the historical D3-era snapshot.
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

---

## 2026-09-28 10:21:38 UTC — Sprint: Glitch Brand System (site-wide rollout)
**Date/Time:** 2026-09-28 10:21:38 UTC
**Status:** Complete — all checks green; committed as `4da48ed UP3T3`
**Repo:** https://github.com/samuel1578/Dmayor (branch `master`, commit before this sprint: `0dac088 HOMEBASE`)
**Scope:** Brand wordmark treatment across the account dashboard, scrolly hero, homepage sections and the fullscreen mobile menu. Desktop Navbar logo, Footer, Supabase, cart, checkout, auth logic and hero scroll architecture untouched. No screenshots / Playwright / Puppeteer (none available in this environment).

### New component — `src/components/GlitchBrand.tsx` + `GlitchBrand.module.css`
- Pure-CSS chromatic glitch wordmark for **THE PROXY SHOP** — no images, no canvas, no JS animation.
- Props: `text` (default `THE PROXY SHOP`), `size` (`md` | `lg` | `corner` | `menu`), `surface` (`page` | `card` | `brand`), `variant` (`inline` | `sticky`), `className`.
- **Masking rule:** `::before` / `::after` re-render the text via `attr(data-text)` and paint an opaque `--glitch-bg` that must match the underlying container in both themes; `clip-path: inset()` slices cut them to horizontal bands. Two coprime animations (2.3s / 3.1s, `steps(1, end)` → hard cuts) with `translate3d(-7px…+7px)` offsets; chromatic shadows red `-0.04em` / cyan `+0.04em` on the slices, faint aberration at rest on the base layer.
- **Theme tokens:** light page `#FFFDF5` / dark `#0A0A0A` (default); `.onCard` → `#FFFFFF` / `#111111`; `.onBrand` → `#FCD116` / `#221E0B` (dark value = `bg-ghana-yellow dark:bg-opacity-10` composited over `#0a0a0a`, verified in the built CSS).
- **Sizes:** `md` `clamp(0.9rem, 0.6vw + 0.7rem, 1.5rem)` (dashboard) · `lg` `clamp(1.15rem, 3.6vw - 0.45rem, 5rem)` (hero opening masthead) · `corner` `clamp(0.9rem, 3.6vw - 0.45rem, 5rem)` (page marks — chapters, closing sign-off, homepage sections; ≈44.6px at 1440) · `menu` `clamp(0.8rem, calc(9vw - 1rem), 3.25rem)` (mobile menu header, derived from the row budget `100vw − 32px gutter − 144px controls`).
- **`sticky` variant:** `.stickyBar` — sticky at `calc(5rem + 1px)` (clears the `h-20` navbar + 1px border), `z-index: 40`, full-bleed `-mx-4 px-4 sm:-mx-6 sm:px-6`, 2px gold bottom rule; `display: none` from 768px up.
- **A11y:** `role="img"` + `aria-label` on the span makes it an a11y leaf (inner text marked `aria-hidden`, so the duplicated pseudo text is never announced twice); `pointer-events: none` + `user-select: none`; `prefers-reduced-motion: reduce` → `content: none; animation: none`.
- **Constraint documented in-file:** module CSS is unlayered, so it beats Tailwind utilities at equal specificity — never put display/position utilities on a module-styled element; wrap it instead.

### Placements rolled out
1. **Account dashboard** — `src/pages/account/AccountOverview.tsx`: hero-row mark on desktop (wrapped in `hidden md:block` so mobile keeps its own layout) + a mobile-only `<GlitchBrand variant="sticky" />` fragment rendered **outside** the `motion.div`.
2. **Scrolly hero** — `src/components/hero/HeroNarrative.tsx` (replaces the `logo-header.png` masthead, whose `useTheme`/logo imports were removed): opening `size="lg"` in-flow; four chapter marks via the `chapterBrandPlacement` map, each wrapped in `absolute z-10` divs (the module's `position: relative` had hijacked Tailwind offsets and pushed the Shoes mark over its CTA — fixed): mobile → shirts top-right, trousers bottom-right, hoodies top-left, shoes bottom-right; desktop → shirts bottom-left, trousers top-left, hoodies bottom-left, shoes top-right. Closing page: the `heroClosing.eyebrow` text replaced by an in-flow `size="corner"` mark (`order-last mt-5` on mobile, eyebrow slot `md:order-first md:mb-5` on desktop) so it matches its chapter partners instead of the small `md` default.
3. **Homepage sections** — `src/pages/Home.tsx` (both sections given `relative`; marks `aria-hidden` + `size="corner"` so they sit in the padding bands, heading/grid/input untouched): **Featured Pieces** → top-right (`top-4 right-4 sm:top-5 sm:right-6 md:top-6 lg:right-8`); **newsletter CTA** → top-left on mobile, bottom-right on desktop (`md:top-auto md:left-auto md:bottom-6 md:right-6 lg:right-8`) with `surface="brand"`.
4. **Fullscreen mobile menu** — `src/components/Navbar.tsx`: the header `<img>` (was `h-14`) replaced by `<GlitchBrand size="menu" />` inside the same home `Link` (`aria-label` retained, `min-w-0` guard so the mark can never push the three control buttons off-screen). Desktop navbar logo and the Footer logo are untouched.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (6 pre-existing warnings, out of scope) · `npm run build` success — run after each placement pass.
- Built-CSS spot checks: `_onCard_` / `_onBrand_` / `.dark .` scoping and rule order verified (token rules come after `.glitch` so the surface wins); `_sizeMenu_` emitted as `clamp(.8rem, calc(9vw - 1rem), 3.25rem)`; desktop logo still bundled (`logo-header` ref present), mobile-menu `h-14 w-auto` ref gone (the remaining one belongs to `Footer.tsx`).

### Files changed (committed in `4da48ed UP3T3`)
`src/components/GlitchBrand.tsx` (new), `src/components/GlitchBrand.module.css` (new), `src/components/hero/HeroNarrative.tsx`, `src/lib/hero.ts`, `src/pages/account/AccountOverview.tsx`, `src/pages/Home.tsx`, `src/components/Navbar.tsx`

---

## 2026-09-28 10:48:14 UTC — Sprint: Glitch Brand in Page Heroes (Blog · About · Contact)
**Date/Time:** 2026-09-28 10:48:14 UTC
**Status:** Complete — all checks green; changes in the working tree, not yet committed
**Repo:** https://github.com/samuel1578/Dmayor (last commit `4da48ed UP3T3`)
**Scope:** The three page heroes named in the brief. Desktop Navbar logo, Footer logo, hero scroll architecture, Shop/cart/auth untouched. No screenshots / Playwright / Puppeteer.

### Blog (`src/pages/Blog.tsx`)
- `h1` "The Proxy Shop Stories" → `<GlitchBrand size="lg" surface="ink" />` with **Stories** on its own line (`mt-1 block md:mt-2`) — accessible name still "THE PROXY SHOP Stories".
- `size="lg"` = the hero's big ramp: 44.6px at 1440 (matches `text-5xl` 48px on the same masthead), 18.4px mobile floor.

### About (`src/pages/About.tsx`, `src/lib/aboutContent.ts`)
- `hero.eyebrow` config changed `'ABOUT THE PROXY SHOP'` → `'ABOUT'`; the JSX now renders `{hero.eyebrow} <GlitchBrand size="lg" />`, so screen readers still get "ABOUT THE PROXY SHOP" and the brand half is the mark.
- Sits on the page surface → default tokens, no new surface modifier.

### Contact (`src/pages/Contact.tsx`) — hero redesigned around the mark
- The glitch mark now leads the band (`size="lg" surface="red"`) above the unchanged **Get in Touch** heading and subcopy.

### Mask-vs-gradient mechanics (the reason the bands changed)
- A mark paints an opaque slice mask, so on a full-width gradient it would read as a flat colour rectangle. Both hero bands now use Tailwind colour-stop positions:
  - Blog: `bg-gradient-to-r from-ghana-black from-70% to-ghana-green to-100%`
  - Contact: `bg-gradient-to-r from-ghana-red from-70% to-ghana-green to-100%`
- Left **70%** is therefore solid (all copy lives there; worst case the mark reaches 66% of viewport width at 320px, 59% at 2560), the gold sweep keeps the right third — the band's look is preserved, masks are pixel-exact.

### New surface tokens (`GlitchBrand.module.css`)
- `.onInk` / `:global(.dark) .onInk` → `--glitch-bg: #111111` (ghana-black), `.onRed` / `.dark .onRed` → `#ce1126` (ghana-red); both set `--glitch-fg: #ffffff` to match the white hero copy. Dark overrides repeat the value because these bands do **not** change colour with the theme.
- `surface` prop union extended: `'page' | 'card' | 'brand' | 'ink' | 'red'`.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (6 pre-existing warnings) · `npm run build` success.
- Built-CSS checks: `.from-ghana-black` (index 37478) precedes `.to-ghana-green` (38886) so stops resolve to `#111111 70%, #B8860B 100%`; `.dark ._onInk_` (1079) follows `.dark ._glitch_` (827) so the band tokens win; `.onInk`/`.onRed` sit after the base `.glitch` rule.

### Files changed
`src/pages/Blog.tsx`, `src/pages/About.tsx`, `src/pages/Contact.tsx`, `src/lib/aboutContent.ts`, `src/components/GlitchBrand.tsx`, `src/components/GlitchBrand.module.css`

---

## 2026-09-28 10:48:14 UTC — Sprint: Collections Page Retirement
**Date/Time:** 2026-09-28 10:48:14 UTC
**Status:** Complete — all checks green; changes in the working tree, not yet committed
**Repo:** https://github.com/samuel1578/Dmayor (last commit `4da48ed UP3T3`)
**Scope:** Public Collections page + its navigation entries. Admin surface, Supabase `collections` table and homepage Fit Collections section untouched.

### Deleted / removed
- `src/pages/Collections.tsx` — **deleted** (the page queried Supabase `collections` and rendered an empty state).
- `src/App.tsx` — `/collections` route and `Collections` import removed.
- `src/components/Navbar.tsx` — Collections entry dropped from the shared `navLinks` array, which feeds **both** the desktop nav and the fullscreen hamburger, so both lost it in one edit (menu numbering now `01 Home … 05 Contact`); the now-unused `Layers` icon import removed.
- `src/components/Footer.tsx` — "Collections" link removed from the Shop column.

### Dead-link fixes
- `src/lib/homeContent.ts` — homepage **Explore All Fits** CTA repointed `/collections` → `/shop`.
- `public/_redirects` — added `/collections /shop 301` **above** the `/* /index.html 200` SPA fallback, so old URLs and bookmarks land on Shop instead of a blank screen.

### Deliberately left in place
- Admin sidebar's disabled `/admin/collections` "Soon" entry, the `collections` table type in `src/lib/supabase.ts`, and the Admin dashboard collections count — backend/admin surface, outside this request.

### Verification
- `npm run typecheck` clean · `npm run lint` 0 errors (6 pre-existing warnings) · `npm run build` success (2040 modules, was 2041).
- Repo-wide grep: zero storefront `/collections` links remain in `src/`; the only remaining match in the bundle is the disabled admin entry. `dist/_redirects` ships both rules in order.

### Files changed
`src/pages/Collections.tsx` (deleted), `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Footer.tsx`, `src/lib/homeContent.ts`, `public/_redirects`

---

## Sprint: Phase E1 — Orders Foundation + Checkout
**Date/Time:** 2026-09-28 10:53:27 UTC
**Status:** Complete (pending the manual migration below) — working tree, not committed
**Scope:** Order store + a real, atomic, authenticated checkout with server-authoritative totals. **NOT built:** Paystack (no SDK, no keys, no init, no webhook, no verification endpoint), admin order management, customer order-history list, refunds, carrier/shipment integration, email notifications, analytics, guest checkout, order notes UI. No screenshots / Playwright / Puppeteer (manual QA by the user).

### SQL — `supabase/migrations/008_orders_checkout_foundation.sql` (new, local only — NOT applied remotely)
Forward-only, idempotent, guarded by preconditions on `cart_items` / `set_updated_at()`. Nothing in `001`–`007` was edited.

**`public.commerce_settings`** — single-row config (`id boolean primary key default true check (id)`) read **only** by the SECURITY DEFINER functions: `currency` (`GHS`), `shipping_flat_fee`, `free_shipping_threshold`, `tax_rate`, `prices_include_tax`, `rules_confirmed`, `updated_at`. **PROVISIONAL:** defaults are `0 / null / 0 / true / false` — no delivery fee and no tax are applied, and `rules_confirmed = false` makes `/checkout` disclose that. RLS enabled with **no policies** and all grants revoked → the browser cannot read or write it at all.

**`public.orders`** — `id` uuid pk, `order_number` text unique not null, `user_id` uuid not null → `auth.users(id)` ON DELETE CASCADE, `status` (default `pending`), `payment_status` (default `unpaid`), `subtotal`/`shipping_amount`/`tax_amount`/`total_amount` numeric(12,2), `currency` (default `GHS`), delivery **snapshot** columns `recipient_name`, `phone`, `address_line1`, `address_line2`, `city`, `region`, `country`, `postal_code`, optional `customer_note`, `created_at`/`updated_at`.
- CHECKs: `status in ('pending','confirmed','processing','shipped','delivered','cancelled')`; `payment_status in ('unpaid','paid','failed','refunded')`; amounts `>= 0`; `total_amount = subtotal + shipping_amount + tax_amount`. Fulfilment status and payment status are **separate domains** and never combined.
- **No FK to the saved address.** The delivery columns are a snapshot copied at checkout, because a customer may later edit or delete `customer_addresses` and past orders must not move.

**`public.order_items`** — `id` uuid pk, `order_id` → `orders(id)` ON DELETE CASCADE, **nullable** `product_id` / `variant_id` → `products` / `product_variants` ON DELETE **SET NULL** (reporting links only), snapshots `product_name`, `product_slug`, `variant_sku`, `size`, `colour`, `unit_price`, `quantity`, `line_total`, optional `image_url`, `created_at`. CHECKs: `quantity > 0`, amounts `>= 0`, `line_total = round(unit_price * quantity, 2)`. Snapshots are authoritative for historical display — an archived product, deleted variant, renamed product or new price cannot rewrite a past order.

**Order numbers** — `public.order_number_seq` (revoked from every client role) + `TPS-YYYY-000001` built with `lpad(nextval(...)::int, 6, '0')` **inside** the checkout RPC. Race-safe; **no `count(*) + 1`** anywhere. Gaps are possible when a checkout rolls back, which is the accepted cost of being race-safe. UUIDs are never customer-facing.

**RLS + grants (customers)** — `orders`: SELECT only, `auth.uid() = user_id`, `to authenticated`. `order_items`: SELECT only, `exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())`. **No INSERT/UPDATE/DELETE policies at all**, and INSERT/UPDATE/DELETE are revoked from `authenticated`; `anon`/PUBLIC get nothing. A customer can never read another customer's orders, mutate a status or payment status, or delete an order.

**`public.preview_cart_order()`** — `stable`, SECURITY DEFINER, `set search_path = public, pg_temp`, returns jsonb: current lines (with snapshots + primary image), `settings`, `subtotal`, `shipping`, `tax`, `total`, `purchasableQuantity` and a `blockers[]` list. Read-only (never reserves or decrements) and used for display **and** the final revalidation.

**`public.create_order_from_cart(p_address_id uuid, p_customer_note text default null)`** — `volatile`, SECURITY DEFINER, `set search_path = public, pg_temp`, returns the created order rows. Atomic 15-step flow: authenticated caller → load cart → product active → variant active → variant belongs to the line's product → stock ≥ quantity → resolve current effective price → subtotal → shipping/tax from config → snapshot the caller's own address → insert order + items → decrement variant stock → sync legacy `products.stock` → **clear the cart** → return id + number. Any failure raises before/at that point and the whole transaction rolls back. Error contract: `'<code>|<human sentence>'` (`not_authenticated`, `config_missing`, `address_required`, `note_too_long`, `cart_empty`, `product_unavailable`, `variant_unavailable`, `variant_product_mismatch`, `insufficient_stock`). `payment_status` is hard-coded `'unpaid'` — there is no payment path in E1.

### Inventory — locking and decrement
- Authoritative source stays `product_variants.stock`; `products.stock` is **never** read for the decision.
- The validation loop selects the cart joined to `product_variants v` … `order by v.id for update of v`, so every variant row is **row-locked in a deterministic order** and two customers racing for the last unit serialise instead of overselling: the loser gets `insufficient_stock` and its whole transaction rolls back. Locking only `v` (never the left-joined `products`) keeps admin edits from deadlocking against checkout.
- Decrement is set-based after validation (`stock = stock - quantity` for the locked rows); the `product_variants_stock_check (stock >= 0)` constraint is the final guard against negatives.
- Legacy compatibility: after the decrement, `products.stock` is **re-derived** from `SUM(active variant stock)` for the affected products only — the same rule the Phase B Admin sync uses, so the admin screens stay consistent without `products.stock` ever becoming authoritative.

### Client data layer — `src/lib/checkout/orders.ts` (new)
`previewCartOrder()` → `rpc('preview_cart_order')`; `placeOrder(addressId)` → `rpc('create_order_from_cart', { p_address_id })`; `getOrderByNumber(number)` → `orders` + embedded `order_items` (RLS scopes it to the owner; a foreign number resolves to `null`, no existence leak); `checkoutErrorMessage()` maps the `'<code>|<sentence>'` contract to customer copy (known codes surface the server-authored sentence; network/unknown failures get a generic “nothing was charged, your cart is unchanged” message); `ORDER_STATUS_LABELS` / `PAYMENT_STATUS_LABELS` for display. All rows are parsed defensively (`asText` / `asNumber` / `asRow`) — no `any`, no trusted shapes. `src/lib/supabase.ts` gains `OrderStatus`, `OrderPaymentStatus`, `OrderRow`, `OrderItemRow` and their `Database` entries (`OrderInsert`/`OrderUpdate` are `never`, since only the RPC may write).

### Routes
- `/checkout` and `/order-confirmation/:orderNumber` are nested inside the existing **`AuthenticatedRoute`** (which sits inside the public `Layout`, so the navbar/Footer still render). A guest hitting **Proceed to Checkout** is redirected to `/login` with `state.from = '/checkout'` and returned to checkout after signing in. `CustomerLogin` already honoured `from`; `CustomerSignup` now honours it too (and the login ↔ signup links carry it), so creating an account mid-checkout also lands back on checkout. **No guest checkout.**
- `AccountLayout`'s disabled Orders placeholder is untouched — order history is a later phase.

### Checkout page (`src/pages/Checkout.tsx`, new)
- Loads saved addresses (`listAddresses`, default preselected) and the server preview in one parallel pass. No saved address → explicit CTA to `/account/addresses` and Place Order stays disabled.
- Cart summary renders the **server** lines: product, size, colour, quantity, current unit price, line total, plus the server's per-line `issue` when a line is not purchasable.
- Totals are the server's `subtotal` / `shipping` / `tax` (row shown only when > 0) / `total`, plus a disclosure panel while `rulesConfirmed` is false: “Delivery and tax rules have not been finalised for the store yet. The amounts above are the current unconfirmed defaults — no delivery fee and no tax are being added.”
- Blockers (price/stock/availability) are listed with **Re-check cart**; the button says **Place Order** (never “Pay Now”), with a footer stating that the order is recorded against the account as unpaid and no card details are collected.
- **§13 final revalidation:** on Place Order the preview is re-fetched first. Blockers → the page updates and refuses to submit. Any change in the displayed fingerprint (lines, quantities, unit prices, subtotal, shipping, tax, total) → the page refreshes to the new figures and asks the customer to review and click again, so a stale total is never silently accepted. (A last-millisecond change is still safe: the RPC recomputes everything server-side and would reject it.)

### Order confirmation (`src/pages/OrderConfirmation.tsx`, new)
Order number, placed date (localised), order status (`Pending`), payment status (`Unpaid`), item snapshots, totals, delivery snapshot and an optional note. Copy never claims a payment succeeded (“No payment has been taken”, “Payment is still outstanding”). CTAs: **View Order** — an in-page `#order-detail` anchor, because E1 has no order-history surface to link to — and **Continue Shopping**. Loading / error+retry / not-found states included.

### Cart clearing rule (§15)
The cart is cleared **inside the checkout transaction, after** the order row, the order items and the stock decrement have all succeeded — a failed checkout leaves the cart intact (rollback), and there is no code path that clears it earlier. On success the client calls the new `CartContext.refreshCart()` (re-reads `cart_items`), so the navbar badge reflects the committed server state instead of guessing.

### Cart UI cleanup (§16 + §1)
- **Removed** the hardcoded `₵50` delivery fee, the invented `Tax (10%)` line, the hardcoded `Grand total`, “Secure checkout with Paystack”, “Free returns within 30 days” and “Fast shipping across Ghana”. None of those was a confirmed business rule and no Paystack integration exists yet.
- The summary now shows **Subtotal**, a neutral **“Delivery & tax — Calculated at checkout”** row and **Total** with the caption “Before delivery and any applicable tax.” The right-hand notes are factual system statements only (checkout is for signed-in customers and the cart follows them into the account; delivery details come from saved addresses). Visual design is otherwise unchanged.
- **Proceed to Checkout** is now a real link to `/checkout` (and a disabled button while any line is unavailable).

### Business-rule safety (§1)
All commerce maths lives in exactly one place: the `commerce_settings` row + the two SECURITY DEFINER functions. The browser cannot supply prices, stock, totals, status or payment_status; `products.stock` is never authoritative; the service-role key is nowhere near the Vite app. Unconfirmed values are centralised, defaulted to neutral (no charge) and explicitly flagged (`rules_confirmed`) rather than being turned into policy.

### What remains manual
- Run `supabase/migrations/008_orders_checkout_foundation.sql` in the Supabase SQL editor (after `007`). If PostgREST does not see the new table/RPC immediately, run `notify pgrst, 'reload schema';`.
- **Confirm the real commerce rules before `rules_confirmed` is set true** — see the open questions below.
- Full E1 QA is manual (no browser automation in this repo).

### Verification
`npm run typecheck` clean · `npm run lint` 0 errors (the same 6 pre-existing warnings: 5 `react-refresh` + 1 `CartContext` `exhaustive-deps`) · `npm run build` success. No screenshots / Playwright / Puppeteer.

### Files changed
`supabase/migrations/008_orders_checkout_foundation.sql` (new), `src/lib/checkout/orders.ts` (new), `src/pages/Checkout.tsx` (new), `src/pages/OrderConfirmation.tsx` (new), `src/pages/Cart.tsx`, `src/contexts/CartContext.tsx` (`refreshCart`), `src/lib/supabase.ts`, `src/App.tsx`, `src/pages/auth/CustomerLogin.tsx`, `src/pages/auth/CustomerSignup.tsx`, `SPRINT_LOG.md`

### Manual next step
Run `supabase/migrations/008_orders_checkout_foundation.sql`, then the shortest functional test: sign in → add a variant to the cart → `/checkout` → (add an address first if the CTA shows) → **Place Order** → expect the order confirmation with a `TPS-2026-000001` reference, status `Pending`, payment `Unpaid`, delivery snapshot and totals; then check `/cart` is empty and the navbar badge is `0`, and that `product_variants.stock` dropped by the ordered quantity.

---

## Commerce Decisions / Open Questions
**Recorded, unanswered, not invented.** No shipping fee, tax treatment, returns policy, payment method or reservation rule has been implemented on assumption: the current behaviour is *no fee, no tax, unpaid, stock deducted at order creation*, with `commerce_settings.rules_confirmed = false` and a visible disclosure on `/checkout` until these are answered.

1. Is checkout restricted to authenticated customers permanently, or will guest checkout be supported later? *(E1 is authenticated-only by decision.)*
2. What is the actual shipping rule? — fixed fee? by city/region? free above a threshold? *(Config supports a flat fee plus an optional free-shipping threshold; nothing is charged today.)*
3. Is tax charged separately? — if yes, the exact rate? — and are catalogue prices tax-inclusive or tax-exclusive? *(Config supports a rate plus `prices_include_tax`; nothing is charged today.)*
4. Is “free returns within 30 days” an actual store policy? *(Removed from the cart UI; nothing replaces it.)*
5. What payment methods will exist before Paystack automation? *(None implemented — every order is created `unpaid`.)*
6. Should unpaid orders reserve/deduct stock immediately, or only after an Admin marks payment paid? *(E1 deducts at order creation.)*
7. How long may an unpaid order remain before it is cancelled and restocked? *(No expiry, no automatic restock.)*
8. Can customers cancel pending orders themselves? *(No — customers have no write access to orders.)*
9. Should order notes be supported at checkout? *(`customer_note` exists in the schema and the RPC accepts it, but the checkout UI deliberately collects no note.)*
10. Are delivery instructions needed separately from the postal address? *(Not modelled.)*

**Added during E2 (still unanswered — nothing was invented for them):**

11. **Customer cancellation policy.** May a customer cancel a pending order themselves, and if so which statuses are cancellable, does it restock, and does it require a reason? *(Not implemented: E2 is read-only — there is no cancel button anywhere, exactly as the brief requires while this is unresolved.)*
12. **Status transition wording.** What customer-facing labels should the fulfilment steps use? E2 shows the internal words (`Pending`, `Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`) verbatim. Does the store prefer copy like “Preparing”, “On its way” or “Completed”?
13. **Should customers see internal statuses at all?** Are `pending`/`confirmed`/`processing` internal operational states that should collapse into one customer-facing “In progress”, or should every step be shown?
14. **Refund visibility.** Should a `refunded` payment status be shown to the customer as-is, and should failed payment attempts be visible at all? *(E2 currently displays all four payment statuses verbatim, since the database is the source of truth.)*
15. **Tracking number / carrier requirements.** Will orders ever carry a courier name and tracking number for display? Nothing is modelled and the UI deliberately says it is not live tracking.

**Added during E3 (still unanswered — nothing was invented for them):**

16. **Should marking Paid automatically move Pending → Confirmed?** E3 keeps them fully independent: paying advances nothing, and an Admin confirms the order separately (which is deliberately the current behaviour, not an assumption).
17. **Can Admin mark Paid → Unpaid again, or should reversal require a special action?** Mis-clicks happen, so E3 currently allows any of the four payment states to be set, each behind the same manual update — with confirmation only for `paid` and `refunded`. `paid_at` is cleared when the order leaves `paid`, because no audit history is kept.
18. **What should happen to stock when an unpaid order is cancelled?** Directly related to Q6/Q7. E3 restocks nothing in any case and surfaces the situation on the order screen.
19. **Should a cancelled paid order automatically become Refunded, or stay Paid until a refund is confirmed?** E3 never couples them — cancelling leaves the payment status untouched.
20. **Do we need internal Admin notes per order?** The only note today is the customer's own `customer_note`; there is no internal note field.
21. **Do we need a payment reference field for bank/mobile-money/manual verification?** Nothing is stored today, so there is no way to record that a specific MoMo/bank reference paid a specific order.
22. **Do we need shipment tracking number and carrier fields before launch?** Not modelled (ties to Q15).
23. **Which order statuses should customers see vs internal-only statuses?** The Admin UI shows all six and the customer timeline shows the same six verbatim (ties to Q12/Q13).

_Also raised by E3 implementation, deliberately left alone:_ whether the operational timestamps should ever grow into a real status-history/audit table (E3 keeps only the latest timestamp per state), and whether the Admin transition map needs an explicit override path for corrections (E3 has none, so a mistake cannot be walked back through the UI).

_Also worth confirming later (not blocking E1):_ whether `orders.user_id` should remain `ON DELETE CASCADE` if account deletion is ever introduced (financial records usually prefer restrict/anonymise); whether unpaid orders should expire (ties to Q7); and whether the customer-facing order reference shape (`TPS-YYYY-NNNNNN`) should continue past 999999 orders in a year.

---

## Sprint: Phase E2 — Customer Orders + Tracking
**Date/Time:** 2026-09-28 10:58:13 UTC
**Status:** Complete — working tree, not committed. **No new migration required** (E1's RLS and schema already supported this).
**Scope:** Customer-facing order history, order detail and a restrained status timeline, plus real order data on the account overview. **NOT built:** admin order management, Paystack/payment automation/webhooks, carrier or GPS tracking, email notifications, refunds UI, customer order editing and **customer cancellation** (its rule is still an open commerce decision). No screenshots / Playwright / Puppeteer.

### Routes (`src/App.tsx`)
Both nested under the existing `/account` → `AccountLayout` → `AuthenticatedRoute` (session-only guard, no per-page auth checks):
- `/account/orders` → `AccountOrders` (history)
- `/account/orders/:orderNumber` → `AccountOrderDetail` (one order)

The placeholder comment for the deferred Orders route is gone, and `AccountLayout`'s disabled “Orders — Available after your first order” placeholder (desktop **and** mobile) is replaced by a real `NavLink` — the nav array is shared by both navs, so it became one entry (`Overview · Profile · Addresses · Orders`).

### Customer order queries — `src/lib/account/orders.ts` (new)
One clean data layer; no scattered Supabase calls and no N+1:
- `listMyOrders(userId)` — one `orders` select with an embedded `order_items(quantity)`, newest first. Item count is the sum of quantities (pieces) and `lineCount` the number of lines, from that single request.
- `getRecentOrder(userId)` — the same select, newest first, `limit 1` + `maybeSingle`.
- `countMyOrders(userId)` — head count, no row payload.
- `getMyOrder(userId, orderNumber)` — one `orders` select with its embedded `order_items`.
- Also exported: `ORDER_STATUS_LABELS`, `PAYMENT_STATUS_LABELS`, `FULFILMENT_STEPS`, `ACTIVE_ORDER_STATUSES`, `ORDER_FILTERS`, `orderMatchesFilter`, `countOrdersByFilter`, `formatOrderDate`, `formatItemCount`.
- Every row is parsed defensively (`asRow`/`asText`/`asNumber`) with status narrowing via explicit value lists — a malformed value degrades to `pending`/`unpaid` rather than propagating.
- **Moved out of `src/lib/checkout/orders.ts`** so an order is read from exactly one place: the order-detail query, its mapping and the status/payment labels now live here; `lib/checkout/orders.ts` stays checkout-only (preview, place order, checkout error mapping) and kept just its local status-narrowing lists. `OrderConfirmation` now reads through this layer too.

### History UI — `src/pages/account/AccountOrders.tsx` (new)
- Compact cards (no tables, so phones are unaffected): order number, date, item count, total, fulfilment status and `Payment: <status>` with a “View order” affordance; the whole card is a link to the detail route. Newest first (server-side `order by created_at desc`).
- Filters **All / Active / Delivered / Cancelled** with live counts, applied to the loaded list so switching costs no extra requests. `Active` = pending, confirmed, processing, shipped.
- Loading / error + retry / empty state (with a “Start shopping” CTA) / per-filter empty state.

### Detail UI — `src/pages/account/AccountOrderDetail.tsx` (new)
Order number + placed date (with time), then the shared body. “Back to orders”/“Continue shopping” actions. Loading, error + retry and a **not-found** state that reads the same whether the number does not exist or belongs to another customer.

### Shared body — `src/components/account/OrderDetailView.tsx` (new)
Rendered by **both** `/account/orders/:orderNumber` and `/order-confirmation/:orderNumber` — one implementation, one look:
- **Progress + payment, kept separate:** the timeline, then a distinct payment-status block whose copy is a factual reading of the recorded value (`Unpaid` → “Nothing has been collected for this order yet.”, plus “Payment is recorded separately from order progress.”). Fulfilment is never inferred from payment, and vice-versa.
- **Items** straight from the `order_items` SNAPSHOT columns: name, size, colour, SKU, quantity, unit price, line total, image when available. Names are deliberately **not** linked, so an archived/renamed product cannot create a dead or misleading link, and nothing is re-resolved from the current catalogue.
- **Delivery** from the order's address snapshot (with the customer note when one exists), and **totals** (`subtotal` / `delivery` / `tax` only when > 0 / `total`) with the recorded currency.

### Status timeline — `src/components/account/OrderStatusTimeline.tsx` (new)
`Pending → Confirmed → Processing → Shipped → Delivered` as an ordered list: completed steps are filled green with a check, the current step is ring-emphasised with `aria-current="step"` and labelled “Current”, upcoming steps are muted (“Upcoming”). Responsive by construction — a vertical list on phones, five columns from `sm`. **`cancelled` is never a step on that line**: it renders as its own terminal block (“This order was cancelled and its progress stops here.”). Heading is **“Order progress”** with the explicit line “The status recorded on this order — not live courier tracking” — no GPS, no map, no courier claim.

### Account overview integration — `src/pages/account/AccountOverview.tsx`
Real order data only, loaded in the same parallel pass as the existing address count (each fetch fails independently and degrades gracefully): a third count card **“Orders placed”** (`countMyOrders`) linking to `/account/orders`, and a **“Most recent order”** panel (`getRecentOrder`) showing order number, date, item count, total, fulfilment status and payment status, linking to the order. With no orders it shows an honest empty state (“You have not placed an order yet.” + “Start shopping”). Still no invented spend, points or tier.

### Order confirmation integration (§9)
`OrderConfirmation` now uses the shared `OrderDetailView` and its **View Order** CTA links to the durable `/account/orders/:orderNumber` page (the E1 in-page anchor is gone). Its header shows order number + placed date; status and payment now come from the shared body. It also reads through `lib/account/orders.ts` and gained an “All orders” action.

### Security / RLS behaviour (§11)
- RLS remains the only authority: `orders` is `select … using (auth.uid() = user_id)` and `order_items` is `select … using (exists (… o.user_id = auth.uid()))`; there are **no** insert/update/delete policies for customers and those verbs are revoked, so E2 added **no** new permissions and no new schema.
- Every helper also filters by the session user id, so a hand-edited `/account/orders/<other-customer-number>` URL resolves to `null` — the page shows the same “Order not found” state as a number that does not exist. Nothing reveals whether another customer's order exists.
- Customers stay read-only: no status change, no payment change, no totals editing, no order-item editing, no delete and **no cancellation** anywhere in the UI or the data layer.

### Verification
`npm run typecheck` clean · `npm run lint` 0 errors (the same 6 pre-existing warnings: 5 `react-refresh` + 1 `CartContext` `exhaustive-deps`) · `npm run build` success. No screenshots / Playwright / Puppeteer.

### Files changed
`src/lib/account/orders.ts` (new), `src/components/account/OrderStatusTimeline.tsx` (new), `src/components/account/OrderDetailView.tsx` (new), `src/pages/account/AccountOrders.tsx` (new), `src/pages/account/AccountOrderDetail.tsx` (new), `src/pages/account/AccountOverview.tsx`, `src/components/account/AccountLayout.tsx`, `src/App.tsx`, `src/pages/OrderConfirmation.tsx`, `src/lib/checkout/orders.ts` (reads moved out), `SPRINT_LOG.md`

### Manual next step
No migration to run (E2 reuses E1's schema and policies). Shortest test sequence: sign in → place one order through `/checkout` (or use an account that already has one) → `/account` (Orders placed count + Most recent order) → `/account/orders` (card with number, date, item count, total, statuses; try the All/Active/Delivered/Cancelled filters) → open the order (`Order progress` timeline, Unpaid payment block, item snapshots, delivery snapshot, totals) → then hand-edit the URL to another customer's order number and confirm the not-found state.

---

## Sprint: Phase E3 — Admin Orders + Manual Payment Tracking
**Date/Time:** 2026-09-28 11:04:00 UTC
**Status:** Complete (pending the manual migration below) — working tree, not committed
**Scope:** Admin operations for customer orders: the order queue, one order in full, and manual management of payment state and fulfilment state. **NOT built:** Paystack or any payment automation (no SDK, no keys, no init, no webhook, no verification), email notifications, refunds processing, carrier integration, customer cancellation, and **automatic restocking** (the rule is still unconfirmed — see §7 and the open questions). No screenshots / Playwright / Puppeteer.

### SQL — `supabase/migrations/009_admin_order_operations.sql` (new, local only — NOT applied remotely)
Forward-only, idempotent, guarded by preconditions on `orders`/`order_items`, `public.is_admin()` (Phase A) and `public.profiles` (005). Nothing in `001`–`008` was edited.

**New columns on `public.orders`** (lightweight operational timestamps, explicitly *not* an audit-event system): `paid_at`, `confirmed_at`, `shipped_at`, `delivered_at`, `cancelled_at` (all nullable `timestamptz`). Each records WHEN the order reached that state; a jump (pending → shipped) backfills the earlier steps so the progression stays coherent. `paid_at` is written only while the order is paid and nulled otherwise, so it always describes current state — there is no history of previous statuses by design.

**New index:** `idx_orders_status_payment_status on public.orders(status, payment_status)` for the admin queue.

**Five admin-only functions**, every one starting with a fail-closed `if not coalesce(public.is_admin(), false) then raise exception 'not_authorized|…'`:
- `admin_list_orders(p_search, p_status, p_payment_status, p_limit, p_offset)` — server-side search (order number, recipient name, delivery phone, customer full name, customer email — case-insensitive), exact status/payment filters, newest first, limit clamped 1..200. Returns one row per order with `item_count`/`line_count` (aggregated, so no N+1) and the customer's name/email/phone.
- `admin_get_order(p_order_id)` — jsonb `{ order: {…all order columns…}, items: [...], customer: {name,email,phone} }` via `to_jsonb`, so the client mapper matches the list columns.
- `admin_set_order_status(p_order_id, p_status)` — validates the transition map below, writes the matching timestamp, returns the updated row. It never touches `payment_status`.
- `admin_set_order_payment_status(p_order_id, p_payment_status)` — records `unpaid | paid | failed | refunded`, writes/clears `paid_at`, returns the updated row. It never touches `status`.
- `admin_order_stats()` — real counts only: `total`, `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `unpaid`, `paid`, `failed`, `refunded`, plus `paidTotal` = `SUM(total_amount)` over orders currently marked paid.

Grants: `execute` to `authenticated` only (revoked from `public`/`anon`); the internal `is_admin()` check is the real boundary. **No new table privileges and no new policies** — `orders`/`order_items` keep exactly the E1 customer SELECT-only rules, and the customer email is only reachable through the two admin read functions (`auth.users` is never exposed to PostgREST).

### Admin routes
Both under the existing `/admin` → `AdminRoute` (session + `is_admin()`) → `AdminLayout` shell: `/admin/orders` → `AdminOrders`, `/admin/orders/:id` → `AdminOrderDetail`. `AdminSidebar` now shows a real **Orders** entry (Collections and Blog remain the only deferred items).

### Admin order list (`src/pages/admin/AdminOrders.tsx`)
Desktop table (Order · Customer · Email · Date · Items · Total · Payment · Status) plus mobile cards, following the existing AdminProducts pattern. Search box debounced 300 ms; **Order status** and **Payment status** selects plus a Clear button. All three run server-side through `admin_list_orders` with a 50-row page and a “Show more” button (only shown when a full page came back), so the query is never unbounded. Newest first. Loading, error + retry, “no orders yet” and “no orders match these filters” states.

### Admin order detail (`src/pages/admin/AdminOrderDetail.tsx`)
Two-column layout: **Customer** (name, email, phone — name/phone fall back to the delivery snapshot when the profile is empty), **Delivery snapshot** (labelled as a checkout snapshot, with the customer note), **Items** (product, variant, SKU, quantity, unit price, line total, image; labelled as historical snapshot) with the **Totals** footer (subtotal / shipping / tax / total), then the two control cards.

### Manual payment management (§4)
A select over all four states plus **Update payment status**, which calls the admin RPC. `paid` and `refunded` open a `ConfirmDialog` first (dialog copy states plainly that nothing is charged and no money moves); `unpaid`/`failed` apply directly. The card shows the current state and, when present, “Marked paid …”. Only real states are recorded — no payment transaction is ever invented — and the card states that payment is maintained manually until an automated provider exists.

### Fulfilment + transition rules (§5, §6)
The card shows the current status, the recorded timestamps, and **only the allowed next steps as buttons** — the database enforces the same map and rejects anything else. `cancelled` is danger-styled and behind a confirm dialog. Terminal states show “This order is in a final state … No further status changes are allowed.”

| From | Allowed → |
| --- | --- |
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered`, `cancelled` |
| `delivered` | — (final) |
| `cancelled` | — (final) |

Backwards moves (e.g. `delivered → processing`) and re-opening a cancelled order are rejected with no override switch (none was specified). **Payment and fulfilment stay independent:** separate cards, separate RPCs, separate columns — marking an order paid never advances fulfilment, and shipping an unpaid order is allowed. Valid combinations such as Unpaid + Pending, Paid + Processing, Paid + Shipped and Refunded + Cancelled are all representable.

### Stock / cancellation behaviour (§7) — surfaced, not invented
**No restocking is implemented.** E1 deducts stock at order creation, but whether cancellation should return that stock is still an unconfirmed rule, so inventing it would silently move inventory. When an order is `cancelled`, the detail page shows an explicit **“Stock was not restocked”** blocker explaining that stock was deducted at checkout, that the restock rule is unconfirmed, and that variant stock can be adjusted in Products meanwhile. No `restocked_at` column and no restock RPC were added, so there is nothing half-built: when the rule is confirmed it should arrive as its own idempotent migration/RPC (guarded so it can never run twice).

### Customer reflection (§10)
Nothing extra was needed: the customer order pages read through `lib/account/orders.ts` on mount, and RLS already lets a customer read their own order's new `status`/`payment_status`, so an Admin change appears on `/account/orders/:orderNumber` (and in the list and the overview) on the next load. No realtime subscription, no cache and no refresh hack was added.

### Admin overview (§11)
`AdminDashboard` now loads `admin_order_stats()` alongside the catalogue counts (independent failure → “—”, never blocks the page) and renders an **Operations** section with real tiles: Pending, Unpaid, Processing, Shipped, Delivered, Cancelled and **Paid order value** (sum over orders currently marked paid), plus a “Manage orders” CTA and an explicit note that these are real counts, that payment is manual, and that nothing is a projected revenue figure. “Orders & payments” was removed from the Deferred list.

### Verification
`npm run typecheck` clean · `npm run lint` 0 errors (the same 6 pre-existing warnings: 5 `react-refresh` + 1 `CartContext` `exhaustive-deps`) · `npm run build` success. No screenshots / Playwright / Puppeteer.

### Files changed
`supabase/migrations/009_admin_order_operations.sql` (new), `src/lib/admin/orders.ts` (new), `src/pages/admin/AdminOrders.tsx` (new), `src/pages/admin/AdminOrderDetail.tsx` (new), `src/components/admin/AdminSidebar.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/lib/admin/format.ts` (`formatAdminDateTime`), `src/App.tsx`, `SPRINT_LOG.md`

### Manual next step
Run `supabase/migrations/009_admin_order_operations.sql` in the Supabase SQL editor (after `008`); if PostgREST does not see the new functions immediately, run `notify pgrst, 'reload schema';`. Shortest Admin ↔ customer cross-test: sign in as a **customer**, place an order at `/checkout` → sign in as **Admin** → `/admin/orders` (the order appears, newest first; try search by order number / customer email and the status filters) → open it → **Mark as Confirmed**, then set Payment to **Paid** (confirm the dialog) → sign back in as the customer and open `/account/orders/:orderNumber` → confirm the timeline shows Confirmed and the payment block shows Paid.

---

## Sprint: Phase E4 — Checkout / Order UX Polish + Invoice
**Date/Time:** 2026-09-28 11:34:39 UTC
**Status:** Complete — working tree, not committed. **No database migration** (E4 is presentation + client generation only).
**Scope:** Brand signature on the customer commerce surfaces, one global route scroll-restoration rule, and a real downloadable order invoice PDF generated on demand from the order's current recorded state. **Deliberately unchanged:** the order/payment architecture, fulfilment + transition rules, stock/restocking logic, every Admin workflow, and the account area's overall structure. **NOT built:** Paystack or any payment automation, email delivery, carrier tracking, admin invoice UI. No screenshots / Playwright / Puppeteer (manual QA by the user).

### 1. GlitchBrand placements (existing component + tokens, nothing duplicated)
The existing `GlitchBrand` component was reused as-is — no new glitch CSS, no new surface tokens. Default `page` surface everywhere below, because all five surfaces sit on `bg-ghana-light` / `dark:bg-ghana-dark`. Each mark is wrapped in a plain `div` because the module CSS is unlayered and would beat spacing utilities on the mark itself.

| Surface | Placement | Size |
| --- | --- | --- |
| `/checkout` | above the “Checkout” eyebrow, at the top of the page intro | `corner` |
| `/order-confirmation/:orderNumber` | between the “Order recorded” badge row and the “Thank you — your order is in” heading | `lg` |
| `/account` | **unchanged** — existing desktop hero-row mark + mobile `sticky` bar kept exactly as they were | `md` / `sticky` |
| `/account/orders` | above the “Orders” heading | `corner` |
| `/account/orders/:orderNumber` | above the “Order” eyebrow, clear of the order number, status blocks and timeline | `corner` |

No mark sits on or near an order number, payment status, the status timeline or an action row, the `prefers-reduced-motion` behaviour already inside the component is untouched, and on mobile each mark stays in normal flow (no fixed/overlay positioning), so it can never push actions off-screen.

### 2. ScrollToTop — one global rule, no per-page scroll calls
New `src/components/ScrollToTop.tsx`, mounted **once** inside `<BrowserRouter>` in `App.tsx` (before `<Routes>`). It uses `useLocation()` + `useNavigationType()`:
- **`PUSH`/`REPLACE`** (Cart → Checkout, Checkout → Order Confirmation, Orders → Order Detail, admin links, every future result page) → `window.scrollTo({ top: 0, left: 0, behavior: 'auto' })`, so the destination opens at the top.
- **`POP`** (browser back/forward) → deliberately hands-off, so the browser restores where the customer actually was instead of being yanked to the top.
- **A hash target** (`#section`) is honoured when the element exists — `scrollIntoView({ block: 'start' })` — and only falls back to top when the hash is not present on that route. (No in-page anchors remain in the app; the old `#order-detail` anchor was already removed in E2, so this is future-proofing.)
- Instant, not smooth, so it never animates over the scrollytelling hero and respects reduced-motion by simply not animating.

No `window.scrollTo` exists in any page component — the behaviour lives in exactly one place, and future payment-confirmation routes inherit it automatically.

### 3. Invoice generator — `src/lib/orders/invoice.ts` (new)
**PDF dependency added: `jspdf@^4.2.1`** (the current release line, actively co-maintained, ~416 kB). It is the only PDF dependency, it is browser-side only, and it is **imported dynamically** inside the generator (`const { jsPDF } = await import('jspdf')`), which the build confirms: jsPDF lands in its own lazy chunk and the main bundle contains only the `import()` reference — nothing is downloaded until a customer actually clicks Download Invoice. No screenshots, no page rasterising, no `html2canvas` on the interface, and no order data is ever sent to a third-party service.

Exports: `buildOrderInvoicePdf(order)` (returns the document), `downloadOrderInvoice(order)`, `downloadOrderInvoiceByNumber(userId, orderNumber)` (reads the order through the customer's normal RLS-scoped query first), and `invoiceFileName(orderNumber)`.

**Filename:** `${orderNumber}-invoice.pdf` → `TPS-2026-000001-invoice.pdf`. One stable format, identical paid or unpaid (the state lives inside the document where it belongs).

**Data source (§6):** the document is built from the order's current recorded state at the moment of the download — never cached, never generated or stored at checkout, no new table and no stored artefact. Every value comes from the `orders` / `order_items` SNAPSHOT columns (product name, size, colour, SKU, quantity, unit price, line total, image not used) plus the delivery snapshot. The catalogue is never consulted, so a renamed/repriced/archived product or a removed variant cannot change a past document.

**Document contents:**
- **Brand** — “THE PROXY SHOP” wordmark with the gold rule (no image asset needed; pure text keeps the PDF small and crisp).
- **Title** — `ORDER INVOICE`, plus the generation date/time.
- **Conspicuous payment banner** — a bordered, tinted block spelling the state out in words: `PAYMENT STATUS: UNPAID` / `PAID` / `FAILED` / `REFUNDED`, with a plain-language second line. Red border for anything that is not paid, gold for paid.
- **Order information** — order number, order date, current **order status** and current **payment status** (both as real text), and the document's generation date/time.
- **Customer / delivery** — recipient name, phone, and the full delivery address snapshot (with the customer note deliberately excluded to stay inside the standard-font character set).
- **Items** — one row per snapshot line: product name, size, colour, SKU, quantity, unit price, line total.
- **Totals** — subtotal, delivery, tax only when greater than zero, and the total, each amount printed as `GHS 1,234.00` (the cedi sign `\u20B5` is not in jsPDF's standard font encoding, so the ISO currency code is used instead of a garbled glyph; a small sanitiser also maps typographic characters to ASCII).
- **Footer** — “Generated from the order record held by The Proxy Shop.”, the order number, and page numbering; every non-paid document additionally states **“This document does not confirm payment.”** in red on **every** page.

Multi-page safe: item rows page-break with the table header redrawn, and the footer is stamped on every page. Payment/fulfilment state is expressed as text throughout, never colour alone.

### 4. Download Invoice placement + loading/error UX
One reusable component, `src/components/orders/DownloadInvoiceButton.tsx`, used in all four places, with `primary` / `secondary` / `quiet` variants:
- **Order Confirmation** — primary action in the confirmation action row (the row was tidied: the redundant “All orders” button was dropped since “View Order” leads to the account order page, which links back).
- **Account order detail** — primary action in the footer row, above “Back to orders” / “Continue shopping” (the latter changed from solid green to the outline style so there is one primary action).
- **Orders list** — a restrained `quiet` action on every order card. The card is no longer one big link (nested interactive elements are invalid): the order number and a “View order” link now navigate, next to **Download invoice**.
- **Account overview** — a single `quiet` action inside the Most recent order panel only; no other account section gained invoice UI.

The button shows **“Preparing invoice…”**, disables itself (`disabled` + `aria-busy`) so repeated clicks do nothing, and on failure shows **“We couldn't prepare the invoice. Please try again.”** — library errors are logged to the console, never surfaced. Its accessible name reads “Download Invoice for order TPS-…”.

### 5. Security (§11)
The invoice uses only data the customer can already read. `downloadOrderInvoiceByNumber` calls the existing `getMyOrder(userId, orderNumber)` (RLS: `auth.uid() = user_id`), and pages that already hold an order pass that object. No service-role key, no RLS bypass, no elevated grants, **no order data accepted from URL parameters**, and nothing is stored or transmitted. A customer cannot download a document for an order they cannot read.

### 6. Admin (§12)
Untouched: no Admin behaviour changed and no Admin invoice UI was added. `src/lib/orders/invoice.ts` takes a plain `OrderDetail`, so exposing it in Admin later is a one-line import rather than a refactor.

### Verification
`npm run typecheck` clean · `npm run lint` 0 errors (the same 6 pre-existing warnings: 5 `react-refresh` + 1 `CartContext` `exhaustive-deps`) · `npm run build` success. Bundle check: jsPDF is emitted as its own lazy chunk (`jspdf.es.min-*.js`, 416 kB) and the main chunk references it only via `await import(…)` — the library is never in the initial download; `html2canvas` / `dompurify` / `canvg` chunks are also emitted but are only requested by jsPDF's unused `html()` path. `npm install` added only `jspdf` + its optional dependencies (240 lockfile lines added, **no existing package version changed**). No screenshots / Playwright / Puppeteer.

### Files changed
`src/lib/orders/invoice.ts` (new), `src/components/orders/DownloadInvoiceButton.tsx` (new), `src/components/ScrollToTop.tsx` (new), `src/App.tsx`, `src/pages/Checkout.tsx`, `src/pages/OrderConfirmation.tsx`, `src/pages/account/AccountOverview.tsx`, `src/pages/account/AccountOrders.tsx`, `src/pages/account/AccountOrderDetail.tsx`, `package.json`, `package-lock.json`, `SPRINT_LOG.md`

### Manual test (§17)
1. As a customer, add an item and place an order at `/checkout` — the **confirmation page opens at the top** (even though checkout was scrolled down) and shows the brand mark above the heading.
2. Click **Download Invoice** → `TPS-2026-000001-invoice.pdf` downloads and reads **PAYMENT STATUS: UNPAID** in a red box, with “This document does not confirm payment.” in the banner and the footer.
3. As Admin, open the order at `/admin/orders/:id`, **Mark as Confirmed**, then set Payment to **Paid**.
4. Back as the customer, reload `/account/orders/:orderNumber` (timeline = Confirmed, payment = Paid) and click **Download Invoice** again → the same filename now reads **PAYMENT STATUS: PAID** and **Order status: Confirmed**, i.e. the current recorded state, not the checkout state.
5. Bonus: click Download Invoice from `/account/orders` and from the account overview’s Most recent order panel — both download without opening the order first.

---

## Current state (after Phase E4)
**Live and working:** the public storefront on the normalized catalogue model (Home, Shop, PDP, QuickView, variant-aware cart); customer auth + account area (overview, profile, addresses, **order history + order detail with the status timeline**); persistent Supabase cart with guest merge; atomic authenticated checkout (`/checkout` → `/order-confirmation/:orderNumber`); **order invoice PDFs downloaded on demand from current recorded state**; Admin auth + catalogue management + **order operations (manual payment status and validated fulfilment transitions, real operational counts on the dashboard)**; global route scroll restoration; the GlitchBrand brand system across the storefront, account and commerce surfaces. All behind RLS; one shared AuthContext.

- **Supersedes the “Current state (after Phase D3)” snapshot above** for anything commerce-related.
- **Still not built:** Paystack or any payment automation (payment is manual: unpaid / paid / failed / refunded), payment webhooks/verification, email notifications (order confirmation, shipping, payment), automatic restocking on cancellation, customer-initiated cancellation, refunds processing, carrier/tracking integration, customer order-history **admin** tooling beyond the E3 queue, Collections CRUD, Blog CRUD, password reset UI, wishlist, social login, analytics, newsletter admin.
- **Migrations in this repo are all manual, local only:** `004`, `005`, `006`, `007`, `008`, `009`. Nothing is applied remotely by the app.

## Open follow-ups (current — after Phase E4)
- **Run `supabase/migrations/008_orders_checkout_foundation.sql` manually in Supabase** — checkout, orders and the invoice data are inert until it is applied (after `007`).
- **Run `supabase/migrations/009_admin_order_operations.sql` manually in Supabase** — the Admin order queue, manual payment/fulfilment controls and dashboard operation counts need it (after `008`).
- **Run `supabase/migrations/004_admin_catalogue_policies.sql` manually in Supabase** if it is still not applied — Phase B admin writes are inert without it.
- **Confirm the unresolved commerce rules** (see “Commerce Decisions / Open Questions”): shipping/tax, stock reservation, unpaid-order expiry, cancellation, restock-on-cancel, payment references, customer-visible statuses. In particular, **do not set `commerce_settings.rules_confirmed = true` until the real shipping/tax values are decided**, and implement restock-on-cancel as its own idempotent migration when that rule is confirmed.
- **Legacy columns:** `products.images` / `products.stock` still exist and are still written by the Admin sync (`products.stock` is re-derived from variant stock by the checkout RPC too). A later cleanup migration can drop the compatibility sync first, then the columns.
- **Bundle weight:** jsPDF is lazy-loaded, so it never affects the initial download; the main chunk is still ~840 kB (gzip ~235 kB) and route-level code splitting remains the biggest remaining win.
- **Footer `logo.png` (730,923 bytes ≈ 730.92 kB build output)** should still be replaced with the optimised asset. (An earlier note here said 5.8 MB; the measured source file is 730.92 kB. `og-image.png` is larger at 901.15 kB.)

---

## Sprint: Pre-F/G/H Readiness Investigation

**Type:** investigation only. **No features, migrations, policies, RLS, routes, business rules or UI were changed.** Source files were only *read*; the two files written are the readiness document and this log entry.

**Scope.** Precise readiness report to plan Phase F (Paystack / payment automation), Phase G (fulfilment, restock, shipment operations) and Phase H (launch hardening), deliberately bounded to the requested items — discounts, wishlist, social login, newsletter admin, Blog/Collections CRUD, analytics, email/Brevo, custom domain email and visual redesign were excluded.

**What was inspected.**
- `supabase/migrations/001–009`: tables, indexes, constraints, policies, grants, triggers, all seven `SECURITY DEFINER` functions, the `is_admin()` dependency, `search_path` handling and `profiles_guard_update`.
- Money and inventory paths: `create_order_from_cart`, `preview_cart_order`, the admin order RPCs, `commerce_settings`, `order_number_seq`, the `orders` CHECK constraints, and `orders.user_id on delete cascade`.
- Client code: `src/App.tsx` (route graph and static imports), `src/lib/checkout/orders.ts` (RPC error mapping), `src/lib/account/orders.ts`, `src/lib/orders/invoice.ts`, `src/components/orders/DownloadInvoiceButton.tsx`, `src/components/auth/AuthenticatedRoute.tsx`, `src/pages/auth/CustomerLogin.tsx` / `CustomerSignup.tsx`, `src/contexts/AuthContext.tsx`, `src/components/Footer.tsx`, `src/pages/Contact.tsx`, `src/lib/aboutContent.ts`.
- Configuration: `vite.config.ts` (`base: './'`), `index.html` (canonical/OG), `public/_redirects`, `.env` (key names only), `.gitignore`, `package.json`, `package-lock.json` (no `paystack`), the `supabase/` tree (no `functions/`), and the absence of `vercel.json` and `.github/workflows`.
- Production behaviour: live HTTP checks against `https://theproxyshop.vercel.app`.

**Key blockers found.**
1. **Every route except `/` returns HTTP 404 in production** — verified for `/shop`, `/checkout` and `/order-confirmation/TPS-2026-000001`. `public/_redirects` is Netlify-only syntax that Vercel ignores, no `vercel.json` exists, and `base: './'` means assets would still resolve against the wrong directory on multi-segment paths. No deep link, refresh, bookmark or future Paystack callback works until this pair is fixed. **Must before launch, and it blocks Phase F.**
2. **No server-side secret surface exists at all** — recorded explicitly so Phase F does not put a Paystack secret into a `VITE_*` variable.
3. **Permission-model gaps for F:** no payment reference, provider, channel or source columns; no payment attempt/webhook idempotency ledger; no server-side amount verification against `orders.total_amount`.
4. **Stock/restock rule unresolved:** stock is deducted at order creation, cancellation never restocks, and there is no `restocked_at` marker — adding a naive restock would be double-restock prone.
5. **The repo is not self-contained:** `003` is missing and the Phase A migration creating `profiles`/`is_admin()`/the signup trigger is not versioned here, though `005`/`006`/`009` depend on it (`009` raises if `is_admin()` is absent).
6. **The Contact form is a mock** — it awaits a 1-second timer and reports success while discarding the message.
7. **The footer advertises Visa / Mastercard / MTN MoMo / Paystack** although no payment collection of any kind exists.
8. **A single 840.51 kB eager JS bundle (gzip 234.57 kB)** contains the entire Admin surface plus Account/Checkout/Orders; there is no `React.lazy` anywhere.
- No **Critical** security finding exists in the schema/policy/grant layer. The items above are launch-readiness issues; the security-specific notes are two High (no secret store yet; production deep links), several Medium (no payment attribution, no admin action log, `on delete cascade` order loss) and Low (`profiles_guard_update`'s `current_user` caveat, pathname-only redirect state).

**Readiness document created.** `PRE_FGH_READINESS.md` — report ready to plan from, with the required sections: executive summary; Phase F current state / missing pieces / F1–F3 split; Phase G stock-cancellation, tracking fields and G1–G2 split; Phase H performance, security/RLS, production environment, failure paths (15 scenarios), invoice correctness, auth redirects, placeholder-claim audit and H1–H3 split; database/migration gaps; production configuration checklist; owner decisions (10 carried over + 9 new); priority matrix using only **Must before real payments / Must before launch / Can defer**.

**Verification / commands used.** `npm run build` (asset and gzip sizes recorded), `npm run typecheck`, `npm run lint`, `git check-ignore -v .env`, dependency and migration inventory greps, and live HTTP checks of three production URLs. No screenshots, Playwright, Puppeteer or any browser automation.

**Exact files changed.** `PRE_FGH_READINESS.md` (new) and `SPRINT_LOG.md` (this entry). **No** application code, migration, policy, route or configuration file was modified.
- Deferred sprints: Paystack phase, email notifications, Collections CRUD, Blog CRUD, newsletter admin, password reset UI.
- Stale `.kilo/worktrees/tree-nest/` worktree causes pre-existing lint noise — not in scope.
- Optional breakpoint screenshot matrix — explicitly skipped across sprints.

---

## Sprint: Shop Price Filter + Hero Category Deep Links
**Date:** 2026-10-05
**Status:** Complete
**Scope:** Storefront only — `src/pages/Shop.tsx` + this log entry. No schema, product data, Admin, Product Detail, Cart, Checkout, Orders, Account, Paystack, Navbar, Footer, hero motion or imagery changes.

### Price-filter root cause
The Price Range checkboxes in `src/pages/Shop.tsx` were purely presentational: plain `<input type="checkbox">` elements with no `checked`, no `onChange`, no state and no price-filtering code anywhere in the file. Only category and sort were applied to the product list, so toggling a range only flipped the visual box. Prices were never the problem — `CatalogueProductSummary.price` is already a plain number (built by `toNumber`, not a string and not minor units). The visible bands were also stale dollar-era values (Under ₵50 / ₵50-₵100 / ₵100-₵200 / Over ₵200) against a catalogue priced ~₵250-₵550+, so even wired up they would have matched almost nothing.

### New GHS ranges (half-open: min inclusive, max exclusive — no overlap, no gap)
- Under ₵300 → `price < 300`
- ₵300 - ₵399 → `price >= 300 && price < 400`
- ₵400 - ₵499 → `price >= 400 && price < 500`
- ₵500 and above → `price >= 500`

Defined once as a module-level `PRICE_RANGES` const in `Shop.tsx` with `matchesPriceRange(price, range)`; the checkboxes are controlled and toggle ids in `selectedPriceRanges: PriceRangeId[]`.

### Multi-range semantics
OR. A product matches when it satisfies ANY selected band (`selectedPriceRanges.some(...)`). No selection = every price passes. Example: "Under ₵300" + "₵500 and above" shows both ₵250 and ₵550.

### Composition
Category, price and sort are one derived pipeline in a single `useMemo`: filter by category AND price, then sort. Each control writes only its own state, so no control resets another — e.g. Shirts + ₵300-₵399 + Price: Low to High returns only Shirts in that band, ordered ascending.

### Category URL parameter architecture
`useSearchParams` (react-router-dom 7, `BrowserRouter` already in `App.tsx`) is the source of truth. `?category=` holds a category **slug**, never a database UUID. The slug is resolved to the id with `categories.find(c => c.slug === categorySlug)` and compared against `product.categoryId`. Category clicks clone the existing `URLSearchParams`, `set('category', slug)` or `delete('category')` for All Products, then `setSearchParams(...)` — SPA push navigation, no reload, other params preserved, browser back/forward works. An unknown slug (`/shop?category=does-not-exist`) resolves to `null` and behaves as All Products instead of an empty grid; the URL is left as-is. Price bands deliberately stay component state this sprint (not URL-encoded).

### Hero CTA mappings
Already correct in `src/lib/hero.ts`, verified and left untouched (`HeroNarrative` renders `<Link to={chapter.href}>`):
- Shirts → `/shop?category=shirts`
- Trousers → `/shop?category=trousers`
- Hoodies → `/shop?category=hoodies`
- Shoes → `/shop?category=shoes`

### Files changed
- `src/pages/Shop.tsx` — price filter wired up + new bands, category driven by URL slug param, composed filter/sort pipeline.
- `SPRINT_LOG.md` — this entry.
- **Not changed:** `src/lib/hero.ts`, `src/components/hero/*` (already correct).

### Verification
`npm run typecheck` clean; `npm run lint` 0 errors (8 pre-existing warnings in `src/contexts/*` and the stale `.kilo/worktrees/tree-nest/` copy, none in Shop); `npm run build` succeeded (same pre-existing chunk-size / browserslist notices). Manual test sequence: each band alone; two bands together; Shirts + band + sort; direct `/shop?category=shirts`; refresh keeps Shirts selected; hero CTAs for all four categories.

**SQL: no migration required** — category slugs already exist (`supabase/migrations/002_seed_proxy_shop_categories.sql` seeds shirts/trousers/hoodies/shoes) and no schema, policy or product data was touched.

### Follow-up — hero CTA hit-testing (`src/components/hero/HeroNarrative.tsx`)
Manual testing showed the "Explore …" buttons were dead. Root cause: all six `NarrativeShell` layers are full-bleed `absolute inset-0` stacked in DOM order, and the closing narrative is the last sibling — so it covered every chapter CTA with an invisible-but-hit-testable panel. Fix: each shell derives a `pointerEvents` MotionValue from its own opacity (`> 0.5 → auto`, else `none`), so only the shell actually on screen accepts clicks. Motion, imagery, GlitchBrand placements and scroll windows untouched. `npm run typecheck`, `npm run lint` (0 errors) and `npm run build` all pass.

---

## Sprint: Footer Payment Brand Logos
**Date:** 2026-10-05
**Status:** Complete
**Scope:** The payment-method row of `src/components/Footer.tsx` only. Checkout, payment/Paystack integration, Navbar, public routes, auth, orders, Admin, Supabase and the footer navigation structure were not touched.

### Changes
- **Text payment pills removed.** The four bordered text divs (Visa / Mastercard / MTN MoMo / Paystack) were replaced by real brand images. No text pills left behind.
- **MTN MoMo removed** from the footer entirely (and it exists nowhere else in the codebase).
- **Local assets only** from `public/payment-logos/` — no remote fetches, no hotlinking: `visa.jpeg` (JPEG, 1335x430), `mastercard.png` (PNG, 1000x1000), `paystack.png` (PNG, 2400x455). Mixed JPEG + PNG supported as-is; nothing renamed or moved.
- **Visual treatment:** a shared `h-9` chip (`rounded-md border border-white/10 bg-black px-3`) per mark, image `h-5 sm:h-6 w-auto object-contain`. That lands the logos at 20px mobile / 24px desktop, keeps aspect ratio, allows natural width, no stretching, no recolouring and no CSS filters. Chips are opaque black because the Visa JPEG and the Mastercard PNG both carry a pure-`#000000` background (verified by pixel probe) — they blend seamlessly into the tile instead of showing a black rectangle against the footer's `#111111`; Paystack's transparent PNG sits on the same tile, so all three read consistently. Hairline `white/10` border keeps the tile legible in both themes.
- **Accessibility:** descriptive `alt` text on every mark — `Visa`, `Mastercard`, `Paystack` (not empty alt).
- **Responsive:** `flex flex-wrap` + `gap-3` with a compact section, so marks wrap on narrow screens and never overflow the footer.

### Files changed
- `src/components/Footer.tsx`
- `SPRINT_LOG.md` (this entry)

### Verification
`npm run typecheck` clean, `npm run lint` 0 errors (same 8 pre-existing warnings), `npm run build` succeeded. No screenshots, Playwright or Puppeteer.

**SQL: no migration required** — pure front-end asset/visual change; no schema, policy or data touched.

---

## Sprint: Phase H0.1 — Payment Metadata + Admin Payment Center
**Date:** 2026-10-05
**Status:** Complete
**Scope:** Payment metadata foundation + Admin payment management + a customer payment placeholder. **No Paystack integration of any kind.** No callback route, no webhook, no initialization, no verification, no secret, no SDK.

### Migration
- **New forward-only migration:** `supabase/migrations/010_payment_metadata_foundation.sql` (`001`–`009` untouched). Idempotent: `add column if not exists`, `drop constraint if exists` + re-add, `drop trigger if exists` + create, `create or replace function`, guarded precondition `do $$` block.

### New columns on `public.orders`
- `payment_reference text` — optional external bank/MoMo/transfer reference recorded by Admin. Never generated by the app.
- `payment_provider text` — nullable free text (no auto-population; `Paystack` is not written).
- `payment_channel text` — nullable free text (no invented value).
- `payment_source text` — nullable, constrained to `manual | paystack`.
- `payment_updated_at timestamptz` — when the payment state/metadata last changed.
- New index `idx_orders_payment_source` for the queue filter. `paid_at` retained unchanged.

### `payment_updated_at` vs `paid_at`
- `paid_at` = when the order is CURRENTLY marked paid (cleared when it moves away from paid).
- `payment_updated_at` = last payment-state/metadata change, refreshed by a plain `BEFORE UPDATE` trigger (`set_orders_payment_updated_at`) that fires only when `payment_status`, `payment_reference`, `payment_provider`, `payment_channel` or `payment_source` actually changes. It never touches `paid_at` or order status.

### Admin payment RPCs (admin-only, SECURITY DEFINER)
Every function uses the Phase E3 pattern: `set search_path = public, pg_temp`, fail-closed `if not coalesce(public.is_admin(), false)`, `revoke execute` from `public`/`anon`, `grant execute` to `authenticated`.
- `admin_list_payments(p_search, p_payment_status, p_payment_source, p_limit, p_offset)` — returns order id, order number, customer name/email, total, currency, payment status/source/provider/channel/reference, `paid_at`, `payment_updated_at`, `created_at`. Search covers order number, recipient/customer name, email and payment reference. Newest orders first; limit clamped 1–200.
- `admin_get_payment(p_order_id)` — payment-focused jsonb (order summary + customer + all payment fields). Deliberately NOT the full Admin order payload.
- `admin_set_manual_payment(p_order_id, p_payment_status, p_reference, p_provider, p_channel)` — the single manual-payment write path. No money moves, no network call, order status untouched.

### Existing order-payment RPC (Option A — no duplicated logic)
- `admin_set_order_payment_status(uuid, text)` is **preserved but refactored to delegate to `admin_set_manual_payment`**. Existing error contract is unchanged (`invalid_status`, `no_change`, `order_not_found`), and it now also records `payment_source = 'manual'` — the correct attribution. One payment-write implementation, no drift; existing Admin order functionality is not weakened.

### Payment-source semantics
- `manual` is the only source actively written, and it is written **server-side**.
- `paystack` exists only as a forward-compatible allowed value; nothing writes it in this sprint. The Paystack filter may show zero results until Phase F — expected.
- New orders keep `payment_source = null` until an Admin records a payment. No source is invented at checkout.

### Manual-payment rules
- The client never sends a payment source and there is **no source selector** in the UI.
- Optional reference/provider/channel are only written when supplied (blank/null keeps the stored value). Length caps: reference 200, provider/channel 100.
- `paid_at` is set when the order becomes paid (preserving the original moment if metadata is re-recorded while already paid) and cleared otherwise. `no_change` is raised when the status is unchanged and no new metadata is supplied.
- Payment status and order status remain **separate domains** — no `paid → confirmed` or `refunded → cancelled` coupling.

### Admin routes
- `/admin/payments` → `AdminPayments` (payment queue/history).
- `/admin/payments/:orderId` → `AdminPaymentDetail`.
- Both live under `AdminRoute` → `AdminLayout`; **Payments** is enabled in the Admin sidebar (Overview, Products, Categories, Orders, Payments). Collections/Blog remain deferred.

### Admin payment list
- Columns: Order, Customer, Email, Amount, Payment status, Source, Provider, Channel, Reference, Updated, View.
- Filters: payment status (All / Unpaid / Paid / Failed / Refunded) and payment source (All / Manual / Paystack). Debounced search. Server-side RPC paging with "Show more" — never a client-side full-table load.

### Admin payment detail
- Order (number, order status, created date, amount, link to `/admin/orders/:id`), Customer (name, email, phone), Payment record (status, source, provider, channel, reference, paid_at, payment_updated_at), and a Manual Update form (status + optional reference/provider/channel).
- Copy: “This records a payment manually. No payment is collected by this action.” Confirmed via `ConfirmDialog` for Paid (“This marks the order as paid manually. No money will be charged.”) and Refunded (“This records the payment as refunded. This does not issue a refund through a payment provider.”).

### Customer payment view + Pay Now placeholder
- `OrderDetail` now carries the payment metadata; `OrderDetailView` (shared by `/order-confirmation/:orderNumber` and `/account/orders/:orderNumber`) shows reference, method, paid-at and last-updated **when present**, plus a disabled **Pay Now** button for `unpaid`/`failed` with the copy “Online payment is not available yet. Nothing is charged when you place an order.” Phase F replaces this placeholder with real Paystack initialization/verification and real copy.

### Admin overview
- One compact Payments section with real counts (Unpaid / Paid / Failed / Refunded) and a link to the payment center. No fake revenue charts; the E3 paid-order value is reused as-is.

### Types / data layer
- `src/lib/admin/payments.ts` — all Admin payment RPC calls live here (no RPC calls scattered in pages), with defensive parsing, no `any`, and a payment-specific error mapper.
- `src/lib/supabase.ts` — `OrderRow` gains `payment_reference`, `payment_provider`, `payment_channel`, `payment_source` (`PaymentSource | null`), `payment_updated_at`, `paid_at`; new `PaymentSource` type.
- `src/lib/account/orders.ts` — `OrderDetail` + `DETAIL_SELECT` + mapper extended with the payment fields (customer reads their own row via the existing RLS SELECT).

### Security
- No service-role key in Vite; no Paystack key anywhere; all Admin reads/writes gated by `public.is_admin()`.
- Normal customers cannot succeed at Admin payment RPCs: they are granted only to `authenticated` but re-check `is_admin()` and raise `not_authorized` for a non-admin.
- Customer `orders`/`order_items` SELECT access is unchanged; **no new table grants, no broad UPDATE grants**.
- `payment_source` cannot be chosen by the client; the database hard-codes `manual` in `admin_set_manual_payment`.

### Paystack — NOT implemented
No callback route, no webhook, no initialization, no verification, no secret, no SDK, no dependency. No fake transactions or references; no order is ever auto-marked paid.

### Files changed
- `supabase/migrations/010_payment_metadata_foundation.sql` (new)
- `src/lib/admin/payments.ts` (new)
- `src/pages/admin/AdminPayments.tsx` (new)
- `src/pages/admin/AdminPaymentDetail.tsx` (new)
- `src/App.tsx` — Admin payment routes
- `src/components/admin/AdminSidebar.tsx` — Payments nav
- `src/pages/admin/AdminDashboard.tsx` — payment operations section
- `src/lib/supabase.ts` — `OrderRow` payment fields + `PaymentSource`
- `src/lib/account/orders.ts` — customer `OrderDetail` payment fields
- `src/components/account/OrderDetailView.tsx` — customer payment details + Pay Now placeholder
- `SPRINT_LOG.md` (this entry)

### Verification
- `npm run typecheck` → clean.
- `npm run lint` → 0 errors (same 8 pre-existing warnings in `src/contexts/*` and the stale `.kilo/worktrees/tree-nest/` copy).
- `npm run build` → succeeded.
- No screenshots, Playwright or Puppeteer. Migration not executed here (manual, as with all migrations in this repo).

### Manual test
Admin → **Payments** → open an unpaid order → set status **Paid** with a reference → confirm → return to **Admin Orders** → the order shows **Paid** there too (both surfaces read the same `orders.payment_status`, and the order page now attributes the change to `manual`).

---

## Current state (after Phase H0.1)
**Live and working:** everything in the “Current state (after Phase E4)” snapshot, **plus** payment metadata (`payment_reference`, `payment_provider`, `payment_channel`, `payment_source`, `payment_updated_at`), the **Admin Payment Center** (`/admin/payments` list + `/admin/payments/:orderId` detail with manual status/reference/provider/channel recording, server-enforced `payment_source = manual`), the compact payments section on the Admin overview, and a customer-facing payment details block with a **Pay Now placeholder** on the shared order view.

- **Supersedes the “Current state (after Phase E4)” snapshot** for anything payment-metadata related.
- **Still not built:** **Paystack or any payment automation** (payment is manual: unpaid / paid / failed / refunded; the customer Pay Now button is a disabled placeholder), payment webhooks/verification, an attempt/event ledger, refunds processing, email notifications, automatic restocking on cancellation, customer-initiated cancellation, carrier/tracking integration, Collections CRUD, Blog CRUD, password reset UI, wishlist, social login, analytics, newsletter admin.
- **Migrations in this repo are all manual, local only:** `004`, `005`, `006`, `007`, `008`, `009`, **`010`**. Nothing is applied remotely by the app.

## Open follow-ups (current — after Phase H0.1)
- **Run `supabase/migrations/010_payment_metadata_foundation.sql` manually in Supabase** — the Admin Payment Center, payment fields and the customer payment details are inert until it is applied (after `009`).
- **Phase F (Paystack):** initialize/verify server-side in an Edge Function with secrets (never `VITE_*`), add callback/webhook handling, and replace the customer “Online payment is not available yet.” placeholder with real initialization/verification. Populate `payment_source = 'paystack'`, real `payment_reference`/provider/channel and a verification result. No Paystack code exists yet.
- **Confirm the unresolved commerce rules** (shipping/tax, stock reservation, unpaid-order expiry, cancellation, restock-on-cancel, payment references, customer-visible statuses). In particular, **do not set `commerce_settings.rules_confirmed = true` until the real shipping/tax values are decided**.
- **Legacy columns:** `products.images` / `products.stock` still exist and are still written by the Admin sync. A later cleanup migration can drop the compatibility sync first, then the columns.
- **Bundle weight:** the main chunk is now ~869 kB (gzip ~239 kB); route-level code splitting remains the biggest remaining win.
- **Footer `logo.png` (730.92 kB) / `og-image.png` (901.15 kB)** should still be compressed or replaced.
---

## Sprint: Phase H0.2 — Customer Payment Center
**Date:** 2026-10-05
**Status:** Complete
**Scope:** Customer-facing payment center built on the H0.1 payment metadata, plus order/confirmation/overview integration. **No Paystack integration of any kind** — no initialization, no callback route, no webhook, no verification, no secret keys, no fabricated references/attempts. Online payments are **not active**.

### Routes
- `/account/payments` → `AccountPayments` (payment list).
- `/account/payments/:orderNumber` → `AccountPaymentDetail`.
- Both under the existing `AuthenticatedRoute` → `AccountLayout`, so a signed-out visitor is redirected to `/login` and returned afterwards.

### Account navigation
- `AccountLayout` nav is now: Overview, Profile, Addresses, Orders, **Payments** (desktop side nav and the mobile horizontal nav both read the same `navItems` array).

### Payment data layer (`src/lib/account/payments.ts`)
- Payment records are **derived from the customer's own `orders` rows** — no new customer-readable transaction table, no SQL.
- Functions: `listMyPayments(userId)` (one select, newest first), `getMyPayment(userId, orderNumber)` (one select, `maybeSingle`), `getRecentPayment(userId)` (same select + `limit 1`), and the pure helper `countMyPaymentsByStatus(payments)`. Single queries only — no N+1.
- Honest display helpers: `paymentSourceLabel` (`Manual` / `Paystack` / `Not recorded`), `paymentProviderLabel` (`Not connected`), `paymentChannelLabel`, `paymentReferenceLabel` (`—`), `PAYMENT_STATE_TITLES`, and `paymentStateNote`.
- `CustomerPayment` carries order status, totals, status, source, provider, channel, reference, `paid_at`, `payment_updated_at`, `created_at`.

### Payment list (`/account/payments`)
- Cards (no wide table, no horizontal scrolling) showing order number, order date, total, payment state + status, source, provider, channel, reference and the latest payment update. Absent metadata shows neutral copy (`Not recorded` / `Not connected` / `—` / `No update recorded`) — never invented values.
- Filters: **All / Unpaid / Paid / Failed / Refunded**, applied to the loaded list (no extra requests, no analytics).

### Payment detail (`/account/payments/:orderNumber`)
- Payment: status (text), source (with `Recorded manually` when `manual`), provider, channel, reference, amount, currency, `paid_at` when present, and last payment update.
- Related order: order number, order status, link to `/account/orders/:orderNumber`.
- Invoice: the existing `DownloadInvoiceButton` (generated from the order's current recorded state).
- Does not duplicate the full order detail page.

### Payment states
- **Unpaid** — "Payment outstanding" with a disabled **Pay Now** button and the copy "Online payment is not available yet. Nothing is charged when you place an order."
- **Failed** — "Payment failed" with a disabled **Retry Payment** button and copy that retrying is not possible yet (no retry network call exists).
- **Paid** — "Payment received" with provider, channel, reference and paid date; manual records say "Recorded manually by our team." — Paystack is never implied.
- **Refunded** — "Refund recorded"; manual records make clear it is a recorded status only and no automated refund was issued.
- No fake loading or fake payment success anywhere.

### Order detail integration (`/account/orders/:orderNumber`)
- A restrained payment action area shows `Payment: <status>` and links to `/account/payments/:orderNumber` — **"View Payment"** when unpaid, **"Payment Details"** when paid. Payment metadata is not duplicated.

### Order confirmation integration (`/order-confirmation/:orderNumber`)
- When unpaid, a "Payment outstanding" panel with a **View Payment** link to `/account/payments/:orderNumber`. No active Pay Now until Phase F.

### Account overview
- New **Payments** panel: Unpaid orders count, Paid orders count and the most recent payment state (order number + state), with a **View Payments** CTA. One list query feeds both counts and the recent payment. No wallet, balance, loyalty points or card details.

### GlitchBrand
- `GlitchBrand size="corner"` on both `/account/payments` and `/account/payments/:orderNumber`, placed beside/above the heading so it never overpowers the payment-status information. No CSS duplication.

### Mobile & accessibility
- Payment cards and the detail layout stack cleanly (flex/grid, no wide tables). Payment state is always rendered as text, never colour-only; coloured labels are accompanied by explicit state titles/labels. Disabled buttons carry `disabled`, `aria-disabled`, an accessible name and `aria-describedby` explanatory copy.

### Security
- Customers can only read their own payment/order metadata: every query filters by session `user_id` and the existing `orders` RLS policy (`auth.uid() = user_id`) authorizes row-by-row. A hand-edited URL to another customer's order number returns the same safe "not found" state as an invalid one.
- **No** customer UPDATE policies, **no** payment-status mutations and **no** direct order updates were added. Payment status remains Admin-only (H0.1). RLS remains authoritative.

### SQL
- **No new migration.** H0.1 already added every required field; the payment center reads the existing `orders` columns.

### Files changed
- `src/lib/account/payments.ts` (new)
- `src/pages/account/AccountPayments.tsx` (new)
- `src/pages/account/AccountPaymentDetail.tsx` (new)
- `src/App.tsx` — account payment routes
- `src/components/account/AccountLayout.tsx` — Payments nav item
- `src/pages/account/AccountOverview.tsx` — payment summary panel
- `src/pages/account/AccountOrderDetail.tsx` — payment action area
- `src/pages/OrderConfirmation.tsx` — unpaid "Payment outstanding" + View Payment
- `SPRINT_LOG.md` (this entry)

### Verification
- `npm run typecheck` → exit 0, clean.
- `npm run lint` → exit 0, 0 errors (same 8 pre-existing warnings).
- `npm run build` → exit 0.
- No screenshots, Playwright or Puppeteer. No SQL executed (no migration in this sprint).

### Manual test
Customer → **Payments** → open an unpaid order → see the recorded metadata and a **disabled Pay Now** → Admin marks Paid manually with a reference → customer refreshes → the payment page shows **Paid · Manual** with the reference.

---

## Current state (after Phase H0.2)
**Live and working:** everything in the “Current state (after Phase H0.1)” snapshot, **plus** the **Customer Payment Center** (`/account/payments` list with All/Unpaid/Paid/Failed/Refunded filters and `/account/payments/:orderNumber` detail), the Payments account-nav item, a real payment summary panel on `/account/overview`, restrained payment links on `/account/orders/:orderNumber` and `/order-confirmation/:orderNumber`, and state-specific unpaid/failed/paid/refunded copy with informational (disabled) Pay Now / Retry buttons.

- **Supersedes the “Current state (after Phase H0.1)” snapshot** for anything customer-payment related.
- **Still not built:** **Paystack or any payment automation** — the customer Pay Now / Retry buttons are disabled placeholders, `paystack` never appears in real data, and there is no provider connection. Also still absent: payment webhooks/verification, an attempt/event ledger, refunds processing, email notifications, restocking on cancellation, customer cancellation, carrier/tracking, Collections/Blog CRUD, password reset, wishlist, social login, analytics, newsletter admin.
- **Migrations in this repo are all manual, local only:** `004`–`010`. Nothing is applied remotely by the app.

## Open follow-ups (current — after Phase H0.2)
- **Phase F (Paystack):** initialize/verify server-side in an Edge Function with secrets (never `VITE_*`), add callback/webhook handling, then replace the customer “Online payment is not available yet.” placeholders with real initialization/verification and enable the Pay Now / Retry CTAs. Populate `payment_source = 'paystack'` and the real reference/provider/channel.
- **Run `supabase/migrations/010_payment_metadata_foundation.sql` manually in Supabase** if not already applied — both the Admin and now the Customer payment surfaces are inert without it.
- **Confirm the unresolved commerce rules** (shipping/tax, stock reservation, unpaid-order expiry, cancellation, restock-on-cancel, payment references, customer-visible statuses). Do not set `commerce_settings.rules_confirmed = true` until the real shipping/tax values are decided.
- **Bundle weight:** route-level code splitting remains the biggest remaining win (Admin + Account are eagerly imported).
- **Footer `logo.png` / `og-image.png`** should still be compressed or replaced.

---

## Sprint: Vercel SPA Deep-Link Routing Fix
**Type:** hosting/build configuration only. **No application code, routes, auth, payments, orders, Supabase, migrations or UI were changed.**

### Root cause
Every URL except `/` returned HTTP 404 in production (`/admin/login`, `/admin`, `/shop` all verified 404; `/` and `/assets/*` returned 200). Two paired defects: (1) no Vercel rewrite existed — `public/_redirects` is Netlify-only syntax that Vercel ignores, so `/* /index.html 200` never applied; (2) `vite.config.ts` used `base: './'`, so the shell referenced `./assets/…`, which a browser loading `/admin/login` would resolve to `/admin/assets/…` (404, or HTML served to a module script) and boot no JS even if the shell had been served.

### Fix
- **`vercel.json` added (new file, repo root):** `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`. Vercel resolves real files first, so `/assets/*`, `/payment-logos/*` and other static assets keep serving from the filesystem; every other path falls through to the SPA shell. This is what makes direct navigation, refresh and bookmarks work for `/admin/login`, `/admin`, `/shop`, `/product/:slug`, `/checkout`, `/order-confirmation/:orderNumber`, `/account/*` and the future Paystack return/callback URL.
- **`vite.config.ts`:** `base: './'` → `base: '/'` (one line). Built asset references are now root-absolute (`/assets/index-Mf_s9mP4.js`, `/assets/index-zdwozoyA.css`, `/assets/FAVICON-BdgQMbyy.png`), so a deep link served the shell loads the same bundle as `/`.
- `public/_redirects` left untouched (inert on Vercel, out of scope this sprint). `/og-image.png` 404 (asset removed from `public/` in the previous commit) deliberately not addressed here.
- Prior readiness note at `SPRINT_LOG.md` ("Every route except `/` returns HTTP 404 in production") is now resolved by this pair; both are required — either one alone still fails.

### Purpose / dependency
Deep-link and refresh support for the whole React Router surface, and a hard prerequisite for **Phase F**: a Paystack return/callback URL (e.g. `/payment/callback`) must be able to load directly from the provider redirect, which is impossible without the SPA rewrite plus root-absolute assets.

### Files changed
- `vercel.json` (new)
- `vite.config.ts` (base path)
- `SPRINT_LOG.md` (this entry)

### Verification
- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0, 0 errors (same 8 pre-existing warnings, incl. the stale `.kilo/worktrees/tree-nest/` worktree).
- `npm run build` → exit 0, 2442 modules; `dist/index.html` emits `/assets/…` (root-absolute), no `./assets/…` references.
- `git status`: only `vite.config.ts` modified + `vercel.json` untracked — no file under `src/` touched.
- **Not yet live:** production URLs can only be re-tested after Vercel redeploys this commit.

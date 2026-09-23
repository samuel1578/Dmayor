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
- Supabase migrations/schema (beyond the rebrand migration above), auth, checkout, payments, orders, admin.
- CartContext, ProductCard, QuickViewModal, Shop filtering, Cart quantity logic.
- Tailwind config / CSS theme system (palette prefixes remain `ghana-*`).
- Navbar, logo sizing, hamburger, footer (hero sprint did not touch them).
- Blog, About, Contact, Collections, Shop page logic (rebrand text only where noted).

---

## Open follow-ups
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
- Supabase schema/migrations (beyond rebrand migration), auth, checkout, payments, orders, admin.
- CartContext, ProductCard, QuickViewModal, Shop filtering, cart quantity logic.
- Palette prefixes remain `ghana-*`.
- Hero scroll architecture / hero image URLs (presentation-only changes in designated sprints).
- Fit Collections / brand-section image URLs after introduction.

---

## Open follow-ups
- ~~Run `20251107000000_add_variants_and_rebrand.sql` manually in Supabase; replace `.env` placeholders.~~ — superseded: run `001_initial_proxy_shop_schema.sql` then `002_seed_proxy_shop_categories.sql`; set `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`.
- Replace Footer `logo.png` (5.8 MB) with optimised asset (bundle weight).
- Stale `.kilo/worktrees/tree-nest/` worktree causes pre-existing lint noise — out of scope.
- ~~**Insert production domain** in `index.html` (`YOUR-DOMAIN.example`) for OG/canonical absolute URLs.~~ — **done** (`https://theproxyshop.vercel.app`).
- ~~Add `src/assets/founder.png` and set `aboutContent.founder.image`~~ — **done** (founder portrait wired into About).
- Optional breakpoint screenshot matrix — explicitly skipped across sprints.
- Admin external-image preview/resolution architecture — still deferred (not built).

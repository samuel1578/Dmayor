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

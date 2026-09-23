import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { aboutContent } from '../lib/aboutContent';

const rise = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: 'easeOut' as const },
};

const slowerRise = {
  ...rise,
  transition: { duration: 0.6, ease: 'easeOut' as const },
};

function EditorialImage({
  src,
  alt,
  position,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  position: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-black/10 dark:bg-white/5 ${className ?? ''}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: position }}
        className={`h-full w-full object-cover ${imgClassName ?? ''}`}
      />
    </div>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`hero-type-ui mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ghana-green md:mb-4 ${className ?? ''}`}
    >
      {children}
    </p>
  );
}

function FounderPortrait() {
  const { founder } = aboutContent;

  if (founder.image) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/10 dark:bg-white/5">
        <img
          src={founder.image}
          alt={founder.imageAlt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-[50%_25%]"
        />
      </div>
    );
  }

  /* Swappable placeholder — drop founder.png into config when available */
  return (
    <div
      className="relative flex aspect-[3/4] w-full items-center justify overflow-hidden border border-dashed border-ghana-green/35 bg-gradient-to-b from-ghana-light to-white dark:from-ghana-dark dark:to-black"
      aria-hidden="true"
    >
      <div className="px-8 text-center">
        <span className="hero-type-display block text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-tight text-ghana-black/35 dark:text-white/35">
          Founder portrait
        </span>
        <span className="hero-type-ui mt-3 block text-[12px] font-medium uppercase tracking-[0.2em] text-ghana-green/70">
          founder.png
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-ghana-green/15" />
      <div className="pointer-events-none absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-ghana-green/15" />
    </div>
  );
}

export function About() {
  const { hero, perspective, focus, founder, closing } = aboutContent;

  return (
    <div className="bg-ghana-light text-ghana-black transition-colors duration-300 dark:bg-ghana-dark dark:text-white">
      {/* 1 — About hero */}
      <section aria-labelledby="about-hero-heading" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-24">
          <motion.div {...rise}>
            <Eyebrow>{hero.eyebrow}</Eyebrow>
            <h1
              id="about-hero-heading"
              className="hero-type-display mb-5 whitespace-pre-line font-medium text-brand-heading text-ghana-black dark:text-white md:mb-7"
            >
              {hero.title}
            </h1>
            <p className="max-w-[46ch] text-[15px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 md:text-base">
              {hero.description}
            </p>
          </motion.div>

          <motion.div {...slowerRise} className="lg:-mr-2 xl:-mr-6">
            <EditorialImage
              src={hero.image.src}
              alt={hero.image.alt}
              position={hero.image.position}
              className="aspect-[4/5] w-full sm:aspect-[3/4] lg:aspect-[3/4] lg:min-h-[520px]"
            />
          </motion.div>
        </div>
      </section>

      {/* 2 — Brand perspective + editorial image */}
      <section
        aria-labelledby="about-perspective-heading"
        className="bg-ghana-black text-ghana-light"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <motion.div {...rise} className="order-2 lg:order-1">
            <EditorialImage
              src={perspective.image.src}
              alt={perspective.image.alt}
              position={perspective.image.position}
              className="aspect-[4/5] w-full sm:aspect-[3/4] lg:aspect-[3/4] lg:min-h-[520px]"
            />
          </motion.div>

          <motion.div {...slowerRise} className="order-1 lg:order-2">
            <Eyebrow>OUR POINT OF VIEW</Eyebrow>
            <h2
              id="about-perspective-heading"
              className="hero-type-display mb-5 font-medium text-brand-heading text-ghana-light md:mb-6"
            >
              {perspective.heading}
            </h2>
            <p className="max-w-[48ch] text-[15px] font-normal leading-relaxed text-white/65 md:text-base">
              {perspective.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* 3 — What we focus on: typographic rows + staggered images */}
      <section aria-labelledby="about-focus-heading" className="py-14 md:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...rise} className="mb-10 md:mb-14">
            <Eyebrow>{focus.eyebrow}</Eyebrow>
            <h2
              id="about-focus-heading"
              className="hero-type-display max-w-[16ch] font-medium text-brand-heading text-ghana-black dark:text-white"
            >
              {focus.heading}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-16">
            <motion.ul
              {...rise}
              className="hero-type-ui border-t border-ghana-black/12 dark:border-white/12"
            >
              {focus.points.map((point) => (
                <li
                  key={point.number}
                  className="border-b border-ghana-black/12 py-5 dark:border-white/12 md:py-6"
                >
                  <div className="flex gap-4 md:gap-6">
                    <span className="mt-0.5 w-7 shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.12em] text-ghana-green">
                      {point.number}
                    </span>
                    <div>
                      <p className="text-[16px] font-medium tracking-[0.01em] text-ghana-black dark:text-white md:text-lg">
                        {point.title}
                      </p>
                      <p className="mt-1.5 max-w-[42ch] text-[13px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 md:text-sm">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </motion.ul>

            <div className="grid grid-cols-2 gap-4 md:gap-5">
              <motion.div {...slowerRise}>
                <EditorialImage
                  src={focus.images[0].src}
                  alt={focus.images[0].alt}
                  position={focus.images[0].position}
                  className="aspect-[3/4] w-full"
                />
              </motion.div>
              <motion.div
                {...slowerRise}
                transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' as const }}
                className="mt-8 md:mt-12"
              >
                <EditorialImage
                  src={focus.images[1].src}
                  alt={focus.images[1].alt}
                  position={focus.images[1].position}
                  className="aspect-[3/4] w-full"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 — Founder (single founder; portrait slot ready for founder.png) */}
      <section
        aria-labelledby="about-founder-heading"
        className="border-y border-ghana-black/10 bg-white py-14 dark:border-white/10 dark:bg-black/40 md:py-20 lg:py-24"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16 lg:px-8">
          <motion.div {...rise}>
            <FounderPortrait />
          </motion.div>

          <motion.div {...slowerRise}>
            <Eyebrow>{founder.eyebrow}</Eyebrow>
            <h2
              id="about-founder-heading"
              className="hero-type-display mb-5 font-medium text-brand-heading text-ghana-black dark:text-white md:mb-6"
            >
              {founder.heading}
            </h2>
            <p className="max-w-[48ch] text-[15px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 md:text-base">
              {founder.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* 5 — Closing CTA */}
      <section aria-labelledby="about-closing-heading" className="bg-ghana-black text-ghana-light">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-24">
          <motion.div {...rise} className="max-w-2xl">
            <h2
              id="about-closing-heading"
              className="hero-type-display mb-4 font-medium text-brand-heading text-ghana-light md:mb-5"
            >
              {closing.heading}
            </h2>
            <p className="mb-8 max-w-[44ch] text-[15px] font-normal leading-relaxed text-white/65 md:text-base">
              {closing.description}
            </p>
            <Link
              to={closing.cta.href}
              className="hero-type-ui group inline-flex w-fit items-center gap-2 text-[13px] font-medium tracking-[0.04em] text-ghana-light transition-colors hover:text-ghana-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2 focus-visible:ring-offset-ghana-black md:text-sm"
            >
              <span className="border-b border-white/25 pb-0.5 transition-colors group-hover:border-ghana-green">
                {closing.cta.label}
              </span>
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="text-ghana-green transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

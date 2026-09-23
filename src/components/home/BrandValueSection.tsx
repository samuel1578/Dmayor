import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { whyProxyShop } from '../../lib/homeContent';

function IntroCopy({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="hero-type-ui mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ghana-green md:mb-4">
        {whyProxyShop.eyebrow}
      </p>
      <h2 className="hero-type-display mb-4 whitespace-pre-line font-medium text-ghana-light md:mb-6 text-brand-heading">
        {whyProxyShop.heading}
      </h2>
      <p className="max-w-[42ch] text-[14px] font-normal leading-relaxed text-white/65 md:text-[15px] lg:text-base">
        {whyProxyShop.description}
      </p>
    </div>
  );
}

function ValueRows({ stagger }: { stagger: boolean }) {
  const reduced = useReducedMotion();

  return (
    <ul className="hero-type-ui mt-8 border-t border-white/12 md:mt-10">
      {whyProxyShop.values.map((value, index) => (
        <motion.li
          key={value.number}
          initial={
            reduced || !stagger
              ? false
              : { opacity: 0, y: 12 }
          }
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: 0.08 * index, ease: 'easeOut' }}
          className="border-b border-white/12 py-4 md:py-5"
        >
          <div className="flex gap-4 md:gap-6">
            <span className="mt-0.5 w-7 shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.12em] text-ghana-green">
              {value.number}
            </span>
            <div>
              <p className="text-[15px] font-medium tracking-[0.01em] text-ghana-light md:text-base">
                {value.title}
              </p>
              <p className="mt-1 max-w-[40ch] text-[13px] font-normal leading-relaxed text-white/55 md:text-sm">
                {value.description}
              </p>
            </div>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

function ShopLink({ className }: { className?: string }) {
  return (
    <Link
      to={whyProxyShop.cta.href}
      className={`hero-type-ui group inline-flex w-fit items-center gap-2 text-[13px] font-medium tracking-[0.04em] text-ghana-light transition-colors hover:text-ghana-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2 focus-visible:ring-offset-ghana-black md:text-sm ${className ?? ''}`}
    >
      <span className="border-b border-white/25 pb-0.5 transition-colors group-hover:border-ghana-green">
        {whyProxyShop.cta.label}
      </span>
      <ArrowRight
        size={16}
        aria-hidden="true"
        className="text-ghana-green transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/**
 * Post-hero brand / value section — answers why buy from The Proxy Shop.
 * Calm after the scrolly hero: no sticky, no parallax, no second scroll story.
 */
export function BrandValueSection() {
  const reduced = useReducedMotion();

  const rise = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.55, ease: 'easeOut' as const },
      };

  return (
    <section
      aria-label={whyProxyShop.eyebrow}
      className="relative overflow-hidden bg-ghana-black text-ghana-light"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8 lg:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[52%_1fr] lg:items-center lg:gap-14 xl:gap-20">
          {/* Mobile: intro before image */}
          <IntroCopy className="lg:hidden" />

          {/* Editorial image — left on desktop, visual pause on mobile */}
          <motion.div
            {...rise}
            className="relative lg:col-start-1 lg:row-start-1 lg:-ml-4 xl:-ml-8"
          >
            <div className="relative overflow-hidden">
              <img
                src={whyProxyShop.image}
                alt={whyProxyShop.imageAlt}
                loading="lazy"
                decoding="async"
                style={{ objectPosition: whyProxyShop.imagePosition }}
                className="aspect-[4/5] w-full object-cover sm:aspect-[3/4] lg:aspect-[3/4] lg:min-h-[540px] xl:min-h-[620px]"
              />
            </div>
          </motion.div>

          {/* Desktop: full content column */}
          <div className="hidden lg:col-start-2 lg:row-start-1 lg:block">
            <IntroCopy />
            <ValueRows stagger />
            <ShopLink className="mt-8 md:mt-10" />
          </div>

          {/* Mobile: values + CTA after image */}
          <div className="lg:hidden">
            <ValueRows stagger />
            <ShopLink className="mt-8" />
          </div>
        </div>
      </div>
    </section>
  );
}

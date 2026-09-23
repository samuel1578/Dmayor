import { useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { fitCollections } from '../../lib/homeContent';

const FIT_COLLECTION_AUTOPLAY_DELAY = 3500;

function SectionCopy({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="hero-type-ui mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ghana-green md:mb-4">
        {fitCollections.eyebrow}
      </p>
      <h2 className="hero-type-display mb-4 whitespace-pre-line font-medium text-ghana-light md:mb-5 text-brand-heading">
        {fitCollections.heading}
      </h2>
      <p className="mb-7 max-w-[38ch] text-[14px] font-normal leading-relaxed text-white/65 md:mb-8 md:text-[15px]">
        {fitCollections.description}
      </p>
      <Link
        to={fitCollections.cta.href}
        className="hero-type-ui group inline-flex w-fit items-center gap-2 text-[13px] font-medium tracking-[0.04em] text-ghana-light transition-colors hover:text-ghana-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2 focus-visible:ring-offset-ghana-black md:text-sm"
      >
        <span className="border-b border-white/25 pb-0.5 transition-colors group-hover:border-ghana-green">
          {fitCollections.cta.label}
        </span>
        <ArrowRight
          size={16}
          aria-hidden="true"
          className="text-ghana-green transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );
}

/** Fixed 3:4 stage — reserves layout before image load; image cannot set height. */
function FitImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden bg-black/20 ${className ?? ''}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={736}
        height={981}
        className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
      />
    </div>
  );
}

/**
 * Fit Collections — editorial look directions (replaces old "Our Categories").
 * Mobile: portrait Swiper with fixed 3:4 geometry (no autoHeight).
 * Desktop: static editorial grid (no autoplay carousel).
 */
export function FitCollections() {
  const reduced = useReducedMotion();
  const autoplay = reduced
    ? false
    : {
        delay: FIT_COLLECTION_AUTOPLAY_DELAY,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      };

  return (
    <section
      aria-label={`${fitCollections.eyebrow} — ${fitCollections.heading.replace('\n', ' ')}`}
      className="bg-ghana-black text-ghana-light"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8 lg:py-24">
        {/* Mobile: copy → portrait swiper → (CTA lives in copy block) */}
        <div className="lg:hidden">
          <SectionCopy />

          <div className="mt-8">
            <Swiper
              modules={[Autoplay, Pagination]}
              slidesPerView={1}
              spaceBetween={16}
              loop
              autoHeight={false}
              autoplay={autoplay}
              pagination={{
                clickable: true,
                dynamicBullets: false,
              }}
              className="fit-collections-swiper"
              a11y={{ enabled: true }}
            >
              {fitCollections.images.map((image) => (
                <SwiperSlide key={image.src}>
                  <FitImage src={image.src} alt={image.alt} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>

        {/* Desktop / tablet: editorial image column + copy column */}
        <div className="hidden lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 xl:gap-20">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <FitImage
                src={fitCollections.images[0].src}
                alt={fitCollections.images[0].alt}
              />
              <FitImage
                src={fitCollections.images[1].src}
                alt={fitCollections.images[1].alt}
              />
            </div>
            <div className="mt-10 flex flex-col gap-4">
              <FitImage
                src={fitCollections.images[2].src}
                alt={fitCollections.images[2].alt}
              />
              <FitImage
                src={fitCollections.images[3].src}
                alt={fitCollections.images[3].alt}
              />
            </div>
          </div>

          <SectionCopy />
        </div>
      </div>
    </section>
  );
}

import type { MotionValue } from 'framer-motion';
import { motion, useTransform } from 'framer-motion';
import {
  heroChapters,
  heroClosing,
  heroOpening,
  heroTimeline,
  type HeroImageMotion,
  type HeroLayout,
  type HeroMediaShape,
  type HeroWindow,
} from '../../lib/hero';

interface HeroVisualStageProps {
  progress: MotionValue<number>;
  reduced: boolean;
}

function useHeroTransform<T extends number | string>(
  progress: MotionValue<number>,
  win: HeroWindow<T>,
  reduced: boolean,
  neutral: T,
): MotionValue<T> {
  const output: T[] = reduced ? win.input.map(() => neutral) : win.output;
  return useTransform(progress, win.input, output);
}

/** Aspect constraint for portrait / tall media (object-cover inside). */
function mediaShapeClass(shape: HeroMediaShape): string {
  switch (shape) {
    case 'portrait':
      return 'aspect-[3/4]';
    case 'tall':
      return 'aspect-[4/5]';
    case 'wide':
      return 'aspect-[16/9]';
    case 'bleed':
    default:
      return '';
  }
}

/**
 * Editorial frame: placement from layout, proportions from mediaShape.
 * Trousers = wide-bottom + portrait → 3:4 plate, not a shallow horizontal strip.
 */
function layoutFrame(layout: HeroLayout, shape: HeroMediaShape): string {
  const ratio = mediaShapeClass(shape);

  switch (layout) {
    case 'portrait-right':
      return `absolute top-[7%] right-[2%] h-[86%] max-w-full ${ratio || 'aspect-[3/4]'}`;
    case 'wide-bottom':
      return `absolute bottom-[5%] left-1/2 w-[68%] max-w-[400px] -translate-x-1/2 md:left-auto md:right-[10%] md:translate-x-0 md:w-[46%] md:max-w-[440px] ${ratio || 'aspect-[3/4]'}`;
    case 'bleed-left':
      return `absolute inset-y-0 left-0 w-full md:-left-[4%] md:w-[96%]`;
    case 'portrait-offset':
      return `absolute top-[10%] right-[3%] h-[82%] max-w-full ${ratio || 'aspect-[4/5]'}`;
    default:
      return `absolute inset-0 ${ratio}`;
  }
}

function MorphLayer({
  progress,
  windows,
  reduced,
  image,
  imageAlt,
  focalPoint,
  eager,
  frameClassName,
  altHidden,
}: {
  progress: MotionValue<number>;
  windows: HeroImageMotion;
  reduced: boolean;
  image: string;
  imageAlt: string;
  focalPoint?: string;
  eager?: boolean;
  frameClassName: string;
  altHidden?: boolean;
}) {
  const opacity = useTransform(progress, windows.opacity.input, windows.opacity.output);
  const rotateY = useHeroTransform(progress, windows.rotateY, reduced, 0);
  const rotateX = useHeroTransform(progress, windows.rotateX, reduced, 0);
  const scale = useHeroTransform(progress, windows.scale, reduced, 1);
  const x = useHeroTransform(progress, windows.x, reduced, 0);
  const y = useHeroTransform(progress, windows.y, reduced, 0);
  const clip = useHeroTransform(progress, windows.clip, reduced, 'inset(0% 0% 0% 0%)');
  const parallaxY = useHeroTransform(progress, windows.parallaxY, reduced, 0);

  return (
    <motion.div style={{ opacity }} className={`pointer-events-none ${frameClassName}`}>
      <div className="h-full w-full [perspective:1500px] max-md:[perspective:1100px]">
        <motion.div
          style={{
            rotateY,
            rotateX,
            scale,
            x,
            y,
            transformStyle: 'preserve-3d',
          }}
          className="h-full w-full will-change-transform"
        >
          <motion.div
            style={{ clipPath: clip }}
            className="h-full w-full overflow-hidden bg-ghana-light dark:bg-ghana-dark"
          >
            <motion.img
              src={image}
              alt={altHidden ? '' : imageAlt}
              aria-hidden={altHidden ? true : undefined}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              style={{
                y: parallaxY,
                objectPosition: focalPoint ?? '50% 50%',
              }}
              className="h-full w-full object-cover"
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function HeroVisualStage({ progress, reduced }: HeroVisualStageProps) {
  const veilOpacity = useTransform(
    progress,
    heroTimeline.closingVeil.input,
    heroTimeline.closingVeil.output,
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-ghana-light dark:bg-ghana-dark">
      {/* Opening editorial cover image — overlaps column edge on desktop */}
      <MorphLayer
        progress={progress}
        windows={heroTimeline.openingImageMotion}
        reduced={reduced}
        image={heroOpening.image}
        imageAlt={heroOpening.imageAlt}
        focalPoint={heroOpening.focalPoint}
        eager
        frameClassName="absolute inset-0 md:-left-[10%] md:w-[calc(100%+10%)]"
      />

      {/* Chapter images — layout-specific editorial frames */}
      <div className="absolute inset-0">
        {heroChapters.map((chapter, index) => (
          <MorphLayer
            key={chapter.id}
            progress={progress}
            windows={heroTimeline.chapterImageMotion[index]}
            reduced={reduced}
            image={chapter.image}
            imageAlt={chapter.imageAlt}
            focalPoint={chapter.focalPoint}
            eager={index === 0}
            frameClassName={layoutFrame(chapter.layout, chapter.mediaShape)}
          />
        ))}
      </div>

      {/* Closing campaign image — full stage */}
      <MorphLayer
        progress={progress}
        windows={heroTimeline.closingImageMotion}
        reduced={reduced}
        image={heroClosing.image}
        imageAlt={heroClosing.imageAlt}
        focalPoint={heroClosing.focalPoint}
        frameClassName="absolute inset-0"
      />

      {/* Soft veil only through the closing handoff — not a black void */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: veilOpacity }}
        className="pointer-events-none absolute inset-0 bg-ghana-black"
      />
    </div>
  );
}

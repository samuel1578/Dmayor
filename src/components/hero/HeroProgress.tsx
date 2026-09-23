import type { MotionValue } from 'framer-motion';
import { motion, useTransform } from 'framer-motion';
import { heroChapters, heroTimeline } from '../../lib/hero';

interface HeroProgressProps {
  progress: MotionValue<number>;
}

function ProgressDot({
  progress,
  input,
  output,
}: {
  progress: MotionValue<number>;
  input: number[];
  output: number[];
}) {
  const opacity = useTransform(progress, input, output);
  return (
    <motion.span
      style={{ opacity }}
      className="block h-1 w-1 rounded-full bg-ghana-green"
    />
  );
}

export function HeroProgress({ progress }: HeroProgressProps) {
  const lineScale = useTransform(
    progress,
    heroTimeline.progressLine.input,
    heroTimeline.progressLine.output,
  );

  return (
    <div
      className="hero-type-ui flex items-center gap-2.5 px-5 py-3.5 sm:px-8 md:px-10 lg:px-12 shrink-0"
      aria-label="Chapter progress"
    >
      <span className="text-[10px] font-medium tabular-nums tracking-[0.12em] text-ghana-black/40 dark:text-white/40">
        01
      </span>
      <div className="relative h-px flex-1 max-w-[120px] overflow-hidden bg-ghana-black/10 dark:bg-white/15">
        <motion.div
          style={{ scaleX: lineScale }}
          className="absolute inset-0 origin-left bg-ghana-green"
        />
      </div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {heroChapters.map((chapter, index) => {
          const win = heroTimeline.chapterProgressDots[index];
          return (
            <ProgressDot
              key={chapter.id}
              progress={progress}
              input={win.input}
              output={win.output}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-medium tabular-nums tracking-[0.12em] text-ghana-black/40 dark:text-white/40">
        0{heroChapters.length}
      </span>
      <span className="sr-only">
        Four-part collection story, chapter 1 through {heroChapters.length}
      </span>
    </div>
  );
}

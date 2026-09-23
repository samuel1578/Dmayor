import { useRef, useState } from 'react';
import {
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'framer-motion';
import { heroScroll } from '../../lib/hero';
import { HeroNarrative } from './HeroNarrative';
import { HeroVisualStage } from './HeroVisualStage';
import { HeroProgress } from './HeroProgress';

type HeroPhase = 'default' | 'hoodies';

export function ScrollyHero() {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const reduced = reduceMotion === true;
  const [phase, setPhase] = useState<HeroPhase>('default');

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end end'],
  });

  const springProgress = useSpring(scrollYProgress, heroScroll.spring);
  const progress = reduced ? scrollYProgress : springProgress;

  // Only fires when phase boundary crosses — not a per-frame visual state loop
  useMotionValueEvent(progress, 'change', (v) => {
    const next: HeroPhase = v >= 0.48 && v < 0.7 ? 'hoodies' : 'default';
    setPhase((prev) => (prev === next ? prev : next));
  });

  const stageLeft = phase === 'hoodies';

  return (
    <section
      ref={heroRef}
      aria-label="The Proxy Shop collection story"
      className="relative bg-ghana-light dark:bg-ghana-dark"
      style={{ height: `${heroScroll.wrapperHeightVh * 100}vh` }}
    >
      {/*
        Mobile: narrative | dominant stage | progress
        Desktop: 42/58 split; hoodies flips to stage-left / narrative-right for bleed-left
        sticky under navbar (top-20 / md:top-24), z-0 under drawer z-40 and nav z-50
      */}
      <div
        className={`sticky top-20 z-0 grid h-[calc(100vh-5rem)] grid-cols-1 grid-rows-[minmax(0,0.92fr)_minmax(0,1.55fr)_auto] overflow-hidden md:top-24 md:h-[calc(100vh-6rem)] md:grid-rows-[minmax(0,1fr)_auto] ${
          stageLeft
            ? 'md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]'
            : 'md:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]'
        }`}
      >
        <div
          className={`relative min-h-0 overflow-hidden border-b border-gray-200 dark:border-gray-800 md:border-b-0 ${
            stageLeft
              ? 'md:col-start-2 md:row-start-1 md:border-l md:border-gray-200 md:dark:border-gray-800'
              : 'md:col-start-1 md:row-start-1 md:border-r md:border-gray-200 md:dark:border-gray-800'
          }`}
        >
          <HeroNarrative progress={progress} reduced={reduced} />
        </div>

        <div
          className={`relative min-h-0 md:row-span-2 md:row-start-1 md:h-full ${
            stageLeft ? 'md:col-start-1' : 'md:col-start-2'
          }`}
        >
          <HeroVisualStage progress={progress} reduced={reduced} />
        </div>

        <div
          className={`relative md:row-start-2 md:border-t md:border-gray-200 md:dark:border-gray-800 ${
            stageLeft ? 'md:col-start-2' : 'md:col-start-1'
          }`}
        >
          <HeroProgress progress={progress} />
        </div>
      </div>
    </section>
  );
}

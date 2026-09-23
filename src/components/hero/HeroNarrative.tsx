import type { MotionValue } from 'framer-motion';
import { motion, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import logoHeader from '../../assets/logo-header.png';
import logoDark from '../../assets/logodark.png';
import {
  heroChapters,
  heroClosing,
  heroOpening,
  heroTimeline,
  type HeroLayout,
  type HeroWindow,
} from '../../lib/hero';

interface HeroNarrativeProps {
  progress: MotionValue<number>;
  reduced: boolean;
}

function NarrativeShell({
  progress,
  window: win,
  reduced,
  className,
  children,
  yAmount = 22,
}: {
  progress: MotionValue<number>;
  window: HeroWindow;
  reduced: boolean;
  className?: string;
  children: React.ReactNode;
  yAmount?: number;
}) {
  const opacity = useTransform(progress, win.input, win.output);
  const yOutput = reduced
    ? win.input.map(() => 0)
    : win.input.map((_, i) =>
        i === 0 ? yAmount : i === win.input.length - 1 ? -yAmount * 0.35 : 0,
      );
  const y = useTransform(progress, win.input, yOutput);

  return (
    <motion.div
      style={{ opacity, y }}
      className={`hero-type-ui absolute inset-0 flex flex-col justify-center px-5 sm:px-8 md:px-10 lg:px-12 ${className ?? ''}`}
    >
      {children}
    </motion.div>
  );
}

function ChapterMeta({
  number,
  category,
  layout,
}: {
  number: string;
  category: string;
  layout: HeroLayout;
}) {
  if (layout === 'wide-bottom') {
    return (
      <div className="flex w-full items-baseline justify-between gap-4 mb-3 md:mb-5">
        <span className="text-[10px] font-medium tracking-[0.22em] text-ghana-black/35 dark:text-white/35 tabular-nums">
          {number}
        </span>
        <span className="text-[11px] font-semibold tracking-[0.34em] uppercase text-ghana-green">
          {category}
        </span>
      </div>
    );
  }

  if (layout === 'bleed-left') {
    return (
      <div className="flex flex-col items-end gap-2 mb-3 md:mb-5">
        <span className="text-[10px] font-medium tracking-[0.22em] text-ghana-black/35 dark:text-white/35 tabular-nums">
          {number}
        </span>
        <span className="text-[11px] font-semibold tracking-[0.34em] uppercase text-ghana-green">
          {category}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-4 mb-3 md:mb-5">
      <span className="text-[10px] font-medium tracking-[0.22em] text-ghana-black/35 dark:text-white/35 tabular-nums">
        {number}
      </span>
      <span className="text-[11px] font-semibold tracking-[0.34em] uppercase text-ghana-green">
        {category}
      </span>
    </div>
  );
}

function chapterAlign(layout: HeroLayout): string {
  if (layout === 'bleed-left') return 'items-end text-right';
  return 'items-start text-left';
}

export function HeroNarrative({ progress, reduced }: HeroNarrativeProps) {
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? logoHeader : logoDark;

  return (
    <div className="relative h-full w-full">
      {/* Opening — logo signature + editorial cover copy */}
      <NarrativeShell
        progress={progress}
        window={heroTimeline.openingNarrative}
        reduced={reduced}
        className="justify-end pb-6 md:justify-center md:pb-0"
      >
        <img
          src={logoSrc}
          alt="The Proxy Shop"
          width={280}
          height={400}
          className="mb-4 h-16 w-auto object-contain object-left md:mb-6 md:h-[96px] lg:h-[108px]"
        />
        <h1 className="hero-type-display mb-4 text-hero-opening font-medium text-ghana-black dark:text-white md:mb-6 whitespace-pre-line">
          {heroOpening.title}
        </h1>
        <p className="max-w-[34ch] text-[13px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm md:max-w-[38ch] md:text-base">
          {heroOpening.description}
        </p>
      </NarrativeShell>

      {/* Chapters — controlled layout variation */}
      {heroChapters.map((chapter, index) => (
        <NarrativeShell
          key={chapter.id}
          progress={progress}
          window={heroTimeline.chapterNarrative[index]}
          reduced={reduced}
          className={`flex-col justify-center ${chapterAlign(chapter.layout)}`}
        >
          <ChapterMeta
            number={chapter.number}
            category={chapter.category}
            layout={chapter.layout}
          />
          <h2 className="hero-type-display mb-3 whitespace-pre-line text-hero-chapter font-medium text-ghana-black dark:text-white md:mb-5">
            {chapter.title}
          </h2>
          <p
            className={`mb-5 max-w-[30ch] text-[13px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm md:mb-7 md:text-[15px] ${
              chapter.layout === 'bleed-left'
                ? 'text-right'
                : chapter.layout === 'wide-bottom'
                  ? 'md:ml-6'
                  : ''
            }`}
          >
            {chapter.description}
          </p>
          <Link
            to={chapter.href}
            className={`group inline-flex w-fit items-center gap-2 rounded text-[13px] font-medium tracking-[0.04em] text-ghana-black transition-colors hover:text-ghana-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2 focus-visible:ring-offset-ghana-light dark:text-white dark:hover:text-ghana-green dark:focus-visible:ring-offset-ghana-dark ${
              chapter.layout === 'bleed-left' ? 'flex-row-reverse' : ''
            }`}
          >
            <span className="border-b border-ghana-green/50 pb-0.5 transition-colors group-hover:border-ghana-green">
              Explore {chapter.category}
            </span>
            <ArrowRight
              size={15}
              aria-hidden="true"
              className={`text-ghana-green transition-transform ${
                chapter.layout === 'bleed-left'
                  ? 'group-hover:-translate-x-0.5 rotate-180'
                  : 'group-hover:translate-x-0.5'
              }`}
            />
          </Link>
        </NarrativeShell>
      ))}

      {/* Closing — campaign copy */}
      <NarrativeShell
        progress={progress}
        window={heroTimeline.closingNarrative}
        reduced={reduced}
        className="items-start text-left justify-center"
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-ghana-green md:mb-5">
          {heroClosing.eyebrow}
        </p>
        <h2 className="hero-type-display mb-3 text-hero-closing font-medium text-ghana-black dark:text-white md:mb-5">
          {heroClosing.title}
        </h2>
        <p className="mb-6 max-w-[32ch] text-[13px] font-normal leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm md:mb-8 md:text-base">
          {heroClosing.description}
        </p>
        <Link
          to={heroClosing.cta.href}
          className="btn-primary inline-flex w-fit items-center gap-2 bg-ghana-green text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green focus-visible:ring-offset-2 focus-visible:ring-offset-ghana-light dark:focus-visible:ring-offset-ghana-dark"
        >
          {heroClosing.cta.label}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </NarrativeShell>
    </div>
  );
}

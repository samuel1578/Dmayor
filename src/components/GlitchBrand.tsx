import styles from './GlitchBrand.module.css';

/**
 * GlitchBrand — lightweight, purely-CSS glitch treatment for the brand mark.
 *
 * `size`   md (default) is the fixed small mark used on the dashboard.
 *          lg is the hero opening masthead that replaces the logo image.
 *          corner is the page-mark ramp — hero chapters, the closing
 *          sign-off, and the homepage section watermarks. Same desktop
 *          growth as lg, but a lower floor so it tucks beside the copy
 *          on mobile.
 *          menu is the mobile menu header: fluid to the row it shares
 *          with the control buttons.
 * `variant` `inline`  plain glitch text. Responsive visibility is the
 *            caller's job: wrap it in a div with `hidden md:block` rather
 *            than passing display utilities (module CSS is unlayered and
 *            would win).
 *          `sticky`  mobile-only solid block, pinned under the navbar while
 *            the dashboard cards scroll. Hidden from 768px up by the module.
 *
 * Masks (the ::before/::after backgrounds) are driven by `--glitch-bg`,
 * which flips between the page and card surfaces across light/dark mode.
 */

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

export interface GlitchBrandProps {
  text?: string;
  size?: 'md' | 'lg' | 'corner' | 'menu';
  /** Mask surface — must match the container the mark sits on. */
  surface?: 'page' | 'card' | 'brand' | 'ink' | 'red';
  variant?: 'inline' | 'sticky';
  className?: string;
}

export function GlitchBrand({
  text = 'THE PROXY SHOP',
  size = 'md',
  surface = 'page',
  variant = 'inline',
  className,
}: GlitchBrandProps) {
  // role="img" + aria-label makes the span a leaf in the a11y tree, so the
  // duplicated pseudo-element text is never announced twice.
  const surfaceClass =
    surface === 'brand'
      ? styles.onBrand
      : surface === 'ink'
        ? styles.onInk
        : surface === 'red'
          ? styles.onRed
          : surface === 'card' || variant === 'sticky'
            ? styles.onCard
            : undefined;

  const glitch = (
    <span
      className={cx(
        styles.glitch,
        size === 'lg' && styles.sizeLg,
        size === 'corner' && styles.sizeCorner,
        size === 'menu' && styles.sizeMenu,
        surfaceClass,
        className,
      )}
      data-text={text}
      role="img"
      aria-label={text}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );

  if (variant === 'sticky') {
    return <div className={cx(styles.stickyBar, styles.onCard, className)}>{glitch}</div>;
  }

  return glitch;
}

import type { Variants } from "framer-motion";

/**
 * Globe overlay panels (ContentPanel, Blog) use the same timings on mobile and desktop.
 * Only the nav full-screen menu (SpaceNav) is mobile-specific.
 */

/** Ease-out — keep durations modest; long fades + backdrop-blur = main-thread stalls (looks like a freeze). */
export const UI_SOFT_EASE = [0.25, 0.1, 0.25, 1] as const;

/** Scrim: opacity only (cheap). Never put backdrop-blur on a layer you’re animating. */
export const scrimFadeVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.28, ease: UI_SOFT_EASE } },
  visible: { opacity: 1, transition: { duration: 0.32, ease: UI_SOFT_EASE } },
};

/** Card: transform + opacity on a solid surface (no blur). */
export const contentCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    transition: { duration: 0.34, ease: UI_SOFT_EASE },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: UI_SOFT_EASE },
  },
};

/** Blog shell: opacity + small y; avoid glass/blur on the animated root. */
export const blogShellVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -16,
    transition: { duration: 0.34, ease: UI_SOFT_EASE },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: UI_SOFT_EASE },
  },
};

export const blogInnerVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 16,
    transition: { duration: 0.32, ease: UI_SOFT_EASE },
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.34, ease: UI_SOFT_EASE },
  },
};

export const blogListVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.32, ease: UI_SOFT_EASE } },
  visible: { opacity: 1, transition: { duration: 0.34, ease: UI_SOFT_EASE } },
};

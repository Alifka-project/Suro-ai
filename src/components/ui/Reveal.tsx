"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp, inView, stagger } from "@/lib/motion";

/**
 * Static lookup rather than motion.create(as) at call time — creating a
 * component during render returns a new type on every pass and remounts the
 * whole subtree.
 */
const MOTION = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  ul: motion.ul,
  li: motion.li,
  span: motion.span,
  p: motion.p,
  h2: motion.h2,
} as const;

type Tag = keyof typeof MOTION;

/**
 * Every entrance carries `data-reveal`. framer writes the hidden state
 * (opacity:0, translateY) into the server HTML as an inline style, so
 * globals.css uses this attribute to show the finished state when scripting
 * is off.
 */
const REVEAL_ATTR = { "data-reveal": "" } as const;

/**
 * A variant's own `transition` replaces the component-level `transition` prop
 * (framer only merges the two when the variant sets `inherit: true`), so a
 * delay has to be written into the "show" variant itself to take effect.
 */
function withDelay(variants: Variants, delay: number): Variants {
  const show = variants.show;
  if (!delay || !show || typeof show === "function") return variants;
  return { ...variants, show: { ...show, transition: { ...show.transition, delay } } };
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before this element animates in. */
  delay?: number;
  variants?: Variants;
  as?: Tag;
};

/**
 * Scroll-triggered entrance. Fires once so the page never feels twitchy when
 * the user scrolls back up.
 *
 * framer drives transforms through inline styles that the reduced-motion block
 * in globals.css can't reach, and its default is to ignore the OS setting.
 * reducedMotion="user" makes the slide jump straight to its end position for
 * those visitors and keeps only the opacity fade.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variants = fadeUp,
  as = "div",
}: RevealProps) {
  const MotionTag = MOTION[as];

  return (
    <MotionConfig reducedMotion="user">
      <MotionTag
        {...REVEAL_ATTR}
        className={className}
        variants={withDelay(variants, delay)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
      >
        {children}
      </MotionTag>
    </MotionConfig>
  );
}

/** Parent wrapper that cascades any <RevealItem> children. */
export function RevealGroup({
  children,
  className,
  gap = 0.09,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  as?: Tag;
}) {
  const MotionTag = MOTION[as];

  return (
    <MotionConfig reducedMotion="user">
      <MotionTag
        {...REVEAL_ATTR}
        className={className}
        variants={stagger(gap, delay)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
      >
        {children}
      </MotionTag>
    </MotionConfig>
  );
}

/**
 * Child of <RevealGroup> (or any motion parent with hidden/show variants);
 * animates when the parent comes into view. Its own MotionConfig covers a
 * parent that doesn't set reducedMotion.
 */
export function RevealItem({
  children,
  className,
  variants = fadeUp,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  as?: Tag;
}) {
  const MotionTag = MOTION[as];

  return (
    <MotionConfig reducedMotion="user">
      <MotionTag {...REVEAL_ATTR} className={className} variants={variants}>
        {children}
      </MotionTag>
    </MotionConfig>
  );
}

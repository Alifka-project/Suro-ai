"use client";

import { motion, type Variants } from "framer-motion";
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
 * the user scrolls back up. Decorative motion is neutralised globally by the
 * prefers-reduced-motion block in globals.css.
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
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
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
    <MotionTag
      className={className}
      variants={stagger(gap, delay)}
      initial="hidden"
      whileInView="show"
      viewport={inView}
    >
      {children}
    </MotionTag>
  );
}

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
    <MotionTag className={className} variants={variants}>
      {children}
    </MotionTag>
  );
}

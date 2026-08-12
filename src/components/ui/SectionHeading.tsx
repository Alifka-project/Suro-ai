"use client";

import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

/**
 * Shared section header: mono eyebrow, display headline with a gradient
 * fragment, and an optional lede. Keeps vertical rhythm identical everywhere.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "center",
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={`${centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}
    >
      <Reveal>
        <span
          className={`eyebrow ${centered ? "justify-center" : ""} w-full sm:w-auto`}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-r from-aqua-500 to-blush-500"
          />
          {eyebrow}
        </span>
      </Reveal>

      <Reveal delay={0.08}>
        <h2 className="mt-4 text-[clamp(1.85rem,5.2vw,3.1rem)] font-bold leading-[1.1]">
          {title}
        </h2>
      </Reveal>

      {lede && (
        <Reveal delay={0.16}>
          <p
            className={`mt-4 text-[0.98rem] leading-relaxed text-ink-600 sm:text-lg ${centered ? "mx-auto" : ""}`}
          >
            {lede}
          </p>
        </Reveal>
      )}
    </div>
  );
}

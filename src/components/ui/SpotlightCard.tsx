"use client";

import {
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
  type ElementType,
  type CSSProperties,
} from "react";

/** Space-separated RGB triplets — required by the `rgb(var(--glow) / a)` syntax. */
export const GLOW = {
  abyss: "7 102 163",
  azure: "56 134 213",
  aqua: "65 176 204",
  mint: "142 209 196",
  lilac: "181 171 230",
  blush: "253 156 194",
} as const;

/**
 * Glass card with a pointer-following spotlight and an aurora gradient hairline
 * that lights up on hover. The spotlight is driven by CSS custom properties so
 * pointer moves never trigger a React re-render, and it only activates for fine
 * pointers — on touch the card is simply a clean glass panel.
 */
export function SpotlightCard({
  children,
  className = "",
  glow = GLOW.azure,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  glow?: string;
  as?: "div" | "article" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const Tag = as as ElementType;

  function handleMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <Tag
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={(e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse") setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      className={`group relative isolate overflow-hidden rounded-3xl glass transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 ${className}`}
      style={{ "--glow": glow } as CSSProperties}
    >
      {/* Pointer spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500"
        style={{
          opacity: active ? 1 : 0,
          background:
            "radial-gradient(340px circle at var(--mx, 50%) var(--my, 50%), rgb(var(--glow) / 0.18), transparent 70%)",
        }}
      />

      {/* Aurora hairline that brightens on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          padding: "1px",
          background:
            "linear-gradient(130deg, rgb(var(--glow) / 0.9), rgb(150 217 210 / 0.7) 45%, rgb(197 175 226 / 0.75) 72%, rgb(253 156 194 / 0.85))",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {children}
    </Tag>
  );
}

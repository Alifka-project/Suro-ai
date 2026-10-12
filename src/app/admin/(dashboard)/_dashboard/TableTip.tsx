"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/components/admin/ui";

/**
 * A small visual tooltip above an icon button in the clients table. It repeats
 * the button's accessible name, so it is hidden from assistive tech.
 *
 * It shows on hover and on keyboard focus, and stays open while the pointer
 * moves onto it (no gap to cross). Escape hides it without moving focus or the
 * pointer, since it can sit over the phone number above the buttons (WCAG
 * 1.4.13). It comes back on the next hover or focus.
 */
export function TableTip({ text, children }: { text: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const listening = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!listening) return;
    // On the document: a hovered tip has no focus to receive the key.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [listening]);

  return (
    <span
      className="group/tip relative inline-flex"
      onPointerEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => {
        setFocused(true);
        setDismissed(false);
      }}
      onBlur={() => setFocused(false)}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          // Padding, not margin, below the bubble: the pointer stays inside the
          // group on its way from the button to the tip.
          "invisible absolute bottom-full left-1/2 z-30 -translate-x-1/2 pb-1.5 opacity-0 transition-opacity duration-150",
          !dismissed &&
            "group-hover/tip:visible group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:visible group-has-[:focus-visible]/tip:opacity-100",
        )}
      >
        <span className="block whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[0.7rem] font-medium text-white shadow-[0_8px_20px_-8px_rgb(7_38_60/0.6)]">
          {text}
        </span>
      </span>
    </span>
  );
}

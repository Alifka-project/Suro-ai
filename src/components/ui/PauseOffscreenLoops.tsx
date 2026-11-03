"use client";

import { useEffect } from "react";

/**
 * Pauses the decorative CSS loops (aurora, orbs, grid, marquee…) while their
 * section is more than 200px off screen, so they resume just before it comes
 * back. This only marks each `main > section` and the footer with
 * `data-offscreen`; the pause itself is a rule in globals.css that lists the
 * loop classes. Without JavaScript nothing is marked and the loops run.
 */
export function PauseOffscreenLoops() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting);
        }
      },
      { rootMargin: "200px 0px" },
    );

    document
      .querySelectorAll("main > section, body > footer")
      .forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      document
        .querySelectorAll("[data-offscreen]")
        .forEach((el) => el.removeAttribute("data-offscreen"));
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { easeOutExpo } from "@/lib/motion";

const LINKS = [
  { href: "#intro", label: "About" },
  { href: "#pain-points", label: "Pain points" },
  { href: "#services", label: "Services" },
  { href: "#process", label: "Process" },
  { href: "#results", label: "Results" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  // Lock the page behind the mobile sheet
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes the sheet
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? "py-2.5" : "py-4"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Primary"
            className={`flex items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5 ${
              scrolled ? "glass-strong" : "border border-transparent"
            }`}
          >
            {/* Mark as an image, wordmark as live text: the supplied lockup is
                vertical, so its wordmark would be illegible at header height.
                This keeps the name crisp, selectable and searchable. */}
            <a
              href="#top"
              className="group flex items-center gap-2.5"
              aria-label="SULOAI — back to top"
            >
              <Image
                src="/brand/suloai-mark.png"
                alt=""
                aria-hidden="true"
                width={226}
                height={240}
                priority
                className="h-8 w-auto transition-transform duration-500 group-hover:scale-105 sm:h-9"
              />
              <span className="font-display text-[1.15rem] font-bold tracking-[0.02em] text-ink-900">
                SULO<span className="text-gradient">AI</span>
              </span>
            </a>

            {/* Desktop links */}
            <ul className="hidden items-center gap-1 lg:flex">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="relative rounded-full px-3.5 py-2 text-[0.87rem] font-medium text-ink-600 transition-colors duration-300 hover:text-ink-900"
                  >
                    <span className="relative z-10">{l.label}</span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 scale-90 rounded-full bg-white/70 opacity-0 transition-all duration-300 hover:scale-100 hover:opacity-100"
                    />
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <a
                href="#contact"
                className="btn-primary hidden !px-5 !py-2.5 !text-[0.85rem] sm:inline-flex"
              >
                Start a project
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className="flex h-10 w-10 items-center justify-center rounded-full glass lg:hidden"
              >
                {open ? (
                  <X className="h-5 w-5 text-ink-800" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5 text-ink-800" aria-hidden="true" />
                )}
              </button>
            </div>
          </nav>
        </div>

        {/* Reading progress hairline */}
        <motion.div
          aria-hidden="true"
          style={{ scaleX: scrollYProgress }}
          className={`mx-auto mt-2 h-[2px] max-w-6xl origin-left rounded-full bg-linear-to-r from-abyss-600 via-aqua-500 to-blush-500 transition-opacity duration-500 ${
            scrolled ? "opacity-70" : "opacity-0"
          }`}
        />
      </header>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink-900/25 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.5, ease: easeOutExpo }}
              className="relative mx-3 mt-20 overflow-hidden rounded-3xl glass-strong p-5"
            >
              <ul className="space-y-1">
                {LINKS.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.06,
                      duration: 0.45,
                      ease: easeOutExpo,
                    }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-2xl px-4 py-3.5 font-display text-lg font-semibold text-ink-800 transition-colors hover:bg-white/70 hover:text-ink-900"
                    >
                      {l.label}
                      <ArrowRight
                        className="h-4 w-4 text-ink-300"
                        aria-hidden="true"
                      />
                    </a>
                  </motion.li>
                ))}
              </ul>

              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="btn-primary mt-4 w-full"
              >
                Start a project
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

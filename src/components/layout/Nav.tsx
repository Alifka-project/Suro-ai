"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { ArrowRight, CalendarDays, Menu, X } from "lucide-react";
import { easeOutExpo } from "@/lib/motion";
import { BRAND, SECTION_IDS } from "@/lib/site";
import { ContactLink } from "@/components/ui/ContactLink";

const LINKS = [
  { id: SECTION_IDS.painPoints, label: "Pain points" },
  { id: SECTION_IDS.functions, label: "Functions" },
  { id: SECTION_IDS.services, label: "Services" },
  { id: SECTION_IDS.about, label: "About" },
  { id: SECTION_IDS.faq, label: "FAQ" },
] as const;

const LINK_IDS: readonly string[] = LINKS.map((l) => l.id);

/**
 * The nav section currently crossing a thin band a little above the middle of
 * the viewport, or null while the visitor is in a section the nav doesn't
 * list (the hero, the approach band, the footer).
 */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setActive(ids.find((id) => inBand.has(id)) ?? null);
      },
      { rootMargin: "-38% 0px -57% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const reduce = useReducedMotion();
  const active = useActiveSection(LINK_IDS);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  const close = () => setOpen(false);

  // Lock the page behind the mobile sheet
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes the sheet and hands focus back to the toggle; growing the
  // window to desktop width closes it too, so the scroll lock can't outlive it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  // Tabbing past the last item leaves the menu, so close it rather than keep
  // a full-screen sheet over content the keyboard is now in.
  function onSheetBlur(e: FocusEvent<HTMLElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next) && next !== toggleRef.current) {
      setOpen(false);
    }
  }

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
                width/height are the rendered size (h-9 at most, 226:240
                source), so the srcset offers 48w/96w, not 256w/640w. */}
            <a
              href="#top"
              className="group flex shrink-0 items-center gap-2.5"
              aria-label={`${BRAND.name}, back to top`}
            >
              <Image
                src="/brand/suloai-mark.png"
                alt=""
                aria-hidden="true"
                width={34}
                height={36}
                loading="eager"
                className="h-8 w-auto transition-transform duration-500 group-hover:scale-105 sm:h-9"
              />
              <span className="font-display text-[1.15rem] font-bold tracking-[0.02em] text-ink-900">
                SULO<span className="text-gradient">AI</span>
              </span>
            </a>

            {/* Desktop links. The pill marks the section in view: a shape,
                not just a colour change. */}
            <ul className="hidden items-center gap-0.5 lg:flex">
              {LINKS.map((l) => {
                const current = active === l.id;
                return (
                  <li key={l.id}>
                    <a
                      href={`#${l.id}`}
                      aria-current={current ? "true" : undefined}
                      className={`group relative block rounded-full px-3.5 py-2 text-[0.87rem] font-medium transition-colors duration-300 ${
                        current ? "text-ink-900" : "text-ink-600 hover:text-ink-900"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute inset-0 rounded-full bg-ink-100/80 ring-1 ring-ink-200/60 transition-[opacity,transform] duration-300 ${
                          current
                            ? "scale-100 opacity-100"
                            : "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-60"
                        }`}
                      />
                      <span className="relative">{l.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2">
              <ContactLink
                intent={{ kind: "call" }}
                className="btn-ghost hidden px-4 py-2.5 text-[0.85rem] xl:inline-flex"
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Book a call
              </ContactLink>
              <ContactLink
                intent={{ kind: "message" }}
                className="btn-primary hidden px-5 py-2.5 text-[0.85rem] sm:inline-flex"
              >
                Talk to us
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </ContactLink>

              <button
                ref={toggleRef}
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
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Pointer-only dismiss; keyboard users have the toggle and Escape */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close menu"
              onClick={close}
              className="absolute inset-0 bg-ink-900/25 backdrop-blur-sm"
            />

            <motion.nav
              aria-label="Menu"
              onBlur={onSheetBlur}
              initial={reduce ? false : { y: "-100%" }}
              animate={{ y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "-100%" }}
              transition={reduce ? { duration: 0 } : { duration: 0.5, ease: easeOutExpo }}
              className="relative mx-3 mt-20 overflow-hidden rounded-3xl glass-strong p-5"
            >
              <ul className="space-y-1">
                {LINKS.map((l, i) => {
                  const current = active === l.id;
                  return (
                    <motion.li
                      key={l.id}
                      initial={reduce ? false : { opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05, duration: 0.45, ease: easeOutExpo }}
                    >
                      <a
                        href={`#${l.id}`}
                        onClick={close}
                        aria-current={current ? "true" : undefined}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 font-display text-lg font-semibold transition-colors hover:bg-white/70 hover:text-ink-900 ${
                          current ? "bg-ink-100/80 text-ink-900" : "text-ink-800"
                        }`}
                      >
                        {l.label}
                        <ArrowRight className="h-4 w-4 text-ink-400" aria-hidden="true" />
                      </a>
                    </motion.li>
                  );
                })}
              </ul>

              <div className="mt-4 grid gap-2.5">
                <ContactLink
                  intent={{ kind: "message" }}
                  onNavigate={close}
                  className="btn-primary w-full"
                >
                  Talk to us
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ContactLink>
                <ContactLink
                  intent={{ kind: "call" }}
                  onNavigate={close}
                  className="btn-ghost w-full"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Book a call
                </ContactLink>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

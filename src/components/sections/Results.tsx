"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Quote } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard, GLOW } from "@/components/ui/SpotlightCard";
import { easeOutExpo } from "@/lib/motion";

/**
 * ⚠️ PLACEHOLDER FIGURES — replace with your own delivered results before
 * launch, and get sign-off from each client on any quote or attribution.
 * These are written as representative engagement patterns rather than named
 * case studies precisely so nothing here misrepresents a real customer.
 */
const CASES = [
  {
    sector: "Electronics distribution",
    scope: "PO intake + approvals",
    headline: "Order desk stopped re-keying",
    stat: 340,
    suffix: " hrs",
    statLabel: "returned per quarter",
    body: "Orders arriving as email PDFs were extracted, validated against the item master, and routed for approval automatically. The team kept the exceptions and lost the typing.",
    stack: ["Power Automate", "Document AI", "SAP"],
    glow: GLOW.abyss,
  },
  {
    sector: "FMCG manufacturing",
    scope: "Demand forecasting",
    headline: "Planning cycle cut to an afternoon",
    stat: 28,
    suffix: "%",
    statLabel: "lower forecast error",
    body: "A statistical baseline replaced twelve linked spreadsheets, with planner overrides captured and measured. The monthly S&OP prep dropped from three days to under four hours.",
    stack: ["Python", "Excel VBA", "Power BI"],
    glow: GLOW.aqua,
  },
  {
    sector: "3PL logistics",
    scope: "Customer status agent",
    headline: "The inbox stopped being the bottleneck",
    stat: 64,
    suffix: "%",
    statLabel: "of enquiries answered by AI",
    body: "A grounded AI agent answered shipment status questions from live TMS data across web and WhatsApp, escalating anything it couldn't verify with full context attached.",
    stack: ["Claude API", "RAG", "WhatsApp"],
    glow: GLOW.lilac,
  },
];

/** Counts up to `value` when scrolled into view. */
function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;

    const duration = 1500;
    let frame = 0;
    let start: number | null = null;

    const tick = (t: number) => {
      if (start === null) start = t;
      const progress = Math.min((t - start) / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, reduced]);

  // Derived rather than set from the effect, so reduced motion shows the final
  // figure without a cascading render.
  const shown = reduced ? value : display;

  return (
    <span ref={ref} className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

export function Results() {
  return (
    <section
      id="results"
      className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="What changes"
          title={
            <>
              The work, <span className="text-gradient">and what it moved</span>.
            </>
          }
          lede="Three representative engagements. Every number is measured against a baseline we captured in week one — because an automation you can't measure is a story, not a result."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <motion.div
              key={c.headline}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.75, delay: i * 0.12, ease: easeOutExpo }}
            >
              <SpotlightCard glow={c.glow} as="article" className="h-full p-5 sm:p-6">
                {/* min-height keeps the stat baselines aligned across the row
                    even when one card's badges wrap to a second line */}
                <div className="flex flex-wrap items-start gap-2 lg:min-h-[3.4rem]">
                  <span className="rounded-full bg-ink-100 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-500">
                    {c.sector}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-white"
                    style={{ backgroundColor: `rgb(${c.glow} / 0.9)` }}
                  >
                    {c.scope}
                  </span>
                </div>

                <p className="mt-5 font-display text-[2.6rem] font-extrabold leading-none text-gradient sm:text-[3rem]">
                  <CountUp value={c.stat} suffix={c.suffix} />
                </p>
                <p className="mt-1.5 text-[0.8rem] text-ink-500">{c.statLabel}</p>

                <h3 className="mt-5 text-[1.05rem] font-bold leading-snug">
                  {c.headline}
                </h3>
                <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-600">
                  {c.body}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-100 pt-4">
                  {c.stack.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-white/70 px-2 py-1 font-mono text-[0.66rem] text-ink-500 ring-1 ring-ink-100"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        {/* Positioning statement */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
          className="relative mt-6 overflow-hidden rounded-[1.75rem] glass p-6 sm:mt-8 sm:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-mint-400 opacity-30 blur-[80px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-blush-400 opacity-30 blur-[80px]"
          />
          <Quote
            className="relative h-7 w-7 text-lilac-400"
            aria-hidden="true"
          />
          <p className="relative mt-4 max-w-3xl font-display text-[1.15rem] font-semibold leading-snug text-ink-900 sm:text-[1.5rem]">
            We don&apos;t sell transformation programmes. We find the one process
            costing you the most, automate it properly, and let the result decide
            whether there&apos;s a second project.
          </p>
          <p className="relative mt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-400">
            How we work — every engagement
          </p>
        </motion.div>
      </div>
    </section>
  );
}

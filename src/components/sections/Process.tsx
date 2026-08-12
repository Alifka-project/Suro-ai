"use client";

import { motion } from "framer-motion";
import { Search, PenTool, Rocket, LineChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo } from "@/lib/motion";
import { GLOW } from "@/components/ui/SpotlightCard";

type Step = {
  icon: LucideIcon;
  n: string;
  title: string;
  duration: string;
  body: string;
  deliverable: string;
  glow: string;
};

const STEPS: Step[] = [
  {
    icon: Search,
    n: "01",
    title: "Map one process",
    duration: "Week 1",
    body: "A 45-minute session where you walk us through the process as it truly runs — including the workarounds that never made it into the SOP. We measure hours, error rate, and delay cost against your numbers.",
    deliverable: "Process map + costed baseline",
    glow: GLOW.abyss,
  },
  {
    icon: PenTool,
    n: "02",
    title: "Scope and fix the price",
    duration: "Week 1–2",
    body: "You get a written scope: what gets built, what it touches, what it won't do, and a fixed price. No hourly drift, no discovery phase you pay for twice. If the numbers don't justify it, we say so.",
    deliverable: "Fixed-price proposal",
    glow: GLOW.azure,
  },
  {
    icon: Rocket,
    n: "03",
    title: "Build in the open",
    duration: "Week 2–6",
    body: "Weekly working demos, not status decks. It's built inside your tenant with your governance, so nothing leaves your environment and your IT team can see exactly what's running.",
    deliverable: "Working automation in production",
    glow: GLOW.aqua,
  },
  {
    icon: LineChart,
    n: "04",
    title: "Measure, then extend",
    duration: "Ongoing",
    body: "We measure against the week-one baseline and hand over documentation your team can maintain. Most clients then point us at the next process — but that's a decision, not a retainer.",
    deliverable: "Impact report + handover docs",
    glow: GLOW.lilac,
  },
];

export function Process() {
  return (
    <section
      id="process"
      className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-haze/60 to-canvas"
      />
      <Orb
        className="-right-24 top-1/3"
        color="bg-blush-400"
        size="h-80 w-80"
        opacity={0.24}
      />
      <Orb
        className="-left-20 bottom-10 hidden sm:block"
        color="bg-aqua-400"
        size="h-72 w-72"
        opacity={0.24}
        delay="-6s"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Four steps. <span className="text-gradient">No discovery theatre</span>.
            </>
          }
          lede="Every engagement runs the same way, whether it's a two-week Excel rebuild or a six-month AI programme. You know the price before we write a line of code."
        />

        <div className="relative mt-12 sm:mt-16">
          {/* Spine — vertical on mobile, horizontal on desktop */}
          <motion.div
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.4, ease: easeOutExpo }}
            className="absolute left-[1.42rem] top-2 hidden h-[calc(100%-2rem)] w-[2px] origin-top rounded-full bg-linear-to-b from-abyss-600 via-aqua-500 to-blush-500 opacity-30 sm:block lg:hidden"
          />
          <motion.div
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.4, ease: easeOutExpo }}
            className="absolute left-0 top-[2.15rem] hidden h-[2px] w-full origin-left rounded-full bg-linear-to-r from-abyss-600 via-aqua-500 to-blush-500 opacity-30 lg:block"
          />

          <ol className="grid gap-5 sm:gap-6 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.li
                  key={step.n}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.12,
                    ease: easeOutExpo,
                  }}
                  className="relative flex gap-4 sm:gap-5 lg:block"
                >
                  {/* Node */}
                  <div className="relative shrink-0">
                    <span
                      className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_12px_24px_-14px_rgb(7_38_60_/_0.8)]"
                      style={{
                        backgroundImage: `linear-gradient(140deg, rgb(${step.glow}), rgb(${step.glow} / 0.6))`,
                      }}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-0 rounded-2xl opacity-30 blur-md"
                      style={{ backgroundColor: `rgb(${step.glow})` }}
                    />
                  </div>

                  <div className="min-w-0 flex-1 lg:mt-5">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-[0.7rem] font-medium text-ink-400">
                        {step.n}
                      </span>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-500 ring-1 ring-ink-100">
                        {step.duration}
                      </span>
                    </div>

                    <h3 className="mt-2 text-[1.08rem] font-bold leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-600">
                      {step.body}
                    </p>

                    <p className="mt-3.5 flex items-start gap-2 border-t border-ink-100 pt-3 text-[0.78rem] text-ink-500">
                      <span
                        aria-hidden="true"
                        className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: `rgb(${step.glow})` }}
                      />
                      <span>
                        <span className="font-mono uppercase tracking-[0.1em] text-ink-400">
                          You get
                        </span>
                        <br />
                        <span className="text-ink-700">{step.deliverable}</span>
                      </span>
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

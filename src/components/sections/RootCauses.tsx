"use client";

import { motion } from "framer-motion";
import { Repeat, Shuffle, Sigma, HardDrive, DatabaseZap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { GLOW } from "@/components/ui/SpotlightCard";
import { easeOutExpo } from "@/lib/motion";

type RootCause = {
  n: string;
  icon: LucideIcon;
  title: string;
  /** One line: what the cause actually is. */
  line: string;
  /** Short, concrete signals a visitor recognises in their own week. */
  signals: string[];
  /** What it costs while it stays unfixed. */
  cost: string;
  glow: string;
};

const ROOT_CAUSES: RootCause[] = [
  {
    n: "01",
    icon: Repeat,
    title: "Repetitive manual work",
    line: "The same tasks by hand, every day and every month-end.",
    signals: [
      "Re-keying between systems",
      "Downloading and renaming files",
      "Rebuilding the same report",
      "Manual follow-ups",
    ],
    cost: "Hours gone daily — and errors nobody catches until it is late.",
    glow: GLOW.abyss,
  },
  {
    n: "02",
    icon: Shuffle,
    title: "No single source of truth",
    line: "The data exists in five places, in five formats, and no two agree.",
    signals: [
      "Competing Excel trackers",
      "Customer ID vs Code vs Name",
      "Overlapping portals",
      "Versions nobody trusts",
    ],
    cost: "More time spent reconciling data than actually using it.",
    glow: GLOW.azure,
  },
  {
    n: "03",
    icon: Sigma,
    title: "Excel holding the process together",
    line: "The logic lives in formulas nobody wants to touch.",
    signals: [
      "Nested IFs and long lookups",
      "Linked workbooks",
      "Hidden rules",
      "One person who understands it",
    ],
    cost: "One broken formula takes the whole process down.",
    glow: GLOW.aqua,
  },
  {
    n: "04",
    icon: HardDrive,
    title: "Files too heavy to work in",
    line: "Workbooks so large that opening one is a coffee break.",
    signals: ["Slow to open", "Painful to share", "Corrupts under load", "Freezes mid-edit"],
    cost: "The tool itself becomes the bottleneck.",
    glow: GLOW.mint,
  },
  {
    n: "05",
    icon: DatabaseZap,
    title: "Master data nobody trusts",
    line: "The same customer, product or supplier looks different in every file.",
    signals: ["Duplicate records", "Outdated suppliers", "Wrong status", "Missing fields"],
    cost: "Decisions made on numbers people quietly doubt.",
    glow: GLOW.lilac,
  },
];

export function RootCauses() {
  return (
    <section
      id="root-causes"
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-haze/70 to-canvas"
      />
      <Orb
        className="-left-24 top-24 hidden lg:block"
        color="bg-blush-400"
        size="h-80 w-80"
        opacity={0.22}
      />
      <Orb
        className="-right-20 bottom-16 hidden sm:block"
        color="bg-azure-400"
        size="h-72 w-72"
        opacity={0.22}
        delay="-7s"
      />

      <div className="relative mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Root cause"
          title={
            <>
              Five root causes.{" "}
              <span className="text-gradient">Yours is on this list</span>.
            </>
          }
          lede="Overtime is the symptom. These are the causes underneath it — and every one of them is fixable. Recognise yours, and we will tell you what it takes to remove it."
        />

        {/* Zigzag timeline: a spine down the centre at lg with cards
            alternating either side, each sliding in from its own side. Below
            lg it collapses to one column with the spine on the left. */}
        <div className="relative mt-10 sm:mt-14">
          <motion.span
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 1.6, ease: easeOutExpo }}
            className="absolute inset-y-0 left-[21px] w-[2px] origin-top rounded-full bg-linear-to-b from-abyss-600 via-aqua-500 to-blush-500 opacity-25 lg:left-1/2 lg:-translate-x-1/2"
          />

          <ol className="space-y-5 lg:space-y-8">
            {ROOT_CAUSES.map((c, i) => {
              const Icon = c.icon;
              const left = i % 2 === 0;

              return (
                <li
                  key={c.n}
                  className="relative pl-16 lg:grid lg:grid-cols-2 lg:gap-x-16 lg:pl-0"
                >
                  {/* Node sits on the spine, level with the card title */}
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.5, ease: easeOutExpo }}
                    className="absolute left-0 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-12px_rgb(7_38_60_/_0.6)] lg:left-1/2 lg:-translate-x-1/2"
                    style={{
                      backgroundImage: `linear-gradient(140deg, rgb(${c.glow}), rgb(${c.glow} / 0.6))`,
                    }}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </motion.span>

                  <motion.div
                    initial={{ opacity: 0, y: 24, x: left ? -24 : 24 }}
                    whileInView={{ opacity: 1, y: 0, x: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.65, ease: easeOutExpo }}
                    className={`relative overflow-hidden rounded-3xl glass p-5 sm:p-6 ${
                      left ? "lg:col-start-1 lg:text-right" : "lg:col-start-2 lg:row-start-1"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 w-1 ${left ? "left-0 lg:left-auto lg:right-0" : "left-0"}`}
                      style={{
                        backgroundImage: `linear-gradient(to bottom, rgb(${c.glow}), rgb(${c.glow} / 0.25))`,
                      }}
                    />

                    <div
                      className={`flex items-baseline gap-2.5 ${left ? "lg:justify-end" : ""}`}
                    >
                      <span className="font-mono text-[0.7rem] font-medium text-ink-400">
                        {c.n}
                      </span>
                      <h3 className="font-display text-[1.02rem] font-bold leading-snug text-ink-900 sm:text-[1.15rem]">
                        {c.title}
                      </h3>
                    </div>

                    <p className="mt-1.5 text-[0.9rem] leading-snug text-ink-600 sm:text-[0.95rem]">
                      {c.line}
                    </p>

                    <motion.ul
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true, amount: 0.35 }}
                      variants={{
                        hidden: {},
                        show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
                      }}
                      className={`mt-3 flex flex-wrap gap-1.5 ${left ? "lg:justify-end" : ""}`}
                    >
                      {c.signals.map((sig) => (
                        <motion.li
                          key={sig}
                          variants={{
                            hidden: { opacity: 0, y: 6 },
                            show: { opacity: 1, y: 0 },
                          }}
                          transition={{ duration: 0.4, ease: easeOutExpo }}
                          className="rounded-full border border-ink-200/70 bg-white/70 px-2.5 py-1 text-[0.74rem] text-ink-600"
                        >
                          {sig}
                        </motion.li>
                      ))}
                    </motion.ul>

                    <p
                      className={`mt-3.5 flex items-start gap-2 text-[0.82rem] leading-snug text-ink-500 ${
                        left ? "lg:flex-row-reverse" : ""
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: `rgb(${c.glow})` }}
                      />
                      {c.cost}
                    </p>
                  </motion.div>
                </li>
              );
            })}
          </ol>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="mt-8 text-center text-[0.95rem] text-ink-600"
        >
          Recognise more than one?{" "}
          <a
            href="#contact"
            className="font-semibold text-ink-900 underline decoration-aqua-400 decoration-2 underline-offset-4 transition-colors hover:text-abyss-600"
          >
            Tell us which
          </a>{" "}
          and we&apos;ll scope the fix.
        </motion.p>
      </div>
    </section>
  );
}

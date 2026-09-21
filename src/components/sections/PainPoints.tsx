"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Repeat, Shuffle, Sigma, HardDrive, DatabaseZap, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { GLOW } from "@/components/ui/SpotlightCard";
import { easeOutExpo } from "@/lib/motion";

type PainPoint = {
  n: string;
  icon: LucideIcon;
  title: string;
  /** Shown even when the item is collapsed, so a closed list still reads. */
  summary: string;
  body: string[];
  examples?: string[];
  examplesLabel?: string;
  /** What it costs when left alone. */
  consequence?: string;
  /** The line we want them to remember. */
  kicker: string;
  glow: string;
};

const PAIN_POINTS: PainPoint[] = [
  {
    n: "01",
    icon: Repeat,
    title: "Too much manual work, too often, too risky",
    summary:
      "The same tasks, by hand, every day and every month-end.",
    body: [
      "Your team spends hours a day downloading documents, copying data between systems, renaming files, formatting reports and sending the same emails — repeating on every daily cycle, every month-end, every reporting deadline.",
    ],
    examplesLabel: "Sound familiar?",
    examples: [
      "Downloading invoices from email or portals",
      "Copying data between systems",
      "Renaming and filing documents by hand",
      "Formatting the same report every week",
      "Repetitive outbound emails",
      "Uploading files one at a time",
      "Updating the same tracker daily",
      "Re-keying data that already exists",
      "Recurring management reports",
      "Month-end consolidation",
      "Manual follow-ups with customers and suppliers",
    ],
    consequence:
      "Done by hand, mistakes are not a risk — they are a certainty. Missed deadlines, wrong customer details, incorrect figures, duplicate processing, documents that expired while nobody was looking, follow-ups that never happened.",
    kicker:
      "What should take minutes takes hours. What stays manual eventually goes wrong.",
    glow: GLOW.abyss,
  },
  {
    n: "02",
    icon: Shuffle,
    title: "Data scattered, duplicated, never in the same format",
    summary:
      "The data exists. It just doesn’t flow — and no two files agree.",
    body: [
      "As a company grows, every department builds its own trackers, files and versions of the truth — spread across Excel, email, PDFs, shared drives, the ERP, web portals and SharePoint. Nothing is missing, exactly. It’s just never in one place.",
      "A single report can need Excel plus CSV plus PDF plus an ERP export plus a database plus email — each naming the same thing differently. File A says Customer ID, File B says Customer Code, File C says Customer Name.",
    ],
    examplesLabel: "What it looks like",
    examples: [
      "Multiple Excel trackers",
      "Competing versions of one report",
      "Shared folders nobody prunes",
      "Overlapping data across portals",
      "Identifiers that don’t match",
    ],
    consequence:
      "People spend more time finding and reconciling data than actually using it: duplicate entry, numbers that disagree, updates that land late, and no real-time view of anything.",
    kicker: "Your data shouldn’t need a person to connect it every single time.",
    glow: GLOW.azure,
  },
  {
    n: "03",
    icon: Sigma,
    title: "Overcomplicated Excel and formula dependency",
    summary:
      "The logic lives in cells nobody wants to touch.",
    body: [
      "Excel is genuinely powerful — until a process outgrows it. The rules end up buried in formulas, and the person who wrote them is the only one who understands what happens when something changes.",
    ],
    examplesLabel: "The usual suspects",
    examples: [
      "Hundreds of formulas",
      "Long VLOOKUP / XLOOKUP chains",
      "Nested IF statements",
      "Multiple linked workbooks",
      "Manual copy-paste steps",
      "Logic hidden inside spreadsheets",
      "Different users keeping different versions",
    ],
    consequence:
      "One broken formula can take the whole process down — usually on the day it matters most, and usually without an obvious error message.",
    kicker:
      "We turn complicated spreadsheets into structured, repeatable workflows.",
    glow: GLOW.aqua,
  },
  {
    n: "04",
    icon: HardDrive,
    title: "Heavy and unstable files",
    summary: "Workbooks so large that opening them is a coffee break.",
    body: [
      "Big workbooks linked to a chain of external files become slow to open, painful to share, easy to corrupt — and every so often they simply stop responding.",
      "Rather than forcing Excel to do everything, the process gets rebuilt with the right combination of automation, data processing, structured files, databases, cloud tools and APIs — with Excel kept for what it is actually good at.",
    ],
    kicker: "The goal isn’t a faster spreadsheet. It’s a better process.",
    glow: GLOW.mint,
  },
  {
    n: "05",
    icon: DatabaseZap,
    title: "Poor or untrusted master data",
    summary: "No single source of truth — so every number needs checking.",
    body: [
      "Most businesses don’t have one reliable master record. The same customer, product or supplier shows up differently in every file, and reconciling them becomes somebody’s unofficial full-time job.",
    ],
    examplesLabel: "Where it goes wrong",
    examples: [
      "Different customer names",
      "Different product codes",
      "Outdated supplier details",
      "Duplicate records",
      "Incorrect status flags",
      "Missing fields",
    ],
    consequence:
      "Teams burn hours working out which version is correct, and decisions get made on figures nobody fully trusts.",
    kicker:
      "Validation, standard formats and controlled master data fix this at the source.",
    glow: GLOW.lilac,
  },
];

export function PainPoints() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="pain-points"
      className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
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

      <div className="relative mx-auto max-w-4xl">
        <SectionHeading
          eyebrow="The problem"
          title={
            <>
              Where the hours{" "}
              <span className="text-gradient">actually go</span>.
            </>
          }
          lede="Before we talk about what we build, here is what we keep finding. If two or three of these sound like your week, there is almost certainly a fortnight of work hiding in them."
        />

        <ol className="mt-10 space-y-3 sm:mt-14">
          {PAIN_POINTS.map((p, i) => {
            const isOpen = open === i;
            const Icon = p.icon;

            return (
              <motion.li
                key={p.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: 0.6,
                  delay: Math.min(i * 0.06, 0.3),
                  ease: easeOutExpo,
                }}
                className={`relative overflow-hidden rounded-3xl transition-all duration-500 ${
                  isOpen ? "glass-strong" : "glass"
                }`}
              >
                {/* Accent edge, lit when the item is open */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1 transition-opacity duration-500"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgb(${p.glow}), rgb(${p.glow} / 0.25))`,
                    opacity: isOpen ? 1 : 0,
                  }}
                />

                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`pain-panel-${i}`}
                    id={`pain-trigger-${i}`}
                    className="flex w-full items-start gap-3.5 p-4 text-left sm:gap-5 sm:p-6"
                  >
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-12px_rgb(7_38_60_/_0.6)] sm:h-11 sm:w-11"
                      style={{
                        backgroundImage: `linear-gradient(140deg, rgb(${p.glow}), rgb(${p.glow} / 0.6))`,
                      }}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[0.7rem] font-medium text-ink-400">
                          {p.n}
                        </span>
                        <span
                          className={`font-display text-[1rem] font-bold leading-snug transition-colors duration-300 sm:text-[1.15rem] ${
                            isOpen ? "text-ink-900" : "text-ink-700"
                          }`}
                        >
                          {p.title}
                        </span>
                      </span>
                      <span className="mt-1 block text-[0.85rem] leading-snug text-ink-500">
                        {p.summary}
                      </span>
                    </span>

                    <span
                      className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                        isOpen
                          ? "rotate-45 bg-linear-to-br from-abyss-600 to-aqua-500 text-white"
                          : "bg-ink-100 text-ink-500"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`pain-panel-${i}`}
                      role="region"
                      aria-labelledby={`pain-trigger-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: easeOutExpo }}
                    >
                      <div className="px-4 pb-5 sm:px-6 sm:pb-7 sm:pl-[5.5rem]">
                        {p.body.map((para) => (
                          <p
                            key={para.slice(0, 32)}
                            className="mt-0 mb-3 text-[0.9rem] leading-relaxed text-ink-600 last:mb-0 sm:text-[0.95rem]"
                          >
                            {para}
                          </p>
                        ))}

                        {p.examples && (
                          <div className="mt-5">
                            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">
                              {p.examplesLabel ?? "Examples"}
                            </p>
                            <ul className="mt-2.5 flex flex-wrap gap-1.5">
                              {p.examples.map((ex) => (
                                <li
                                  key={ex}
                                  className="rounded-full border border-ink-200/70 bg-white/70 px-2.5 py-1 text-[0.76rem] text-ink-600"
                                >
                                  {ex}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {p.consequence && (
                          <p className="mt-5 border-l-2 border-ink-200 pl-3.5 text-[0.88rem] leading-relaxed text-ink-600">
                            {p.consequence}
                          </p>
                        )}

                        <p
                          className="mt-5 font-display text-[0.95rem] font-semibold leading-snug text-ink-900 sm:text-[1.05rem]"
                          style={{
                            textDecorationColor: `rgb(${p.glow})`,
                          }}
                        >
                          {p.kicker}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ol>

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
            Tell us which ones
          </a>{" "}
          and we&apos;ll tell you what it would take to fix them.
        </motion.p>
      </div>
    </section>
  );
}

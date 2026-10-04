"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import { Search, PenTool, Hammer, ChartLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo } from "@/lib/motion";
import { GLOW } from "@/components/ui/SpotlightCard";
import { SECTION_IDS } from "@/lib/site";

type Step = {
  icon: LucideIcon;
  n: string;
  title: string;
  body: ReactNode;
  deliverable: string;
  glow: string;
};

/** In-page link to a package card in the Services section. */
function PackageLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a
      href={`#service-${id}`}
      className="font-medium text-ink-900 underline decoration-aqua-400 decoration-2 underline-offset-4 transition-colors hover:text-abyss-600"
    >
      {children}
    </a>
  );
}

const STEPS: Step[] = [
  {
    icon: Search,
    n: "01",
    title: "Audit one process",
    body: (
      <>
        We go through one process with you step by step, including the
        workarounds nobody wrote down. This is the{" "}
        <PackageLink id="automation-audit">Automation Audit</PackageLink>.
      </>
    ),
    deliverable: "Automation opportunities, recommended solution, estimated time saving",
    glow: GLOW.abyss,
  },
  {
    icon: PenTool,
    n: "02",
    title: "Agree the scope and price",
    body: "A written scope: what gets built, what it connects to, what it won't do, and a fixed price. If the numbers don't justify building it, we tell you.",
    deliverable: "Written scope and fixed price",
    glow: GLOW.azure,
  },
  {
    icon: Hammer,
    n: "03",
    title: "Build and test",
    body: "You see working versions while it's being built. We build on your accounts and licences wherever possible, so your IT team can see what's running.",
    deliverable: "A working solution, live and tested",
    glow: GLOW.aqua,
  },
  {
    icon: ChartLine,
    n: "04",
    title: "Hand over and improve",
    body: (
      <>
        We check the result against the audit&apos;s estimate and hand over
        documentation, the source and a walkthrough. To keep it monitored and
        improving, add{" "}
        <PackageLink id="support">Support &amp; Continuous Improvement</PackageLink>.
      </>
    ),
    deliverable: "Documentation, source and handover",
    glow: GLOW.lilac,
  },
];

export function Process() {
  return (
    <section
      id={SECTION_IDS.process}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
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

      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="How it works"
            title={
              <>
                Four steps, <span className="text-gradient">audit to handover</span>
              </>
            }
            lede="Every project follows these four steps, and you know the price before we build anything."
          />

          <div className="relative mt-10 sm:mt-12">
            {/* Spine — vertical on mobile, horizontal on desktop */}
            <motion.div
              aria-hidden="true"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1.4, ease: easeOutExpo }}
              className="absolute left-[21px] top-2 hidden h-[calc(100%-2rem)] w-[2px] origin-top rounded-full bg-linear-to-b from-abyss-600 via-aqua-500 to-blush-500 opacity-30 sm:block lg:hidden"
            />
            <motion.div
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.4, ease: easeOutExpo }}
              className="absolute top-[21px] hidden h-[2px] origin-left rounded-full bg-linear-to-r from-abyss-600 via-aqua-500 to-blush-500 opacity-30 lg:left-[22px] lg:right-[calc((100%-4.5rem)/4-22px)] lg:block"
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
                    {/* Sized to the node in both axes: as a flex child its
                        height would stretch to the row, and as an lg block its
                        width would fill the column — either way the inset-0 glow
                        smears instead of sitting behind the icon. */}
                    <div className="relative h-11 w-11 shrink-0">
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
                        className="absolute inset-0 z-0 rounded-2xl opacity-40 blur-md"
                        style={{ backgroundColor: `rgb(${step.glow})` }}
                      />
                    </div>

                    <div className="min-w-0 flex-1 lg:mt-5">
                      <p className="font-mono text-[0.7rem] font-medium text-ink-550">
                        <span className="sr-only">Step </span>
                        {step.n}
                      </p>

                      <h3 className="mt-1.5 text-[1.08rem] font-bold leading-snug">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-600">
                        {step.body}
                      </p>

                      <p className="mt-3.5 flex items-start gap-2 border-t border-ink-100 pt-3 text-[0.78rem] text-ink-600">
                        <span
                          aria-hidden="true"
                          className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: `rgb(${step.glow})` }}
                        />
                        <span>
                          <span className="font-mono uppercase tracking-[0.1em] text-ink-550">
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
      </MotionConfig>
    </section>
  );
}

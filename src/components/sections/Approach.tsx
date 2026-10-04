import type { Variants } from "framer-motion";
import {
  Clock3,
  Database,
  Gauge,
  Hourglass,
  Keyboard,
  Route,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo } from "@/lib/motion";
import { SECTION_IDS } from "@/lib/site";

/**
 * "Technology-agnostic automation": what the work is for, and the order we
 * look at things in before a tool is chosen. A compact band between the pain
 * points and the business functions.
 *
 * A server component. Every word is plain HTML; only the decorative entrance
 * (nodes lighting up in turn, connectors drawing in) runs on the client,
 * through Reveal. Text never waits on an animation.
 *
 * Colours are Tailwind classes, not GLOW triplets: GLOW lives in a client
 * module, and a server component can't read properties of a client export.
 */

type Outcome = { label: string; icon: LucideIcon };

/** The client's "We focus on" list. Labels only, no figures. */
const OUTCOMES: Outcome[] = [
  { label: "Time saved", icon: Clock3 },
  { label: "Fewer errors", icon: ShieldCheck },
  { label: "Less manual work", icon: Keyboard },
  { label: "Higher efficiency", icon: Gauge },
];

type Step = {
  label: string;
  detail: string;
  icon: LucideIcon;
  /** Gradient stops for the node. */
  node: string;
  /** Gradient stops for the connector to the next node; text-* colours its arrowhead. */
  connector?: string;
};

/** The client's "We start with" chain, ending in the choice of approach. */
const STEPS: Step[] = [
  {
    label: "Your process",
    detail: "How the work runs today, workarounds included",
    icon: Workflow,
    node: "from-abyss-600 to-azure-400",
    connector: "from-abyss-600/60 to-azure-500/60 text-azure-500/70",
  },
  {
    label: "Your systems",
    detail: "The tools you already use",
    icon: Server,
    node: "from-azure-600 to-aqua-400",
    connector: "from-azure-500/60 to-aqua-500/60 text-aqua-500/70",
  },
  {
    label: "Your data",
    detail: "Where it lives and what state it's in",
    icon: Database,
    node: "from-aqua-600 to-mint-500",
    connector: "from-aqua-500/60 to-blush-500/60 text-blush-500/80",
  },
  {
    label: "Your bottleneck",
    detail: "Where the time and the errors come from",
    icon: Hourglass,
    node: "from-blush-600 to-lilac-400",
    connector: "from-blush-500/60 to-lilac-500/70 text-lilac-500/80",
  },
  {
    label: "The right approach",
    detail: "Then we choose the automation that fits",
    icon: Route,
    node: "from-abyss-600 via-aqua-500 to-lilac-500",
  },
];

/** Seconds between one node lighting up and the next. */
const STEP_GAP = 0.32;

/**
 * Framer animates from inline styles, which the reduced-motion block in
 * globals.css can't reach. Under prefers-reduced-motion these !important
 * classes pin each animated element to its finished state.
 */
const SETTLED = "motion-reduce:opacity-100! motion-reduce:transform-none!";

const LABEL =
  "font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-ink-600";

/** Nodes start dimmed, not invisible, so the chain reads even before it animates. */
function nodeIn(i: number): Variants {
  return {
    hidden: { opacity: 0.35, scale: 0.84 },
    show: {
      opacity: 1,
      scale: 1,
      transition: { delay: i * STEP_GAP, duration: 0.55, ease: easeOutExpo },
    },
  };
}

function draw(i: number, axis: "x" | "y"): Variants {
  const transition = { delay: i * STEP_GAP + 0.14, duration: 0.5, ease: easeOutExpo };
  return axis === "x"
    ? { hidden: { scaleX: 0 }, show: { scaleX: 1, transition } }
    : { hidden: { scaleY: 0 }, show: { scaleY: 1, transition } };
}

export function Approach() {
  return (
    <section
      id={SECTION_IDS.approach}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-white/70 to-canvas"
      />
      <Orb
        className="-left-24 top-10 hidden md:block"
        color="bg-aqua-400"
        size="h-72 w-72"
        opacity={0.16}
      />
      <Orb
        className="-right-20 bottom-4 hidden lg:block"
        color="bg-lilac-400"
        size="h-64 w-64"
        opacity={0.18}
        delay="-6s"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-14">
          <SectionHeading
            align="left"
            eyebrow="Our approach"
            title={
              <>
                <span className="whitespace-nowrap">Technology-agnostic</span>{" "}
                <span className="text-gradient">automation</span>
              </>
            }
            lede="We don't start with a technology and force your process into it."
          />

          <div className="min-w-0">
            <h3 className={LABEL}>We focus on</h3>
            <RevealGroup as="ul" gap={0.07} className="mt-3 grid grid-cols-2 gap-2.5">
              {OUTCOMES.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <RevealItem
                    key={outcome.label}
                    as="li"
                    className={`flex min-w-0 items-center gap-2.5 rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-[0_10px_24px_-18px_rgb(7_38_60/0.5)] ${SETTLED}`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-haze text-abyss-600 ring-1 ring-ink-100"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 text-[0.88rem] font-semibold leading-tight text-ink-800">
                      {outcome.label}
                    </span>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </div>
        </div>

        <div className="relative mt-9 rounded-3xl glass p-5 sm:mt-10 sm:p-7 lg:px-8 lg:pb-8 lg:pt-7">
          <h3 className={LABEL}>We start with</h3>

          {/* The connectors run between nodes: down the left on phones and
              tablets, left to right across five columns from lg. Each one
              draws in after its node lights up. */}
          <RevealGroup gap={0} className="mt-5 lg:mt-7">
            <ol role="list" className="lg:grid lg:grid-cols-5 lg:gap-x-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const last = i === STEPS.length - 1;

                return (
                  <li
                    key={step.label}
                    className="relative flex min-w-0 gap-4 pb-8 last:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:pb-0 lg:text-center"
                  >
                    {step.connector && (
                      <>
                        <RevealItem
                          as="span"
                          variants={draw(i, "y")}
                          className={`absolute bottom-1 left-[23px] top-[3.25rem] w-[2px] origin-top rounded-full bg-linear-to-b lg:hidden ${step.connector} ${SETTLED}`}
                        >
                          <span className="absolute -bottom-px left-1/2 -translate-x-1/2 border-x-4 border-t-[6px] border-x-transparent border-t-current" />
                        </RevealItem>
                        <RevealItem
                          as="span"
                          variants={draw(i, "x")}
                          className={`absolute left-[calc(50%+2rem)] top-[23px] hidden h-[2px] w-[calc(100%-3rem)] origin-left rounded-full bg-linear-to-r lg:block ${step.connector} ${SETTLED}`}
                        >
                          <span className="absolute -right-px top-1/2 -translate-y-1/2 border-y-4 border-l-[6px] border-y-transparent border-l-current" />
                        </RevealItem>
                      </>
                    )}

                    <RevealItem
                      as="span"
                      variants={nodeIn(i)}
                      className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[0_12px_24px_-14px_rgb(7_38_60/0.75)] ${step.node} ${
                        last ? "ring-4 ring-aqua-300/35" : ""
                      } ${SETTLED}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </RevealItem>

                    <div className="min-w-0 pt-1.5 lg:mt-4 lg:px-1 lg:pt-0">
                      <p className="font-display text-[1rem] font-bold leading-snug text-ink-900 sm:text-[1.05rem]">
                        {step.label}
                      </p>
                      <p className="mt-1 text-[0.85rem] leading-snug text-ink-600">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </RevealGroup>
        </div>

        <p className="mt-6 text-center text-[0.95rem] text-ink-600">
          From one Excel task to a system that spans departments.
        </p>
      </div>
    </section>
  );
}

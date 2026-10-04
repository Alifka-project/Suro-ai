import type { Variants } from "framer-motion";
import { ArrowRight, CalendarClock, CirclePause, Compass, Files, Mail, Unplug } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Orb } from "@/components/ui/AuroraField";
import { packageById } from "@/lib/packages";
import { SECTION_IDS } from "@/lib/site";
import { easeOutExpo } from "@/lib/motion";

/**
 * "Does this sound familiar?" — the client's six one-liners as chat bubbles,
 * each linking to the package that answers it.
 *
 * A server component: the quotes and links ship as plain HTML, and only the
 * scroll entrance (Reveal) runs on the client.
 *
 * Colours are literal Tailwind classes, not GLOW triplets: GLOW lives in a
 * "use client" module, and a server component that reads a value from one
 * gets a client reference, so every colour would come out undefined.
 */

type HookLine = {
  quote: string;
  icon: LucideIcon;
  /** A package id from packages.ts; Services renders it as #service-<id>. */
  packageId: string;
  /** Avatar gradient stops (literal classes, so Tailwind sees them). */
  tone: string;
};

const LINES: HookLine[] = [
  {
    quote: "My team does this every single day.",
    icon: CalendarClock,
    packageId: "automate",
    tone: "from-abyss-600 to-abyss-400",
  },
  {
    quote: "Our data is everywhere, and nothing matches.",
    icon: Files,
    packageId: "data-flow-reporting",
    tone: "from-azure-600 to-azure-400",
  },
  {
    quote: "We're still sending the same emails, manually.",
    icon: Mail,
    packageId: "automate",
    tone: "from-aqua-600 to-aqua-400",
  },
  {
    quote: "Our systems don't talk to each other.",
    icon: Unplug,
    packageId: "connect",
    tone: "from-mint-600 to-mint-400",
  },
  {
    quote: "That project? Started, then stuck.",
    icon: CirclePause,
    packageId: "project-rescue",
    tone: "from-lilac-600 to-lilac-400",
  },
  {
    quote: "We know it should be automated — we just don't know how.",
    icon: Compass,
    packageId: "automation-audit",
    tone: "from-blush-600 to-blush-400",
  },
];

/**
 * Bubbles pop up from the avatar corner. Each bubble triggers on its own, so
 * on a phone they appear as you scroll; the delay staggers each desktop row.
 * Under reduced motion the `motion-reduce:transform-none!` class on the item
 * cancels the movement and leaves a plain fade.
 */
function bubbleIn(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 14, scale: 0.94 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.55, ease: easeOutExpo, delay },
    },
  };
}

export function Hook() {
  return (
    <section
      id={SECTION_IDS.hook}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-white/70 to-canvas"
      />
      <Orb
        className="-right-28 top-8 hidden md:block"
        color="bg-lilac-400"
        size="h-72 w-72"
        opacity={0.2}
      />
      <Orb
        className="-left-24 bottom-0 hidden lg:block"
        color="bg-aqua-400"
        size="h-64 w-64"
        opacity={0.18}
        delay="-5s"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="What we hear"
          title={
            <>
              Does this sound <span className="text-gradient">familiar</span>?
            </>
          }
          lede="If you've said any of these, there's a package for it."
        />

        <ul className="mt-9 grid gap-x-5 gap-y-4 sm:mt-11 sm:grid-cols-2 lg:grid-cols-3">
          {LINES.map((line, i) => {
            const Icon = line.icon;
            const pkg = packageById(line.packageId);

            return (
              <Reveal
                key={line.quote}
                as="li"
                variants={bubbleIn((i % 3) * 0.08)}
                className="flex min-w-0 origin-bottom-left items-end gap-2.5 motion-reduce:transform-none!"
              >
                {/* Avatar */}
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-white shadow-[0_8px_18px_-10px_rgb(7_38_60_/_0.7)] ${line.tone}`}
                >
                  <Icon className="h-[1.05rem] w-[1.05rem]" />
                </span>

                {/* Bubble: the flattened bottom-left corner is the tail. */}
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 self-stretch rounded-[1.35rem] rounded-bl-md glass px-4 py-3.5 sm:px-5 sm:py-4">
                  <p className="font-display text-[1.04rem] font-medium leading-snug text-ink-900 sm:text-[1.1rem]">
                    {line.quote}
                  </p>

                  {pkg && (
                    <a
                      href={`#service-${pkg.id}`}
                      className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[0.78rem] font-semibold text-abyss-600 ring-1 ring-ink-200/80 transition-colors hover:bg-white hover:text-abyss-700 hover:ring-aqua-400"
                    >
                      <span>
                        <span className="font-medium text-ink-600">See:</span> {pkg.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

import type { CSSProperties } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Cable,
  CalendarDays,
  Plug,
  ScanSearch,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { AuroraField } from "@/components/ui/AuroraField";
import { ContactLink } from "@/components/ui/ContactLink";
import { PromptConsole } from "./PromptConsole";
import { BRAND, CONTACT, PROFILE, VALUE_PILLARS } from "@/lib/site";

/**
 * Entrance motion is plain CSS (the `rise` keyframe in globals.css), not
 * framer-motion: the hero is server-rendered and visible on first paint, with
 * or without JavaScript, and nothing waits for hydration. Reduced motion
 * removes the animation entirely, delay included.
 */
const RISE = "animate-rise motion-reduce:animate-none";
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * The tagline is one sentence set in two tiers: the hook large, the promise
 * below it with its last two words ("smarter solutions.") as the gradient
 * fragment. Derived from BRAND.tagline so the headline can't drift from the
 * copy used in metadata and structured data.
 */
function splitTagline(tagline: string) {
  const at = tagline.indexOf(" — ");
  if (at === -1) return { hook: tagline, promise: "", accent: "" };
  const words = tagline.slice(at + 3).split(" ");
  return {
    hook: tagline.slice(0, at),
    promise: words.slice(0, -2).join(" "),
    accent: words.slice(-2).join(" "),
  };
}

const HEADLINE = splitTagline(BRAND.tagline);

const PILLAR_STYLE: Record<
  (typeof VALUE_PILLARS)[number]["key"],
  { icon: LucideIcon; tint: string }
> = {
  automation: { icon: Workflow, tint: "from-abyss-600 to-azure-500" },
  integration: { icon: Cable, tint: "from-azure-500 to-aqua-500" },
  intelligence: { icon: ScanSearch, tint: "from-aqua-600 to-lilac-600" },
};

const [projects] = PROFILE.credentials;

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: BadgeCheck, label: `${projects.value} ${projects.label}` },
  { icon: Plug, label: "Works with the tools you already use" },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pt-36"
    >
      <AuroraField />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-14">
          {/* ── Copy — sticks in view while a long answer renders alongside.
              min-w-0 is load-bearing: grid items default to min-width:auto, so
              the console's intrinsic width would otherwise push the track wider
              than the viewport on phones. */}
          <div className="min-w-0 text-center lg:sticky lg:top-32 lg:self-start lg:pt-6 lg:text-left">
            {/* The pill is part of the h1, so the page's one heading carries
                the terms the title targets ("business automation & AI",
                "Dubai") as well as the tagline. It looks the same as a
                separate eyebrow; the hidden colon makes it read as one
                sentence to screen readers. */}
            <h1>
              <span
                className={`inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-[0.78rem] font-medium tracking-normal text-ink-700 backdrop-blur-md ${RISE}`}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-r from-aqua-500 to-blush-500"
                />
                <span>{`${BRAND.descriptor} in ${CONTACT.city}`}</span>
              </span>
              <span className="sr-only">: </span>
              <span
                className={`mt-6 block text-[clamp(2.25rem,7.4vw,3.6rem)] font-bold leading-[1.03] tracking-[-0.035em] lg:text-[clamp(2.6rem,4.4vw,3.75rem)] ${RISE}`}
                style={delay(60)}
              >
                {HEADLINE.hook}
                {HEADLINE.accent && " —"}
              </span>{" "}
              {HEADLINE.accent && (
                <span
                  className={`mt-3 block text-[clamp(1.2rem,3.4vw,1.65rem)] font-medium leading-[1.28] tracking-[-0.015em] text-ink-700 lg:text-[clamp(1.3rem,1.9vw,1.6rem)] ${RISE}`}
                  style={delay(140)}
                >
                  {HEADLINE.promise}{" "}
                  <span className="font-bold text-gradient">{HEADLINE.accent}</span>
                </span>
              )}
            </h1>

            {/* ── Value pillars: three columns at every width. On phones only
                icon + label show (the line stays readable to screen readers)
                so the console the copy points at starts within the first
                screen. The label size scales with the viewport so the
                longest word still fits a third of a 320px screen. ── */}
            <ul
              aria-label="What we do"
              className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-2 sm:max-w-none sm:gap-2.5 sm:text-left lg:mx-0"
            >
              {VALUE_PILLARS.map((pillar, i) => {
                const { icon: Icon, tint } = PILLAR_STYLE[pillar.key];
                return (
                  <li
                    key={pillar.key}
                    className={`relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-white/70 bg-white/55 p-2.5 backdrop-blur-md sm:items-start sm:gap-2.5 sm:p-3.5 ${RISE}`}
                    style={delay(240 + i * 80)}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-[0_8px_18px_-10px_rgb(7_102_163_/_0.8)] ${tint}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 max-w-full">
                      <p className="font-display text-[clamp(0.75rem,3.6vw,0.95rem)] font-semibold leading-tight text-ink-900">
                        {pillar.label}
                      </p>
                      <p className="mt-1 text-[0.8rem] leading-snug text-ink-600 max-sm:sr-only">
                        {pillar.line}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p
              className={`mx-auto mt-6 max-w-xl text-[1rem] leading-relaxed text-ink-600 sm:text-[1.08rem] lg:mx-0 ${RISE}`}
              style={delay(460)}
            >
              Describe the problem in your own words and see how we&apos;d
              approach it.
            </p>

            <div
              className={`mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start ${RISE}`}
              style={delay(520)}
            >
              <ContactLink intent={{ kind: "message" }} className="btn-primary">
                Talk to us
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ContactLink>
              <ContactLink intent={{ kind: "call" }} className="btn-ghost">
                <CalendarDays className="h-4 w-4 text-abyss-600" aria-hidden="true" />
                Book a call
              </ContactLink>
            </div>

            <ul
              className={`mt-6 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5 lg:justify-start ${RISE}`}
              style={delay(600)}
            >
              {TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-[0.82rem] text-ink-600"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-aqua-600" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Console ──────────────────────────────────────────────────
              `isolate` keeps the glow bed behind the console and in front of
              the aurora, whether or not the entrance transform is applied. */}
          <div className={`relative isolate min-w-0 ${RISE}`} style={delay(200)}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-linear-to-br from-aqua-400/25 via-lilac-400/20 to-blush-400/25 blur-3xl"
            />
            <PromptConsole />
          </div>
        </div>
      </div>
    </section>
  );
}

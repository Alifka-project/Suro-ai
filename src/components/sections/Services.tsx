"use client";

import type { CSSProperties, ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import {
  AppWindow,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronDown,
  Compass,
  GraduationCap,
  LifeBuoy,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard, GLOW } from "@/components/ui/SpotlightCard";
import { Reveal } from "@/components/ui/Reveal";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo, fadeUp, inView, stagger } from "@/lib/motion";
import {
  NOT_SURE_OPTION,
  PACKAGE_GROUPS,
  PACKAGES,
  type PackageGroupId,
  type ServicePackage,
} from "@/lib/packages";
import { SECTION_IDS } from "@/lib/site";
import { ContactLink } from "@/components/ui/ContactLink";

/**
 * Services: packages 0–9 as a ladder from basic to complex, one rung per
 * package group. Every package's full detail is rendered into the HTML inside
 * a native <details>, so it is indexable and works without JavaScript; only
 * the "Talk to us" links need the client (to pre-tick the package in the
 * contact form).
 */

/** One line icon and one palette colour per rung, following the palette order. */
const GROUP_STYLE: Record<PackageGroupId, { icon: LucideIcon; glow: string }> = {
  start: { icon: Compass, glow: GLOW.abyss },
  existing: { icon: Workflow, glow: GLOW.azure },
  intelligence: { icon: BrainCircuit, glow: GLOW.aqua },
  new: { icon: AppWindow, glow: GLOW.mint },
  special: { icon: LifeBuoy, glow: GLOW.lilac },
  training: { icon: GraduationCap, glow: GLOW.blush },
};

const LABEL = "font-mono text-[0.64rem] uppercase tracking-[0.14em] text-ink-550";

export function Services() {
  const first = PACKAGES[0]?.number ?? 0;
  const last = PACKAGES[PACKAGES.length - 1]?.number ?? 9;
  const rungs = PACKAGE_GROUPS.map((group) => ({
    group,
    items: PACKAGES.filter((p) => p.group === group.id),
  })).filter((r) => r.items.length > 0);

  return (
    <section
      id={SECTION_IDS.services}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-white to-canvas"
      />
      <Orb
        className="left-1/2 top-2 hidden -translate-x-1/2 sm:block"
        color="bg-lilac-400"
        size="h-[20rem] w-[34rem]"
        opacity={0.12}
      />
      <Orb
        className="-right-24 bottom-1/4 hidden lg:block"
        color="bg-aqua-400"
        size="h-80 w-80"
        opacity={0.16}
        delay="-6s"
      />

      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={`Packages ${first}–${last}`}
            title={
              <>
                Our services — <span className="text-gradient">from basic to complex</span>
              </>
            }
            lede="Start with one task or go straight to a complete system. Open any package to see what it covers."
          />

          {/* ── The ladder ─────────────────────────────────────────────
               From md up, a rail runs down the left with one node per rung.
               Below md the node sits inline beside the rung's title. */}
          <ol className="mt-10 space-y-10 sm:mt-12 sm:space-y-12">
            {rungs.map(({ group, items }, i) => (
              <Rung
                key={group.id}
                group={group}
                items={items}
                nextGlow={rungs[i + 1] ? GROUP_STYLE[rungs[i + 1].group.id].glow : undefined}
              />
            ))}
          </ol>

          {/* ── Closing CTA ──────────────────────────────────────────── */}
          <Reveal className="mt-10 flex flex-col items-center gap-3 text-center sm:mt-12">
            <p className="text-[0.95rem] text-ink-600">Not sure which package fits?</p>
            <ContactLink
              intent={{ kind: "message", packageLabel: NOT_SURE_OPTION }}
              className="btn-primary"
            >
              Talk to us
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </ContactLink>
          </Reveal>
        </div>
      </MotionConfig>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

type Group = (typeof PACKAGE_GROUPS)[number];

function Rung({
  group,
  items,
  nextGlow,
}: {
  group: Group;
  items: ServicePackage[];
  /** Colour of the next rung's node; absent on the last rung. */
  nextGlow?: string;
}) {
  const { icon: Icon, glow } = GROUP_STYLE[group.id];
  const titleId = `services-group-${group.id}`;
  const isStart = group.id === "start";
  const wide = items.length === 1;
  const odd = items.length % 2 === 1;

  return (
    <li className="relative md:pl-16">
      {/* Rail segment down to the next rung's node (md and up). It spans this
          rung plus the list gap, blending this rung's colour into the next. */}
      {nextGlow && (
        <motion.span
          aria-hidden="true"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1.2, ease: easeOutExpo }}
          className={`absolute -bottom-8 left-[19px] hidden w-[2px] origin-top rounded-full opacity-40 sm:-bottom-10 md:block ${
            isStart ? "top-16" : "top-12"
          }`}
          style={{ backgroundImage: `linear-gradient(to bottom, rgb(${glow}), rgb(${nextGlow}))` }}
        />
      )}

      {/* Rail node (md and up) */}
      <span
        aria-hidden="true"
        className={`absolute left-0 z-10 hidden h-10 w-10 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-12px_rgb(7_38_60_/_0.6)] md:flex ${
          isStart ? "top-4" : "top-0"
        }`}
        style={{
          backgroundImage: `linear-gradient(140deg, rgb(${glow}), rgb(${glow} / 0.6))`,
        }}
      >
        <Icon className="h-[1.1rem] w-[1.1rem]" />
      </span>

      {/* The first rung carries its title inside the featured card, so a
          deep link to the audit still shows "Start here". */}
      {!isStart && (
        <div className="mb-5 flex items-start gap-3.5 md:pt-1">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-12px_rgb(7_38_60_/_0.6)] md:hidden"
            style={{
              backgroundImage: `linear-gradient(140deg, rgb(${glow}), rgb(${glow} / 0.6))`,
            }}
          >
            <Icon className="h-[1.1rem] w-[1.1rem]" />
          </span>
          <Reveal className="min-w-0">
            <p
              id={titleId}
              className="font-display text-[1.1rem] font-bold leading-snug text-ink-900 sm:text-[1.2rem]"
            >
              {group.title}
            </p>
            <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-ink-600">
              {group.note}
            </p>
          </Reveal>
        </div>
      )}

      <motion.ul
        aria-labelledby={titleId}
        variants={stagger(0.08)}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className={
          wide ? "" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3"
        }
      >
        {items.map((p, i) => (
          <motion.li
            key={p.id}
            id={`service-${p.id}`}
            variants={fadeUp}
            className={`min-w-0 scroll-mt-6 ${
              wide
                ? ""
                : `${CARD_ROWS} ${odd && i === items.length - 1 ? "sm:col-span-2 xl:col-span-1" : ""}`
            }`}
          >
            {wide ? (
              <WideCard pkg={p} glow={glow} group={isStart ? group : undefined} titleId={titleId} />
            ) : (
              <PackageCard pkg={p} glow={glow} />
            )}
          </motion.li>
        ))}
      </motion.ul>
    </li>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

/**
 * From sm, where cards sit side by side, cards in a row share three subgrid
 * rows (heading, "Best for", footer), so the "Best for" blocks and the
 * Details/CTA footers line up across the row, and opening one card's details
 * adds space below its neighbours' footers rather than in the middle of them.
 * Below sm there is one card per row and nothing to line up with.
 */
const CARD_ROWS = "sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:gap-y-0";

/**
 * Standard card, three to a row on wide screens. On phones it is kept short:
 * the numeral sits beside the title, and "Best for" moves inside Details.
 */
function PackageCard({ pkg, glow }: { pkg: ServicePackage; glow: string }) {
  return (
    <SpotlightCard as="article" glow={glow} className={`${CARD_ROWS} p-5 sm:p-6`}>
      <div className="relative min-w-0">
        <div className="flex items-baseline gap-3 sm:block">
          <Numeral n={pkg.number} glow={glow} />
          <PackageTitle pkg={pkg} className="min-w-0 text-[1.1rem] sm:mt-4" />
        </div>
        <p className="mt-1.5 text-[0.95rem] leading-snug text-ink-700">{pkg.promise}</p>
      </div>

      <BestFor text={pkg.bestFor} className="relative mt-4 hidden min-w-0 sm:block" />

      <div className="relative min-w-0 pt-5">
        <Details pkg={pkg} glow={glow} showIntro showBestForOnPhones />
        <TalkLink pkg={pkg} className="mt-4" />
      </div>
    </SpotlightCard>
  );
}

/**
 * A rung with a single package gets the full width, split in two from lg:
 * the package on the left, who it's for and the detail on the right. The
 * audit (package 0) additionally carries the "Start here" title, a gradient
 * outline and its deliverables in view.
 */
function WideCard({
  pkg,
  glow,
  group,
  titleId,
}: {
  pkg: ServicePackage;
  glow: string;
  /** Set on the first rung: its title and note are drawn inside the card. */
  group?: Group;
  titleId: string;
}) {
  const featured = Boolean(group);

  return (
    <SpotlightCard as="article" glow={glow}>
      {featured && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            padding: "1.5px",
            background: `linear-gradient(120deg, rgb(${GLOW.abyss} / 0.75), rgb(${GLOW.aqua} / 0.55) 45%, rgb(${GLOW.lilac} / 0.6) 75%, rgb(${GLOW.blush} / 0.7))`,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}

      <div className="relative grid gap-x-10 gap-y-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr]">
        {/* Left: the package */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {group && (
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                id={titleId}
                className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-abyss-600 to-azure-600 px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-white shadow-[0_8px_18px_-10px_rgb(7_102_163_/_0.8)]"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                {group.title}
              </span>
              <span className="text-[0.88rem] text-ink-600">{group.note}</span>
            </div>
          )}

          <div className="flex items-end gap-4">
            <Numeral n={pkg.number} glow={glow} large />
            <PackageTitle pkg={pkg} className="pb-1 text-[1.2rem] sm:text-[1.35rem]" />
          </div>
          <p className="mt-3 text-[1rem] leading-snug text-ink-700 sm:text-[1.05rem]">
            {pkg.promise}
          </p>
          {pkg.intro && (
            <p className="mt-2.5 text-[0.9rem] leading-relaxed text-ink-600">{pkg.intro}</p>
          )}
        </div>

        {/* Right: who it's for, what you get, the detail */}
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-ink-100 lg:pl-10">
          <BestFor text={pkg.bestFor} />

          {featured && pkg.deliverables && (
            <div className="mt-5">
              <p className={LABEL}>You get</p>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {pkg.deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-2.5 text-[0.9rem] leading-snug text-ink-800">
                    <span
                      aria-hidden="true"
                      className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-200 text-mint-ink"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <Details pkg={pkg} glow={glow} showDeliverables={!featured} />
          </div>
        </div>

        {/* CTA: last on small screens, bottom-left from lg */}
        <div className="lg:col-start-1 lg:row-start-2 lg:self-end">
          <TalkLink pkg={pkg} primary={featured} />
        </div>
      </div>
    </SpotlightCard>
  );
}

/* ── Card parts ─────────────────────────────────────────────────────────── */

/** The big package number. Decorative: the heading carries "Package N" for screen readers. */
function Numeral({ n, glow, large = false }: { n: number; glow: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`block font-display font-bold leading-[0.8] tracking-tight ${
        large ? "text-[3.6rem] sm:text-[4.2rem]" : "text-[2rem] sm:text-[3.2rem]"
      }`}
      style={{
        // The rung colour fading into a shared deep blue, so the light hues
        // (mint, lilac, blush) keep as much weight as the dark ones.
        backgroundImage: `linear-gradient(170deg, rgb(${glow}) 15%, rgb(${GLOW.abyss} / 0.85) 135%)`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {n}
    </span>
  );
}

function PackageTitle({ pkg, className = "" }: { pkg: ServicePackage; className?: string }) {
  return (
    <h3 className={`font-bold leading-snug ${className}`}>
      <span className="sr-only">Package {pkg.number}: </span>
      {pkg.name}
    </h3>
  );
}

function BestFor({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <p className={LABEL}>Best for</p>
      <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-600">{text}</p>
    </div>
  );
}

/**
 * Native disclosure: the content is always in the HTML (indexable, works
 * without JS, keyboard and screen-reader support built in).
 */
function Details({
  pkg,
  glow,
  showIntro = false,
  showDeliverables = true,
  showBestForOnPhones = false,
}: {
  pkg: ServicePackage;
  glow: string;
  showIntro?: boolean;
  showDeliverables?: boolean;
  /** Below sm, render "Best for" here; the card hides its own copy there. */
  showBestForOnPhones?: boolean;
}) {
  return (
    <details className="group/details border-t border-ink-100 pt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2 text-[0.88rem] font-semibold text-ink-800 transition-colors hover:text-abyss-600 [&::-webkit-details-marker]:hidden">
        <span>
          Details<span className="sr-only">: {pkg.name}</span>
        </span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600 transition-[rotate,background-color,color] duration-300 group-open/details:rotate-180 group-open/details:bg-linear-to-br group-open/details:from-abyss-600 group-open/details:to-aqua-500 group-open/details:text-white"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </summary>

      <div className="space-y-4 pb-1 pt-3">
        {showBestForOnPhones && <BestFor text={pkg.bestFor} className="min-w-0 sm:hidden" />}

        {showIntro && pkg.intro && (
          <p className="text-[0.86rem] leading-relaxed text-ink-600">{pkg.intro}</p>
        )}

        <Block label={pkg.coversLabel}>
          <Chips items={pkg.covers} />
        </Block>

        {pkg.tools && (
          <Block label="Tools we use">
            <ul className="flex flex-wrap gap-1.5">
              {pkg.tools.map((t) => (
                <li
                  key={t}
                  className="rounded-md bg-white/80 px-2 py-1 font-mono text-[0.68rem] text-ink-600 ring-1 ring-ink-100"
                >
                  {t}
                </li>
              ))}
            </ul>
          </Block>
        )}

        {pkg.flow && (
          <Block label="How it runs">
            <StepChain steps={pkg.flow} glow={glow} />
          </Block>
        )}

        {pkg.examples && pkg.examples.length > 0 && (
          <Block label={pkg.examples.length > 1 ? "Examples" : "Example"}>
            <ul className="space-y-3">
              {pkg.examples.map((ex) => (
                <li key={ex.steps.join("|")} className="min-w-0">
                  {ex.label && ex.label !== "Example" && (
                    <p className="mb-2 inline-block rounded-2xl rounded-bl-md bg-ink-100/80 px-3 py-1.5 text-[0.82rem] font-medium text-ink-800">
                      {ex.label}
                    </p>
                  )}
                  <StepChain steps={ex.steps} glow={glow} />
                </li>
              ))}
            </ul>
          </Block>
        )}

        {showDeliverables && pkg.deliverables && (
          <Block label="You get">
            <Chips items={pkg.deliverables} />
          </Block>
        )}
      </div>
    </details>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={`mb-2 ${LABEL}`}>{label}</p>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <li
          key={c}
          className="rounded-full border border-ink-200/70 bg-white/70 px-2.5 py-1 text-[0.76rem] leading-snug text-ink-600"
        >
          {c}
        </li>
      ))}
    </ul>
  );
}

/** Step → Step → Step. An ordered list, so the sequence survives without the arrows. */
function StepChain({ steps, glow }: { steps: string[]; glow: string }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
      {steps.map((s, i) => (
        <li key={`${i}-${s}`} className="flex min-w-0 items-center gap-1">
          <span
            className="rounded-lg bg-white/85 px-2 py-1 text-[0.76rem] leading-snug text-ink-700 ring-1"
            style={{ "--tw-ring-color": `rgb(${glow} / 0.35)` } as CSSProperties}
          >
            {s}
          </span>
          {i < steps.length - 1 && (
            <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0 text-ink-400" />
          )}
        </li>
      ))}
    </ol>
  );
}

/** Opens the contact form with this package already ticked. Works as a plain link without JS. */
function TalkLink({
  pkg,
  primary = false,
  className = "",
}: {
  pkg: ServicePackage;
  primary?: boolean;
  className?: string;
}) {
  return (
    <ContactLink
      intent={{ kind: "message", packageLabel: pkg.formLabel }}
      className={
        primary
          ? `btn-primary ${className}`
          : `group/cta inline-flex items-center gap-1.5 rounded-full bg-white/75 px-4 py-2 font-display text-[0.86rem] font-semibold text-ink-900 ring-1 ring-ink-200 transition-[background-color,box-shadow,color] duration-300 hover:bg-white hover:text-abyss-600 hover:ring-aqua-400 ${className}`
      }
    >
      Talk to us about this
      <span className="sr-only">: {pkg.name}</span>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-0.5"
      />
    </ContactLink>
  );
}

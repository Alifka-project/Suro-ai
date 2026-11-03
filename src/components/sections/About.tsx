"use client";

import Image from "next/image";
import { MotionConfig, motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo, fadeUp, inView, stagger } from "@/lib/motion";
import { BRAND, PROFILE, SECTION_IDS, VALUE_PILLARS } from "@/lib/site";

/**
 * Who the client will work with: the profile line, the published figures and
 * a brand panel. The films are in their own section under the hero
 * (FilmTour), so this frame no longer takes a video.
 */
export function About() {
  return (
    <section
      id={SECTION_IDS.about}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <Orb
        className="-left-24 top-10 hidden lg:block"
        color="bg-mint-400"
        size="h-80 w-80"
        opacity={0.3}
      />
      <Orb
        className="-right-20 bottom-0"
        color="bg-lilac-400"
        size="h-72 w-72"
        opacity={0.28}
        delay="-5s"
      />

      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* ── Copy ─────────────────────────────────────────────── */}
            <div className="min-w-0">
              <SectionHeading
                align="left"
                eyebrow={`About ${BRAND.name}`}
                title={
                  <>
                    Who you&apos;ll <span className="text-gradient">work with</span>
                  </>
                }
                lede="Our background is in supply chain and logistics. We now work across the whole business, from finance and HR to sales and legal."
              />

              {/* Credentials: exactly the figures the client publishes, and the
                  only place on the page they appear as a list. dt comes first
                  in the DOM (label, then value) and is flipped visually so the
                  number leads. */}
              <motion.dl
                variants={stagger(0.1)}
                initial="hidden"
                whileInView="show"
                viewport={inView}
                className="mt-8 grid gap-4 border-t border-ink-100 pt-6 sm:grid-cols-3 sm:gap-5"
              >
                {PROFILE.credentials.map((c) => (
                  <motion.div
                    key={c.label}
                    variants={fadeUp}
                    className="flex min-w-0 flex-row-reverse items-baseline justify-end gap-3 sm:flex-col-reverse sm:items-start sm:gap-1.5"
                  >
                    <dt className="text-[0.84rem] leading-snug text-ink-600 sm:text-[0.8rem]">
                      {c.label}
                    </dt>
                    <dd className="min-w-[3.75rem] font-display text-[1.6rem] font-bold leading-none text-gradient sm:min-w-0 sm:text-[1.9rem]">
                      {c.value}
                    </dd>
                  </motion.div>
                ))}
              </motion.dl>
            </div>

            {/* ── Brand panel ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease: easeOutExpo }}
              className="relative min-w-0"
            >
              <div className="relative aspect-video overflow-hidden rounded-[1.5rem] glass-strong sm:rounded-[2rem]">
                <BrandPanel />
              </div>
            </motion.div>
          </div>
        </div>
      </MotionConfig>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/** The mark, the name and the three pillars. */
function BrandPanel() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-canvas p-6 text-center"
    >
      <div className="absolute inset-0 grid-field opacity-50" />

      <Image
        src="/brand/suloai-mark.png"
        alt=""
        width={226}
        height={240}
        sizes="80px"
        className="relative h-14 w-auto drop-shadow-[0_14px_22px_rgb(7_38_60_/_0.18)] sm:h-20"
      />
      <p className="relative mt-3 font-display text-[1.1rem] font-bold tracking-[0.02em] text-ink-900 sm:text-[1.3rem]">
        SULO<span className="text-gradient">AI</span>
      </p>
      <ul className="relative mt-3 flex flex-wrap justify-center gap-1.5 sm:mt-4">
        {VALUE_PILLARS.map((p) => (
          <li
            key={p.key}
            className="rounded-full bg-white/75 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-600 ring-1 ring-ink-100 sm:px-3 sm:text-[0.66rem]"
          >
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

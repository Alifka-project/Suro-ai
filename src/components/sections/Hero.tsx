"use client";

import { motion } from "framer-motion";
import { ArrowDown, ShieldCheck, Zap } from "lucide-react";
import { AuroraField } from "@/components/ui/AuroraField";
import { PromptConsole } from "./PromptConsole";
import { easeOutExpo, stagger, wordReveal } from "@/lib/motion";

const HEADLINE_LINE_1 = ["Your", "supply", "chain", "has"];
const HEADLINE_LINE_2 = ["a", "bottleneck."];

const TRUST = [
  { icon: Zap, label: "First automation live in 2–4 weeks" },
  { icon: ShieldCheck, label: "Your data stays in your tenant" },
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
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: easeOutExpo }}
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 py-1.5 pl-1.5 pr-3.5 backdrop-blur-md"
            >
              <span className="rounded-full bg-linear-to-r from-abyss-600 to-aqua-500 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white">
                SCM only
              </span>
              <span className="text-[0.78rem] font-medium text-ink-600">
                Automation &amp; AI, built for supply chain
              </span>
            </motion.div>

            <h1 className="mt-6 text-[clamp(2.15rem,7.6vw,4.1rem)] font-bold leading-[1.04] tracking-[-0.032em]">
              <motion.span
                variants={stagger(0.07, 0.12)}
                initial="hidden"
                animate="show"
                className="block [perspective:800px]"
              >
                {HEADLINE_LINE_1.map((word) => (
                  <motion.span
                    key={word}
                    variants={wordReveal}
                    className="mr-[0.22em] inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
                <span className="block">
                  {HEADLINE_LINE_2.map((word) => (
                    <motion.span
                      key={word}
                      variants={wordReveal}
                      className="mr-[0.22em] inline-block text-gradient"
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8, ease: easeOutExpo }}
              className="mx-auto mt-5 max-w-xl text-[1rem] leading-relaxed text-ink-600 sm:text-[1.12rem] lg:mx-0"
            >
              You already know where it is — the report rebuilt every Monday, the
              orders re-keyed by hand, the inbox full of{" "}
              <em className="not-italic font-medium text-ink-800">
                &ldquo;where is my shipment?&rdquo;
              </em>{" "}
              Describe it below and get a real solution outline in seconds. No
              call required to find out if we can help.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-5 lg:items-start lg:justify-start"
            >
              {TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-[0.82rem] text-ink-500"
                >
                  <Icon
                    className="h-3.5 w-3.5 shrink-0 text-aqua-600"
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* ── Console ──────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: easeOutExpo }}
            className="relative min-w-0"
          >
            {/* Glow bed behind the console */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-linear-to-br from-aqua-400/25 via-lilac-400/20 to-blush-400/25 blur-3xl"
            />
            <PromptConsole />
          </motion.div>
        </div>

        {/* Scroll cue — desktop only, where there's room for it */}
        <motion.a
          href="#intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.8 }}
          className="mx-auto mt-14 hidden w-fit items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-400 transition-colors hover:text-ink-700 lg:flex"
        >
          <ArrowDown className="h-3.5 w-3.5 animate-bounce" aria-hidden="true" />
          See how we work
        </motion.a>
      </div>
    </section>
  );
}

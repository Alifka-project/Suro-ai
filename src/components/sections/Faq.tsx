"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { easeOutExpo } from "@/lib/motion";

const FAQS = [
  {
    q: "How is the price actually decided?",
    a: "By scope, not by hour. After the first session we send a fixed price for a defined build. What moves it: how many systems are involved, whether they have usable APIs, data volume, how many exception rules exist, and whether you need us in your governance and security review. That's why the form asks about company size and systems — those answers change the number more than anything else.",
  },
  {
    q: "What's the smallest sensible project?",
    a: "A single recurring report or one Excel rebuild — typically two to four weeks. We deliberately keep a small fixed-price tier because it's the honest way to let a new client judge us on delivered work rather than a pitch. If your problem is smaller than that, we'll tell you and point you at the tool that solves it.",
  },
  {
    q: "Do you need access to our ERP?",
    a: "Usually read access to the relevant tables or an integration user, scoped to exactly what the build touches. Everything runs inside your own Microsoft tenant or cloud environment — we don't move your operational data to our infrastructure. If your IT team needs a security review, we'll sit in it.",
  },
  {
    q: "We're not on Microsoft. Does that rule you out?",
    a: "No. Power Platform is where a lot of supply chain work lives, so we're deep in it — but we build in Python, SQL, and the Claude API just as often. If you're on Google Workspace, Odoo, NetSuite, or a stack of your own, the approach doesn't change.",
  },
  {
    q: "How do you stop an AI agent inventing answers?",
    a: "By never letting it answer from memory. Every response is grounded in a retrieved record from your live systems, with confidence thresholds and a citation back to the source. Below the threshold it escalates to a human with full context rather than guessing. We report the escalation rate honestly — an agent that never escalates is one that's bluffing.",
  },
  {
    q: "What happens after handover?",
    a: "You get documentation, the source, and a walkthrough with whoever will maintain it. Everything is built in your tenant under your licences, so you're never locked in. Support plans exist if you want one, but nothing we build requires an ongoing payment to keep running.",
  },
  {
    q: "Do you work with individuals and small teams?",
    a: "Yes — the form has an individual option for that reason. A one-person operation drowning in spreadsheet work is a perfectly good project, and it's priced differently from an enterprise rollout with a procurement process attached.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-white to-canvas"
      />

      <div className="relative mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="Straight answers"
          title={
            <>
              The questions you&apos;d ask{" "}
              <span className="text-gradient">on the call</span>.
            </>
          }
          lede="Including the ones about money, because pretending pricing is simple wastes everyone's time."
        />

        <div className="mt-10 space-y-2.5">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.55,
                  delay: Math.min(i * 0.05, 0.25),
                  ease: easeOutExpo,
                }}
                className={`overflow-hidden rounded-2xl transition-all duration-500 ${
                  isOpen ? "glass-strong" : "glass"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-trigger-${i}`}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
                  >
                    <span
                      className={`font-display text-[0.98rem] font-semibold leading-snug transition-colors duration-300 sm:text-[1.05rem] ${
                        isOpen ? "text-ink-900" : "text-ink-700"
                      }`}
                    >
                      {item.q}
                    </span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
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
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.42, ease: easeOutExpo }}
                    >
                      <p className="px-4 pb-5 text-[0.9rem] leading-relaxed text-ink-600 sm:px-5 sm:pr-14">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

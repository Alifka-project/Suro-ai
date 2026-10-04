"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { FAQS } from "@/lib/faq-content";
import { SECTION_IDS } from "@/lib/site";
import { announceContactIntent, CONTACT_HREF } from "@/lib/contact-intent";

/**
 * FAQ accordion. Every answer is rendered in the HTML whether its item is open
 * or not — collapsed panels are squeezed to zero height and made inert rather
 * than unmounted — so the visible answers always match the FAQPage structured
 * data built from the same FAQS list.
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id={SECTION_IDS.faq}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-white to-canvas"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="FAQ"
          title={
            <>
              Frequently asked <span className="text-gradient">questions</span>
            </>
          }
          lede="Where to start, how pricing works and what happens after handover."
        />

        <RevealGroup gap={0.05} className="mx-auto mt-10 max-w-3xl space-y-2.5">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            const triggerId = `faq-question-${i}`;
            const panelId = `faq-answer-${i}`;
            return (
              <RevealItem
                key={item.q}
                className={`rounded-2xl transition-[background-color,box-shadow] duration-500 ${
                  isOpen ? "glass-strong" : "glass"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    id={triggerId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left focus-visible:outline-offset-[-3px] sm:p-5"
                  >
                    <span
                      className={`min-w-0 font-display text-[0.98rem] font-semibold leading-snug transition-colors duration-300 sm:text-[1.05rem] ${
                        isOpen ? "text-ink-900" : "text-ink-700"
                      }`}
                    >
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-[transform,background-color,color] duration-500 ${
                        isOpen
                          ? "rotate-45 bg-linear-to-br from-abyss-600 to-aqua-500 text-white"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </h3>

                {/* grid-rows 0fr → 1fr animates to the answer's natural
                    height with no measuring. `inert` takes a closed answer
                    out of the tab order and the accessibility tree while
                    leaving its text in the page. */}
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  inert={!isOpen}
                  className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p
                      className={`px-4 pb-5 text-[0.92rem] leading-relaxed text-ink-600 transition-opacity duration-500 sm:px-5 sm:pr-14 ${
                        isOpen ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {item.a}
                    </p>
                  </div>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <p className="mx-auto mt-8 max-w-3xl text-center text-[0.92rem] text-ink-600">
          Something we haven&apos;t covered?{" "}
          <a
            href={CONTACT_HREF}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              announceContactIntent({ kind: "message" });
            }}
            className="font-semibold text-abyss-600 underline decoration-abyss-600/30 underline-offset-4 transition-colors hover:decoration-abyss-600"
          >
            Ask us directly
          </a>
        </p>
      </div>
    </section>
  );
}

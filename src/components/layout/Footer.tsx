"use client";

import Image from "next/image";
import { Mail, MapPin, MessageCircle, ArrowUp } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "@/components/sections/ContactForm";

/** ⚠️ The WhatsApp number is still a placeholder — swap in the real one. */
const CONTACT = {
  email: "suloai.automation@gmail.com",
  whatsapp: "+971 50 000 0000",
  location: "Dubai, United Arab Emirates — working across the GCC, EMEA & APAC",
};

const NAV_GROUPS = [
  {
    title: "Services",
    links: [
      { label: "Power Automate", href: "#services" },
      { label: "Excel & VBA", href: "#services" },
      { label: "AI agents", href: "#services" },
      { label: "Document intelligence", href: "#services" },
      { label: "Forecasting", href: "#services" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "#intro" },
      { label: "Root causes", href: "#root-causes" },
      { label: "How we work", href: "#process" },
      { label: "Results", href: "#results" },
      { label: "FAQ", href: "#faq" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      id="contact"
      className="relative isolate overflow-hidden px-4 pt-14 sm:px-6 sm:pt-18 lg:px-8"
    >
      {/* Aurora bed */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-b from-canvas via-haze to-white" />
        <div className="absolute -left-[10%] top-[6%] h-[46vh] w-[46vh] rounded-full bg-abyss-600 opacity-20 blur-[110px] animate-aurora" />
        <div className="absolute right-[-8%] top-[24%] h-[42vh] w-[42vh] rounded-full bg-blush-500 opacity-25 blur-[100px] animate-aurora-slow" />
        <div className="absolute bottom-[8%] left-[28%] h-[40vh] w-[40vh] rounded-full bg-mint-400 opacity-25 blur-[100px] animate-float-slow" />
        <div className="absolute inset-0 grid-field opacity-40 mask-fade-b" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          {/* ── Pitch + details ──────────────────────────────────────── */}
          <div className="lg:pt-4">
            <Reveal>
              <span className="eyebrow">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-linear-to-r from-aqua-500 to-blush-500"
                />
                Start here
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h2 className="mt-4 text-[clamp(1.9rem,5.6vw,3.2rem)] font-bold leading-[1.07]">
                Tell us what&apos;s{" "}
                <span className="text-gradient">costing you</span>.
              </h2>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-md text-[1rem] leading-relaxed text-ink-600">
                The form asks more than most because the answers genuinely change
                the price — company size, systems, and timeline decide whether
                this is a two-week build or a six-month programme. Ninety seconds
                here saves a discovery call.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <ul className="mt-8 space-y-3.5">
                {[
                  {
                    icon: Mail,
                    label: "Email",
                    value: CONTACT.email,
                    href: `mailto:${CONTACT.email}`,
                  },
                  {
                    icon: MessageCircle,
                    label: "WhatsApp",
                    value: CONTACT.whatsapp,
                    href: `https://wa.me/${CONTACT.whatsapp.replace(/[^\d]/g, "")}`,
                  },
                  { icon: MapPin, label: "Based in", value: CONTACT.location },
                ].map(({ icon: Icon, label, value, href }) => (
                  <li key={label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass">
                      <Icon className="h-4 w-4 text-abyss-600" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">
                        {label}
                      </span>
                      {href ? (
                        <a
                          href={href}
                          target={href.startsWith("http") ? "_blank" : undefined}
                          rel={
                            href.startsWith("http")
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className="break-words text-[0.92rem] font-medium text-ink-800 underline-offset-4 transition-colors hover:text-abyss-600 hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        <span className="block text-[0.92rem] text-ink-700">
                          {value}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* ── Form ─────────────────────────────────────────────────── */}
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-ink-100 pt-8 sm:mt-24">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <a href="#top" className="flex items-center gap-2.5">
                <Image
                  src="/brand/suloai-mark.png"
                  alt=""
                  aria-hidden="true"
                  width={226}
                  height={240}
                  className="h-9 w-auto"
                />
                <span className="font-display text-[1.15rem] font-bold tracking-[0.02em] text-ink-900">
                  SULO<span className="text-gradient">AI</span>
                </span>
              </a>
              <p className="mt-3 max-w-xs text-[0.85rem] leading-relaxed text-ink-500">
                Automation and applied AI for supply chain teams. Power Automate,
                Excel VBA, and AI that stays inside your environment.
              </p>
            </div>

            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">
                  {group.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-[0.85rem] text-ink-600 transition-colors hover:text-ink-900"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ink-100 py-6 sm:flex-row">
            <p className="text-center font-mono text-[0.7rem] text-ink-400 sm:text-left">
              © {new Date().getFullYear()} SULOAI. All rights reserved.
            </p>
            <a
              href="#top"
              className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-ink-700"
            >
              Back to top
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Workflow,
  FileSpreadsheet,
  Bot,
  Blocks,
  ScanText,
  TrendingUp,
  Plug,
  BarChart3,
  Boxes,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard, GLOW } from "@/components/ui/SpotlightCard";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo } from "@/lib/motion";

type Track = "Automation" | "AI" | "Data";

type Service = {
  icon: LucideIcon;
  track: Track;
  title: string;
  tagline: string;
  bullets: string[];
  glow: string;
};

const SERVICES: Service[] = [
  {
    icon: Workflow,
    track: "Automation",
    title: "Power Automate & Power Platform",
    tagline:
      "Approval chains, cross-system orchestration, and the notifications that stop people chasing each other.",
    bullets: [
      "PO, requisition & invoice approval flows",
      "Power Apps front-ends for the warehouse floor",
      "SharePoint, Teams, Outlook & Dataverse wiring",
      "Error handling and alerting that names an owner",
    ],
    glow: GLOW.abyss,
  },
  {
    icon: FileSpreadsheet,
    track: "Automation",
    title: "Excel & VBA engineering",
    tagline:
      "The workbook your team actually trusts, rebuilt to be fast, documented, and impossible to break.",
    bullets: [
      "Planning and costing models that don't crash",
      "Macros rebuilt with proper error handling",
      "Power Query pipelines replacing manual pulls",
      "One-click report packs with locked formatting",
    ],
    glow: GLOW.azure,
  },
  {
    icon: Boxes,
    track: "Automation",
    title: "Process & workflow automation",
    tagline:
      "For the legacy systems with no API and the portals that were never meant to be automated.",
    bullets: [
      "Supplier and carrier portal data collection",
      "Scheduled extract, transform and distribute jobs",
      "Email and attachment parsing at volume",
      "Screen-level automation where nothing else reaches",
    ],
    glow: GLOW.aqua,
  },
  {
    icon: Plug,
    track: "Automation",
    title: "System integration & EDI",
    tagline:
      "ERP, WMS, TMS, and e-commerce talking to each other without a person in the middle re-typing.",
    bullets: [
      "SAP, Dynamics, NetSuite, Odoo connectors",
      "EDI 850 / 855 / 856 / 810 mapping",
      "Idempotent syncs — retries never duplicate",
      "Master data dedup and validation at entry",
    ],
    glow: GLOW.mint,
  },
  {
    icon: Bot,
    track: "AI",
    title: "AI chatbots & support agents",
    tagline:
      "Grounded in your live order and stock data, so it answers from the system of record — or escalates.",
    bullets: [
      "Order status, stock and lead-time questions",
      "Web, WhatsApp, Teams or customer portal",
      "Authenticated — customers see only their data",
      "Clean handoff with full context, never a guess",
    ],
    glow: GLOW.lilac,
  },
  {
    icon: Blocks,
    track: "AI",
    title: "Embedded AI copilots",
    tagline:
      "Intelligence inside the tools your team already has open, instead of one more tab to remember.",
    bullets: [
      "Copilots inside your ERP, portal or Excel",
      "Natural-language search over operational data",
      "Draft emails, quotes and supplier replies",
      "Scoped permissions per role and per record",
    ],
    glow: GLOW.blush,
  },
  {
    icon: ScanText,
    track: "AI",
    title: "Document intelligence",
    tagline:
      "Invoices, packing lists, bills of lading and customs paperwork read and cross-checked in seconds.",
    bullets: [
      "Line-item extraction from PDFs, scans and photos",
      "Three-way match with your tolerance rules",
      "Cross-document consistency checks before filing",
      "Confidence scores on every extracted field",
    ],
    glow: GLOW.abyss,
  },
  {
    icon: TrendingUp,
    track: "AI",
    title: "Forecasting & predictive analytics",
    tagline:
      "Demand, lead time and risk models backtested on your own history — accuracy measured, not claimed.",
    bullets: [
      "Demand forecasting with seasonality and promos",
      "Dynamic safety stock and reorder points",
      "Supplier lead-time and delay prediction",
      "Planner overrides captured with reason codes",
    ],
    glow: GLOW.azure,
  },
  {
    icon: BarChart3,
    track: "Data",
    title: "Dashboards & operational visibility",
    tagline:
      "One reconciled view of stock, orders and shipments — refreshed before anyone logs in.",
    bullets: [
      "Power BI models built on clean pipelines",
      "Exception alerts pushed to Teams and email",
      "Supplier and carrier scorecards, automatic",
      "Scheduled Excel and PDF packs for the board",
    ],
    glow: GLOW.aqua,
  },
];

const FILTERS: { label: string; value: Track | "All"; hint: string }[] = [
  { label: "Everything", value: "All", hint: "9 services" },
  { label: "Automation", value: "Automation", hint: "Power Platform, VBA, EDI" },
  { label: "AI solutions", value: "AI", hint: "Agents, documents, forecasting" },
  { label: "Data", value: "Data", hint: "Visibility and reporting" },
];

export function Services() {
  const [filter, setFilter] = useState<Track | "All">("All");
  const reduced = useReducedMotion();

  const visible =
    filter === "All" ? SERVICES : SERVICES.filter((s) => s.track === filter);

  return (
    <section
      id="services"
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      {/* Section wash */}
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

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="What we build"
          title={
            <>
              Two disciplines,{" "}
              <span className="text-gradient">one domain</span>.
            </>
          }
          lede="We don't do generic digital transformation. Everything below is built for supply chain, procurement, warehousing and logistics teams — which is why scoping takes a call, not a discovery phase."
        />

        {/* ── Filters — wrap rather than scroll, so the pill is never
             clipped mid-shape on a narrow screen ──────────────────────── */}
        <div className="mt-10 flex justify-center">
          <div className="flex flex-wrap justify-center gap-1.5 rounded-3xl glass p-1.5 sm:rounded-full">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={active}
                  title={f.hint}
                  className={`relative shrink-0 rounded-full px-3.5 py-2 text-[0.82rem] font-medium transition-colors duration-300 sm:px-4 ${
                    active ? "text-white" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="service-filter-pill"
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 380, damping: 32 }
                      }
                      className="absolute inset-0 -z-10 rounded-full bg-linear-to-r from-abyss-600 via-azure-500 to-aqua-500 shadow-[0_8px_20px_-8px_rgb(32_103_165_/_0.75)]"
                    />
                  )}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        <motion.div
          layout={!reduced}
          className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((service, i) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.title}
                  layout={!reduced}
                  initial={{ opacity: 0, y: 22, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{
                    duration: 0.55,
                    delay: reduced ? 0 : Math.min(i * 0.05, 0.3),
                    ease: easeOutExpo,
                  }}
                >
                  <SpotlightCard
                    glow={service.glow}
                    as="article"
                    className="h-full p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-12px_rgb(7_38_60_/_0.6)]"
                        style={{
                          backgroundImage: `linear-gradient(140deg, rgb(${service.glow}), rgb(${service.glow} / 0.65))`,
                        }}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="rounded-full border border-ink-200/70 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-500">
                        {service.track}
                      </span>
                    </div>

                    <h3 className="mt-4 text-[1.08rem] font-bold leading-snug">
                      {service.title}
                    </h3>
                    <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-600">
                      {service.tagline}
                    </p>

                    <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-4">
                      {service.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-2 text-[0.82rem] leading-snug text-ink-600"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[0.42rem] h-1 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: `rgb(${service.glow})` }}
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* ── Closing CTA ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          className="mt-8 flex flex-col items-center gap-3 text-center sm:mt-10"
        >
          <p className="text-[0.95rem] text-ink-600">
            Not sure which one your problem needs?{" "}
            <span className="font-medium text-ink-900">
              That&apos;s a normal place to start.
            </span>
          </p>
          <a href="#contact" className="btn-primary">
            Tell us what&apos;s broken
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

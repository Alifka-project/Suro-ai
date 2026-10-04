import type { Variants } from "framer-motion";
import { ChevronDown, DatabaseZap, HardDrive, Repeat, Shuffle, Sigma, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Orb } from "@/components/ui/AuroraField";
import { CONTACT_HREF } from "@/lib/contact-intent";
import { SECTION_IDS } from "@/lib/site";
import { easeOutExpo } from "@/lib/motion";

/**
 * The client's five pain points as a zigzag timeline: a spine down the centre
 * at lg with each card on alternate sides and its takeaway facing it across
 * the spine. Below lg it is one column with the spine on the left and the
 * takeaway under its card.
 *
 * A server component: all copy, including the collapsed "read more" panels
 * (native <details>), is in the HTML. Only the scroll entrances run on the client.
 *
 * Colours are literal Tailwind classes, not GLOW triplets: GLOW lives in a
 * "use client" module, and a server component that reads a value from one
 * gets a client reference, so every colour would come out undefined.
 */

type PainPoint = {
  n: string;
  icon: LucideIcon;
  title: string;
  /** One sentence: the problem in plain words. */
  summary: string;
  chips: { label: string; items: string[] };
  /** 02 only: the same field named three ways across three files. */
  formats?: { file: string; field: string }[];
  /** One short line: what it costs, or (04) what to do instead. */
  outcome:
    | { kind: "risk"; label: string; text: string }
    | { kind: "fix"; label: string; text: string; items: string[] };
  /** The client's punchline, shown as the highlighted takeaway. */
  takeaway: string;
  /** The rest of the client's detail, one tap away. */
  more?: { label: string; chips?: string[]; text: string[] };
  /** Literal classes, so Tailwind sees them. */
  tone: {
    /** Gradient stops for the spine node. */
    node: string;
    /** Gradient stops for the card's accent edge. */
    accent: string;
    /** Border colour for the takeaway rule. */
    rule: string;
  };
};

const PAIN_POINTS: PainPoint[] = [
  {
    n: "01",
    icon: Repeat,
    title: "Too much manual work, too often, too risky",
    summary:
      "The same tasks come round every day, every month-end and every reporting cycle, and each one is done by hand.",
    chips: {
      label: "Typical tasks",
      items: [
        "Downloading invoices",
        "Copying data between systems",
        "Renaming and organising files",
        "Formatting reports",
        "Repetitive emails",
        "Month-end consolidation",
      ],
    },
    outcome: {
      kind: "risk",
      label: "The risk:",
      text: "missed deadlines, incorrect figures, duplicate processing, delayed follow-up.",
    },
    takeaway: "What should take minutes can take hours. What's manual eventually goes wrong.",
    more: {
      label: "More examples",
      chips: [
        "Uploading files one by one",
        "Updating the same tracker every day",
        "Repeating the same data entry",
        "Preparing recurring management reports",
        "Follow-ups with customers or suppliers",
      ],
      text: [
        "Employees spend hours every day downloading documents, copying data, renaming files, formatting reports and sending emails.",
        "Done by hand, the usual mistakes are missed deadlines, wrong customer information, incorrect figures, duplicate processing, missed document expiry dates and delayed follow-up.",
      ],
    },
    tone: {
      node: "from-abyss-600 to-abyss-400",
      accent: "from-abyss-600 to-abyss-600/25",
      rule: "border-abyss-600",
    },
  },
  {
    n: "02",
    icon: Shuffle,
    title: "Data scattered, duplicated & never in the same format",
    summary:
      "The data exists, but it doesn't flow. As a company grows, every department builds its own trackers, files and versions of the truth.",
    chips: {
      label: "Spread across",
      items: ["Excel", "Email", "PDF", "Shared drive", "ERP", "Web portal", "SharePoint"],
    },
    formats: [
      { file: "File A", field: "Customer ID" },
      { file: "File B", field: "Customer Code" },
      { file: "File C", field: "Customer Name" },
    ],
    outcome: {
      kind: "risk",
      label: "The result:",
      text: "duplicate entry, inconsistent numbers, delayed updates and no real-time visibility.",
    },
    takeaway: "Your data shouldn't need a person to connect it every time.",
    more: {
      label: "How it builds up",
      text: [
        "You end up with several Excel trackers, different versions of the same report, shared folders full of files, and multiple portals and platforms, each holding overlapping information.",
        "One report may need an Excel file, a CSV, a PDF, an ERP export, a database and an email, each in a different format. People spend more time finding and reconciling data than using it.",
      ],
    },
    tone: {
      node: "from-azure-600 to-azure-400",
      accent: "from-azure-500 to-azure-500/25",
      rule: "border-azure-500",
    },
  },
  {
    n: "03",
    icon: Sigma,
    title: "Overcomplicated Excel & formula dependency",
    summary: "Excel is powerful, but it becomes difficult to manage once a process grows.",
    chips: {
      label: "Typical signs",
      items: [
        "Hundreds of formulas",
        "Complex VLOOKUP / XLOOKUP logic",
        "Nested IF statements",
        "Multiple linked workbooks",
        "Manual copy and paste",
        "Hidden logic inside spreadsheets",
        "Different users, different versions",
      ],
    },
    outcome: {
      kind: "risk",
      label: "The result:",
      text: "one broken formula can break the entire process.",
    },
    takeaway:
      "We can help turn complicated spreadsheet processes into structured, repeatable workflows.",
    tone: {
      node: "from-aqua-600 to-aqua-400",
      accent: "from-aqua-500 to-aqua-500/25",
      rule: "border-aqua-500",
    },
  },
  {
    n: "04",
    icon: HardDrive,
    title: "Heavy & unstable files",
    summary: "Large workbooks linked to multiple external files get harder to work with as they grow.",
    chips: {
      label: "Symptoms",
      items: ["Extremely slow", "Difficult to open", "Difficult to share", "Prone to errors", "Unresponsive"],
    },
    outcome: {
      kind: "fix",
      label: "The fix:",
      text: "redesign the process instead of forcing Excel to do everything, using:",
      items: ["Automation", "Data processing", "Structured files", "Databases", "Cloud tools", "APIs"],
    },
    takeaway:
      "The goal isn't simply to make Excel faster. It's to make the process itself more efficient.",
    tone: {
      node: "from-mint-600 to-mint-400",
      accent: "from-mint-600 to-mint-600/25",
      rule: "border-mint-600",
    },
  },
  {
    n: "05",
    icon: DatabaseZap,
    title: "Poor or untrusted master data",
    summary:
      "Without a reliable single source of truth, people spend time checking by hand which version is correct.",
    chips: {
      label: "Across your files",
      items: [
        "Different customer names",
        "Different product codes",
        "Outdated supplier information",
        "Duplicate records",
        "Incorrect status",
        "Missing information",
      ],
    },
    outcome: {
      kind: "risk",
      label: "The result:",
      text: "business decisions made on numbers nobody fully trusts.",
    },
    takeaway:
      "Automation can help establish data validation, standardised formats and controlled master data processes.",
    tone: {
      node: "from-lilac-600 to-lilac-400",
      accent: "from-lilac-500 to-lilac-500/25",
      rule: "border-lilac-500",
    },
  },
];

/* Entrances. Cards slide in from their own side of the spine; under reduced
   motion the `motion-reduce:transform-none!` class cancels the movement and
   leaves a fade. Delays live in the variants because a variant's own
   transition replaces Reveal's `delay` prop. */
const cardIn = (dir: 1 | -1): Variants => ({
  hidden: { opacity: 0, x: 28 * dir, y: 18 },
  show: { opacity: 1, x: 0, y: 0, transition: { duration: 0.7, ease: easeOutExpo } },
});

const nodeIn: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: easeOutExpo } },
};

const takeawayIn: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOutExpo, delay: 0.15 } },
};

const NO_MOTION = "motion-reduce:transform-none!";

function Chip({ children }: { children: string }) {
  return (
    <li className="rounded-full border border-ink-200/80 bg-white/75 px-2.5 py-1 text-[0.76rem] leading-tight text-ink-700">
      {children}
    </li>
  );
}

function MiniLabel({ children, id }: { children: string; id?: string }) {
  return (
    <p id={id} className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-ink-550">
      {children}
    </p>
  );
}

export function PainPoints() {
  return (
    <section
      id={SECTION_IDS.painPoints}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-haze/70 to-canvas"
      />
      <Orb
        className="-left-24 top-24 hidden lg:block"
        color="bg-blush-400"
        size="h-80 w-80"
        opacity={0.22}
      />
      <Orb
        className="-right-20 bottom-16 hidden sm:block"
        color="bg-azure-400"
        size="h-72 w-72"
        opacity={0.22}
        delay="-7s"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Pain points"
          title={
            <>
              Five problems that waste time{" "}
              <span className="text-gradient">and cause errors</span>
            </>
          }
          lede="From daily manual tasks to master data nobody trusts."
        />

        <div className="relative mt-10 sm:mt-14">
          {/* Spine */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[17px] w-[2px] rounded-full bg-linear-to-b from-abyss-600 via-aqua-500 to-blush-500 opacity-25 sm:left-[21px] lg:left-1/2 lg:-translate-x-1/2"
          />

          <ol className="space-y-7 lg:space-y-10">
            {PAIN_POINTS.map((p, i) => {
              const Icon = p.icon;
              const left = i % 2 === 0;
              const chipsLabelId = `pain-${p.n}-chips`;
              const fixLabelId = `pain-${p.n}-fix`;

              return (
                <li
                  key={p.n}
                  className="relative pl-12 sm:pl-16 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-24 lg:pl-0"
                >
                  {/* Node on the spine, level with the card title */}
                  <Reveal
                    as="span"
                    variants={nodeIn}
                    className={`absolute left-0 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[0_10px_22px_-12px_rgb(7_38_60_/_0.6)] sm:top-5 sm:h-11 sm:w-11 sm:rounded-2xl lg:left-1/2 lg:-translate-x-1/2 ${NO_MOTION}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-[inherit] bg-linear-to-br ${p.tone.node}`}
                    />
                    <Icon className="relative h-[1.05rem] w-[1.05rem] sm:h-5 sm:w-5" aria-hidden="true" />
                  </Reveal>

                  {/* Card */}
                  <Reveal
                    variants={cardIn(left ? -1 : 1)}
                    className={`relative min-w-0 overflow-hidden rounded-3xl glass p-4 sm:p-6 lg:row-start-1 ${
                      left ? "lg:col-start-1" : "lg:col-start-2"
                    } ${NO_MOTION}`}
                  >
                    {/* Accent edge, on the side facing the spine */}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${p.tone.accent} ${
                        left ? "lg:left-auto lg:right-0" : ""
                      }`}
                    />

                    <div className="flex items-baseline gap-2.5">
                      <span aria-hidden="true" className="font-mono text-[0.72rem] font-medium text-ink-550">
                        {p.n}
                      </span>
                      <h3 className="min-w-0 text-[1.05rem] font-bold leading-snug sm:text-[1.18rem]">
                        {p.title}
                      </h3>
                    </div>

                    <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-600 sm:text-[0.95rem]">
                      {p.summary}
                    </p>

                    <div className="mt-3.5">
                      <MiniLabel id={chipsLabelId}>{p.chips.label}</MiniLabel>
                      <ul aria-labelledby={chipsLabelId} className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.chips.items.map((item) => (
                          <Chip key={item}>{item}</Chip>
                        ))}
                      </ul>
                    </div>

                    {p.formats && (
                      <div className="mt-3.5 rounded-2xl bg-white/60 p-3 ring-1 ring-ink-200/70">
                        <MiniLabel>Same customer, three files</MiniLabel>
                        <ul className="mt-2 grid grid-cols-3 gap-1.5">
                          {p.formats.map((f) => (
                            <li
                              key={f.file}
                              className="min-w-0 rounded-xl bg-white px-2 py-1.5 ring-1 ring-ink-100"
                            >
                              <span className="block font-mono text-[0.62rem] text-ink-550">
                                {f.file}
                                <span className="sr-only">:</span>
                              </span>
                              <span className="block text-[0.78rem] font-semibold leading-tight text-ink-800">
                                {f.field}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {p.outcome.kind === "risk" ? (
                      <p className="mt-3.5 flex items-start gap-2 text-[0.85rem] leading-snug text-ink-700">
                        <TriangleAlert
                          className="mt-[0.1rem] h-4 w-4 shrink-0 text-blush-600"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="font-semibold text-ink-900">{p.outcome.label}</span>{" "}
                          {p.outcome.text}
                        </span>
                      </p>
                    ) : (
                      <div className="mt-3.5">
                        <p
                          id={fixLabelId}
                          className="flex items-start gap-2 text-[0.85rem] leading-snug text-ink-700"
                        >
                          <Wrench className="mt-[0.1rem] h-4 w-4 shrink-0 text-aqua-600" aria-hidden="true" />
                          <span>
                            <span className="font-semibold text-ink-900">{p.outcome.label}</span>{" "}
                            {p.outcome.text}
                          </span>
                        </p>
                        <ul aria-labelledby={fixLabelId} className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                          {p.outcome.items.map((item, k) => (
                            <li key={item} className="flex items-center gap-1.5">
                              {k > 0 && (
                                <span aria-hidden="true" className="font-mono text-[0.78rem] text-ink-550">
                                  +
                                </span>
                              )}
                              <span className="rounded-full bg-mint-200/70 px-2.5 py-1 text-[0.76rem] font-medium leading-tight text-ink-800">
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {p.more && (
                      <details className="group/more mt-4 border-t border-ink-100 pt-3">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full py-1 text-[0.82rem] font-semibold text-abyss-600 transition-colors hover:text-abyss-700 [&::-webkit-details-marker]:hidden">
                          <ChevronDown
                            className="h-4 w-4 transition-transform duration-300 group-open/more:rotate-180"
                            aria-hidden="true"
                          />
                          {p.more.label}
                        </summary>
                        <div className="mt-2 space-y-2.5">
                          {p.more.chips && (
                            <ul className="flex flex-wrap gap-1.5">
                              {p.more.chips.map((item) => (
                                <Chip key={item}>{item}</Chip>
                              ))}
                            </ul>
                          )}
                          {p.more.text.map((t) => (
                            <p key={t} className="text-[0.86rem] leading-relaxed text-ink-600">
                              {t}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </Reveal>

                  {/* Takeaway, across the spine from its card at lg */}
                  <Reveal
                    as="p"
                    variants={takeawayIn}
                    className={`relative mt-3 border-l-2 ${p.tone.rule} pl-4 font-display text-[1.02rem] font-medium leading-snug text-ink-900 sm:mt-4 sm:text-[1.1rem] lg:row-start-1 lg:mt-0 lg:self-center lg:text-[1.38rem] lg:leading-[1.3] ${
                      left
                        ? "lg:col-start-2 lg:pl-5"
                        : "lg:col-start-1 lg:border-r-2 lg:border-l-0 lg:pl-0 lg:pr-5 lg:text-right"
                    } ${NO_MOTION}`}
                  >
                    <span className="sr-only">Takeaway: </span>
                    {p.takeaway}
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>

        <Reveal as="p" className="mt-10 text-center text-[0.95rem] text-ink-600 sm:mt-12">
          Recognise more than one?{" "}
          <a
            href={CONTACT_HREF}
            className="font-semibold text-ink-900 underline decoration-aqua-400 decoration-2 underline-offset-4 transition-colors hover:text-abyss-600"
          >
            Tell us which
          </a>{" "}
          and we&apos;ll suggest where to start.
        </Reveal>
      </div>
    </section>
  );
}

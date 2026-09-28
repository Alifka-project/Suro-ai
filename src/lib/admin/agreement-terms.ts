/**
 * Service Agreement terms: defaults, the payment schedule maths and the SOW
 * timeline format. Pure — safe in Server and Client Components (the editor
 * previews the schedule live with the same functions the server saves with).
 */
import type { AgreementStatus, Installment } from "@prisma/client";
import { dateInputToDate } from "./time";
import type { Tone } from "./labels";

/** Section defaults for a newly generated agreement. Mirrors the schema defaults. */
export const AGREEMENT_DEFAULTS = {
  depositPct: 50,
  midpointPct: 25,
  finalPct: 25,
  midpointMilestone: "mid-point delivery",
  invoiceDueDays: 14,
  lateFeeBps: 200,
  feedbackDays: 3,
  warrantyDays: 30,
  terminationNoticeDays: 14,
} as const;

export const DEFAULT_DELIVERABLES = [
  "Working automation deployed in the Client's environment",
  "Setup guide and handover documentation",
  "One training session (30 minutes) for the Client's team",
] as const;

export const DEFAULT_OUT_OF_SCOPE = [
  "Automation of any system or process not listed in the Scope of Work — can be added as a separate change request",
  "Ongoing maintenance after the warranty period — covered under a separate support arrangement",
  "Data migration from legacy systems",
] as const;

export const DEFAULT_ASSUMPTIONS = [
  `Client will provide access to the required systems, data and accounts within ${AGREEMENT_DEFAULTS.feedbackDays} business days of signing`,
  "Client will designate one point of contact for feedback and approvals",
  "The structure and format of the systems in scope will not change materially during the project",
] as const;

// ─── Status ──────────────────────────────────────────────────────────────────

export const AGREEMENT_STATUS: Record<AgreementStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent for signature", tone: "blue" },
  SIGNED: { label: "Signed", tone: "mint" },
  CANCELLED: { label: "Cancelled", tone: "red" },
};

export const AGREEMENT_STATUS_ORDER: readonly AgreementStatus[] = ["DRAFT", "SENT", "SIGNED", "CANCELLED"];

/**
 * Allowed manual status changes, keyed by the stored status. Only a DRAFT can
 * be edited or re-synced from its quotation; sending freezes the terms, and
 * "Back to draft" is the way to change a sent agreement.
 */
export const AGREEMENT_TRANSITIONS: Record<AgreementStatus, readonly AgreementStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["SIGNED", "DRAFT", "CANCELLED"],
  SIGNED: ["CANCELLED"],
  CANCELLED: ["DRAFT"],
};

export function isAgreementStatus(value: unknown): value is AgreementStatus {
  return typeof value === "string" && (AGREEMENT_STATUS_ORDER as readonly string[]).includes(value);
}

// ─── Payment schedule (Section 2) ────────────────────────────────────────────

export const INSTALLMENTS = ["DEPOSIT", "MILESTONE", "FINAL"] as const satisfies readonly Installment[];

export const INSTALLMENT_LABEL: Record<Installment, string> = {
  DEPOSIT: "Deposit",
  MILESTONE: "Milestone payment",
  FINAL: "Final payment",
};

export type ScheduleTerms = {
  subtotalFils: number;
  vatBps: number;
  depositPct: number;
  midpointPct: number;
  finalPct: number;
  midpointMilestone: string;
};

export type InstallmentLine = {
  installment: Installment;
  label: string;
  /** "due upon signing, before any work begins" */
  due: string;
  pct: number;
  subtotalFils: number;
  vatFils: number;
  totalFils: number;
};

/**
 * The three payment stages with their amounts. Deposit and milestone are
 * rounded to the fil; the final stage takes the remainder, so the three
 * always add up to the agreement's subtotal exactly. VAT is computed per
 * stage, because each stage is invoiced separately. Stages at 0% are omitted.
 */
export function installmentPlan(t: ScheduleTerms): InstallmentLine[] {
  const deposit = Math.round((t.subtotalFils * t.depositPct) / 100);
  const midpoint = Math.round((t.subtotalFils * t.midpointPct) / 100);
  const final = t.subtotalFils - deposit - midpoint;
  const vat = (fils: number) => Math.round((fils * t.vatBps) / 10_000);
  const lines: InstallmentLine[] = [
    {
      installment: "DEPOSIT",
      label: INSTALLMENT_LABEL.DEPOSIT,
      due: "due upon signing, before any work begins",
      pct: t.depositPct,
      subtotalFils: deposit,
      vatFils: vat(deposit),
      totalFils: deposit + vat(deposit),
    },
    {
      installment: "MILESTONE",
      label: INSTALLMENT_LABEL.MILESTONE,
      due: `due upon ${t.midpointMilestone.trim() || AGREEMENT_DEFAULTS.midpointMilestone}`,
      pct: t.midpointPct,
      subtotalFils: midpoint,
      vatFils: vat(midpoint),
      totalFils: midpoint + vat(midpoint),
    },
    {
      installment: "FINAL",
      label: INSTALLMENT_LABEL.FINAL,
      due: "due upon final delivery, before final handover of files, access and credentials",
      pct: t.finalPct,
      subtotalFils: final,
      vatFils: vat(final),
      totalFils: final + vat(final),
    },
  ];
  return lines.filter((l) => l.pct > 0);
}

/**
 * The contract total as it is actually invoiced: the sum of the stages.
 * Each stage invoice rounds its own VAT, so this can be a fil or two away
 * from VAT rounded once on the whole subtotal (what the quotation shows) —
 * the agreement states and stores this figure so its total always equals
 * what the three invoices add up to. With a schedule that doesn't add up to
 * 100% (which can't be sent or invoiced), VAT falls back to the single rounding.
 */
export function scheduleTotals(t: ScheduleTerms): { subtotalFils: number; vatFils: number; totalFils: number } {
  const vatFils = percentagesProblem(t.depositPct, t.midpointPct, t.finalPct)
    ? Math.round((t.subtotalFils * t.vatBps) / 10_000)
    : installmentPlan(t).reduce((sum, l) => sum + l.vatFils, 0);
  return { subtotalFils: t.subtotalFils, vatFils, totalFils: t.subtotalFils + vatFils };
}

/** Null when the three percentages are valid whole numbers totalling 100. */
export function percentagesProblem(depositPct: number, midpointPct: number, finalPct: number): string | null {
  const all = [depositPct, midpointPct, finalPct];
  if (!all.every((n) => Number.isInteger(n) && n >= 0 && n <= 100)) return "Each percentage must be a whole number from 0 to 100.";
  const sum = depositPct + midpointPct + finalPct;
  if (sum !== 100) return `The payment schedule must add up to 100% (currently ${sum}%).`;
  if (finalPct === 0) return "Keep a final payment: the IP clause transfers ownership on final payment.";
  return null;
}

/** 200 -> "2", 150 -> "1.5". Basis points as a plain percentage figure. */
export function bpsToPercentText(bps: number): string {
  return (bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ─── SOW timeline ────────────────────────────────────────────────────────────

/** One row of the SOW timeline table. `date` is a "YYYY-MM-DD" calendar date or null (to be confirmed). */
export type Milestone = { label: string; date: string | null };

export const MAX_MILESTONES = 12;

export const DEFAULT_MILESTONES: readonly Milestone[] = [
  { label: "Project start (after deposit received)", date: null },
  { label: "First working draft / demo", date: null },
  { label: "Client review & feedback", date: null },
  { label: "Final delivery", date: null },
];

/** Reads the Json column defensively: anything malformed is dropped, never thrown. */
export function parseMilestones(value: unknown): Milestone[] {
  if (!Array.isArray(value)) return [];
  const out: Milestone[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const label = typeof (row as { label?: unknown }).label === "string" ? (row as { label: string }).label.trim() : "";
    const rawDate = (row as { date?: unknown }).date;
    const date = typeof rawDate === "string" && dateInputToDate(rawDate) ? rawDate : null;
    if (label) out.push({ label: label.slice(0, 200), date });
    if (out.length === MAX_MILESTONES) break;
  }
  return out;
}

/** Multi-line textarea -> list: one item per non-empty line, bullets stripped. */
export function linesToList(raw: string, { max = 30, maxLength = 500 } = {}): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Display labels and badge tones for every status enum, in one place so the
 * CRM, billing and project screens can't drift apart.
 */
import { formatBusinessDate, formatBusinessDateTime } from "./time";

export type Tone = "neutral" | "blue" | "aqua" | "mint" | "lilac" | "blush" | "amber" | "red";

type StatusMeta = { label: string; tone: Tone };

/**
 * Client (lead) status, as the team names it. The stored enum keeps its
 * original values so no data migration is needed: CONTACTED is shown as
 * "Prospect", QUALIFIED as "Follow-up", PROPOSAL as "Quotation sent", WON as
 * "Goal" (deal closed) and LOST as "Cancel".
 */
export const LEAD_STATUS: Record<string, StatusMeta & { hint: string }> = {
  NEW: { label: "New", tone: "blue", hint: "Enquiry received, not contacted yet" },
  CONTACTED: { label: "Prospect", tone: "aqua", hint: "Contacted and interested" },
  QUALIFIED: { label: "Follow-up", tone: "amber", hint: "Waiting on the next step" },
  PROPOSAL: { label: "Quotation sent", tone: "lilac", hint: "Quotation with the client" },
  WON: { label: "Goal", tone: "mint", hint: "Deal closed" },
  LOST: { label: "Cancel", tone: "neutral", hint: "Not going ahead" },
};

export const QUOTE_STATUS: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "blue" },
  ACCEPTED: { label: "Accepted", tone: "mint" },
  DECLINED: { label: "Declined", tone: "red" },
  EXPIRED: { label: "Expired", tone: "amber" },
};

export const INVOICE_STATUS: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "blue" },
  PAID: { label: "Paid", tone: "mint" },
  OVERDUE: { label: "Overdue", tone: "red" },
  VOID: { label: "Void", tone: "neutral" },
};

export const PROJECT_STATUS: Record<string, StatusMeta> = {
  PLANNING: { label: "Planning", tone: "lilac" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  REVIEW: { label: "Review", tone: "amber" },
  DONE: { label: "Done", tone: "mint" },
  ON_HOLD: { label: "On hold", tone: "neutral" },
};

export const TASK_STATUS: Record<string, StatusMeta> = {
  TODO: { label: "To do", tone: "neutral" },
  DOING: { label: "Doing", tone: "blue" },
  DONE: { label: "Done", tone: "mint" },
};

/** Ordered pipeline for the CRM board and the funnel chart. */
export const LEAD_PIPELINE = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export const PROJECT_PIPELINE = ["PLANNING", "IN_PROGRESS", "REVIEW", "DONE", "ON_HOLD"] as const;

/**
 * Dates are printed on the business clock (Asia/Dubai), whatever zone the
 * server runs in — see src/lib/admin/time.ts.
 */
export function formatDate(d: Date | string | null | undefined): string {
  return formatBusinessDate(d);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return formatBusinessDateTime(d);
}

/** Solid dot colour per tone, for pipeline chips, legends and board columns. */
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-300",
  blue: "bg-azure-500",
  aqua: "bg-aqua-500",
  mint: "bg-mint-600",
  lilac: "bg-lilac-500",
  blush: "bg-blush-500",
  amber: "bg-amber-400",
  red: "bg-red-500",
};

/** "Omar Al Haddad" -> "OH". "?" for an empty name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** "3 days ago" style, for activity feeds. */
export function timeAgo(d: Date | string): string {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"],
  ];
  let value = -s;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [step, u] of units) {
    unit = u;
    if (Math.abs(value) < step) break;
    value = Math.round(value / step);
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(value, unit);
}

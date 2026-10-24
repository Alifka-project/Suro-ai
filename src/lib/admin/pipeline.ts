/**
 * CRM pipeline rules, modelled on Odoo CRM. Pure — safe in Server and Client
 * Components.
 *
 * - The kanban board shows the open stages plus Won. Lost opportunities leave
 *   the board (Odoo archives them) and are listed/restored separately.
 * - Every opportunity has an expected revenue, a probability (defaulting to
 *   its stage's), a 0–3 star priority, tags, an owner and scheduled activities.
 * - Activity state drives the card clock icon and the column progress bar:
 *   overdue (red), due today (amber), planned (green), none (grey).
 */
import type { ActivityType, LeadStatus } from "@prisma/client";
import { dayKey } from "./time";
import type { Tone } from "./labels";

/** Columns of the pipeline board, in order. */
export const BOARD_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "INVOICED", "WON"] as const satisfies readonly LeadStatus[];
export type BoardStage = (typeof BOARD_STAGES)[number];

/** Stages an opportunity can be moved between by hand (Won/Lost have their own actions). */
export const OPEN_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "INVOICED"] as const satisfies readonly LeadStatus[];
export type OpenStage = (typeof OPEN_STAGES)[number];

export function isBoardStage(value: unknown): value is BoardStage {
  return typeof value === "string" && (BOARD_STAGES as readonly string[]).includes(value);
}

export function isOpenStage(value: unknown): value is OpenStage {
  return typeof value === "string" && (OPEN_STAGES as readonly string[]).includes(value);
}

/** Default probability (%) per stage, used when an opportunity has no explicit one. */
export const STAGE_PROBABILITY: Record<LeadStatus, number> = {
  NEW: 10,
  CONTACTED: 20,
  QUALIFIED: 40,
  PROPOSAL: 60,
  INVOICED: 80,
  WON: 100,
  LOST: 0,
};

/** Won and Lost are decided: their probability is fixed at 100 / 0. */
export function effectiveProbability(lead: { status: LeadStatus; probability: number | null }): number {
  if (lead.status === "WON" || lead.status === "LOST") return STAGE_PROBABILITY[lead.status];
  return lead.probability ?? STAGE_PROBABILITY[lead.status];
}

/** Expected revenue × probability, in fils (Odoo's "prorated revenue"). */
export function weightedRevenueFils(lead: {
  status: LeadStatus;
  probability: number | null;
  estimatedValueFils: number | null;
}): number {
  return Math.round(((lead.estimatedValueFils ?? 0) * effectiveProbability(lead)) / 100);
}

/** What the card and page title show: the opportunity name, else the company, else the contact. */
export function leadTitle(lead: { title?: string | null; companyName?: string | null; fullName: string }): string {
  return lead.title?.trim() || lead.companyName?.trim() || lead.fullName;
}

export const PRIORITY_MAX = 3;
export const PRIORITY_LABELS = ["Normal", "Good", "Very good", "Excellent"] as const;

export function clampPriority(value: number): number {
  return Math.min(PRIORITY_MAX, Math.max(0, Math.round(value)));
}

/** Reasons offered when marking an opportunity lost. Free text is also accepted. */
export const LOST_REASONS = [
  "Too expensive",
  "Chose a competitor",
  "No budget",
  "Not the right timing",
  "Requirements not a fit",
  "No response",
  "Handled in-house",
] as const;

// ─── Tags ────────────────────────────────────────────────────────────────────

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;

/** "Power Automate, urgent ,  urgent" -> ["Power Automate", "urgent"]. Case-insensitive de-dupe. */
export function parseTags(raw: string | readonly string[]): string[] {
  const parts = typeof raw === "string" ? raw.split(",") : raw;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const tag = part.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

const TAG_TONES: readonly Tone[] = ["blue", "aqua", "mint", "lilac", "blush", "amber"];

/** Stable colour per tag name, so a tag looks the same on every card. */
export function tagTone(tag: string): Tone {
  let h = 0;
  for (const ch of tag.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_TONES[h % TAG_TONES.length];
}

// ─── Activities ──────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "TODO", "FOLLOW_UP"] as const satisfies readonly ActivityType[];

/** Label and lucide-react icon name per activity type. */
export const ACTIVITY_TYPE: Record<ActivityType, { label: string; icon: "Phone" | "Mail" | "Users" | "ListTodo" | "Repeat" }> = {
  CALL: { label: "Call", icon: "Phone" },
  EMAIL: { label: "Email", icon: "Mail" },
  MEETING: { label: "Meeting", icon: "Users" },
  TODO: { label: "To-do", icon: "ListTodo" },
  FOLLOW_UP: { label: "Follow-up", icon: "Repeat" },
};

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

export type ActivityState = "overdue" | "today" | "planned";

/**
 * Odoo's activity colours, on the business (Dubai) calendar: a due date before
 * today is overdue, today is today, anything later is planned.
 */
export function activityState(dueDate: Date | string, now: Date = new Date()): ActivityState {
  const due = dayKey(dueDate);
  const today = dayKey(now);
  return due < today ? "overdue" : due === today ? "today" : "planned";
}

/**
 * `text` colours small due labels, so each meets WCAG AA (4.5:1) on white,
 * canvas and haze: the planned green is the text-safe mint-ink token (5.5:1 on
 * white), not a fill shade.
 */
export const ACTIVITY_STATE: Record<ActivityState, { label: string; tone: Tone; text: string; dot: string }> = {
  overdue: { label: "Overdue", tone: "red", text: "text-red-600", dot: "bg-red-500" },
  today: { label: "Today", tone: "amber", text: "text-amber-700", dot: "bg-amber-400" },
  planned: { label: "Planned", tone: "mint", text: "text-mint-ink", dot: "bg-mint-600" },
};

/**
 * The most urgent state among a lead's open activities (overdue beats today
 * beats planned), or null when nothing is scheduled. Drives the card icon and
 * the column progress bar.
 */
export function worstActivityState(
  activities: readonly { dueDate: Date | string }[],
  now: Date = new Date(),
): ActivityState | null {
  let worst: ActivityState | null = null;
  for (const a of activities) {
    const s = activityState(a.dueDate, now);
    if (s === "overdue") return s;
    if (s === "today") worst = "today";
    else if (!worst) worst = "planned";
  }
  return worst;
}

// ─── Kanban ordering ─────────────────────────────────────────────────────────

/**
 * sortOrder for a card dropped between two neighbours (either may be missing:
 * top or bottom of the column). Floats let a card land between two others
 * without renumbering the column; when the gap gets too small to split,
 * `needsRebalance` tells the caller to renumber that column.
 */
export function sortOrderBetween(before: number | null, after: number | null): { value: number; needsRebalance: boolean } {
  if (before === null && after === null) return { value: 0, needsRebalance: false };
  if (before === null) return { value: (after as number) - 1024, needsRebalance: false };
  if (after === null) return { value: before + 1024, needsRebalance: false };
  const value = (before + after) / 2;
  return { value, needsRebalance: !(value > before && value < after) || after - before < 1e-6 };
}

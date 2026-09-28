import type { ActivityType, Prisma } from "@prisma/client";
import { LEAD_PIPELINE } from "@/lib/admin/labels";
import { ACTIVITY_TYPE, activityState, type ActivityState } from "@/lib/admin/pipeline";
import { BUSINESS_TIME_ZONE, daysFromToday, dueHint } from "@/lib/admin/time";

/*
 * Pure CRM helpers. No database, no "server-only" — safe to import from both
 * Server and Client Components inside this module.
 *
 * Only CRM-specific logic lives here. Shared rules come from src/lib/admin:
 * pipeline stages and activity states (pipeline.ts), money input (money.ts),
 * dates (time.ts), badge tone dots and initials (labels.ts).
 */

export type LeadStatusKey = (typeof LEAD_PIPELINE)[number];

export function isLeadStatus(value: unknown): value is LeadStatusKey {
  return typeof value === "string" && (LEAD_PIPELINE as readonly string[]).includes(value);
}

/** Next's searchParams values can be a string, an array (?a=1&a=2) or absent. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Builds a /admin/crm (leads list) URL, leaving defaults out so links stay short and shareable. */
export function crmHref({ status, q, page }: { status?: string | null; q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/admin/crm?${qs}` : "/admin/crm";
}

/**
 * Search across the opportunity name, contact, company and email. Shared by
 * the leads list and the pipeline so both find the same records.
 *
 * Prisma's `contains` becomes ILIKE '%…%' without escaping, so "%" and "_" in
 * the query would act as wildcards ("_" alone matched every lead). Backslash
 * is Postgres's default LIKE escape character.
 */
export function leadSearchWhere(q: string): Prisma.LeadWhereInput {
  if (!q) return {};
  const term = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { fullName: { contains: term, mode: "insensitive" } },
      { companyName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ],
  };
}

/** "Company name", or "Individual" for private clients. */
export function companyLabel(lead: { companyName: string | null; clientType: string }): string {
  if (lead.companyName) return lead.companyName;
  return lead.clientType === "INDIVIDUAL" ? "Individual" : "Company";
}

export function sourceLabel(source: string): string {
  if (source === "website") return "Website form";
  if (source === "manual") return "Added manually";
  if (source === "demo") return "Demo data";
  return source;
}

// ─── Activities ──────────────────────────────────────────────────────────────

const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, day: "numeric", month: "short" });

/** What a list row or pipeline card says about an opportunity's next activity. */
export type ActivityBrief = {
  state: ActivityState;
  /** "Call: Discuss the scope", or just "Call" when the summary is the type. */
  label: string;
  /** "Due today", "Due in 3 days", "2 days overdue". */
  due: string;
  /** Compact visible text beside the icon: "2d late", "Today", "Tomorrow", "12 Oct". */
  short: string;
};

/**
 * Describes an open activity on the business (Dubai) calendar. Pass the
 * earliest-due open activity: it is also the most urgent one, so its state is
 * the opportunity's worst state (see worstActivityState in pipeline.ts).
 */
export function describeActivity(
  activity: { type: ActivityType; summary: string; dueDate: Date | string },
  now: Date,
): ActivityBrief {
  const typeLabel = ACTIVITY_TYPE[activity.type].label;
  const summary = activity.summary.trim();
  const days = daysFromToday(activity.dueDate, now);
  return {
    state: activityState(activity.dueDate, now),
    label: summary && summary !== typeLabel ? `${typeLabel}: ${summary}` : typeLabel,
    due: dueHint(activity.dueDate, now),
    short:
      days < 0 ? `${-days}d late` : days === 0 ? "Today" : days === 1 ? "Tomorrow" : shortDate.format(new Date(activity.dueDate)),
  };
}

// ─── Contact links ───────────────────────────────────────────────────────────

/**
 * wa.me wants the full international number as digits only: no "+", no
 * spaces, no "00" international prefix. The public form's phone field is free
 * text, so a visitor may type a local number ("050 123 4567"); without a
 * country code wa.me rejects it as invalid. Only numbers written in
 * international form ("+971 ...", "(+971) ...", "00971 ...") get a link — otherwise null,
 * and the page hides the WhatsApp button while still showing the number with
 * its tel: link.
 */
export function whatsappNumber(phone: string): string | null {
  const trimmed = phone.trim();
  if (!/^\(?(?:\+|00)/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Country codes never start with 0, so "+0..." / "000..." is not dialable.
  if (digits.startsWith("0")) return null;
  // E.164 caps a full number at 15 digits; anything shorter than 7 is not a real number.
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** tel: links keep the leading "+" and digits only. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

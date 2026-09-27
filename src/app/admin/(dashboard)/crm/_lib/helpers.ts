import { LEAD_PIPELINE } from "@/lib/admin/labels";

/*
 * Pure CRM helpers. No database, no "server-only" — safe to import from both
 * Server and Client Components inside this module.
 *
 * Only CRM-specific logic lives here. Shared rules come from src/lib/admin:
 * invoice overdue status (invoices.ts), money input (money.ts), dates, badge
 * tone dots and initials (labels.ts, time.ts).
 */

export type LeadStatusKey = (typeof LEAD_PIPELINE)[number];
export type CrmView = "table" | "board";

export function isLeadStatus(value: unknown): value is LeadStatusKey {
  return typeof value === "string" && (LEAD_PIPELINE as readonly string[]).includes(value);
}

/** Next's searchParams values can be a string, an array (?a=1&a=2) or absent. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Builds a /admin/crm URL, leaving defaults out so links stay short and shareable. */
export function crmHref({
  status,
  q,
  view,
  page,
}: {
  status?: string | null;
  q?: string;
  view?: CrmView;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (view === "board") sp.set("view", "board");
  if (status) sp.set("status", status);
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/admin/crm?${qs}` : "/admin/crm";
}

/** "Company name", or "Individual" for private clients. */
export function companyLabel(lead: { companyName: string | null; clientType: string }): string {
  if (lead.companyName) return lead.companyName;
  return lead.clientType === "INDIVIDUAL" ? "Individual" : "Company";
}

export function sourceLabel(source: string): string {
  if (source === "website") return "Website form";
  if (source === "demo") return "Demo data";
  return source;
}

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

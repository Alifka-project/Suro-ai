/**
 * Input rules shared by the agreement editor (live preview) and updateAgreement
 * (authoritative validation), so the schedule the admin previews is the one
 * that gets saved. Pure — safe in Client Components.
 */
import { linesToList } from "@/lib/admin/agreement-terms";

/** Bounds for the numeric terms. Wide enough for any real engagement, narrow enough to catch typos. */
export const TERM_BOUNDS = {
  invoiceDueDays: { min: 1, max: 120 },
  feedbackDays: { min: 1, max: 30 },
  warrantyDays: { min: 0, max: 365 },
  terminationNoticeDays: { min: 1, max: 180 },
} as const;

/** 10% a month, in basis points. */
export const MAX_LATE_FEE_BPS = 1000;

/** Each SOW list: at most this many lines, each at most this long. */
export const MAX_LIST_ITEMS = 30;
export const MAX_LIST_ITEM_LENGTH = 500;

/** A whole number within [min, max], or null. Accepts only plain digits ("14", not "14.0" or "1e1"). */
export function parseWholeNumber(input: string, min: number, max: number): number | null {
  const s = input.trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

/** "2", "1.5", "0.25%" -> basis points (200, 150, 25), 0–10%. Null when invalid. */
export function parseLateFeeToBps(input: string): number | null {
  const s = input.trim().replace(/%$/, "").trim();
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  return Number.isFinite(bps) && bps >= 0 && bps <= MAX_LATE_FEE_BPS ? bps : null;
}

/**
 * A SOW textarea as a list, with the reason it can't be saved (or null).
 * Unlike linesToList on its own, too many or too long lines are reported
 * instead of silently cut.
 */
export function readList(raw: string): { items: string[]; problem: string | null } {
  const all = linesToList(raw, { max: Number.MAX_SAFE_INTEGER, maxLength: Number.MAX_SAFE_INTEGER });
  if (all.length > MAX_LIST_ITEMS) {
    return { items: all.slice(0, MAX_LIST_ITEMS), problem: `Keep it to ${MAX_LIST_ITEMS} lines or fewer (currently ${all.length}).` };
  }
  const long = all.findIndex((line) => line.length > MAX_LIST_ITEM_LENGTH);
  if (long !== -1) {
    return { items: all, problem: `Item ${long + 1} is too long — keep each line under ${MAX_LIST_ITEM_LENGTH} characters.` };
  }
  return { items: all, problem: null };
}

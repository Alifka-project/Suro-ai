/**
 * Billing-only calendar helpers. Pure — safe on both sides.
 *
 * The business clock itself — "today", day counts, the overdue rule, date
 * inputs and printed dates — lives in @/lib/admin/time. Only what no other
 * module needs stays here.
 */
import { calendarDay, startOfBusinessDay } from "@/lib/admin/time";

/**
 * 00:00 on the business clock on the 1st of a month. `month` is 0-based and may
 * overflow (12 is January of the next year). Noon UTC on the 1st falls on the
 * 1st in Dubai, so its business day is the 1st.
 */
function startOfBusinessMonth(year: number, month: number): Date {
  return startOfBusinessDay(new Date(Date.UTC(year, month, 1, 12)));
}

/** [start, end) of the current calendar month on the business clock. */
export function currentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const { year, month } = calendarDay(now);
  return { start: startOfBusinessMonth(year, month), end: startOfBusinessMonth(year, month + 1) };
}

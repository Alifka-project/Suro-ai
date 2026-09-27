/**
 * The business clock. Pure — safe in Server and Client Components.
 *
 * SULOAI operates in Dubai, so "today", overdue checks, day counts, month
 * boundaries and every printed date follow Asia/Dubai — not the server's zone.
 * That matters: Vercel runs in UTC, where anything recorded between 00:00 and
 * 04:00 Dubai time would otherwise print as the previous day.
 *
 * Dubai is a fixed UTC+4 with no daylight saving, so a constant offset is exact.
 *
 * CALENDAR DATES vs INSTANTS. Due dates, validity dates and project dates are
 * calendar days, not instants. They are stored at 12:00 UTC on the chosen day:
 * noon UTC falls on that same calendar day everywhere from UTC-11 to UTC+11.
 * Use dateInputToDate() to store one and toDateInputValue() to prefill a form.
 */

export const BUSINESS_TIME_ZONE = "Asia/Dubai";
const BUSINESS_UTC_OFFSET = "+04:00";
export const DAY_MS = 86_400_000;

/** A calendar day on the business clock. `month` is 0-based, like Date. */
export type CalendarDay = { year: number; month: number; day: number };

const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The business-clock calendar day an instant falls on. */
export function calendarDay(d: Date | string): CalendarDay {
  const parts = partsFormatter.formatToParts(new Date(d));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

/** "2026-09-27" — the business-clock day an instant falls on. */
export function dayKey(d: Date | string): string {
  const c = calendarDay(d);
  return `${c.year}-${String(c.month + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

/** The instant 00:00 began today on the business clock. */
export function startOfBusinessDay(now: Date = new Date()): Date {
  return new Date(`${dayKey(now)}T00:00:00${BUSINESS_UTC_OFFSET}`);
}

/**
 * True once the WHOLE calendar day of `date` has ended on the business clock.
 * A due date is the last day that still counts, so it lapses at 00:00 the
 * following day — never part-way through the day itself.
 * Equivalent Prisma filter: `{ lt: startOfBusinessDay(now) }`.
 */
export function isPastDay(date: Date | string, now: Date = new Date()): boolean {
  return new Date(date).getTime() < startOfBusinessDay(now).getTime();
}

function daySerial(d: Date | string): number {
  const c = calendarDay(d);
  return Date.UTC(c.year, c.month, c.day) / DAY_MS;
}

/**
 * Whole business-clock calendar days from `from` to `to`: 0 on the same day,
 * 1 when `to` is tomorrow, negative when it is earlier. Time of day never matters.
 */
export function calendarDaysBetween(from: Date | string, to: Date | string): number {
  return daySerial(to) - daySerial(from);
}

/** Calendar days from today to `date`: 0 today, 1 tomorrow, -1 yesterday. */
export function daysFromToday(date: Date | string, now: Date = new Date()): number {
  return calendarDaysBetween(now, date);
}

/**
 * "YYYY-MM-DD" (an <input type="date"> value) -> Date at 12:00 UTC, or null for
 * anything that is not a real calendar date ("2026-02-30") or is outside
 * 2000–2100. Impossible dates are rejected rather than rolled into next month.
 */
export function dateInputToDate(value: string): Date | null {
  const m = DATE_INPUT_RE.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (y < 2000 || y > 2100) return null;
  const d = new Date(Date.UTC(y, mo - 1, da, 12));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) return null;
  return d;
}

/** Date -> "YYYY-MM-DD" on the business clock, for prefilling <input type="date">. "" for none. */
export function toDateInputValue(d: Date | string | null | undefined): string {
  return d ? dayKey(d) : "";
}

/** "2026-09-27" + 30 -> "2026-10-27". Returns the input unchanged if it is not a date. */
export function addDaysToDateInput(value: string, days: number): string {
  const m = DATE_INPUT_RE.exec(value);
  if (!m) return value;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12)).toISOString().slice(0, 10);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "27 Sept 2026" on the business clock. "—" for none. */
export function formatBusinessDate(d: Date | string | null | undefined): string {
  return d ? dateFormatter.format(new Date(d)) : "—";
}

/** "27 Sept 2026, 14:05" on the business clock. "—" for none. */
export function formatBusinessDateTime(d: Date | string | null | undefined): string {
  return d ? dateTimeFormatter.format(new Date(d)) : "—";
}

/** "Due today", "Due in 3 days", "2 days overdue" — relative to the business day. */
export function dueHint(date: Date | string, now: Date = new Date()): string {
  const days = daysFromToday(date, now);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${-days} days overdue`;
}

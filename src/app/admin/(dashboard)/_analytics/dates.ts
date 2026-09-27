/**
 * Time buckets for the overview (weeks, months, year to date), cut on the
 * business clock.
 *
 * The clock itself (the Asia/Dubai calendar day of an instant, the start of a
 * business day, day keys, printed dates) lives in src/lib/admin/time.ts and is
 * shared with Billing, CRM and Projects. This file only adds the bucketing
 * that the overview needs. Without the business clock, a UTC server (typical
 * hosting) would start every bucket four hours late: a payment marked at 01:30
 * on 1 October in Dubai would chart as September here while Billing counts it
 * in October.
 */
import { DAY_MS, calendarDay, dayKey, startOfBusinessDay } from "@/lib/admin/time";

/**
 * The instant 00:00 business time begins on a calendar day. Date.UTC
 * normalises overflow, so month 12 or day 0 roll into the next or previous
 * month as expected. Noon UTC falls on that same calendar day in Dubai, so the
 * start of its business day is the midnight wanted.
 */
function midnight(year: number, month: number, day: number): Date {
  return startOfBusinessDay(new Date(Date.UTC(year, month, day, 12)));
}

/** Shift an instant by whole days. Exact because the business zone has no DST. */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Monday 00:00 of the business week containing d. */
export function startOfWeek(d: Date): Date {
  const c = calendarDay(d);
  const weekday = new Date(Date.UTC(c.year, c.month, c.day)).getUTCDay();
  const sinceMonday = (weekday + 6) % 7;
  return midnight(c.year, c.month, c.day - sinceMonday);
}

export function startOfMonth(d: Date): Date {
  const c = calendarDay(d);
  return midnight(c.year, c.month, 1);
}

/** 00:00 on the 1st of the month `months` away from the month containing d. */
export function addMonths(d: Date, months: number): Date {
  const c = calendarDay(d);
  return midnight(c.year, c.month + months, 1);
}

export function startOfYear(d: Date): Date {
  return midnight(calendarDay(d).year, 0, 1);
}

/** Calendar year of d on the business clock. */
export function businessYear(d: Date): number {
  return calendarDay(d).year;
}

/** True when a and b fall in the same business-clock month. */
export function sameMonth(a: Date, b: Date): boolean {
  const x = calendarDay(a);
  const y = calendarDay(b);
  return x.year === y.year && x.month === y.month;
}

/** "2026-09" for the business-clock month d falls in. */
export function isoMonth(d: Date): string {
  return dayKey(d).slice(0, 7);
}

/**
 * Index of the bucket that t falls in, given ascending bucket start times and
 * the exclusive end of the last bucket. -1 when t is outside the range.
 */
export function bucketIndex(t: number, starts: number[], end: number): number {
  if (starts.length === 0 || t < starts[0] || t >= end) return -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (t >= starts[i]) return i;
  }
  return -1;
}

export function earliest(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

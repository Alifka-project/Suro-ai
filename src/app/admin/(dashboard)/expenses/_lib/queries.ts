import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { ACTIVE_CLIENT } from "@/lib/admin/clients";
import { expenseCategoryLabel, isExpenseCategory } from "@/lib/admin/expenses";
import { DEFAULT_CURRENCY, documentTotals, formatMoney } from "@/lib/admin/money";
import { BUSINESS_TIME_ZONE, formatBusinessDate, toDateInputValue } from "@/lib/admin/time";
import { addMonths, bucketIndex, isoMonth, startOfMonth } from "../../_analytics/dates";
import type { ExpensesPoint } from "../../_dashboard/charts";
import { NO_PROJECT, PAGE_SIZE, isMonthKey } from "./filters";
import type {
  CategoryTotal,
  ExpenseFilters,
  ExpenseProject,
  ExpenseRow,
  ExpensesData,
  ProjectOption,
  SelectOption,
} from "./types";

/*
 * Everything the Expenses page and its CSV export read. Months are cut on the
 * business (Dubai) clock like the dashboard. Expense dates are calendar days
 * stored at 12:00 UTC, which always falls inside the Dubai day.
 *
 * Money is summed in JavaScript over the selected amounts, AED only (another
 * currency is never mixed in, as on the dashboard). Prisma's `_sum` on an Int
 * column is computed as INT4 in Postgres and can overflow above about
 * AED 21.4M; a JS number is exact far beyond that.
 */

const MONTHS = 12;
/** Month filter options: this many months back from the current one. */
const MONTH_OPTIONS_BACK = 24;
/** Expenses may be dated up to a year ahead, so the month filter can look ahead too. */
const MONTH_OPTIONS_AHEAD_MAX = 12;
/** The CSV export's ceiling. */
export const EXPORT_LIMIT = 10_000;

const monthShort = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, month: "short" });
const monthLong = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, month: "long", year: "numeric" });

const ORDER = [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }] satisfies Prisma.ExpenseOrderByWithRelationInput[];

const leadSelect = {
  id: true,
  title: true,
  companyName: true,
  fullName: true,
  removedAt: true,
} satisfies Prisma.LeadSelect;

type LeadLabelSource = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;

const rowSelect = {
  id: true,
  date: true,
  amountFils: true,
  currency: true,
  category: true,
  description: true,
  vendor: true,
  notes: true,
  lead: { select: leadSelect },
} satisfies Prisma.ExpenseSelect;

type ExpenseRecord = Prisma.ExpenseGetPayload<{ select: typeof rowSelect }>;

// ─── Labels and filters ─────────────────────────────────────────────────────

/** Project name, else company, else the person; plus the person when that differs. */
export function leadLabel(lead: Pick<LeadLabelSource, "title" | "companyName" | "fullName">): {
  label: string;
  person: string | null;
} {
  const label = lead.title?.trim() || lead.companyName?.trim() || lead.fullName;
  return { label, person: label === lead.fullName ? null : lead.fullName };
}

function toProject(lead: LeadLabelSource): ExpenseProject {
  return { id: lead.id, ...leadLabel(lead), removed: lead.removedAt !== null };
}

/** The half-open [start, end) of a "YYYY-MM" business month. */
export function monthRange(key: string): { start: Date; end: Date } {
  const [year, month] = key.split("-").map(Number);
  // Mid-month noon UTC sits safely inside that Dubai month.
  const anchor = new Date(Date.UTC(year, month - 1, 15, 12));
  return { start: startOfMonth(anchor), end: addMonths(anchor, 1) };
}

/**
 * Prisma's `contains` becomes ILIKE '%…%' without escaping, so "%" and "_"
 * would act as wildcards. Backslash is Postgres's default LIKE escape.
 */
function likeTerm(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** The list filters as a Prisma where clause. Shared by the page and the CSV export. */
export function expenseWhere(f: Pick<ExpenseFilters, "q" | "category" | "project" | "month">): Prisma.ExpenseWhereInput {
  const and: Prisma.ExpenseWhereInput[] = [];
  if (f.q) {
    const term = likeTerm(f.q);
    and.push({
      OR: [
        { description: { contains: term, mode: "insensitive" } },
        { vendor: { contains: term, mode: "insensitive" } },
        { notes: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  if (f.category) and.push({ category: f.category });
  if (f.project === NO_PROJECT) and.push({ leadId: null });
  else if (f.project) and.push({ leadId: f.project });
  if (f.month && isMonthKey(f.month)) {
    const { start, end } = monthRange(f.month);
    and.push({ date: { gte: start, lt: end } });
  }
  return and.length > 0 ? { AND: and } : {};
}

function toRow(e: ExpenseRecord): ExpenseRow {
  return {
    id: e.id,
    date: toDateInputValue(e.date),
    dateLabel: formatBusinessDate(e.date),
    amountFils: e.amountFils,
    amountLabel: formatMoney(e.amountFils, e.currency),
    currency: e.currency,
    category: e.category,
    categoryLabel: expenseCategoryLabel(e.category),
    description: e.description,
    vendor: e.vendor,
    notes: e.notes,
    project: e.lead ? toProject(e.lead) : null,
  };
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

// ─── The page ───────────────────────────────────────────────────────────────

/**
 * One read for the whole page: the summary tiles, the monthly chart and the
 * category breakdown (last 12 business months, unaffected by the filters),
 * plus the filtered list page, its totals and the picker options.
 */
export async function getExpensesPage(filters: ExpenseFilters, now: Date = new Date()): Promise<ExpensesData> {
  await requireAdmin();

  const firstMonth = addMonths(now, -(MONTHS - 1));
  const monthStarts = Array.from({ length: MONTHS }, (_, i) => addMonths(firstMonth, i));
  const starts = monthStarts.map((d) => d.getTime());
  const endDate = addMonths(now, 1);
  const end = endDate.getTime();

  const where = expenseWhere(filters);
  const listPage = (page: number) =>
    db.expense.findMany({ where, orderBy: ORDER, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: rowSelect });

  const [windowExpenses, paidInvoices, matching, requestedRows, leads, dateRange] = await Promise.all([
    // The 12-month window: tiles, chart and categories.
    db.expense.findMany({
      where: { date: { gte: firstMonth, lt: endDate }, currency: DEFAULT_CURRENCY },
      select: { date: true, amountFils: true, category: true, leadId: true },
    }),
    // Revenue collected, exactly as the dashboard counts it: paid invoices by
    // payment month, VAT included, AED only.
    db.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: firstMonth, lt: endDate } },
      select: {
        paidAt: true,
        currency: true,
        vatBps: true,
        items: { select: { quantity: true, unitPriceFils: true } },
      },
    }),
    // Count and total of everything the filters match (not just this page).
    db.expense.findMany({ where, select: { amountFils: true, currency: true } }),
    // The requested page, read in parallel; re-read below only if it was past the end.
    listPage(filters.page),
    // Every client an expense can be linked to, or already is.
    db.lead.findMany({ where: { OR: [ACTIVE_CLIENT, { expenses: { some: {} } }] }, select: leadSelect }),
    db.expense.aggregate({ _min: { date: true }, _max: { date: true } }),
  ]);

  // ── Monthly buckets, tiles and categories ───────────────────────────────
  const spent = Array<number>(MONTHS).fill(0);
  const spentCount = Array<number>(MONTHS).fill(0);
  const collected = Array<number>(MONTHS).fill(0);
  let projectCostsFils = 0;
  const projectIds = new Set<string>();
  const byCategory = new Map<string, { amountFils: number; count: number }>();

  for (const e of windowExpenses) {
    const i = bucketIndex(e.date.getTime(), starts, end);
    if (i < 0) continue;
    spent[i] += e.amountFils;
    spentCount[i]++;
    if (e.leadId) {
      projectCostsFils += e.amountFils;
      projectIds.add(e.leadId);
    }
    const c = byCategory.get(e.category) ?? { amountFils: 0, count: 0 };
    c.amountFils += e.amountFils;
    c.count++;
    byCategory.set(e.category, c);
  }

  for (const inv of paidInvoices) {
    if (inv.currency !== DEFAULT_CURRENCY || !inv.paidAt) continue;
    const i = bucketIndex(inv.paidAt.getTime(), starts, end);
    if (i >= 0) collected[i] += documentTotals(inv.items, inv.vatBps).totalFils;
  }

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const last12Fils = sum(spent);
  const revenueFils = sum(collected);

  const monthly: ExpensesPoint[] = monthStarts.map((start, i) => ({
    key: isoMonth(start),
    label: monthShort.format(start),
    fullLabel: i === MONTHS - 1 ? `${monthLong.format(start)} (to date)` : monthLong.format(start),
    expensesFils: spent[i],
    collectedFils: collected[i],
  }));

  const categories: CategoryTotal[] = [...byCategory]
    .filter(([, c]) => c.amountFils > 0)
    .map(([key, c]) => ({
      key,
      label: expenseCategoryLabel(key),
      known: isExpenseCategory(key),
      amountFils: c.amountFils,
      count: c.count,
      share: last12Fils > 0 ? c.amountFils / last12Fils : 0,
    }))
    .sort((a, b) => b.amountFils - a.amountFils || collator.compare(a.label, b.label));

  // ── The filtered list ───────────────────────────────────────────────────
  const total = matching.length;
  let totalFils = 0;
  let otherCurrencyCount = 0;
  for (const m of matching) {
    if (m.currency === DEFAULT_CURRENCY) totalFils += m.amountFils;
    else otherCurrencyCount++;
  }
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = page === filters.page ? requestedRows : await listPage(page);

  // ── Picker options ──────────────────────────────────────────────────────
  const projects: ProjectOption[] = leads
    .map((lead) => {
      const { label, person } = leadLabel(lead);
      return { id: lead.id, label: person ? `${label} · ${person}` : label, removed: lead.removedAt !== null };
    })
    // Active clients first, then removed ones (kept for their old expenses), each A–Z.
    .sort((a, b) => Number(a.removed) - Number(b.removed) || collator.compare(a.label, b.label));

  return {
    summary: {
      currency: DEFAULT_CURRENCY,
      thisMonthKey: isoMonth(now),
      thisMonthFils: spent[MONTHS - 1],
      thisMonthCount: spentCount[MONTHS - 1],
      lastMonthFils: spent[MONTHS - 2],
      last12Fils,
      last12Count: sum(spentCount),
      projectCostsFils,
      projectCount: projectIds.size,
      revenueFils,
      profitFils: revenueFils - last12Fils,
    },
    monthly,
    categories,
    list: {
      rows: rows.map(toRow),
      total,
      totalFils,
      otherCurrencyCount,
      page,
      pageCount,
      pageSize: PAGE_SIZE,
      anyExpenses: dateRange._min.date !== null,
    },
    projects,
    months: monthOptions(now, dateRange._max.date, filters.month),
  };
}

/**
 * The month filter: from the latest month with a (future-dated) expense, or
 * this month, back 24 months. A month set in the URL outside that range is
 * added so the select can still show it.
 */
function monthOptions(now: Date, latest: Date | null, selected: string | null): SelectOption[] {
  let ahead = 0;
  if (latest) {
    const latestKey = isoMonth(latest);
    for (let k = MONTH_OPTIONS_AHEAD_MAX; k >= 1; k--) {
      if (isoMonth(addMonths(now, k)) <= latestKey) {
        ahead = k;
        break;
      }
    }
  }
  const options: SelectOption[] = [];
  for (let k = ahead; k > -MONTH_OPTIONS_BACK; k--) {
    const start = addMonths(now, k);
    options.push({ value: isoMonth(start), label: monthLong.format(start) });
  }
  if (selected && isMonthKey(selected) && !options.some((o) => o.value === selected)) {
    options.push({ value: selected, label: monthLong.format(monthRange(selected).start) });
    options.sort((a, b) => (a.value < b.value ? 1 : -1));
  }
  return options;
}

// ─── The CSV export ─────────────────────────────────────────────────────────

const exportSelect = {
  ...rowSelect,
  createdBy: { select: { name: true } },
} satisfies Prisma.ExpenseSelect;

export type ExportRecord = Prisma.ExpenseGetPayload<{ select: typeof exportSelect }>;

/** Everything matching the filters, newest first, up to EXPORT_LIMIT rows. */
export async function getExpensesForExport(
  filters: Pick<ExpenseFilters, "q" | "category" | "project" | "month">,
): Promise<{ rows: ExportRecord[]; total: number }> {
  await requireAdmin();
  const where = expenseWhere(filters);
  const [rows, total] = await Promise.all([
    db.expense.findMany({ where, orderBy: ORDER, take: EXPORT_LIMIT, select: exportSelect }),
    db.expense.count({ where }),
  ]);
  return { rows, total };
}

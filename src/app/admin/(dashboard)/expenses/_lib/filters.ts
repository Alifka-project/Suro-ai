import { isExpenseCategory } from "@/lib/admin/expenses";
import { stripControlChars } from "./text";
import type { ExpenseFilters, ExpenseSearch } from "./types";

/*
 * The Expenses page's URL contract, shared by the page, the CSV export and the
 * filter bar. Pure: safe in Server and Client Components.
 *
 *   ?q=        search description, paid to and notes (trimmed, max 100)
 *   ?category= a key from EXPENSE_CATEGORIES
 *   ?project=  a client's id, or "none" for running costs only
 *   ?month=    "YYYY-MM", one business (Dubai) month
 *   ?page=     1-based list page
 *   ?add=1     open the "Add expense" dialog on load (page only), with the
 *              ?project= client preselected when it is an active client
 *
 * Anything malformed falls back to "no filter" instead of failing the page.
 */

export const EXPENSES_PATH = "/admin/expenses";
export const EXPORT_PATH = "/admin/expenses/export";
/** The list's section id, so filter and page links land back on it. */
export const LIST_ID = "expenses";
/** The list's heading (tabIndex -1): focus lands there when a deleted row disappears. */
export const LIST_HEADING_ID = "expenses-heading";
/** The page header's "Add expense" button: focus lands there when the dialog opened by ?add=1 closes. */
export const ADD_BUTTON_ID = "expenses-add";
export const PAGE_SIZE = 25;
/** ?project= value for running costs (no client). */
export const NO_PROJECT = "none";
export const MAX_QUERY = 100;

export type SearchParams = Record<string, string | string[] | undefined>;

const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Next's searchParams values can be a string, an array (?a=1&a=2) or absent. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "2026-10", within the years the date helpers accept (2000–2100). */
export function isMonthKey(value: string | null | undefined): value is string {
  const m = value ? MONTH_KEY.exec(value) : null;
  if (!m) return false;
  const year = Number(m[1]);
  return year >= 2000 && year <= 2100;
}

/**
 * The search term: control characters dropped (a NUL from `?q=%00` would make
 * the database reject the query), trimmed, and cut to MAX_QUERY characters by
 * code point, so the cut never leaves half an emoji.
 */
export function cleanQuery(value: string | null | undefined): string {
  const term = stripControlChars(value ?? "").trim();
  return Array.from(term).slice(0, MAX_QUERY).join("").trim();
}

export function parseExpenseSearch(sp: SearchParams): ExpenseSearch {
  const category = first(sp.category)?.trim();
  const project = first(sp.project)?.trim();
  const month = first(sp.month)?.trim();
  const page = Number.parseInt(first(sp.page) ?? "", 10);
  return {
    q: cleanQuery(first(sp.q)),
    category: isExpenseCategory(category) ? category : null,
    // "none" also matches the id pattern; either way it is kept as given.
    project: project && (project === NO_PROJECT || RECORD_ID.test(project)) ? project : null,
    month: isMonthKey(month) ? month : null,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    add: first(sp.add) === "1",
  };
}

/** A route handler's URLSearchParams as the record shape the parser takes. */
export function searchParamsToRecord(params: URLSearchParams): SearchParams {
  const record: SearchParams = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    record[key] = all.length > 1 ? all : all[0];
  }
  return record;
}

export function hasFilters(f: Pick<ExpenseFilters, "q" | "category" | "project" | "month">): boolean {
  return Boolean(f.q || f.category || f.project || f.month);
}

type HrefFilters = {
  q?: string | null;
  category?: string | null;
  project?: string | null;
  month?: string | null;
  page?: number;
};

function query({ q, category, project, month, page }: HrefFilters): string {
  const sp = new URLSearchParams();
  const term = cleanQuery(q);
  if (term) sp.set("q", term);
  if (category) sp.set("category", category);
  if (project) sp.set("project", project);
  if (month) sp.set("month", month);
  if (page && page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/** /admin/expenses?…#expenses, leaving defaults out. `hash: false` for in-place updates. */
export function expensesHref(filters: HrefFilters, { hash = true }: { hash?: boolean } = {}): string {
  return `${EXPENSES_PATH}${query(filters)}${hash ? `#${LIST_ID}` : ""}`;
}

/** The CSV export of everything matching the filters (all pages). */
export function exportHref(filters: HrefFilters): string {
  return `${EXPORT_PATH}${query({ ...filters, page: undefined })}`;
}

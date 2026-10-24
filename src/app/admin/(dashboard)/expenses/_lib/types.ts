import type { ExpenseCategory } from "@/lib/admin/expenses";
import type { ExpensesPoint } from "../../_dashboard/charts";

/*
 * Shapes the Expenses page hands to its components, and the results of its
 * Server Actions. They live here because a "use server" file may only export
 * async functions. Plain, serialisable data only: dates are "YYYY-MM-DD"
 * strings and every label is formatted on the server.
 */

/** The list filters, as they appear in the URL. */
export type ExpenseFilters = {
  /** Searches description, paid to and notes. Trimmed, at most 100 characters. */
  q: string;
  category: ExpenseCategory | null;
  /** A client's id, NO_PROJECT ("none") for running costs only, or null for everything. */
  project: string | null;
  /** "2026-10": one business (Dubai) month. */
  month: string | null;
  page: number;
};

/** The filters plus `?add=1`, which opens the "Add expense" dialog on load. */
export type ExpenseSearch = ExpenseFilters & { add: boolean };

/** A client an expense can be linked to. */
export type ProjectOption = {
  id: string;
  /** "Project name · Person", or just the name when they are the same. */
  label: string;
  /** Removed from the dashboard's client list: kept for old expenses, not offered for new ones. */
  removed: boolean;
};

export type SelectOption = { value: string; label: string };

/** The client/project an expense row is linked to. */
export type ExpenseProject = {
  id: string;
  /** Project name, else company, else the person's name. */
  label: string;
  /** The person's name when it differs from `label`. */
  person: string | null;
  removed: boolean;
};

/** One expense as the list, the edit dialog and the delete confirmation see it. */
export type ExpenseRow = {
  id: string;
  /** "2026-10-24", the calendar day it was paid. */
  date: string;
  /** "24 Oct 2026". */
  dateLabel: string;
  amountFils: number;
  /** "AED 1,250.00". */
  amountLabel: string;
  currency: string;
  category: string;
  categoryLabel: string;
  description: string;
  vendor: string | null;
  notes: string | null;
  project: ExpenseProject | null;
};

/** The four summary tiles. Unaffected by the list filters. AED only. */
export type ExpenseSummary = {
  currency: string;
  /** "2026-10": the current business month. */
  thisMonthKey: string;
  thisMonthFils: number;
  thisMonthCount: number;
  lastMonthFils: number;
  /** The 12 business months up to and including this one. */
  last12Fils: number;
  last12Count: number;
  /** Of last12Fils: expenses linked to a client. */
  projectCostsFils: number;
  projectCount: number;
  /** Paid invoices over the same 12 months, as the dashboard's Revenue tile counts them. */
  revenueFils: number;
  /** revenueFils − last12Fils; negative for a loss. */
  profitFils: number;
};

export type CategoryTotal = {
  key: string;
  label: string;
  /** False for a key no longer in EXPENSE_CATEGORIES: shown, but not a filter link. */
  known: boolean;
  amountFils: number;
  count: number;
  /** Share of the 12-month total, 0–1. */
  share: number;
};

export type ExpenseList = {
  rows: ExpenseRow[];
  /** Every expense matching the filters. */
  total: number;
  /** Their sum in AED. */
  totalFils: number;
  /** Matching expenses in another currency, left out of totalFils. */
  otherCurrencyCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** False only when nothing has ever been recorded. */
  anyExpenses: boolean;
};

export type ExpensesData = {
  summary: ExpenseSummary;
  monthly: ExpensesPoint[];
  categories: CategoryTotal[];
  list: ExpenseList;
  projects: ProjectOption[];
  /** Month filter options, newest first. */
  months: SelectOption[];
};

// ─── Server Action results ──────────────────────────────────────────────────

/** Result of createExpense / updateExpense. `null` is the dialog's idle state. */
export type ExpenseFormState = {
  ok: boolean;
  message: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Changes on every submission, so the dialog can react to each one. */
  at: number;
} | null;

export type DeleteExpenseResult = {
  ok: boolean;
  /** The expense was already gone: nothing left to delete. */
  gone?: boolean;
  message: string;
  at: number;
};

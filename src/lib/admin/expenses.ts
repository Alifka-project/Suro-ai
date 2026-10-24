/**
 * Expense categories. Stored on Expense.category as the key, so a label can be
 * reworded without touching data. Plain text in the database rather than an
 * enum, so a category can be added here without a migration; keep existing
 * keys stable. Pure — safe in server and client code.
 */
export const EXPENSE_CATEGORIES = [
  { key: "software", label: "Software & subscriptions" },
  { key: "hosting", label: "Hosting & cloud" },
  { key: "contractors", label: "Contractors & freelancers" },
  { key: "staff", label: "Salaries & staff" },
  { key: "equipment", label: "Hardware & equipment" },
  { key: "office", label: "Office & rent" },
  { key: "marketing", label: "Marketing & advertising" },
  { key: "travel", label: "Travel & transport" },
  { key: "professional", label: "Professional fees" },
  { key: "licences", label: "Licences & government fees" },
  { key: "bank", label: "Bank & payment fees" },
  { key: "training", label: "Training & education" },
  { key: "other", label: "Other" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["key"];

export const EXPENSE_CATEGORY_KEYS = EXPENSE_CATEGORIES.map((c) => c.key) as [
  ExpenseCategory,
  ...ExpenseCategory[],
];

const LABELS: ReadonlyMap<string, string> = new Map(EXPENSE_CATEGORIES.map((c) => [c.key, c.label]));

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && LABELS.has(value);
}

/** The category's label; an unknown key (one retired from the list) is shown as stored. */
export function expenseCategoryLabel(key: string): string {
  return LABELS.get(key) ?? key;
}

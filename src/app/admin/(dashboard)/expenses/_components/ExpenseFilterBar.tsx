"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { buttonClass, cn, inputClass } from "@/components/admin/ui";
import { EXPENSE_CATEGORIES } from "@/lib/admin/expenses";
import { EXPENSES_PATH, LIST_ID, MAX_QUERY, NO_PROJECT, expensesHref } from "../_lib/filters";
import type { ExpenseFilters, SelectOption } from "../_lib/types";

/*
 * Search plus Month, Category and Project filters for the list. A plain GET
 * form underneath, so it works before (or without) JavaScript: the Apply
 * button inside <noscript> submits it. With JavaScript, a select applies as
 * soon as it changes (router.replace, keeping the scroll position) and the
 * search applies on Enter, both with tidy URLs that leave empty filters out.
 *
 * The controls are controlled, re-seeded from the URL whenever the applied
 * filters change (a "Clear filters" link, Back), without remounting, so focus
 * stays on the select that was just used.
 */

type Values = { q: string; month: string; category: string; project: string };

const LABEL = "mb-1 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-550";
const SELECT = cn(inputClass, "appearance-auto pr-2");

export function ExpenseFilterBar({
  filters,
  months,
  projects,
}: {
  filters: Pick<ExpenseFilters, "q" | "category" | "project" | "month">;
  months: SelectOption[];
  /** Clients that can be filtered on (labels include "(removed)" where it applies). */
  projects: SelectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const applied: Values = {
    q: filters.q,
    month: filters.month ?? "",
    category: filters.category ?? "",
    project: filters.project ?? "",
  };
  const appliedKey = [applied.q, applied.month, applied.category, applied.project].join("\u0000");
  const [values, setValues] = useState(applied);
  const [seen, setSeen] = useState(appliedKey);
  if (seen !== appliedKey) {
    setSeen(appliedKey);
    setValues(applied);
  }

  const go = (next: Values, how: "push" | "replace") => {
    const href = expensesHref(
      { q: next.q, month: next.month || null, category: next.category || null, project: next.project || null },
      { hash: false },
    );
    startTransition(() => {
      if (how === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  };

  const onSelect = (name: "month" | "category" | "project") => (e: ChangeEvent<HTMLSelectElement>) => {
    const next = { ...values, [name]: e.target.value };
    setValues(next);
    go(next, "replace");
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    go(values, "push");
  };

  // A client in the URL that isn't in the list (deleted since): still show it as selected.
  const projectOptions =
    values.project && values.project !== NO_PROJECT && !projects.some((p) => p.value === values.project)
      ? [...projects, { value: values.project, label: "Client not found" }]
      : projects;

  return (
    <Form
      action={`${EXPENSES_PATH}#${LIST_ID}`}
      onSubmit={onSubmit}
      role="search"
      aria-label="Filter expenses"
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.25fr)]"
    >
      <div className="min-w-0 sm:col-span-2 xl:col-span-1">
        <label htmlFor="expenses-search" className={LABEL}>
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-550"
            aria-hidden="true"
          />
          <input
            id="expenses-search"
            type="search"
            name="q"
            value={values.q}
            onChange={(e) => setValues((v) => ({ ...v, q: e.target.value }))}
            maxLength={MAX_QUERY}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Description, paid to or notes"
            aria-describedby="expenses-search-hint"
            className={cn(inputClass, "pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none")}
          />
          {pending && (
            <Loader2
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-550 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
        </div>
        <p id="expenses-search-hint" className="sr-only">
          Press Enter to search.
        </p>
      </div>

      <div className="min-w-0">
        <label htmlFor="expenses-month" className={LABEL}>
          Month
        </label>
        <select id="expenses-month" name="month" value={values.month} onChange={onSelect("month")} className={SELECT}>
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label htmlFor="expenses-category" className={LABEL}>
          Category
        </label>
        <select
          id="expenses-category"
          name="category"
          value={values.category}
          onChange={onSelect("category")}
          className={SELECT}
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 sm:col-span-2 xl:col-span-1">
        <label htmlFor="expenses-project" className={LABEL}>
          Project
        </label>
        <select
          id="expenses-project"
          name="project"
          value={values.project}
          onChange={onSelect("project")}
          className={SELECT}
        >
          <option value="">All projects and running costs</option>
          <option value={NO_PROJECT}>Running costs (no project)</option>
          {projectOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <noscript>
        <button type="submit" className={cn(buttonClass("secondary", "sm"), "h-10")}>
          Apply filters
        </button>
      </noscript>

      {/* Always mounted so the change is announced; the spinner in the search field is its visual twin.
          The form deliberately has no aria-busy: screen readers hold back updates inside a busy
          region until it is idle, by which time this text has already been cleared. */}
      <p aria-live="polite" className="sr-only">
        {pending ? "Updating the list…" : ""}
      </p>
    </Form>
  );
}

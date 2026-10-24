import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ReceiptText, SearchX } from "lucide-react";
import { Card, EmptyState, LinkButton, buttonClass, cn } from "@/components/admin/ui";
import { formatMoney } from "@/lib/admin/money";
import { clientHref } from "@/lib/admin/modules";
import { LIST_HEADING_ID, LIST_ID, expensesHref, hasFilters } from "../_lib/filters";
import type { ExpenseFilters, ExpenseList as ExpenseListData, ExpenseProject, ExpenseRow, SelectOption } from "../_lib/types";
import { AddExpenseButton, ExpenseRowActions } from "./ExpenseActions";
import { ExpenseFilterBar } from "./ExpenseFilterBar";

/*
 * The expenses list: header, filters, then a table from xl up and cards below
 * (nothing scrolls sideways on a phone), and Previous/Next paging. A Server
 * Component; only the filter bar and the Edit/Delete buttons run in the
 * browser.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500";
const count = new Intl.NumberFormat("en-AE");

export function ExpenseList({
  list,
  filters,
  months,
  projects,
}: {
  list: ExpenseListData;
  filters: ExpenseFilters;
  months: SelectOption[];
  projects: SelectOption[];
}) {
  const filtered = hasFilters(filters);

  let body: ReactNode;
  if (!list.anyExpenses) {
    body = (
      <div className="p-4 sm:p-5">
        <EmptyState
          icon={ReceiptText}
          title="No expenses yet"
          description="Record what the business spends: costs for a client's project, like a contractor or a licence, and running costs like rent, software or fees. They add up here and against revenue above."
          action={<AddExpenseButton />}
        />
      </div>
    );
  } else if (list.total === 0) {
    body = (
      <div className="p-4 sm:p-5">
        <EmptyState
          icon={SearchX}
          title="No matching expenses"
          description={
            filters.q ? (
              <>
                Nothing matches{" "}
                <span className="font-semibold text-ink-700 [overflow-wrap:anywhere]">&ldquo;{filters.q}&rdquo;</span> with
                these filters. Try a word from the description, who was paid or the notes.
              </>
            ) : (
              "No expense matches these filters."
            )
          }
          action={
            <LinkButton href={expensesHref({})} variant="secondary" size="sm">
              Clear filters
            </LinkButton>
          }
        />
      </div>
    );
  } else {
    body = (
      <>
        <div className="hidden xl:block">
          <ExpenseTable rows={list.rows} page={list.page} pageCount={list.pageCount} />
        </div>
        <ul aria-label="Expenses" className="divide-y divide-ink-100 xl:hidden">
          {list.rows.map((row) => (
            <ExpenseCard key={row.id} row={row} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <section id={LIST_ID} aria-labelledby={LIST_HEADING_ID} className="min-w-0">
      <Card padded={false} className="min-w-0">
        <div className="space-y-4 border-b border-ink-100 px-4 pb-4 pt-5 sm:px-5">
          <div className="min-w-0">
            <h2
              id={LIST_HEADING_ID}
              tabIndex={-1}
              className="font-display text-[1.05rem] font-bold text-ink-900 focus:outline-none"
            >
              All expenses
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-ink-550">
              Every cost recorded, newest first. Filter by month, category or project.
            </p>
          </div>

          {list.anyExpenses && (
            <>
              <ExpenseFilterBar filters={filters} months={months} projects={projects} />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {/* Announced when a filter changes the result. */}
                <p aria-live="polite" className="text-[0.8rem] text-ink-550 tabular-nums">
                  <span className="font-semibold text-ink-800">{count.format(list.total)}</span>{" "}
                  {list.total === 1 ? "expense" : "expenses"}
                  {filtered ? (list.total === 1 ? " matches" : " match") : ""} ·{" "}
                  <span className="font-semibold text-ink-800">{formatMoney(list.totalFils)}</span>
                  {list.otherCurrencyCount > 0 && (
                    <span> (plus {count.format(list.otherCurrencyCount)} in other currencies, not included)</span>
                  )}
                </p>
                {filtered && (
                  <Link
                    href={expensesHref({})}
                    className={cn(
                      "rounded text-[0.8rem] font-semibold text-abyss-600 underline underline-offset-2 hover:text-abyss-700",
                      FOCUS_RING,
                    )}
                  >
                    Clear filters
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        <div className="rounded-b-2xl">
          {body}
          <Pagination filters={filters} page={list.page} pageCount={list.pageCount} />
        </div>
      </Card>
    </section>
  );
}

// ─── Project cell ───────────────────────────────────────────────────────────

function ProjectName({ project, compact = false }: { project: ExpenseProject | null; compact?: boolean }) {
  if (!project) return <span className="text-ink-550">Running cost</span>;
  const person = project.person && (
    <span className={cn("block text-ink-550 [overflow-wrap:anywhere]", compact ? "text-[0.74rem]" : "text-[0.76rem]")}>
      {project.person}
    </span>
  );
  if (project.removed) {
    return (
      <span className="min-w-0">
        <span className="text-ink-700 [overflow-wrap:anywhere]">{project.label}</span>{" "}
        <span className="text-ink-550">(removed)</span>
        {person}
      </span>
    );
  }
  return (
    <span className="min-w-0">
      <Link
        href={clientHref(project.id)}
        title="Open in the dashboard's client table"
        className={cn(
          "rounded font-medium text-abyss-600 underline-offset-2 [overflow-wrap:anywhere] hover:underline",
          FOCUS_RING,
        )}
      >
        {project.label}
      </Link>
      {person}
    </span>
  );
}

// ─── Desktop table (xl and up) ──────────────────────────────────────────────

const TH =
  "border-b border-ink-100 px-2.5 py-2.5 text-left align-bottom font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-550";
const TD = "border-b border-ink-100/70 px-2.5 py-3 align-top";

function ExpenseTable({ rows, page, pageCount }: { rows: ExpenseRow[]; page: number; pageCount: number }) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-[0.82rem]">
      <caption className="sr-only">
        Expenses, newest first{pageCount > 1 ? `, page ${page} of ${pageCount}` : ""}.
      </caption>
      <colgroup>
        {/* Sized for the narrowest table (960px, at a 1280px window): the longest
            date ("30 Sept 2026"), the largest storable amount and both icon
            buttons fit unclipped; descriptions, categories and projects wrap. */}
        <col className="w-[12%]" />
        <col className="w-[30%]" />
        <col className="w-[15%]" />
        <col className="w-[18.5%]" />
        <col className="w-[14.5%]" />
        <col className="w-[10%]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn(TH, "pl-4")}>
            Date
          </th>
          <th scope="col" className={TH}>
            Description
          </th>
          <th scope="col" className={TH}>
            Category
          </th>
          <th scope="col" className={TH}>
            Project
          </th>
          <th scope="col" className={cn(TH, "text-right")}>
            Amount
          </th>
          <th scope="col" className={cn(TH, "pr-4 text-right")}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="transition-colors hover:bg-haze/45">
            <td className={cn(TD, "pl-4 whitespace-nowrap text-ink-800")}>
              <time dateTime={row.date}>{row.dateLabel}</time>
            </td>
            <td className={TD}>
              <p className="font-semibold text-ink-900 [overflow-wrap:anywhere]">{row.description}</p>
              {row.vendor && (
                <p className="truncate text-[0.76rem] text-ink-600" title={`Paid to ${row.vendor}`}>
                  <span className="sr-only">Paid to </span>
                  {row.vendor}
                </p>
              )}
              {row.notes && (
                <p className="truncate text-[0.72rem] text-ink-550" title={row.notes}>
                  <span className="sr-only">Notes: </span>
                  {row.notes}
                </p>
              )}
            </td>
            <td className={cn(TD, "text-ink-700 [overflow-wrap:anywhere]")}>{row.categoryLabel}</td>
            <td className={TD}>
              <ProjectName project={row.project} />
            </td>
            <td className={cn(TD, "text-right font-semibold whitespace-nowrap text-ink-900 tabular-nums")}>
              {row.amountLabel}
            </td>
            <td className={cn(TD, "pr-4 py-2.5")}>
              <ExpenseRowActions row={row} layout="icons" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Phone and tablet cards (below xl) ──────────────────────────────────────

function ExpenseCard({ row }: { row: ExpenseRow }) {
  return (
    <li className="min-w-0 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-sans text-[0.92rem] font-semibold tracking-normal text-ink-900 [overflow-wrap:anywhere]">
            {row.description}
          </h3>
          <p className="mt-0.5 text-[0.76rem] text-ink-550">
            <time dateTime={row.date}>{row.dateLabel}</time> · {row.categoryLabel}
          </p>
        </div>
        <p className="shrink-0 text-right text-[0.92rem] font-semibold whitespace-nowrap text-ink-900 tabular-nums">
          {row.amountLabel}
        </p>
      </div>

      <dl className="mt-2.5 grid min-w-0 gap-x-5 gap-y-1.5 text-[0.8rem] sm:grid-cols-2">
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-ink-550">Project:</dt>
          <dd className="min-w-0">
            <ProjectName project={row.project} compact />
          </dd>
        </div>
        {row.vendor && (
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-ink-550">Paid to:</dt>
            <dd className="min-w-0 text-ink-800 [overflow-wrap:anywhere]">{row.vendor}</dd>
          </div>
        )}
      </dl>
      {row.notes && (
        <p
          className="mt-2 line-clamp-2 text-[0.78rem] whitespace-pre-line text-ink-600 [overflow-wrap:anywhere]"
          title={row.notes}
        >
          <span className="sr-only">Notes: </span>
          {row.notes}
        </p>
      )}

      <div className="mt-3">
        <ExpenseRowActions row={row} layout="buttons" />
      </div>
    </li>
  );
}

// ─── Paging ─────────────────────────────────────────────────────────────────

function Pagination({ filters, page, pageCount }: { filters: ExpenseFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const off = cn(buttonClass("secondary", "sm"), "pointer-events-none opacity-50");
  const on = cn(buttonClass("secondary", "sm"), FOCUS_RING);
  const href = (p: number) => expensesHref({ ...filters, page: p });

  return (
    <nav aria-label="Expense pages" className="flex items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 sm:px-5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={on}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={off}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </span>
      )}
      <p className="text-[0.78rem] tabular-nums text-ink-550">
        Page <span className="font-semibold text-ink-800">{page}</span> of{" "}
        <span className="font-semibold text-ink-800">{pageCount}</span>
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={on}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={off}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

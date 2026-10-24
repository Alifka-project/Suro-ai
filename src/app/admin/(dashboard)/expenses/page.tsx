import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader, buttonClass, cn } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { formatMoney } from "@/lib/admin/money";
import { toDateInputValue } from "@/lib/admin/time";
import { ExpensesChart, type ExpensesPoint } from "../_dashboard/charts";
import { CategoryBreakdown } from "./_components/CategoryBreakdown";
import { AddExpenseButton } from "./_components/ExpenseActions";
import { ExpenseList } from "./_components/ExpenseList";
import { ExpensesProvider } from "./_components/ExpensesProvider";
import { SummaryTiles } from "./_components/SummaryTiles";
import { ADD_BUTTON_ID, NO_PROJECT, exportHref, parseExpenseSearch, type SearchParams } from "./_lib/filters";
import { getExpensesPage } from "./_lib/queries";
import type { SelectOption } from "./_lib/types";

export const metadata: Metadata = { title: "Expenses" };

/*
 * What the business spends: costs linked to a client's project (from the
 * dashboard's client table) and running costs. Summary tiles, a monthly chart
 * against revenue collected, a breakdown by category, and the full list with
 * filters, editing and a CSV export.
 *
 * Served at /admin/expenses. URL contract: ?q ?category ?project ?month ?page
 * filter the list (see _lib/filters.ts); ?add=1 opens "Add expense" on load,
 * with ?project=<client id> preselected. The dashboard links here as
 * /admin/expenses?project=<id>&add=1 to add a cost for one client.
 */

// ─── Chart copy (formatted here, on the server, so hydration can't differ) ───

function chartCopy(points: ExpensesPoint[], currency: string) {
  const spent = points.reduce((t, p) => t + p.expensesFils, 0);
  const collected = points.reduce((t, p) => t + p.collectedFils, 0);
  const highest = points.reduce<ExpensesPoint | undefined>(
    (best, p) => (best === undefined || p.expensesFils > best.expensesFils ? p : best),
    undefined,
  );

  const subtitle =
    spent > 0
      ? `${formatMoney(spent, currency)} spent and ${formatMoney(collected, currency)} collected in the last 12 months`
      : collected > 0
        ? `Nothing spent yet · ${formatMoney(collected, currency)} collected in the last 12 months`
        : "Spending and paid invoices, last 12 months";

  const summary = [
    `Columns show what was spent each month and a line shows the money collected from paid invoices, over the last 12 months, in ${currency}.`,
    `Spent: ${formatMoney(spent, currency)} in total.`,
    highest && highest.expensesFils > 0
      ? `Highest spending: ${highest.fullLabel}, ${formatMoney(highest.expensesFils, currency)}.`
      : "",
    `Collected: ${formatMoney(collected, currency)} in total.`,
    "Choose Show table for each month.",
  ]
    .filter(Boolean)
    .join(" ");

  return { subtitle, summary };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The layout checks too, but a layout doesn't re-run on client navigation.
  await requireAdmin();
  const { add, ...filters } = parseExpenseSearch(await searchParams);
  const now = new Date();
  const data = await getExpensesPage(filters, now);
  const { summary } = data;
  const chart = chartCopy(data.monthly, summary.currency);

  // New expenses default to the client the list is filtered to, when that
  // client can still take new costs.
  const presetLeadId =
    filters.project && filters.project !== NO_PROJECT && data.projects.some((p) => p.id === filters.project && !p.removed)
      ? filters.project
      : "";

  const projectFilterOptions: SelectOption[] = data.projects.map((p) => ({
    value: p.id,
    label: p.removed ? `${p.label} (removed)` : p.label,
  }));

  return (
    <ExpensesProvider
      projects={data.projects}
      today={toDateInputValue(now)}
      presetLeadId={presetLeadId}
      openOnLoad={add}
    >
      <PageHeader
        eyebrow="SULOAI"
        title="Expenses"
        description="What the business spends: project costs and running costs, in AED."
        actions={
          <>
            {/* A plain link: the route answers with a file download, not a page. */}
            <a href={exportHref(filters)} className={cn(buttonClass("secondary"), "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500")}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
              <span className="sr-only"> of the expenses matching the current filters</span>
            </a>
            <AddExpenseButton id={ADD_BUTTON_ID} />
          </>
        }
      />

      <div className="space-y-4 lg:space-y-5">
        <SummaryTiles summary={summary} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
          <ExpensesChart
            data={data.monthly}
            currency={summary.currency}
            subtitle={chart.subtitle}
            summary={chart.summary}
          />
          <CategoryBreakdown
            categories={data.categories}
            totalFils={summary.last12Fils}
            currency={summary.currency}
            active={filters.category}
          />
        </div>
      </div>

      <div className="mt-8 lg:mt-10">
        <ExpenseList list={data.list} filters={filters} months={data.months} projects={projectFilterOptions} />
      </div>
    </ExpensesProvider>
  );
}

import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/dal";
import { expenseCategoryLabel } from "@/lib/admin/expenses";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/admin/money";
import { dayKey, toDateInputValue } from "@/lib/admin/time";
import { filsToPlain, number, text, toCsv } from "../_lib/csv";
import { parseExpenseSearch, searchParamsToRecord } from "../_lib/filters";
import { EXPORT_LIMIT, getExpensesForExport, leadLabel } from "../_lib/queries";

/**
 * GET /admin/expenses/export — every expense matching the page's filters
 * (?q ?category ?project ?month; ?page is ignored) as a CSV file, newest
 * first. Authorized like every admin read and never cached, since it carries
 * business figures.
 */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const { q, category, project, month } = parseExpenseSearch(searchParamsToRecord(request.nextUrl.searchParams));
  const { rows, total } = await getExpensesForExport({ q, category, project, month });

  const header = [
    "Date",
    "Description",
    "Paid to",
    "Category",
    "Project",
    "Client",
    `Amount (${DEFAULT_CURRENCY})`,
    "Notes",
    "Recorded by",
  ].map(text);

  const lines = rows.map((e) => {
    const lead = e.lead;
    let client = "";
    if (lead) {
      const company = lead.companyName?.trim();
      client = company && company !== lead.fullName ? `${lead.fullName}, ${company}` : lead.fullName;
      if (lead.removedAt) client += " (removed)";
    }
    // The amount column is AED. An expense in another currency (never created
    // by the admin, but possible in imported data) keeps its amount in the notes.
    const inAed = e.currency === DEFAULT_CURRENCY;
    const notes = inAed
      ? e.notes
      : [`Amount: ${formatMoney(e.amountFils, e.currency)} (not AED)`, e.notes].filter(Boolean).join("\n");
    return [
      text(toDateInputValue(e.date)),
      text(e.description),
      text(e.vendor),
      text(expenseCategoryLabel(e.category)),
      text(lead ? leadLabel(lead).label : "Running cost"),
      text(client),
      inAed ? number(filsToPlain(e.amountFils)) : text(""),
      text(notes),
      text(e.createdBy?.name),
    ];
  });

  if (total > rows.length) {
    lines.push([
      text(
        `# Only the newest ${EXPORT_LIMIT.toLocaleString("en-AE")} of ${total.toLocaleString("en-AE")} matching expenses are included. Narrow the filters (for example by month) to export the rest.`,
      ),
    ]);
  }

  const fileName = `expenses-${dayKey(new Date())}.csv`;
  return new Response(toCsv([header, ...lines]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

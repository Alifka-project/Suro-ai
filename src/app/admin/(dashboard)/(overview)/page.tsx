import type { Metadata } from "next";
import type { LeadStatus } from "@prisma/client";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { LEAD_PIPELINE } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { formatBusinessDate } from "@/lib/admin/time";
import { EngagementChart, RevenueChart } from "../_dashboard/charts";
import { ClientsTable } from "../_dashboard/ClientsTable";
import { getDashboardData } from "../_dashboard/data";
import { Kpis } from "../_dashboard/Kpis";
import type { ClientFilters, EngagementPoint, RevenuePoint } from "../_dashboard/types";

export const metadata: Metadata = { title: "Dashboard" };

/*
 * The admin's one page: five headline figures, two monthly charts and the
 * table of every client who filled in the enquiry form. The CRM, projects,
 * billing lists and full analytics are switched off in src/lib/admin/modules.ts
 * (kept in the codebase, not removed).
 *
 * Served at /admin. It sits in the (overview) route group so its loading.tsx
 * skeleton covers this page only: a loading.tsx directly in (dashboard) would
 * wrap every admin route, and opening a quotation or invoice would flash the
 * dashboard skeleton instead of the billing one.
 */

type SearchParams = Record<string, string | string[] | undefined>;

const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Next's searchParams values can be a string, an array (?a=1&a=2) or absent. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isLeadStatus(value: string | undefined): value is LeadStatus {
  return value !== undefined && (LEAD_PIPELINE as readonly string[]).includes(value);
}

/** Anything malformed in the URL falls back to the default instead of failing the page. */
function parseFilters(sp: SearchParams): ClientFilters {
  const q = (first(sp.q) ?? "").trim().slice(0, 100).trim();
  const status = first(sp.status);
  const page = Number.parseInt(first(sp.page) ?? "", 10);
  const client = first(sp.client)?.trim();
  return {
    q,
    status: isLeadStatus(status) ? status : null,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    focus: client && CLIENT_ID.test(client) ? client : null,
  };
}

// ─── Chart copy (formatted here, on the server, so hydration can't differ) ───

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function peak<T>(items: T[], value: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (best === undefined || value(item) > value(best) ? item : best), undefined);
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-AE")} ${n === 1 ? one : many}`;
}

function revenueCopy(points: RevenuePoint[], currency: string) {
  const collected = sum(points, (p) => p.collectedFils);
  const invoiced = sum(points, (p) => p.invoicedFils);
  const best = peak(points, (p) => p.collectedFils);

  const subtitle =
    collected > 0
      ? `${formatMoney(collected, currency)} collected in the last 12 months`
      : invoiced > 0
        ? `Nothing collected yet · ${formatMoney(invoiced, currency)} invoiced in the last 12 months`
        : "Paid and issued invoices, last 12 months";

  const summary = [
    `Columns show money collected from paid invoices each month and a line shows the amount invoiced, over the last 12 months, in ${currency}.`,
    `Collected: ${formatMoney(collected, currency)} in total.`,
    best && best.collectedFils > 0 ? `Best month: ${best.fullLabel}, ${formatMoney(best.collectedFils, currency)}.` : "",
    `Invoiced: ${formatMoney(invoiced, currency)} in total.`,
    "Choose Show table for each month.",
  ]
    .filter(Boolean)
    .join(" ");

  return { subtitle, summary };
}

/*
 * "Clients added" counts every client created that month, whatever their
 * status now and however they arrived (website form, or added by the team).
 * It is deliberately not called "New enquiries": that is the KPI tile for
 * clients whose status is still New.
 *
 * "Engaged" counts the clients with a team action on their timeline that
 * month. Status changes, quotation changes and invoice payments or voids are
 * recorded there; creating a quotation or invoice, or marking an invoice as
 * sent, is not, so the copy does not claim them.
 */
function engagementCopy(points: EngagementPoint[]) {
  const added = sum(points, (p) => p.enquiries);
  const busiest = peak(points, (p) => p.enquiries);
  const mostEngaged = peak(points, (p) => p.engaged);

  const anyEngaged = points.some((p) => p.engaged > 0);
  const subtitle =
    added === 0 && !anyEngaged
      ? "Clients added and clients engaged, last 12 months"
      : `${added > 0 ? `${plural(added, "client", "clients")} added` : "No clients added"} in the last 12 months. Engaged: clients you worked on that month (a status change, or a quotation or invoice made or updated).`;

  const summary = [
    "Columns show how many clients were added each month, from the website form or by the team. A line shows how many clients were engaged that month: their status or quotation changed, or one of their invoices was paid or voided. Covers the last 12 months.",
    `${plural(added, "client", "clients")} added in total.`,
    busiest && busiest.enquiries > 0
      ? `Busiest month: ${busiest.fullLabel}, with ${plural(busiest.enquiries, "client", "clients")} added.`
      : "",
    mostEngaged && mostEngaged.engaged > 0
      ? `Most clients engaged: ${mostEngaged.fullLabel}, with ${mostEngaged.engaged}.`
      : "No clients engaged yet.",
    "Choose Show table for each month.",
  ]
    .filter(Boolean)
    .join(" ");

  return { subtitle, summary };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The layout checks too, but a layout doesn't re-run on client navigation.
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const data = await getDashboardData(filters);

  const revenue = revenueCopy(data.revenue, data.kpis.currency);
  const engagement = engagementCopy(data.engagement);

  return (
    <>
      <PageHeader
        eyebrow="SULOAI"
        title="Dashboard"
        description={`As of ${formatBusinessDate(data.now)}, Dubai time. Charts cover the last 12 months.`}
      />

      <div className="space-y-4 lg:space-y-5">
        <Kpis kpis={data.kpis} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <RevenueChart
            data={data.revenue}
            currency={data.kpis.currency}
            subtitle={revenue.subtitle}
            summary={revenue.summary}
          />
          <EngagementChart data={data.engagement} subtitle={engagement.subtitle} summary={engagement.summary} />
        </div>
      </div>

      {/* ClientsTable renders the <section id="clients"> itself, with its "Clients"
          heading. No scroll margin here: the global `scroll-padding-top` on
          <html> (globals.css) already keeps a jump to #clients clear of the
          sticky mobile top bar, and a margin would add to it. A focused client
          row lands at the same offset. */}
      <div className="mt-8 lg:mt-10">
        <ClientsTable page={data.clients} filters={filters} now={data.now} />
      </div>
    </>
  );
}

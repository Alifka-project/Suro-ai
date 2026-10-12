import type { Metadata } from "next";
import { Banknote, ChartArea, FilePlus, SquareKanban } from "lucide-react";
import { EmptyState, LinkButton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { formatMoney } from "@/lib/admin/money";
import { formatBusinessDate } from "@/lib/admin/time";
import { ChartCard } from "../_analytics/ChartCard";
import { LeadsTrendChart, RevenueChart } from "../_analytics/charts";
import { getOverviewData } from "../_analytics/data";
import { businessYear } from "../_analytics/dates";
import { Kpis } from "../_analytics/Kpis";
import { ActiveProjects, AgreementsPanel, AttentionInvoices, OverdueFollowUps, RecentLeads } from "../_analytics/lists";
import { MiniTable } from "../_analytics/MiniTable";
import { PipelineBreakdown } from "../_analytics/PipelineBreakdown";
import { ServicesBars } from "../_analytics/ServicesBars";

export const metadata: Metadata = { title: "Overview" };

export default async function AnalyticsOverviewPage() {
  // The layout checks too, but a layout doesn't re-run on client navigation.
  await requireAdmin();
  const data = await getOverviewData();
  const { kpis, currency, weeklyLeads, monthlyRevenue, pipeline } = data;

  const leadsInRange = weeklyLeads.reduce((s, w) => s + w.count, 0);
  const revenueInRange = monthlyRevenue.reduce((s, m) => s + m.fils, 0);
  const busiestWeek = weeklyLeads.reduce((best, w) => (w.count > best.count ? w : best), weeklyLeads[0]);

  const leadsSubtitle =
    leadsInRange > 0
      ? `${leadsInRange} ${leadsInRange === 1 ? "lead" : "leads"} in the last 12 weeks`
      : "Last 12 weeks";
  const leadsSummary =
    `${leadsInRange} leads in the last 12 weeks. ` +
    (leadsInRange > 0 ? `Busiest week: ${busiestWeek.range}, with ${busiestWeek.count}.` : "");

  const revenueSubtitle =
    revenueInRange > 0
      ? `${formatMoney(revenueInRange, currency)} from paid invoices in the last 6 months`
      : `Paid invoices by payment date, ${currency}`;
  const revenueSummary = `${formatMoney(revenueInRange, currency)} collected over the last 6 months.`;

  const closed = pipeline.won + pipeline.lost;
  const pipelineFootnote =
    closed > 0
      ? `Win rate ${Math.round((pipeline.won / closed) * 100)}% · ${pipeline.won} of ${closed} closed ${
          closed === 1 ? "deal" : "deals"
        } won, ${pipeline.lost} lost`
      : "Win rate appears once a deal is marked won or lost.";

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Overview"
        description={`Snapshot as of ${formatBusinessDate(data.now)}. Trends cover the last 12 weeks and 6 months.`}
        actions={
          <>
            <LinkButton href="/admin/crm/pipeline" variant="secondary">
              <SquareKanban className="h-4 w-4" aria-hidden="true" />
              Open pipeline
            </LinkButton>
            <LinkButton href="/admin/billing/quotes/new">
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              New quote
            </LinkButton>
          </>
        }
      />

      <div className="space-y-4 lg:space-y-5">
        <Kpis kpis={kpis} currency={currency} year={businessYear(data.now)} />

        {data.otherCurrencyInvoices > 0 && (
          <p className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-[0.78rem] text-ink-500">
            Money totals are in {currency}. {data.otherCurrencyInvoices}{" "}
            {data.otherCurrencyInvoices === 1 ? "invoice" : "invoices"} in other currencies{" "}
            {data.otherCurrencyInvoices === 1 ? "is" : "are"} left out of them.
          </p>
        )}

        <div className="grid gap-4 lg:gap-5 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="New leads per week"
            subtitle={leadsSubtitle}
            table={
              leadsInRange > 0 ? (
                <MiniTable
                  caption="New leads per week, last 12 weeks"
                  columns={["Week", "Leads"]}
                  rows={[...weeklyLeads].reverse().map((w) => ({
                    key: w.key,
                    label: w.range,
                    value: w.count,
                    muted: w.count === 0,
                  }))}
                />
              ) : undefined
            }
          >
            {leadsInRange > 0 ? (
              <LeadsTrendChart data={weeklyLeads} summary={leadsSummary} />
            ) : (
              <EmptyState
                icon={ChartArea}
                title="No leads in the last 12 weeks"
                description="New enquiries from the website form will be charted here week by week."
              />
            )}
          </ChartCard>

          <PipelineBreakdown stages={pipeline.stages} totalLeads={pipeline.totalLeads} footnote={pipelineFootnote} />
        </div>

        {/* What to act on next: follow-ups that slipped, paperwork waiting on the client. */}
        <div className="grid gap-4 lg:gap-5 lg:grid-cols-2">
          <OverdueFollowUps
            items={data.followUps.items}
            overdueTotal={data.followUps.overdueTotal}
            dueToday={data.followUps.dueToday}
          />
          <AgreementsPanel
            counts={data.agreements.counts}
            total={data.agreements.total}
            awaiting={data.agreements.awaiting}
            awaitingTotal={data.agreements.awaitingTotal}
          />
        </div>

        <div className="grid gap-4 lg:gap-5 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Revenue collected per month"
            subtitle={revenueSubtitle}
            table={
              revenueInRange > 0 ? (
                <MiniTable
                  caption={`Revenue collected per month, last 6 months, ${currency}`}
                  columns={["Month", "Collected"]}
                  rows={[...monthlyRevenue].reverse().map((m) => ({
                    key: m.key,
                    label: m.fullLabel,
                    value: formatMoney(m.fils, currency),
                    muted: m.fils === 0,
                  }))}
                />
              ) : undefined
            }
          >
            {revenueInRange > 0 ? (
              <RevenueChart data={monthlyRevenue} currency={currency} summary={revenueSummary} />
            ) : (
              <EmptyState
                icon={Banknote}
                // Scoped to the chart's window: payments earlier in the year can
                // still count toward the "Collected in <year>" tile above.
                title="No payments in the last 6 months"
                description="Invoices marked as paid will be charted here by payment date."
                action={
                  <LinkButton href="/admin/billing?tab=invoices" variant="secondary" size="sm">
                    Go to invoices
                  </LinkButton>
                }
              />
            )}
          </ChartCard>

          <ServicesBars items={data.services.items} totalLeads={data.services.totalLeads} />
        </div>

        <div className="grid gap-4 lg:gap-5 lg:grid-cols-2">
          <RecentLeads leads={data.recentLeads} />
          <AttentionInvoices
            invoices={data.attention.items}
            total={data.attention.total}
            overdueTotal={data.attention.overdueTotal}
          />
        </div>

        <ActiveProjects projects={data.activeProjects.items} total={data.activeProjects.total} />
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { LinkButton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { crmHref, firstParam } from "../_lib/helpers";
import { CrmTabs } from "../_components/CrmTabs";
import { ACTIVITY_LEGEND } from "./_components/ActivityIndicator";
import { NewOpportunityButton, PipelineProvider } from "./_components/composer";
import { PipelineBoard } from "./_components/PipelineBoard";
import { PipelineFilters } from "./_components/PipelineFilters";
import { SummaryStrip } from "./_components/SummaryStrip";
import { CARDS_PER_COLUMN, getPipelineData } from "./_lib/data";
import { isActivityFilter, pipelineHref, type PipelineFilters as Filters } from "./_lib/filters";

export const metadata: Metadata = { title: "Pipeline" };

/**
 * The CRM pipeline, Odoo-style: one kanban column per stage, a card per
 * opportunity. Drag a card (or use its Move menu) to change stage; dropping
 * it on Won runs the deal automation, which accepts or creates the quotation
 * and generates the service agreement. Lost opportunities leave the board and
 * are listed under Leads.
 */
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const now = new Date();

  const rawActivity = firstParam(sp.activity);
  const requested: Filters = {
    q: (firstParam(sp.q) ?? "").trim().slice(0, 100),
    owner: (firstParam(sp.owner) ?? "").trim().slice(0, 64),
    activity: isActivityFilter(rawActivity) ? rawActivity : null,
  };

  const data = await getPipelineData(requested, admin, now);
  // The owner filter as applied: an unknown or inactive admin id falls back to everyone.
  const filters: Filters = { ...requested, owner: data.owner };
  const filtered = Boolean(filters.q || filters.owner || filters.activity);
  const capped = data.columns.some((c) => c.total > CARDS_PER_COLUMN);

  return (
    <PipelineProvider initialStage={firstParam(sp.new) === "1" ? "NEW" : null}>
      <CrmTabs active="pipeline" overdueActivities={data.overdueAll} />
      <PageHeader
        eyebrow="CRM"
        title="Pipeline"
        description="Track every client from first contact to signed deal. Winning a deal generates its quotation and service agreement."
        actions={
          <>
            <LinkButton href={crmHref({ status: "LOST", q: filters.q })} variant="secondary">
              <Archive className="h-4 w-4" aria-hidden="true" />
              Lost
              <span className="rounded-full bg-ink-100 px-1.5 text-[0.7rem] font-bold tabular-nums text-ink-600">
                {data.lostCount}
              </span>
              <span className="sr-only">opportunities</span>
            </LinkButton>
            <NewOpportunityButton />
          </>
        }
      />

      <SummaryStrip
        summary={data.summary}
        overdueHref={pipelineHref({ ...filters, activity: "overdue" })}
        filtered={filtered}
      />

      <PipelineFilters filters={filters} team={data.team} meId={admin.id} />

      <div className="mb-3 flex flex-col gap-2 text-[0.74rem] text-ink-550 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Drag cards between stages, or use <span className="font-semibold text-ink-700">Move</span> on a card.
          {capped && ` Busy stages show their first ${CARDS_PER_COLUMN} cards.`}
        </p>
        <ul aria-label="Activity colours" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ACTIVITY_LEGEND.map(({ key, label, dot }) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <PipelineBoard columns={data.columns} q={filters.q} />
    </PipelineProvider>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { Inbox, Plus, SearchX, SquareKanban } from "lucide-react";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { db } from "@/lib/db";
import { CrmTabs } from "./_components/CrmTabs";
import { LeadTable } from "./_components/LeadTable";
import { Pagination, SearchForm, StatusChips } from "./_components/Toolbar";
import { crmHref, firstParam, isLeadStatus, leadSearchWhere, plural } from "./_lib/helpers";
import { leadListSelect } from "./_lib/select";
import { pipelineHref } from "./pipeline/_lib/filters";
import { countOverdueActivities } from "./pipeline/_lib/data";

export const metadata: Metadata = { title: "Leads" };

const PAGE_SIZE = 25;

const newestFirst: Prisma.LeadOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

/**
 * The Leads list: every opportunity in one searchable table, Lost included
 * (the pipeline board leaves them out). The kanban lives at /admin/crm/pipeline.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  // The board used to live here as ?view=board; old links go to the pipeline.
  if (firstParam(sp.view) === "board") redirect(pipelineHref({ q }));

  const rawStatus = firstParam(sp.status);
  const status = isLeadStatus(rawStatus) ? rawStatus : null;
  const requestedPage = Math.max(1, Number.parseInt(firstParam(sp.page) ?? "1", 10) || 1);
  const searchWhere = leadSearchWhere(q);
  const now = new Date();

  const [totalLeads, newLeads, grouped, overdueActivities] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
    // Chip counts follow the search but not the stage filter, so every chip
    // says how many results clicking it would show.
    db.lead.groupBy({ by: ["status"], where: searchWhere, _count: { _all: true } }),
    countOverdueActivities(now),
  ]);

  const countByStatus = new Map<string, number>(grouped.map((g) => [g.status, g._count._all]));
  const matchingAll = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const matching = status ? (countByStatus.get(status) ?? 0) : matchingAll;

  const pageCount = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  let content: ReactNode;

  if (totalLeads === 0) {
    content = (
      <EmptyState
        icon={Inbox}
        title="No leads yet"
        description="Enquiries from the website contact form land here automatically, and you get an email for each one. Clients you approach yourself can be added on the pipeline."
        action={
          <LinkButton href="/admin/crm/pipeline?new=1" size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New opportunity
          </LinkButton>
        }
      />
    );
  } else if (matching === 0) {
    content = (
      <EmptyState
        icon={SearchX}
        // The query goes in the description, not the title: a long pasted email
        // has no break points and would push the page wider than a phone screen.
        title={q ? "No matching leads" : `No ${LEAD_STATUS[status ?? "NEW"].label.toLowerCase()} leads`}
        description={
          q ? (
            <>
              Nothing matches{" "}
              <span className="font-semibold text-ink-700 [overflow-wrap:anywhere]">&ldquo;{q}&rdquo;</span>
              {status ? ` in ${LEAD_STATUS[status].label}` : ""}. Try a different name, company or email address.
            </>
          ) : (
            "Nothing is at this stage of the pipeline right now."
          )
        }
        action={
          <LinkButton href={crmHref({})} variant="secondary" size="sm">
            Clear filters
          </LinkButton>
        }
      />
    );
  } else {
    const leads = await db.lead.findMany({
      where: status ? { AND: [searchWhere, { status }] } : searchWhere,
      orderBy: newestFirst,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: leadListSelect,
    });
    content = (
      <Card padded={false}>
        <LeadTable leads={leads} now={now} />
        <Pagination
          page={page}
          pageCount={pageCount}
          total={matching}
          pageSize={PAGE_SIZE}
          hrefFor={(p) => crmHref({ status, q, page: p })}
        />
      </Card>
    );
  }

  return (
    <>
      <CrmTabs active="leads" overdueActivities={overdueActivities} />
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description={
          <>
            {plural(totalLeads, "lead")}
            {newLeads > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-abyss-600">{newLeads} new</span>
              </>
            )}
          </>
        }
        actions={
          <>
            <LinkButton href={pipelineHref({ q })} variant="secondary">
              <SquareKanban className="h-4 w-4" aria-hidden="true" />
              Pipeline
            </LinkButton>
            <LinkButton href="/admin/crm/pipeline?new=1">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New opportunity
            </LinkButton>
          </>
        }
      />

      {totalLeads > 0 && (
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:order-last xl:w-80 xl:shrink-0">
            <SearchForm q={q} status={status} />
          </div>
          <StatusChips active={status} counts={countByStatus} total={matchingAll} q={q} />
        </div>
      )}

      {content}
    </>
  );
}

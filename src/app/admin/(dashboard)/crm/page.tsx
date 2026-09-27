import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { Inbox, SearchX } from "lucide-react";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { LEAD_PIPELINE, LEAD_STATUS } from "@/lib/admin/labels";
import { db } from "@/lib/db";
import { LeadBoard, type BoardColumn } from "./_components/LeadBoard";
import { LeadTable } from "./_components/LeadTable";
import { Pagination, SearchForm, StatusChips, ViewToggle } from "./_components/Toolbar";
import { crmHref, firstParam, isLeadStatus, plural, type CrmView } from "./_lib/helpers";
import { leadListSelect } from "./_lib/select";

export const metadata: Metadata = { title: "CRM" };

const PAGE_SIZE = 25;
/** Cards per board lane; the rest are one click away in the filtered table. */
const BOARD_LANE_LIMIT = 50;

const newestFirst: Prisma.LeadOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const view: CrmView = firstParam(sp.view) === "board" ? "board" : "table";
  const rawStatus = firstParam(sp.status);
  // The board shows every stage side by side, so a stage filter only applies to the table.
  const status = view === "table" && isLeadStatus(rawStatus) ? rawStatus : null;
  const requestedPage = Math.max(1, Number.parseInt(firstParam(sp.page) ?? "1", 10) || 1);

  // Prisma's `contains` becomes ILIKE '%…%' without escaping, so "%" and "_"
  // in the query would act as wildcards ("_" alone matched every lead).
  // Backslash is Postgres's default LIKE escape character.
  const term = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const searchWhere: Prisma.LeadWhereInput = q
    ? {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { companyName: { contains: term, mode: "insensitive" } },
        ],
      }
    : {};

  const [totalLeads, newLeads, grouped] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
    // Chip counts follow the search but not the stage filter, so every chip
    // says how many results clicking it would show.
    db.lead.groupBy({
      by: ["status"],
      where: searchWhere,
      _count: { _all: true },
      _sum: { estimatedValueFils: true },
    }),
  ]);

  const countByStatus = new Map<string, number>(grouped.map((g) => [g.status, g._count._all]));
  const valueByStatus = new Map<string, number>(grouped.map((g) => [g.status, g._sum.estimatedValueFils ?? 0]));
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
        description="Enquiries from the website contact form land here automatically, and you get an email for each one."
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
              {status ? ` in ${LEAD_STATUS[status].label}` : ""}. Try a different name, email address or company.
            </>
          ) : (
            "Nothing is at this stage of the pipeline right now."
          )
        }
        action={
          <LinkButton href={crmHref({ view })} variant="secondary" size="sm">
            Clear filters
          </LinkButton>
        }
      />
    );
  } else if (view === "board") {
    const lanes = await Promise.all(
      LEAD_PIPELINE.map((s) =>
        db.lead.findMany({
          where: { AND: [searchWhere, { status: s }] },
          orderBy: newestFirst,
          take: BOARD_LANE_LIMIT,
          select: leadListSelect,
        }),
      ),
    );
    const columns: BoardColumn[] = LEAD_PIPELINE.map((s, i) => ({
      status: s,
      count: countByStatus.get(s) ?? 0,
      valueFils: valueByStatus.get(s) ?? 0,
      leads: lanes[i],
    }));
    content = <LeadBoard columns={columns} q={q} />;
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
        <LeadTable leads={leads} />
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
      <PageHeader
        eyebrow="Pipeline"
        title="CRM"
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
        actions={totalLeads > 0 ? <ViewToggle view={view} q={q} status={status} /> : undefined}
      />

      {totalLeads > 0 && (
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:order-last xl:w-80 xl:shrink-0">
            <SearchForm q={q} view={view} status={status} />
          </div>
          {view === "table" ? (
            <StatusChips active={status} counts={countByStatus} total={matchingAll} q={q} />
          ) : (
            <p className="text-[0.8rem] text-ink-500">
              {q ? (
                <>
                  {plural(matchingAll, "lead")} matching{" "}
                  <span className="font-semibold text-ink-700 [overflow-wrap:anywhere]">&ldquo;{q}&rdquo;</span>
                </>
              ) : (
                "Every stage of the pipeline, newest leads first."
              )}
            </p>
          )}
        </div>
      )}

      {content}
    </>
  );
}

import "server-only";
import type { Prisma } from "@prisma/client";
import type { AdminSession } from "@/lib/admin/dal";
import { AGREEMENT_STATUS } from "@/lib/admin/agreement-terms";
import { LEAD_STATUS } from "@/lib/admin/labels";
import {
  BOARD_STAGES,
  OPEN_STAGES,
  clampPriority,
  leadTitle,
  weightedRevenueFils,
  type BoardStage,
} from "@/lib/admin/pipeline";
import { BUSINESS_TIME_ZONE, DAY_MS, calendarDay, startOfBusinessDay } from "@/lib/admin/time";
import { db } from "@/lib/db";
import { describeActivity, leadSearchWhere, sourceLabel } from "../../_lib/helpers";
import { pipelineCardSelect, type PipelineLead } from "../../_lib/select";
import type { PipelineCard, PipelineColumnData } from "./board";
import { OWNER_ME, OWNER_UNASSIGNED, type PipelineFilters } from "./filters";

/** Cards loaded per column. The header still counts and sums the whole stage. */
export const CARDS_PER_COLUMN = 60;

/**
 * Open activities due before today (Dubai), on opportunities still in play —
 * the badge on the Activities tab. Lost opportunities' leftovers don't count.
 */
export function countOverdueActivities(now: Date = new Date()): Promise<number> {
  return db.activity.count({
    where: { doneAt: null, dueDate: { lt: startOfBusinessDay(now) }, lead: { status: { not: "LOST" } } },
  });
}

/** 00:00 Dubai on the 1st of the current business month. */
function startOfBusinessMonth(now: Date): Date {
  const { year, month } = calendarDay(now);
  return startOfBusinessDay(new Date(Date.UTC(year, month, 1, 12)));
}

const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, month: "long" });

export type PipelineSummary = {
  openCount: number;
  openExpectedFils: number;
  weightedFils: number;
  overdueActivities: number;
  wonThisMonth: { count: number; valueFils: number; monthLabel: string };
};

export type PipelineData = {
  team: { id: string; name: string }[];
  /** The owner filter actually applied ("" when the requested one was unknown). */
  owner: string;
  columns: PipelineColumnData[];
  lostCount: number;
  summary: PipelineSummary;
  /** Unfiltered, for the CRM tab badge. */
  overdueAll: number;
};

export async function getPipelineData(
  filters: PipelineFilters,
  admin: AdminSession,
  now: Date,
): Promise<PipelineData> {
  const todayStart = startOfBusinessDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

  const team = await db.adminUser.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let owner = filters.owner;
  let ownerWhere: Prisma.LeadWhereInput = {};
  if (owner === OWNER_ME) ownerWhere = { ownerId: admin.id };
  else if (owner === OWNER_UNASSIGNED) ownerWhere = { ownerId: null };
  else if (owner && team.some((m) => m.id === owner)) ownerWhere = { ownerId: owner };
  else owner = "";

  const activityWhere: Prisma.LeadWhereInput =
    filters.activity === "overdue"
      ? { activities: { some: { doneAt: null, dueDate: { lt: todayStart } } } }
      : filters.activity === "today"
        ? { activities: { some: { doneAt: null, dueDate: { gte: todayStart, lt: tomorrowStart } } } }
        : filters.activity === "none"
          ? { activities: { none: { doneAt: null } } }
          : {};

  const filterWhere: Prisma.LeadWhereInput = { AND: [leadSearchWhere(filters.q), ownerWhere, activityWhere] };
  const onBoard: Prisma.LeadWhereInput = { AND: [filterWhere, { status: { in: [...BOARD_STAGES] } }] };

  const [lanes, grouped, openRows, overdueActivities, wonThisMonth, overdueAll] = await Promise.all([
    Promise.all(
      BOARD_STAGES.map((status) =>
        db.lead.findMany({
          where: { AND: [filterWhere, { status }] },
          // Same order the server rebalances a column in (crm/actions.ts).
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
          // One past the cap: its id anchors drops below the last card shown.
          take: CARDS_PER_COLUMN + 1,
          select: pipelineCardSelect,
        }),
      ),
    ),
    db.lead.groupBy({
      by: ["status"],
      where: filterWhere,
      _count: { _all: true },
      _sum: { estimatedValueFils: true },
    }),
    db.lead.findMany({
      where: { AND: [filterWhere, { status: { in: [...OPEN_STAGES] } }] },
      select: { status: true, probability: true, estimatedValueFils: true },
    }),
    db.activity.count({ where: { doneAt: null, dueDate: { lt: todayStart }, lead: onBoard } }),
    db.lead.aggregate({
      where: { AND: [filterWhere, { status: "WON", wonAt: { gte: startOfBusinessMonth(now) } }] },
      _count: { _all: true },
      _sum: { estimatedValueFils: true },
    }),
    countOverdueActivities(now),
  ]);

  const byStatus = new Map(grouped.map((g) => [g.status, g]));

  const columns: PipelineColumnData[] = BOARD_STAGES.map((stage, i) => ({
    stage,
    label: LEAD_STATUS[stage].label,
    tone: LEAD_STATUS[stage].tone,
    total: byStatus.get(stage)?._count._all ?? 0,
    totalValueFils: byStatus.get(stage)?._sum.estimatedValueFils ?? 0,
    cards: lanes[i].slice(0, CARDS_PER_COLUMN).map((lead) => toCard(lead, stage, now)),
    firstHiddenId: lanes[i][CARDS_PER_COLUMN]?.id ?? null,
  }));

  return {
    team,
    owner,
    columns,
    lostCount: byStatus.get("LOST")?._count._all ?? 0,
    summary: {
      openCount: openRows.length,
      openExpectedFils: openRows.reduce((sum, l) => sum + (l.estimatedValueFils ?? 0), 0),
      weightedFils: openRows.reduce((sum, l) => sum + weightedRevenueFils(l), 0),
      overdueActivities,
      wonThisMonth: {
        count: wonThisMonth._count._all,
        valueFils: wonThisMonth._sum.estimatedValueFils ?? 0,
        monthLabel: monthName.format(now),
      },
    },
    overdueAll,
  };
}

function toCard(lead: PipelineLead, stage: BoardStage, now: Date): PipelineCard {
  const title = leadTitle(lead);
  const subtitle =
    [lead.companyName, lead.fullName]
      .map((s) => s?.trim())
      .filter((s): s is string => !!s && s !== title)
      .join(" · ") || null;
  const next = lead.activities[0];
  const agreement = stage === "WON" ? lead.agreements[0] : undefined;

  return {
    id: lead.id,
    stage,
    title,
    subtitle,
    valueFils: lead.estimatedValueFils,
    priority: clampPriority(lead.priority),
    tags: lead.tags,
    source: lead.source,
    sourceLabel: sourceLabel(lead.source),
    owner: lead.owner,
    activity: next ? { ...describeActivity(next, now), openCount: lead._count.activities } : null,
    agreement: agreement
      ? { id: agreement.id, number: agreement.number, statusLabel: AGREEMENT_STATUS[agreement.status].label }
      : null,
  };
}

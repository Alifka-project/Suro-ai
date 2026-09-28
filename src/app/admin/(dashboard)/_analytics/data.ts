import "server-only";
import type { ActivityType, AgreementStatus, LeadStatus, Prisma, ProjectStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AGREEMENT_STATUS, AGREEMENT_STATUS_ORDER } from "@/lib/admin/agreement-terms";
import { requireAdmin } from "@/lib/admin/dal";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import { DEFAULT_CURRENCY, documentTotals, formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { LEAD_STATUS, TONE_DOT, type Tone } from "@/lib/admin/labels";
import { BOARD_STAGES, OPEN_STAGES, leadTitle, weightedRevenueFils } from "@/lib/admin/pipeline";
import {
  BUSINESS_TIME_ZONE,
  calendarDaysBetween,
  dayKey,
  daysFromToday,
  dueHint,
  isPastDay,
  startOfBusinessDay,
} from "@/lib/admin/time";
import {
  addDays,
  addMonths,
  bucketIndex,
  earliest,
  isoMonth,
  sameMonth,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "./dates";

/* Everything the overview renders, computed in one pass on the server. The
   shapes that cross into client components hold only strings and numbers, and
   any text a client component shows on first paint is pre-formatted here, so
   server and browser ICU data can never disagree during hydration. */

const ACTIVE_PROJECT_STATUSES = ["PLANNING", "IN_PROGRESS", "REVIEW"] as const satisfies readonly ProjectStatus[];

const WEEKS = 12;
const MONTHS = 6;
const RECENT_LEADS = 6;
const ATTENTION_LIMIT = 6;
const ATTENTION_WINDOW_DAYS = 7;
const PROJECT_LIMIT = 6;
const FOLLOW_UP_LIMIT = 6;
const AGREEMENT_LIMIT = 5;
/** A sent agreement unsigned for longer than this is flagged for a chase-up. */
const SIGNATURE_CHASE_DAYS = 7;

export type WeeklyLeadsPoint = {
  key: string;
  /** Axis label: week start, e.g. "14 Sep". */
  label: string;
  /** Tooltip / table label, e.g. "14–20 Sep". */
  range: string;
  count: number;
};

export type MonthlyRevenuePoint = {
  key: string;
  /** Axis label, e.g. "Sep". */
  label: string;
  /** Tooltip / table label, e.g. "September 2026 (to date)". */
  fullLabel: string;
  fils: number;
};

export type PipelineStage = {
  status: string;
  label: string;
  /** Tailwind class for the stage dot, from the LEAD_STATUS tone. */
  dotClass: string;
  count: number;
  valueFils: number;
  valueCompact: string;
  valueFull: string;
};

export type ServiceCount = { service: string; count: number };

export type RecentLead = {
  id: string;
  /** Opportunity title, else company, else contact (leadTitle). */
  title: string;
  name: string;
  company: string | null;
  isIndividual: boolean;
  status: LeadStatus;
  createdAt: Date;
};

export type AttentionInvoice = {
  id: string;
  number: string;
  client: string;
  totalFils: number;
  currency: string;
  dueDate: Date;
  overdue: boolean;
  /** "3 days overdue", "Due tomorrow": counted in business-clock calendar days. */
  dueLabel: string;
};

export type ActiveProject = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  dueDate: Date | null;
  overdue: boolean;
  doneTasks: number;
  totalTasks: number;
};

/** An open activity past its due day, on an opportunity that isn't lost. */
export type OverdueFollowUp = {
  id: string;
  leadId: string;
  /** leadTitle of the opportunity. */
  lead: string;
  summary: string;
  type: ActivityType;
  dueDate: Date;
  /** "3 days overdue", counted in business-clock calendar days. */
  dueLabel: string;
  assignee: string | null;
};

/** A service agreement sent to the client and not yet signed. */
export type AwaitingAgreement = {
  id: string;
  number: string;
  client: string;
  projectName: string;
  totalFils: number;
  currency: string;
  sentAt: Date;
  /** "Sent today", "Sent 5 days ago". */
  waitingLabel: string;
  /** Unsigned for more than SIGNATURE_CHASE_DAYS. */
  stale: boolean;
};

export type AgreementStatusCount = { status: AgreementStatus; label: string; tone: Tone; count: number };

export type OverviewData = {
  now: Date;
  currency: string;
  kpis: {
    newLeads30: number;
    newLeadsPrior30: number;
    openPipelineFils: number;
    /** Expected revenue × win probability over open opportunities. */
    weightedPipelineFils: number;
    openLeads: number;
    openLeadsUnvalued: number;
    wonMonthCount: number;
    /** Expected revenue of the deals won this business-clock month. */
    wonMonthFils: number;
    /** "September". */
    monthName: string;
    revenueYtdFils: number;
    revenue30Fils: number;
    paidYtdCount: number;
    outstandingFils: number;
    outstandingCount: number;
    overdueFils: number;
    overdueCount: number;
  };
  weeklyLeads: WeeklyLeadsPoint[];
  monthlyRevenue: MonthlyRevenuePoint[];
  pipeline: {
    /** Board stages only (New … Won): lost opportunities are out of the pipeline. */
    stages: PipelineStage[];
    totalLeads: number;
    won: number;
    lost: number;
  };
  services: {
    items: ServiceCount[];
    totalLeads: number;
  };
  recentLeads: RecentLead[];
  attention: { items: AttentionInvoice[]; total: number; overdueTotal: number };
  followUps: { items: OverdueFollowUp[]; overdueTotal: number; dueToday: number };
  agreements: {
    counts: AgreementStatusCount[];
    total: number;
    awaiting: AwaitingAgreement[];
    awaitingTotal: number;
  };
  activeProjects: { items: ActiveProject[]; total: number };
  /** Invoices in a currency other than the dashboard's, left out of the money totals. */
  otherCurrencyInvoices: number;
};

// Chart axis and range labels, formatted on the same business clock the
// buckets are cut on. Printed dates use formatBusinessDate() from time.ts.
const timeZone = BUSINESS_TIME_ZONE;
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });
const dayOnly = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-GB", { timeZone, month: "short" });
const monthLong = new Intl.DateTimeFormat("en-GB", { timeZone, month: "long", year: "numeric" });
const monthName = new Intl.DateTimeFormat("en-GB", { timeZone, month: "long" });

function waitingLabel(sentAt: Date, now: Date): string {
  const days = calendarDaysBetween(sentAt, now);
  if (days <= 0) return "Sent today";
  if (days === 1) return "Sent yesterday";
  return `Sent ${days} days ago`;
}

function weekRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  return sameMonth(start, end)
    ? `${dayOnly.format(start)}–${dayMonth.format(end)}`
    : `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

export async function getOverviewData(): Promise<OverviewData> {
  // Defence in depth: the page checks too, and cache() makes this free.
  await requireAdmin();

  const now = new Date();
  const currency = DEFAULT_CURRENCY;

  const days30Ago = addDays(now, -30);
  const days60Ago = addDays(now, -60);
  const thisWeek = startOfWeek(now);
  const firstWeek = addDays(thisWeek, -7 * (WEEKS - 1));
  const thisMonth = startOfMonth(now);
  const nextMonth = addMonths(now, 1);
  const firstMonth = addMonths(thisMonth, -(MONTHS - 1));
  const yearStart = startOfYear(now);
  const startOfToday = startOfBusinessDay(now);

  // Same rule as the sidebar badge and the Activities planner: open, due
  // before today began on the business clock, opportunity still in play.
  const overdueActivityWhere: Prisma.ActivityWhereInput = {
    doneAt: null,
    dueDate: { lt: startOfToday },
    lead: { status: { not: "LOST" } },
  };

  const leadsSince = earliest(firstWeek, days60Ago);
  const paidSince = earliest(firstMonth, yearStart, days30Ago);

  const [
    recentLeadDates,
    stageGroups,
    openLeadsUnvalued,
    serviceRows,
    recentLeadRows,
    invoiceRows,
    projectRows,
    activeProjectCount,
    openLeadRows,
    wonThisMonth,
    overdueActivityRows,
    overdueActivityCount,
    dueTodayCount,
    agreementGroups,
    awaitingRows,
  ] = await Promise.all([
    db.lead.findMany({
      where: { createdAt: { gte: leadsSince } },
      select: { createdAt: true },
    }),
    db.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { estimatedValueFils: true },
    }),
    db.lead.count({
      where: { status: { in: [...OPEN_STAGES] }, estimatedValueFils: null },
    }),
    db.lead.findMany({ select: { services: true } }),
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_LEADS,
      select: {
        id: true,
        title: true,
        fullName: true,
        companyName: true,
        clientType: true,
        status: true,
        createdAt: true,
      },
    }),
    db.invoice.findMany({
      where: {
        OR: [
          { status: { in: ["SENT", "OVERDUE"] } },
          { status: "PAID", paidAt: { gte: paidSince } },
        ],
      },
      select: {
        id: true,
        number: true,
        status: true,
        dueDate: true,
        paidAt: true,
        currency: true,
        vatBps: true,
        clientName: true,
        clientCompany: true,
        items: { select: { quantity: true, unitPriceFils: true } },
      },
    }),
    db.project.findMany({
      where: { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: PROJECT_LIMIT,
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        lead: { select: { fullName: true, companyName: true } },
      },
    }),
    db.project.count({ where: { status: { in: [...ACTIVE_PROJECT_STATUSES] } } }),
    // Per-lead rows: the weighted figure needs each opportunity's own probability.
    db.lead.findMany({
      where: { status: { in: [...OPEN_STAGES] } },
      select: { status: true, probability: true, estimatedValueFils: true },
    }),
    db.lead.aggregate({
      where: { status: "WON", wonAt: { gte: thisMonth, lt: nextMonth } },
      _count: { _all: true },
      _sum: { estimatedValueFils: true },
    }),
    db.activity.findMany({
      where: overdueActivityWhere,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: FOLLOW_UP_LIMIT,
      select: {
        id: true,
        type: true,
        summary: true,
        dueDate: true,
        leadId: true,
        lead: { select: { title: true, companyName: true, fullName: true } },
        assignee: { select: { name: true } },
      },
    }),
    db.activity.count({ where: overdueActivityWhere }),
    db.activity.count({
      where: {
        doneAt: null,
        dueDate: { gte: startOfToday, lt: addDays(startOfToday, 1) },
        lead: { status: { not: "LOST" } },
      },
    }),
    db.agreement.groupBy({ by: ["status"], _count: { _all: true } }),
    // Longest-waiting first: those are the ones to chase.
    db.agreement.findMany({
      where: { status: "SENT" },
      orderBy: [{ sentAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      take: AGREEMENT_LIMIT,
      select: {
        id: true,
        number: true,
        clientName: true,
        clientCompany: true,
        projectName: true,
        totalFils: true,
        currency: true,
        sentAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const taskGroups =
    projectRows.length > 0
      ? await db.task.groupBy({
          by: ["projectId", "status"],
          where: { projectId: { in: projectRows.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [];

  // ── Leads: 30-day KPI and the 12-week trend ─────────────────────────────
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDays(firstWeek, 7 * i));
  const weekStartTimes = weekStarts.map((d) => d.getTime());
  const weekEnd = addDays(thisWeek, 7).getTime();
  const weeklyCounts = new Array<number>(WEEKS).fill(0);
  let newLeads30 = 0;
  let newLeadsPrior30 = 0;

  for (const { createdAt } of recentLeadDates) {
    const t = createdAt.getTime();
    if (t >= days30Ago.getTime()) newLeads30++;
    else if (t >= days60Ago.getTime()) newLeadsPrior30++;
    const i = bucketIndex(t, weekStartTimes, weekEnd);
    if (i >= 0) weeklyCounts[i]++;
  }

  const weeklyLeads: WeeklyLeadsPoint[] = weekStarts.map((start, i) => ({
    key: dayKey(start),
    label: dayMonth.format(start),
    range: i === WEEKS - 1 ? `${weekRangeLabel(start)} (this week)` : weekRangeLabel(start),
    count: weeklyCounts[i],
  }));

  // ── Pipeline by stage ───────────────────────────────────────────────────
  // Lost opportunities leave the board (Odoo archives them), so they are left
  // out of every pipeline figure; they only feed the win rate.
  const byStatus = new Map(stageGroups.map((g) => [g.status as string, g]));
  const allLeads = stageGroups.reduce((s, g) => s + g._count._all, 0);
  const stages: PipelineStage[] = BOARD_STAGES.map((status) => {
    const g = byStatus.get(status);
    const valueFils = g?._sum.estimatedValueFils ?? 0;
    return {
      status,
      label: LEAD_STATUS[status]?.label ?? status,
      dotClass: TONE_DOT[LEAD_STATUS[status]?.tone ?? "neutral"],
      count: g?._count._all ?? 0,
      valueFils,
      valueCompact: formatMoneyCompact(valueFils, currency),
      valueFull: formatMoney(valueFils, currency),
    };
  });
  const totalLeads = stages.reduce((s, st) => s + st.count, 0);
  const openStages = stages.filter((s) => (OPEN_STAGES as readonly string[]).includes(s.status));
  const openPipelineFils = openStages.reduce((s, st) => s + st.valueFils, 0);
  const openLeads = openStages.reduce((s, st) => s + st.count, 0);
  const weightedPipelineFils = openLeadRows.reduce((s, lead) => s + weightedRevenueFils(lead), 0);

  // ── Services requested ──────────────────────────────────────────────────
  const serviceCounts = new Map<string, number>();
  for (const { services } of serviceRows) {
    // A lead lists each service once, but de-dupe anyway so a malformed row can't double count.
    for (const service of new Set(services)) {
      const name = service.trim();
      if (name) serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
    }
  }
  const serviceItems = [...serviceCounts.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));

  // ── Invoices: revenue, outstanding, attention list ──────────────────────
  const monthStarts = Array.from({ length: MONTHS }, (_, i) => addMonths(firstMonth, i));
  const monthStartTimes = monthStarts.map((d) => d.getTime());
  const monthEnd = addMonths(thisMonth, 1).getTime();
  const monthlyFils = new Array<number>(MONTHS).fill(0);

  let revenueYtdFils = 0;
  let revenue30Fils = 0;
  let paidYtdCount = 0;
  let outstandingFils = 0;
  let outstandingCount = 0;
  let overdueFils = 0;
  let overdueCount = 0;
  let otherCurrencyInvoices = 0;
  const attention: AttentionInvoice[] = [];

  for (const inv of invoiceRows) {
    const totalFils = documentTotals(inv.items, inv.vatBps).totalFils;
    // The shared rule: SENT turns OVERDUE once the due day has ended in Dubai,
    // so these counts match the Billing tabs and CRM exactly.
    const status = effectiveInvoiceStatus(inv, now);
    const inCurrency = inv.currency === currency;

    if (status === "PAID") {
      if (!inv.paidAt) continue;
      if (!inCurrency) {
        otherCurrencyInvoices++;
        continue;
      }
      const t = inv.paidAt.getTime();
      if (t >= yearStart.getTime()) {
        revenueYtdFils += totalFils;
        paidYtdCount++;
      }
      if (t >= days30Ago.getTime()) revenue30Fils += totalFils;
      const i = bucketIndex(t, monthStartTimes, monthEnd);
      if (i >= 0) monthlyFils[i] += totalFils;
      continue;
    }

    // SENT or (effective) OVERDUE from here on.
    const overdue = status === "OVERDUE";
    if (inCurrency) {
      outstandingFils += totalFils;
      outstandingCount++;
      if (overdue) {
        overdueFils += totalFils;
        overdueCount++;
      }
    } else {
      otherCurrencyInvoices++;
    }

    // Whole business-clock calendar days until the due date (negative once it
    // has passed), so the 7-day window doesn't shift with the time of day. A
    // SENT invoice that isn't overdue is never below 0 here.
    const daysUntilDue = daysFromToday(inv.dueDate, now);
    const dueSoon = !overdue && daysUntilDue <= ATTENTION_WINDOW_DAYS;
    if (overdue || dueSoon) {
      attention.push({
        id: inv.id,
        number: inv.number,
        client: inv.clientCompany || inv.clientName,
        totalFils,
        currency: inv.currency,
        dueDate: inv.dueDate,
        overdue,
        // A stored-OVERDUE invoice whose due day hasn't ended must read
        // "Overdue today", never "Due in 5 days".
        dueLabel: overdue && daysUntilDue >= 0 ? "Overdue today" : dueHint(inv.dueDate, now),
      });
    }
  }

  // Most overdue first, then whatever falls due soonest.
  attention.sort((a, b) =>
    a.overdue !== b.overdue ? (a.overdue ? -1 : 1) : a.dueDate.getTime() - b.dueDate.getTime(),
  );

  const monthlyRevenue: MonthlyRevenuePoint[] = monthStarts.map((start, i) => ({
    key: isoMonth(start),
    label: monthShort.format(start),
    fullLabel: i === MONTHS - 1 ? `${monthLong.format(start)} (to date)` : monthLong.format(start),
    fils: monthlyFils[i],
  }));

  // ── Active projects ─────────────────────────────────────────────────────
  const taskTotals = new Map<string, { done: number; total: number }>();
  for (const g of taskGroups) {
    const entry = taskTotals.get(g.projectId) ?? { done: 0, total: 0 };
    entry.total += g._count._all;
    if (g.status === "DONE") entry.done += g._count._all;
    taskTotals.set(g.projectId, entry);
  }

  // ── Follow-ups and agreements ───────────────────────────────────────────
  const followUps: OverdueFollowUp[] = overdueActivityRows.map((a) => ({
    id: a.id,
    leadId: a.leadId,
    lead: leadTitle(a.lead),
    summary: a.summary,
    type: a.type,
    dueDate: a.dueDate,
    dueLabel: dueHint(a.dueDate, now),
    assignee: a.assignee?.name ?? null,
  }));

  const agreementCountByStatus = new Map(agreementGroups.map((g) => [g.status, g._count._all]));
  const agreementCounts: AgreementStatusCount[] = AGREEMENT_STATUS_ORDER.map((status) => ({
    status,
    label: AGREEMENT_STATUS[status].label,
    tone: AGREEMENT_STATUS[status].tone,
    count: agreementCountByStatus.get(status) ?? 0,
  }));

  const awaiting: AwaitingAgreement[] = awaitingRows.map((a) => {
    // sentAt is set when an agreement is sent; updatedAt covers rows from before that.
    const sentAt = a.sentAt ?? a.updatedAt;
    return {
      id: a.id,
      number: a.number,
      client: a.clientCompany || a.clientName,
      projectName: a.projectName,
      totalFils: a.totalFils,
      currency: a.currency,
      sentAt,
      waitingLabel: waitingLabel(sentAt, now),
      stale: calendarDaysBetween(sentAt, now) > SIGNATURE_CHASE_DAYS,
    };
  });

  const activeProjects: ActiveProject[] = projectRows.map((p) => {
    const tasks = taskTotals.get(p.id) ?? { done: 0, total: 0 };
    return {
      id: p.id,
      name: p.name,
      client: p.lead ? p.lead.companyName || p.lead.fullName : null,
      status: p.status,
      dueDate: p.dueDate,
      overdue: p.dueDate !== null && isPastDay(p.dueDate, now),
      doneTasks: tasks.done,
      totalTasks: tasks.total,
    };
  });

  return {
    now,
    currency,
    kpis: {
      newLeads30,
      newLeadsPrior30,
      openPipelineFils,
      weightedPipelineFils,
      openLeads,
      openLeadsUnvalued,
      wonMonthCount: wonThisMonth._count._all,
      wonMonthFils: wonThisMonth._sum.estimatedValueFils ?? 0,
      monthName: monthName.format(now),
      revenueYtdFils,
      revenue30Fils,
      paidYtdCount,
      outstandingFils,
      outstandingCount,
      overdueFils,
      overdueCount,
    },
    weeklyLeads,
    monthlyRevenue,
    pipeline: {
      stages,
      totalLeads,
      won: byStatus.get("WON")?._count._all ?? 0,
      lost: byStatus.get("LOST")?._count._all ?? 0,
    },
    services: { items: serviceItems, totalLeads: allLeads },
    recentLeads: recentLeadRows.map((l) => ({
      id: l.id,
      title: leadTitle(l),
      name: l.fullName,
      company: l.companyName,
      isIndividual: l.clientType === "INDIVIDUAL",
      status: l.status,
      createdAt: l.createdAt,
    })),
    attention: {
      items: attention.slice(0, ATTENTION_LIMIT),
      total: attention.length,
      overdueTotal: attention.filter((a) => a.overdue).length,
    },
    followUps: { items: followUps, overdueTotal: overdueActivityCount, dueToday: dueTodayCount },
    agreements: {
      counts: agreementCounts,
      total: agreementCounts.reduce((s, c) => s + c.count, 0),
      awaiting,
      awaitingTotal: agreementCountByStatus.get("SENT") ?? 0,
    },
    activeProjects: { items: activeProjects, total: activeProjectCount },
    otherCurrencyInvoices,
  };
}

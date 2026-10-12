import "server-only";
import type { InvoiceStatus, LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import { BUSINESS_TIME_ZONE } from "@/lib/admin/time";
import { DEFAULT_CURRENCY, documentTotals } from "@/lib/admin/money";
import { LEAD_PIPELINE } from "@/lib/admin/labels";
import { addMonths, bucketIndex, isoMonth, startOfMonth } from "../_analytics/dates";
import { leadSearchWhere } from "../crm/_lib/helpers";
import { dialableNumber, telLink } from "./phone";
import type {
  ClientDocument,
  ClientFilters,
  ClientRow,
  ClientsPage,
  DashboardData,
  EngagementPoint,
  RevenuePoint,
} from "./types";

/*
 * Everything the one-page dashboard shows, read in a handful of queries.
 * Months are cut on the business (Dubai) clock, like the rest of the admin, so
 * a payment marked at 01:30 on the 1st counts in the new month.
 */

export const PAGE_SIZE = 20;
const MONTHS = 12;

const monthShort = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, month: "short" });
const monthLong = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, month: "long", year: "numeric" });

/** Timeline events that record a client arriving, not the team acting. */
const ARRIVAL_EVENT = /^(Enquiry received|Opportunity created)\b/;

export async function getDashboardData(filters: ClientFilters, now: Date = new Date()): Promise<DashboardData> {
  const thisMonth = startOfMonth(now);
  const firstMonth = addMonths(now, -(MONTHS - 1));
  const monthStarts = Array.from({ length: MONTHS }, (_, i) => addMonths(firstMonth, i));
  const starts = monthStarts.map((d) => d.getTime());
  const end = addMonths(now, 1).getTime();

  const [totalClients, newThisMonth, statusGroups, invoices, leadsInRange, events, quotesMade, invoicesMade, clients] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { createdAt: { gte: thisMonth } } }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    // Paid in range, plus everything still owed (any age).
    db.invoice.findMany({
      where: {
        OR: [
          { status: "PAID", paidAt: { gte: firstMonth } },
          { status: { in: ["SENT", "OVERDUE"] } },
          { status: { in: ["SENT", "OVERDUE", "PAID"] }, issueDate: { gte: firstMonth } },
        ],
      },
      select: {
        leadId: true,
        status: true,
        issueDate: true,
        dueDate: true,
        paidAt: true,
        currency: true,
        vatBps: true,
        items: { select: { quantity: true, unitPriceFils: true } },
      },
    }),
    db.lead.findMany({ where: { createdAt: { gte: firstMonth } }, select: { createdAt: true } }),
    db.note.findMany({
      where: { kind: "EVENT", createdAt: { gte: firstMonth } },
      select: { leadId: true, createdAt: true, body: true },
    }),
    // Making a quotation or invoice for a client is engagement too, even
    // though it writes no timeline event.
    db.quote.findMany({
      where: { leadId: { not: null }, createdAt: { gte: firstMonth } },
      select: { leadId: true, createdAt: true },
    }),
    db.invoice.findMany({
      where: { leadId: { not: null }, createdAt: { gte: firstMonth } },
      select: { leadId: true, createdAt: true },
    }),
    // Same clock as the KPIs, so a row and the Outstanding tile agree on what is overdue.
    getClientsPage(filters, now),
  ]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const byStatus = new Map<LeadStatus, number>(statusGroups.map((g) => [g.status, g._count._all]));
  const goal = byStatus.get("WON") ?? 0;

  // ── Revenue by month ────────────────────────────────────────────────────
  const collected = Array<number>(MONTHS).fill(0);
  const invoiced = Array<number>(MONTHS).fill(0);
  let revenue12mFils = 0;
  let outstandingFils = 0;
  let outstandingCount = 0;
  let overdueCount = 0;
  let unlinkedOutstandingCount = 0;

  for (const inv of invoices) {
    // Totals are summed in AED only; another currency is never mixed in.
    if (inv.currency !== DEFAULT_CURRENCY) continue;
    const total = documentTotals(inv.items, inv.vatBps).totalFils;
    const status = effectiveInvoiceStatus<InvoiceStatus>(inv, now);

    const issued = bucketIndex(inv.issueDate.getTime(), starts, end);
    if (issued >= 0 && status !== "DRAFT" && status !== "VOID") invoiced[issued] += total;

    if (status === "PAID" && inv.paidAt) {
      const paid = bucketIndex(inv.paidAt.getTime(), starts, end);
      if (paid >= 0) {
        collected[paid] += total;
        revenue12mFils += total;
      }
    } else if (status === "SENT" || status === "OVERDUE") {
      outstandingFils += total;
      outstandingCount++;
      if (status === "OVERDUE") overdueCount++;
      if (!inv.leadId) unlinkedOutstandingCount++;
    }
  }

  const month = (start: Date, i: number) => ({
    key: isoMonth(start),
    label: monthShort.format(start),
    fullLabel: i === MONTHS - 1 ? `${monthLong.format(start)} (to date)` : monthLong.format(start),
  });

  const revenue: RevenuePoint[] = monthStarts.map((start, i) => ({
    ...month(start, i),
    collectedFils: collected[i],
    invoicedFils: invoiced[i],
  }));

  // ── Engagement by month ─────────────────────────────────────────────────
  const enquiries = Array<number>(MONTHS).fill(0);
  for (const l of leadsInRange) {
    const i = bucketIndex(l.createdAt.getTime(), starts, end);
    if (i >= 0) enquiries[i]++;
  }
  const engagedSets = Array.from({ length: MONTHS }, () => new Set<string>());
  const touch = (leadId: string | null, at: Date) => {
    if (!leadId) return;
    const i = bucketIndex(at.getTime(), starts, end);
    if (i >= 0) engagedSets[i].add(leadId);
  };
  for (const e of events) {
    if (!ARRIVAL_EVENT.test(e.body)) touch(e.leadId, e.createdAt);
  }
  for (const d of quotesMade) touch(d.leadId, d.createdAt);
  for (const d of invoicesMade) touch(d.leadId, d.createdAt);
  const engagement: EngagementPoint[] = monthStarts.map((start, i) => ({
    ...month(start, i),
    enquiries: enquiries[i],
    engaged: engagedSets[i].size,
  }));

  return {
    now: now.toISOString(),
    kpis: {
      totalClients,
      newThisMonth,
      awaitingContact: byStatus.get("NEW") ?? 0,
      goal,
      goalRate: totalClients > 0 ? Math.round((goal / totalClients) * 100) : 0,
      revenue12mFils,
      outstandingFils,
      outstandingCount,
      overdueCount,
      unlinkedOutstandingCount,
      currency: DEFAULT_CURRENCY,
    },
    revenue,
    engagement,
    clients,
  };
}

// ─── Clients table ────────────────────────────────────────────────────────

const clientSelect = {
  id: true,
  createdAt: true,
  status: true,
  source: true,
  clientType: true,
  fullName: true,
  companyName: true,
  role: true,
  companySize: true,
  industry: true,
  email: true,
  phone: true,
  country: true,
  city: true,
  contactPreference: true,
  services: true,
  systems: true,
  timeline: true,
  budget: true,
  message: true,
  quotes: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      vatBps: true,
      items: { select: { quantity: true, unitPriceFils: true } },
    },
  },
  // Every invoice (a page is at most PAGE_SIZE clients): the row shows the
  // one that most needs attention, which isn't always the newest.
  invoices: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      number: true,
      status: true,
      dueDate: true,
      currency: true,
      vatBps: true,
      items: { select: { quantity: true, unitPriceFils: true } },
    },
  },
  _count: { select: { quotes: true, invoices: true } },
} satisfies Prisma.LeadSelect;

type ClientRecord = Prisma.LeadGetPayload<{ select: typeof clientSelect }>;

/** Newest first; id breaks ties so paging is stable. */
const ORDER: Prisma.LeadOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

export async function getClientsPage(filters: ClientFilters, now: Date = new Date()): Promise<ClientsPage> {
  const searchWhere = leadSearchWhere(filters.q);
  const where: Prisma.LeadWhereInput = filters.status ? { AND: [searchWhere, { status: filters.status }] } : searchWhere;

  const [grouped, total] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: searchWhere, _count: { _all: true } }),
    db.lead.count({ where }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let page = Math.min(Math.max(1, filters.page), pageCount);
  let focusMissing = false;

  // ?client=<id>: jump to the page that holds that client, if it matches the filters.
  if (filters.focus) {
    const focus = await db.lead.findFirst({
      where: { AND: [where, { id: filters.focus }] },
      select: { id: true, createdAt: true },
    });
    if (focus) {
      const before = await db.lead.count({
        where: {
          AND: [
            where,
            {
              OR: [
                { createdAt: { gt: focus.createdAt } },
                { createdAt: focus.createdAt, id: { gt: focus.id } },
              ],
            },
          ],
        },
      });
      page = Math.floor(before / PAGE_SIZE) + 1;
    } else {
      focusMissing = true;
    }
  }

  const records = await db.lead.findMany({
    where,
    orderBy: ORDER,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: clientSelect,
  });

  const counts = new Map<LeadStatus, number>(grouped.map((g) => [g.status, g._count._all]));

  return {
    rows: records.map((r) => toRow(r, now)),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    statusCounts: LEAD_PIPELINE.map((status) => ({ status, count: counts.get(status) ?? 0 })),
    matchingAll: grouped.reduce((sum, g) => sum + g._count._all, 0),
    focusMissing,
  };
}

type InvoiceRecord = ClientRecord["invoices"][number];

/**
 * The invoice a client's row shows: the longest-overdue one, else the unpaid
 * one due soonest, else the newest. An overdue invoice behind a newer paid or
 * draft one stays in reach from the dashboard (the billing lists are hidden).
 */
function invoiceToShow(invoices: { inv: InvoiceRecord; status: InvoiceStatus }[]) {
  const byDue = (a: { inv: InvoiceRecord }, b: { inv: InvoiceRecord }) =>
    a.inv.dueDate.getTime() - b.inv.dueDate.getTime();
  const overdue = invoices.filter((e) => e.status === "OVERDUE").sort(byDue);
  const sent = invoices.filter((e) => e.status === "SENT").sort(byDue);
  return overdue[0] ?? sent[0] ?? invoices[0] ?? null;
}

function toRow(r: ClientRecord, now: Date): ClientRow {
  const q = r.quotes[0];
  const quote: ClientDocument | null = q
    ? { id: q.id, number: q.number, status: q.status, totalFils: documentTotals(q.items, q.vatBps).totalFils, currency: q.currency }
    : null;

  // Newest first, as loaded.
  const invoices = r.invoices.map((inv) => ({ inv, status: effectiveInvoiceStatus<InvoiceStatus>(inv, now) }));
  const shown = invoiceToShow(invoices);
  const invoice: ClientDocument | null = shown
    ? {
        id: shown.inv.id,
        number: shown.inv.number,
        status: shown.status,
        totalFils: documentTotals(shown.inv.items, shown.inv.vatBps).totalFils,
        currency: shown.inv.currency,
      }
    : null;
  const overdueInvoiceCount = invoices.filter((e) => e.status === "OVERDUE").length;
  const unpaidInvoiceCount = overdueInvoiceCount + invoices.filter((e) => e.status === "SENT").length;

  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    status: r.status,
    source: r.source,
    clientType: r.clientType,
    fullName: r.fullName,
    companyName: r.companyName,
    role: r.role,
    companySize: r.companySize,
    industry: r.industry,
    email: r.email,
    phone: r.phone,
    country: r.country,
    city: r.city,
    contactPreference: r.contactPreference,
    services: r.services,
    systems: r.systems,
    timeline: r.timeline,
    budget: r.budget,
    message: r.message,
    whatsapp: r.phone ? dialableNumber(r.phone, r.country) : null,
    tel: r.phone ? telLink(r.phone, r.country) : null,
    quote,
    quoteCount: r._count.quotes,
    invoice,
    invoiceCount: r._count.invoices,
    unpaidInvoiceCount,
    overdueInvoiceCount,
  };
}

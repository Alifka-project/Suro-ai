import type { Prisma } from "@prisma/client";

/**
 * The earliest-due open activity. It is also the most urgent one, so it gives
 * both the "next activity" and the opportunity's activity state.
 */
const nextActivity = {
  where: { doneAt: null },
  orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  take: 1,
  select: { type: true, summary: true, dueDate: true },
} satisfies Prisma.Lead$activitiesArgs;

const owner = { select: { id: true, name: true } } satisfies Prisma.AdminUserDefaultArgs;

/** Columns the leads list needs — nothing more crosses the wire. */
export const leadListSelect = {
  id: true,
  createdAt: true,
  status: true,
  source: true,
  clientType: true,
  title: true,
  fullName: true,
  email: true,
  phone: true,
  companyName: true,
  estimatedValueFils: true,
  lostReason: true,
  owner,
  activities: nextActivity,
} satisfies Prisma.LeadSelect;

export type LeadListItem = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;

/** Columns a pipeline card needs. */
export const pipelineCardSelect = {
  id: true,
  status: true,
  source: true,
  title: true,
  fullName: true,
  companyName: true,
  estimatedValueFils: true,
  priority: true,
  tags: true,
  owner,
  activities: nextActivity,
  _count: { select: { activities: { where: { doneAt: null } } } },
  // Only read for Won cards: the live agreement generated when the deal was won.
  agreements: {
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, number: true, status: true },
  },
} satisfies Prisma.LeadSelect;

export type PipelineLead = Prisma.LeadGetPayload<{ select: typeof pipelineCardSelect }>;

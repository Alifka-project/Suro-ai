import { cache } from "react";
import { requireAdmin } from "@/lib/admin/dal";
import { db } from "@/lib/db";

const lines = { select: { quantity: true, unitPriceFils: true } } as const;

/**
 * Everything the opportunity page shows, in one query. `cache` shares the
 * result between generateMetadata and the page within a request; the admin
 * check runs before the database is touched on either path.
 */
export const getOpportunity = cache(async (id: string) => {
  await requireAdmin();
  return db.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, active: true } },
      notes: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, createdAt: true, kind: true, body: true, author: { select: { name: true } } },
      },
      activities: {
        where: { doneAt: null },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, type: true, summary: true, note: true, dueDate: true, assignee: { select: { name: true } } },
      },
      quotes: {
        // Newest first: the order markLeadWon picks a quotation in (see _lib/win-plan.ts).
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          currency: true,
          vatBps: true,
          issueDate: true,
          validUntil: true,
          items: lines,
          agreement: { select: { id: true, number: true } },
        },
      },
      agreements: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          projectName: true,
          currency: true,
          totalFils: true,
          effectiveDate: true,
          quote: { select: { id: true, number: true } },
          // Whether delivery has started from this agreement's SOW yet.
          project: { select: { id: true } },
        },
      },
      invoices: {
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          currency: true,
          vatBps: true,
          issueDate: true,
          dueDate: true,
          paidAt: true,
          installment: true,
          items: lines,
          agreement: { select: { number: true } },
        },
      },
      projects: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          status: true,
          dueDate: true,
          valueFils: true,
          tasks: { select: { status: true } },
        },
      },
      _count: { select: { activities: true } },
    },
  });
});

export type Opportunity = NonNullable<Awaited<ReturnType<typeof getOpportunity>>>;

/** Active admins, for the salesperson and assignee pickers. */
export async function getTeam() {
  await requireAdmin();
  return db.adminUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { ACTIVE_CLIENT } from "@/lib/admin/clients";
import { requireAdmin } from "@/lib/admin/dal";
import type { LeadOption, ProjectOption } from "./types";

/** cuids are short alphanumerics; anything else can't be a record id. */
export function isPlausibleId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * Single-document reads. Wrapped in `cache` so generateMetadata and the page
 * share one query per request. Each one authorizes before touching the db.
 */
export const getQuote = cache(async (id: string) => {
  await requireAdmin();
  if (!isPlausibleId(id)) return null;
  return db.quote.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      lead: { select: { id: true, fullName: true, companyName: true, title: true, status: true } },
      invoice: { select: { id: true, number: true, status: true } },
      agreement: {
        select: {
          id: true,
          number: true,
          status: true,
          subtotalFils: true,
          vatBps: true,
          totalFils: true,
          currency: true,
          project: { select: { id: true, name: true } },
          // Stage invoices that still count: a voided one can be reissued.
          invoices: {
            where: { installment: { not: null }, status: { not: "VOID" } },
            select: { id: true, number: true },
          },
        },
      },
    },
  });
});

export const getInvoice = cache(async (id: string) => {
  await requireAdmin();
  if (!isPlausibleId(id)) return null;
  return db.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      lead: { select: { id: true, fullName: true, companyName: true, title: true } },
      project: { select: { id: true, name: true } },
      quote: { select: { id: true, number: true } },
      agreement: {
        select: {
          id: true,
          number: true,
          status: true,
          depositPct: true,
          midpointPct: true,
          finalPct: true,
          midpointMilestone: true,
          invoiceDueDays: true,
        },
      },
    },
  });
});

const leadSelect = { id: true, fullName: true, email: true, companyName: true, estimatedValueFils: true } as const;

function toLeadOption(l: {
  id: string;
  fullName: string;
  email: string | null;
  companyName: string | null;
  estimatedValueFils: number | null;
}): LeadOption {
  return { id: l.id, name: l.fullName, email: l.email, company: l.companyName, estimatedValueFils: l.estimatedValueFils };
}

/** A client removed from the list is treated as not found: new documents are for clients on the list. */
export async function findLeadForPrefill(id: string | undefined) {
  await requireAdmin();
  if (!isPlausibleId(id)) return null;
  return db.lead.findFirst({
    where: { id, ...ACTIVE_CLIENT },
    select: { ...leadSelect, services: true },
  });
}

export async function findProjectForPrefill(id: string | undefined) {
  await requireAdmin();
  if (!isPlausibleId(id)) return null;
  return db.project.findUnique({
    where: { id },
    select: { id: true, name: true, valueFils: true, leadId: true },
  });
}

const projectOptionSelect = {
  id: true,
  name: true,
  leadId: true,
  lead: { select: { fullName: true, companyName: true } },
} as const;

/**
 * Options for the editor's "linked lead" and "project" pickers. The most recent
 * leads and projects, plus any that are already linked or reachable through a
 * project, so a controlled <select> never holds a value missing from its options.
 */
export async function getEditorOptions({
  includeProjects,
  ensureLeadIds = [],
  ensureProjectIds = [],
}: {
  includeProjects: boolean;
  ensureLeadIds?: (string | null | undefined)[];
  ensureProjectIds?: (string | null | undefined)[];
}): Promise<{ leads: LeadOption[]; projects: ProjectOption[] }> {
  await requireAdmin();

  const [recentLeads, recentProjects] = await Promise.all([
    // Removed clients aren't offered, but one a document already links to is
    // still loaded below (ensureLeadIds), so editing it keeps the link.
    db.lead.findMany({ where: ACTIVE_CLIENT, orderBy: { createdAt: "desc" }, take: 300, select: leadSelect }),
    includeProjects
      ? db.project.findMany({ orderBy: { createdAt: "desc" }, take: 300, select: projectOptionSelect })
      : Promise.resolve([]),
  ]);

  const knownProjects = new Set(recentProjects.map((p) => p.id));
  const missingProjects = includeProjects
    ? ensureProjectIds.filter((id): id is string => typeof id === "string" && !knownProjects.has(id))
    : [];
  const projects = missingProjects.length
    ? [
        ...recentProjects,
        ...(await db.project.findMany({ where: { id: { in: missingProjects } }, select: projectOptionSelect })),
      ]
    : recentProjects;

  const known = new Set(recentLeads.map((l) => l.id));
  const missing = [...ensureLeadIds, ...projects.map((p) => p.leadId)].filter(
    (id): id is string => typeof id === "string" && !known.has(id),
  );
  const extraLeads = missing.length
    ? await db.lead.findMany({ where: { id: { in: [...new Set(missing)] } }, select: leadSelect })
    : [];

  return {
    leads: [...recentLeads, ...extraLeads].map(toLeadOption),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      leadId: p.leadId,
      clientLabel: p.lead ? p.lead.companyName || p.lead.fullName : null,
    })),
  };
}

import "server-only";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { leadLabel } from "./format";
import type { LeadOption } from "./types";

/** Upper bound on the client dropdown so an old CRM can't bloat every form. */
const MAX_LEAD_OPTIONS = 500;

/**
 * Leads for the "Client" select, alphabetical. The most recent leads win the
 * cap, and `includeId` (the currently linked or preselected lead) is always
 * present so an edit form never silently drops its client.
 */
export async function getLeadOptions(includeId?: string | null): Promise<LeadOption[]> {
  await requireAdmin();

  const leads = await db.lead.findMany({
    select: { id: true, fullName: true, companyName: true },
    orderBy: { createdAt: "desc" },
    take: MAX_LEAD_OPTIONS,
  });

  if (includeId && !leads.some((lead) => lead.id === includeId)) {
    const extra = await db.lead.findUnique({
      where: { id: includeId },
      select: { id: true, fullName: true, companyName: true },
    });
    if (extra) leads.push(extra);
  }

  return leads
    .map((lead) => ({ id: lead.id, label: leadLabel(lead) }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}

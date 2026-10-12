"use server";

import { Prisma, type LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/dal";
import { lockLead, sortOrderAtTop } from "@/lib/admin/deals";
import { LEAD_PIPELINE, LEAD_STATUS } from "@/lib/admin/labels";
import { logLeadEvent } from "@/lib/admin/timeline";
import { db } from "@/lib/db";

/*
 * The dashboard's one mutation: changing a client's status from the table.
 *
 * A public POST endpoint like every Server Action, so it re-checks the admin
 * session, validates its input and locks the client's row. The table sends the
 * status it was showing (`from`); if someone changed it in the meantime the
 * change is refused instead of silently overwriting theirs.
 *
 * Deliberately just a status change: setting "Goal" here records the deal as
 * closed without generating any paperwork. Quotations and invoices are made
 * from the table's own buttons.
 */

export type StatusChangeResult = {
  ok: boolean;
  message: string;
  /** The status the client is in after the call (the current one on failure, when known). */
  status?: LeadStatus;
};

const recordId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const schema = z.object({
  leadId: recordId,
  from: z.enum(LEAD_PIPELINE),
  to: z.enum(LEAD_PIPELINE),
});

class StaleStatusError extends Error {
  constructor(readonly current: LeadStatus) {
    super("Status changed elsewhere");
  }
}

class GoneError extends Error {}

export async function setClientStatus(input: z.input<typeof schema>): Promise<StatusChangeResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That status isn't valid." };
  const { leadId, from, to } = parsed.data;
  if (from === to) return { ok: true, message: `Already ${LEAD_STATUS[to].label}.`, status: to };

  try {
    await db.$transaction(async (tx) => {
      const current = await lockLead(tx, leadId);
      if (!current) throw new GoneError();
      if (current !== from) throw new StaleStatusError(current);

      const now = new Date();
      const data: Prisma.LeadUpdateInput = { status: to, sortOrder: await sortOrderAtTop(tx, to) };
      if (to === "WON") {
        Object.assign(data, { wonAt: now, lostAt: null, lostReason: null, lostNote: null, stageBeforeLost: null });
      } else if (to === "LOST") {
        Object.assign(data, { lostAt: now, lostReason: "Cancelled", stageBeforeLost: from, wonAt: null });
      } else {
        Object.assign(data, { wonAt: null, lostAt: null, lostReason: null, lostNote: null, stageBeforeLost: null });
      }

      await tx.lead.update({ where: { id: leadId }, data });
      await logLeadEvent(
        leadId,
        `Status changed from ${LEAD_STATUS[from].label} to ${LEAD_STATUS[to].label}.`,
        admin.id,
        tx,
      );
    });
  } catch (err) {
    revalidatePath("/admin", "layout");
    if (err instanceof GoneError || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
      return { ok: false, message: "This client no longer exists. The table has been refreshed." };
    }
    if (err instanceof StaleStatusError) {
      return {
        ok: false,
        message: `Someone changed this client to ${LEAD_STATUS[err.current].label} a moment ago. The table has been refreshed.`,
        status: err.current,
      };
    }
    console.error("[dashboard] setClientStatus failed:", err);
    return { ok: false, message: "Could not change the status. Please try again." };
  }

  // The page, the sidebar badge and the KPIs all read statuses.
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Status set to ${LEAD_STATUS[to].label}.`, status: to };
}

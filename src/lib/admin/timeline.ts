import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Records a system event on a lead's timeline (Odoo's chatter "log"):
 * stage moves, won/lost, quotes accepted, agreements generated, activities
 * completed. Pass the transaction client when logging inside a transaction so
 * the event commits or rolls back with the change it describes.
 *
 * `authorId` is the admin who caused the event, or null for the system
 * (e.g. a website enquiry).
 */
export async function logLeadEvent(
  leadId: string | null | undefined,
  body: string,
  authorId: string | null,
  client: Prisma.TransactionClient = db,
): Promise<void> {
  if (!leadId) return;
  await client.note.create({ data: { leadId, body: body.slice(0, 4000), kind: "EVENT", authorId } });
}

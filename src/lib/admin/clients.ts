import type { Prisma } from "@prisma/client";

/**
 * Clients still on the dashboard's list. "Remove" sets Lead.removedAt instead
 * of deleting the row, so every query that lists or counts clients must AND
 * this in. Reads of one document's client (a quotation or invoice page)
 * deliberately don't: those still show who the document was for.
 *
 * The switched-off modules (CRM, analytics, projects) don't apply it yet.
 * Add it to their lead queries before turning one back on.
 */
export const ACTIVE_CLIENT = { removedAt: null } satisfies Prisma.LeadWhereInput;

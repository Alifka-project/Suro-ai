import type { Prisma } from "@prisma/client";

/** Columns the lead list and board need — nothing more crosses the wire. */
export const leadListSelect = {
  id: true,
  createdAt: true,
  status: true,
  clientType: true,
  fullName: true,
  email: true,
  companyName: true,
  services: true,
  budget: true,
  estimatedValueFils: true,
} satisfies Prisma.LeadSelect;

export type LeadListItem = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;

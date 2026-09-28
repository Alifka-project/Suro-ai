import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { isPlausibleId } from "../../_lib/queries";

const invoiceSelect = {
  id: true,
  number: true,
  status: true,
  installment: true,
  dueDate: true,
  vatBps: true,
  currency: true,
  items: { select: { quantity: true, unitPriceFils: true } },
} as const;

/**
 * One agreement with everything its page links to. Wrapped in `cache` so
 * generateMetadata and the page share one query per request; authorizes
 * before touching the db.
 */
export const getAgreement = cache(async (id: string) => {
  await requireAdmin();
  if (!isPlausibleId(id)) return null;
  return db.agreement.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, fullName: true, companyName: true, title: true, status: true } },
      quote: {
        select: {
          id: true,
          number: true,
          status: true,
          vatBps: true,
          currency: true,
          items: { select: { quantity: true, unitPriceFils: true } },
          invoice: { select: invoiceSelect },
        },
      },
      project: { select: { id: true, name: true, status: true } },
      invoices: { orderBy: [{ issueDate: "asc" }, { number: "asc" }], select: invoiceSelect },
    },
  });
});

export type AgreementWithLinks = NonNullable<Awaited<ReturnType<typeof getAgreement>>>;

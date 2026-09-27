/**
 * THE rule for when an invoice is overdue. Every module — Analytics, CRM,
 * Billing, Projects — must use these, so the same invoice can never read
 * "Due today" on one screen and "Overdue" on another.
 *
 * Pure (Prisma is imported for types only), so it is safe in Client Components.
 */
import type { InvoiceStatus, Prisma, QuoteStatus } from "@prisma/client";
import { isPastDay, startOfBusinessDay } from "./time";

/**
 * The status an invoice is DISPLAYED and COUNTED as. A SENT invoice becomes
 * OVERDUE once its due date's whole calendar day has ended in Dubai (the client
 * may pay on the due date itself). Derived at read time and never written back.
 */
export function effectiveInvoiceStatus<S extends string = InvoiceStatus>(
  invoice: { status: S; dueDate: Date | string },
  now: Date = new Date(),
): S | "OVERDUE" {
  return invoice.status === "SENT" && isPastDay(invoice.dueDate, now) ? "OVERDUE" : invoice.status;
}

export function isInvoiceOverdue(invoice: { status: string; dueDate: Date | string }, now: Date = new Date()): boolean {
  return effectiveInvoiceStatus(invoice, now) === "OVERDUE";
}

/** Prisma filter matching invoices by EFFECTIVE status — the same rule, in SQL. */
export function invoiceWhereForStatus(status: InvoiceStatus, now: Date = new Date()): Prisma.InvoiceWhereInput {
  const startOfToday = startOfBusinessDay(now);
  switch (status) {
    case "SENT":
      return { status: "SENT", dueDate: { gte: startOfToday } };
    case "OVERDUE":
      return { OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: startOfToday } }] };
    default:
      return { status };
  }
}

/** A sent quote whose last valid day has ended (same calendar-day rule). */
export function isQuoteLapsed(quote: { status: QuoteStatus | string; validUntil: Date | string }, now: Date = new Date()): boolean {
  return quote.status === "SENT" && isPastDay(quote.validUntil, now);
}

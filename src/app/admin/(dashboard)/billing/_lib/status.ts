import type { InvoiceStatus, QuoteStatus } from "@prisma/client";
import { isPastDay } from "@/lib/admin/time";

/*
 * The effective (displayed and counted) invoice status, its Prisma filter and
 * the lapsed-quote check are shared with every other module: see
 * @/lib/admin/invoices. What stays here is billing's own workflow.
 */

/** Display order for filters and chips. */
export const INVOICE_STATUS_ORDER: readonly InvoiceStatus[] = ["DRAFT", "SENT", "OVERDUE", "PAID", "VOID"];
export const QUOTE_STATUS_ORDER: readonly QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"];

/**
 * Allowed manual status changes, keyed by the STORED status. Enforced by the
 * Server Actions; the detail pages use the same map to decide which buttons to
 * show, so the UI can never offer a move the server would refuse.
 */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "DECLINED", "EXPIRED"],
  ACCEPTED: ["SENT"],
  DECLINED: ["SENT"],
  EXPIRED: ["SENT"],
};

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["PAID", "VOID"],
  // OVERDUE -> SENT is further limited by isSentMoveUseless below.
  OVERDUE: ["SENT", "PAID", "VOID"],
  PAID: ["SENT"],
  VOID: [],
};

/**
 * A stored-OVERDUE invoice whose due date has already passed would still be
 * displayed and counted as overdue after being set back to SENT, so that move
 * would change nothing the admin can see. Only offered (and accepted) while
 * the invoice is not yet past due, i.e. when it was flagged overdue by mistake.
 * "Past due" is the shared calendar-day rule, the same one effectiveInvoiceStatus uses.
 */
export function isSentMoveUseless(invoice: { status: InvoiceStatus; dueDate: Date }, now: Date = new Date()): boolean {
  return invoice.status === "OVERDUE" && isPastDay(invoice.dueDate, now);
}

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === "string" && (INVOICE_STATUS_ORDER as readonly string[]).includes(value);
}

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && (QUOTE_STATUS_ORDER as readonly string[]).includes(value);
}

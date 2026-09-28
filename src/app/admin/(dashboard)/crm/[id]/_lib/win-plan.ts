import type { LeadStatus, QuoteStatus } from "@prisma/client";
import { isQuoteLapsed } from "@/lib/admin/invoices";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { formatBusinessDate } from "@/lib/admin/time";

/*
 * What "Mark won" is about to do, in plain words, for the confirmation panel.
 * Mirrors the quote selection in markLeadWon (src/lib/admin/deals.ts): the
 * accepted quotation, else the latest sent one (which it accepts), else the
 * latest draft, else a draft generated from the expected revenue. Quotes must
 * be passed newest first, the same order markLeadWon reads them in.
 */

type PlanQuote = {
  number: string;
  status: QuoteStatus;
  validUntil: Date;
  agreement: { number: string } | null;
};

export type WinPlan = {
  /** One sentence per step, in the order they happen. */
  steps: string[];
  /** False when marking won would change nothing (already won, paperwork complete). */
  hasWork: boolean;
};

export function describeWinPlan(
  lead: { status: LeadStatus; estimatedValueFils: number | null; quotes: readonly PlanQuote[] },
  now: Date = new Date(),
): WinPlan {
  const steps: string[] = [];
  const alreadyWon = lead.status === "WON";
  if (!alreadyWon) {
    steps.push(`The stage moves from ${LEAD_STATUS[lead.status]?.label ?? lead.status} to Won and today is recorded as the win date.`);
  }

  const accepted = lead.quotes.find((q) => q.status === "ACCEPTED");
  const sent = lead.quotes.find((q) => q.status === "SENT");
  const draft = lead.quotes.find((q) => q.status === "DRAFT");
  const quote = accepted ?? sent ?? draft ?? null;

  if (accepted) {
    steps.push(`Quotation ${accepted.number} (accepted) will be used.`);
  } else if (sent) {
    const lapsed = isQuoteLapsed(sent, now) ? `, validity ended ${formatBusinessDate(sent.validUntil)}` : "";
    steps.push(`Quotation ${sent.number} (sent${lapsed}) will be marked accepted.`);
  } else if (draft) {
    steps.push(`Draft quotation ${draft.number} will be used. It stays a draft, so review it before sending.`);
  } else if ((lead.estimatedValueFils ?? 0) > 0) {
    steps.push(
      `A draft quotation for ${formatMoney(lead.estimatedValueFils)} will be generated from the expected revenue.`,
    );
  } else {
    steps.push("No quotation or expected revenue: only the stage changes.");
  }

  // markLeadWon adopts the quotation's subtotal when no expected revenue was entered.
  if (quote && lead.estimatedValueFils === null) {
    steps.push(`The expected revenue will be set from quotation ${quote.number}.`);
  }

  const generatesQuote = !quote && (lead.estimatedValueFils ?? 0) > 0;
  let generatesAgreement = false;
  if (quote?.agreement) {
    steps.push(`Service agreement ${quote.agreement.number} already exists and stays linked to it.`);
  } else if (quote || generatesQuote) {
    generatesAgreement = true;
    steps.push("A draft service agreement (with its statement of work) will be generated from that quotation.");
  } else {
    steps.push("No service agreement is generated until the opportunity has a quotation or an expected revenue.");
  }

  const acceptsQuote = !accepted && !!sent;
  return { steps, hasWork: !alreadyWon || acceptsQuote || generatesQuote || generatesAgreement };
}

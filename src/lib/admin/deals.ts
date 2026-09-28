import "server-only";
import type { LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AGREEMENT_DEFAULTS,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_DELIVERABLES,
  DEFAULT_MILESTONES,
  DEFAULT_OUT_OF_SCOPE,
  scheduleTotals,
  type ScheduleTerms,
} from "./agreement-terms";
import { LEAD_STATUS } from "./labels";
import { DEFAULT_CURRENCY, DEFAULT_VAT_BPS, documentTotals, formatMoney } from "./money";
import { nextDocumentNumber } from "./numbering";
import { leadTitle } from "./pipeline";
import { addDaysToDateInput, dateInputToDate, toDateInputValue } from "./time";
import { logLeadEvent } from "./timeline";

/*
 * Deal automation — how a won opportunity turns into paperwork.
 *
 *   Quote ACCEPTED (Billing)        ─┐
 *   Opportunity marked WON (CRM)    ─┴─> Service Agreement generated from the quote
 *
 * - Accepting a quotation generates its Service Agreement (DRAFT) and marks
 *   the linked opportunity Won, like confirming a quotation in Odoo.
 * - Marking an opportunity Won picks its quotation — the accepted one, else
 *   the latest sent one (which it accepts), else the latest draft — and
 *   generates the agreement from it. With no quotation at all but an expected
 *   revenue, it first generates a DRAFT quotation from the opportunity, so
 *   the quote and the agreement arrive together for review.
 * - A won deal's expected revenue comes from its quotation when none was
 *   entered, so won revenue never counts a signed deal as AED 0.
 * - Every step is written to the opportunity's timeline.
 *
 * All of it runs inside the caller's transaction: either the whole chain
 * commits (stage, quote, agreement, numbers, timeline) or none of it does.
 *
 * Several admins work the same pipeline, so every stage change locks the
 * opportunity's row first (lockLead) and decides from what it reads under
 * that lock. Where quotes are involved their locks come before the lead's —
 * the order accepting a quote in Billing takes them in — so a win racing an
 * acceptance queues behind it instead of deadlocking, and two wins can never
 * both generate a quotation and an agreement.
 */

export type Actor = { id: string } | null;
type Tx = Prisma.TransactionClient;

export type GeneratedAgreement = { id: string; number: string; created: boolean };

/** Postgres INT4 ceiling — the largest fils amount an Int column can hold. */
const MAX_FILS = 2_147_483_647;

/** Today on the business clock, as a stored calendar date (12:00 UTC). */
function today(): Date {
  return dateInputToDate(toDateInputValue(new Date())) as Date;
}

/** sortOrder that puts a card at the top of a pipeline column. */
export async function sortOrderAtTop(tx: Tx, status: LeadStatus): Promise<number> {
  const top = await tx.lead.aggregate({ where: { status }, _min: { sortOrder: true } });
  return (top._min.sortOrder ?? 1024) - 1024;
}

/**
 * Locks an opportunity's row until the transaction ends and returns its
 * current stage (null if it doesn't exist). Every stage change takes this
 * lock before reading, so two admins changing one opportunity queue instead
 * of acting on the same stale read — a drag to Proposal undoing a "Mark
 * lost", or two wins each generating paperwork. FOR NO KEY UPDATE is the
 * lock a plain UPDATE takes: notes and activities can still be added
 * meanwhile.
 */
export async function lockLead(tx: Tx, leadId: string): Promise<LeadStatus | null> {
  const rows = await tx.$queryRaw<{ status: LeadStatus }[]>`
    SELECT "status" FROM "Lead" WHERE "id" = ${leadId} FOR NO KEY UPDATE`;
  return rows[0]?.status ?? null;
}

type QuoteForSnapshot = {
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  currency: string;
  vatBps: number;
  items: { quantity: number; unitPriceFils: number }[];
};

/** The agreement's split of the price into stages. */
type ScheduleSplit = Pick<ScheduleTerms, "depositPct" | "midpointPct" | "finalPct" | "midpointMilestone">;

/**
 * Client and money fields an agreement copies from its quotation. The total
 * is what the stage invoices under `schedule` add up to (see scheduleTotals),
 * which can be a fil away from the quotation's own total.
 */
export function snapshotFromQuote(quote: QuoteForSnapshot, schedule: ScheduleSplit) {
  const { subtotalFils } = documentTotals(quote.items, quote.vatBps);
  const { totalFils } = scheduleTotals({ ...schedule, subtotalFils, vatBps: quote.vatBps });
  return {
    clientName: quote.clientName,
    clientEmail: quote.clientEmail.trim() || null,
    clientCompany: quote.clientCompany,
    currency: quote.currency,
    vatBps: quote.vatBps,
    subtotalFils,
    totalFils,
  };
}

/**
 * The quotation's Service Agreement, generating a DRAFT one if it has none.
 * The draft is prefilled from the quote (client, price, one scope line per
 * quote line) and the opportunity (project name, enquiry text as background,
 * requested services as package reference), plus the template defaults.
 * Returns null if the quote doesn't exist.
 */
export async function ensureAgreementForQuote(tx: Tx, quoteId: string, actor: Actor): Promise<GeneratedAgreement | null> {
  const quote = await tx.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: { orderBy: { position: "asc" } },
      agreement: { select: { id: true, number: true } },
      lead: { select: { title: true, companyName: true, fullName: true, message: true, services: true } },
    },
  });
  if (!quote) return null;
  if (quote.agreement) return { ...quote.agreement, created: false };

  const lead = quote.lead;
  const projectName = (
    lead?.title?.trim() ||
    quote.items[0]?.description.trim() ||
    (lead ? leadTitle(lead) : quote.clientCompany || quote.clientName)
  ).slice(0, 160);

  const number = await nextDocumentNumber("agreement", tx);
  const created = await tx.agreement.create({
    data: {
      number,
      status: "DRAFT",
      effectiveDate: today(),
      ...snapshotFromQuote(quote, AGREEMENT_DEFAULTS),
      ...AGREEMENT_DEFAULTS,
      projectName,
      background: lead?.message?.trim().slice(0, 4000) ?? "",
      scope: quote.items
        .map((i) => i.description.trim())
        .filter(Boolean)
        .slice(0, 30),
      packageRef: lead?.services.length ? lead.services.join(" + ").slice(0, 200) : null,
      deliverables: [...DEFAULT_DELIVERABLES],
      outOfScope: [...DEFAULT_OUT_OF_SCOPE],
      assumptions: [...DEFAULT_ASSUMPTIONS],
      milestones: DEFAULT_MILESTONES.map((m) => ({ ...m })),
      leadId: quote.leadId,
      quoteId: quote.id,
    },
    select: { id: true, number: true },
  });
  await logLeadEvent(
    quote.leadId,
    `Service agreement ${number} generated from quotation ${quote.number}.`,
    actor?.id ?? null,
    tx,
  );
  return { ...created, created: true };
}

/**
 * Re-copies client and price from the quotation into a DRAFT agreement.
 * Sent, signed and cancelled agreements are frozen and left untouched.
 * Returns true if the agreement was updated.
 */
export async function syncAgreementFromQuote(tx: Tx, agreementId: string): Promise<boolean> {
  const agreement = await tx.agreement.findUnique({
    where: { id: agreementId },
    select: {
      status: true,
      updatedAt: true,
      depositPct: true,
      midpointPct: true,
      finalPct: true,
      midpointMilestone: true,
      quote: { include: { items: true } },
    },
  });
  if (!agreement?.quote || agreement.status !== "DRAFT") return false;
  const updated = await tx.agreement.updateMany({
    where: { id: agreementId, status: "DRAFT", updatedAt: agreement.updatedAt },
    data: snapshotFromQuote(agreement.quote, agreement),
  });
  return updated.count === 1;
}

/**
 * Moves an opportunity to Won (top of the column) and logs it. No-op if
 * already Won. Call with the lead locked and `from` read under that lock.
 */
async function winLead(tx: Tx, leadId: string, from: LeadStatus, reason: string, actor: Actor): Promise<boolean> {
  if (from === "WON") return false;
  await tx.lead.update({
    where: { id: leadId },
    data: {
      status: "WON",
      wonAt: new Date(),
      lostAt: null,
      lostReason: null,
      lostNote: null,
      stageBeforeLost: null,
      sortOrder: await sortOrderAtTop(tx, "WON"),
    },
  });
  await logLeadEvent(leadId, `Stage changed from ${LEAD_STATUS[from].label} to Won${reason}.`, actor?.id ?? null, tx);
  return true;
}

/**
 * Won revenue is summed from the opportunities' expected revenue. When none
 * was entered — website enquiries arrive with only a budget range — the won
 * deal takes its quotation's subtotal, so it doesn't count as AED 0. An
 * amount the team entered is never overwritten, and a quotation in another
 * currency is never mixed into the AED figures. Call with the lead locked.
 */
async function adoptQuoteValue(tx: Tx, leadId: string, quote: { id: string; number: string }, actor: Actor) {
  const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { estimatedValueFils: true } });
  if (!lead || lead.estimatedValueFils !== null) return;
  const source = await tx.quote.findUnique({
    where: { id: quote.id },
    select: { currency: true, items: { select: { quantity: true, unitPriceFils: true } } },
  });
  if (!source || source.currency !== DEFAULT_CURRENCY) return;
  const { subtotalFils } = documentTotals(source.items, 0);
  if (subtotalFils <= 0 || subtotalFils > MAX_FILS) return;
  await tx.lead.update({ where: { id: leadId }, data: { estimatedValueFils: subtotalFils } });
  await logLeadEvent(
    leadId,
    `Expected revenue set to ${formatMoney(subtotalFils)} from quotation ${quote.number}.`,
    actor?.id ?? null,
    tx,
  );
}

/**
 * Call inside the same transaction that set a quote to ACCEPTED (which holds
 * the quote's row lock, so the lead is locked after it — see the header).
 * Generates the agreement (or refreshes a still-DRAFT one to the accepted
 * price) and marks the linked opportunity Won — even a Lost one: the
 * client's acceptance decides it.
 */
export async function onQuoteAccepted(
  tx: Tx,
  quote: { id: string; number: string; leadId: string | null },
  actor: Actor,
): Promise<{ agreement: GeneratedAgreement | null; leadWon: boolean }> {
  const leadStatus = quote.leadId ? await lockLead(tx, quote.leadId) : null;

  await logLeadEvent(quote.leadId, `Quotation ${quote.number} accepted.`, actor?.id ?? null, tx);
  const agreement = await ensureAgreementForQuote(tx, quote.id, actor);
  if (agreement && !agreement.created) await syncAgreementFromQuote(tx, agreement.id);

  let leadWon = false;
  if (quote.leadId && leadStatus) {
    leadWon = await winLead(tx, quote.leadId, leadStatus, ` — quotation ${quote.number} accepted`, actor);
    await adoptQuoteValue(tx, quote.leadId, quote, actor);
  }
  return { agreement, leadWon };
}

export class LeadNotFoundError extends Error {
  constructor() {
    super("Lead not found");
  }
}

/** The opportunity is Lost: the CRM restores it before it can be moved or won. */
export class LeadLostError extends Error {
  constructor() {
    super("Lead is lost");
  }
}

export type WonResult = {
  /** The lead was already Won before this call (documents may still have been generated). */
  alreadyWon: boolean;
  quote: { id: string; number: string; created: boolean; accepted: boolean } | null;
  agreement: GeneratedAgreement | null;
  /** One sentence for a toast / flash message. */
  message: string;
};

/**
 * Marks an opportunity Won and generates its paperwork (see the header).
 * Idempotent: running it on a Won opportunity only fills in whatever
 * paperwork is missing. Throws LeadNotFoundError for an unknown id and
 * LeadLostError for a Lost one (restore it first).
 */
export async function markLeadWon(leadId: string, actor: Actor): Promise<WonResult> {
  return db.$transaction(
    async (tx) => {
      // The lead's quotes, then the lead: the order accepting a quote locks
      // them in (see the header). Everything below is read under both locks,
      // so a concurrent win or acceptance is seen instead of duplicated.
      await tx.$queryRaw`SELECT "id" FROM "Quote" WHERE "leadId" = ${leadId} ORDER BY "id" FOR NO KEY UPDATE`;
      const status = await lockLead(tx, leadId);
      if (!status) throw new LeadNotFoundError();
      if (status === "LOST") throw new LeadLostError();

      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          status: true,
          title: true,
          fullName: true,
          email: true,
          companyName: true,
          services: true,
          estimatedValueFils: true,
          quotes: {
            where: { status: { in: ["ACCEPTED", "SENT", "DRAFT"] } },
            select: { id: true, number: true, status: true, updatedAt: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          },
        },
      });
      if (!lead) throw new LeadNotFoundError();

      const alreadyWon = !(await winLead(tx, lead.id, lead.status, "", actor));

      let quote: WonResult["quote"] = null;
      const accepted = lead.quotes.find((q) => q.status === "ACCEPTED");
      if (accepted) quote = { id: accepted.id, number: accepted.number, created: false, accepted: false };

      if (!quote) {
        const sent = lead.quotes.find((q) => q.status === "SENT");
        if (sent) {
          // Compare-and-set on the version, like Billing's own status change,
          // so a concurrent edit or conversion isn't silently overridden.
          const res = await tx.quote.updateMany({
            where: { id: sent.id, status: "SENT", updatedAt: sent.updatedAt },
            data: { status: "ACCEPTED" },
          });
          if (res.count === 1) {
            quote = { id: sent.id, number: sent.number, created: false, accepted: true };
            await logLeadEvent(lead.id, `Quotation ${sent.number} accepted — deal won.`, actor?.id ?? null, tx);
          } else {
            // Only a quote created after the lock above can change under us.
            // If it was accepted meanwhile, that is the deal's quotation.
            const nowAccepted = await tx.quote.findFirst({
              where: { leadId: lead.id, status: "ACCEPTED" },
              select: { id: true, number: true },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            });
            if (nowAccepted) quote = { ...nowAccepted, created: false, accepted: false };
          }
        }
      }

      if (!quote) {
        const draft = lead.quotes.find((q) => q.status === "DRAFT");
        if (draft) quote = { id: draft.id, number: draft.number, created: false, accepted: false };
      }

      if (!quote && (lead.estimatedValueFils ?? 0) > 0) {
        const issue = toDateInputValue(new Date());
        const number = await nextDocumentNumber("quote", tx);
        const description = `${leadTitle(lead)}${lead.services.length ? ` — ${lead.services.join(", ")}` : ""}`.slice(0, 500);
        const created = await tx.quote.create({
          data: {
            number,
            status: "DRAFT",
            issueDate: dateInputToDate(issue) as Date,
            validUntil: dateInputToDate(addDaysToDateInput(issue, 30)) as Date,
            vatBps: DEFAULT_VAT_BPS,
            clientName: lead.fullName,
            clientEmail: lead.email ?? "",
            clientCompany: lead.companyName,
            leadId: lead.id,
            items: {
              create: [{ description, quantity: 1, unitPriceFils: lead.estimatedValueFils as number, position: 0 }],
            },
          },
          select: { id: true, number: true },
        });
        quote = { ...created, created: true, accepted: false };
        await logLeadEvent(
          lead.id,
          `Draft quotation ${number} generated from the expected revenue (${formatMoney(lead.estimatedValueFils)}).`,
          actor?.id ?? null,
          tx,
        );
      }

      if (quote && !quote.created) await adoptQuoteValue(tx, lead.id, quote, actor);
      const agreement = quote ? await ensureAgreementForQuote(tx, quote.id, actor) : null;
      if (agreement && !agreement.created && quote?.accepted) await syncAgreementFromQuote(tx, agreement.id);

      let message: string;
      if (!quote) {
        message = "Deal won. Add a quotation (or an expected revenue) to generate the service agreement.";
      } else if (agreement?.created) {
        message = quote.created
          ? `Deal won. Draft quotation ${quote.number} and service agreement ${agreement.number} generated — review both before sending.`
          : `Deal won. Service agreement ${agreement.number} generated from quotation ${quote.number}.`;
      } else {
        message = `Deal won. Service agreement ${agreement?.number ?? ""} is linked to quotation ${quote.number}.`;
      }
      return { alreadyWon, quote, agreement, message };
    },
    { timeout: 15_000 },
  );
}

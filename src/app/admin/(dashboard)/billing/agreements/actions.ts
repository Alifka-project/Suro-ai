"use server";

/**
 * Service agreement mutations. Every export here is a public POST endpoint, so
 * each one authorizes first, validates every field with zod, and re-reads the
 * record it touches instead of trusting ids or statuses sent by the browser.
 *
 * An agreement is a snapshot of its quotation (see @/lib/admin/deals). Only a
 * DRAFT can be edited or refreshed from the quote; sending it freezes the
 * terms (and sends a still-draft quotation with it), signing it accepts the
 * quotation and wins the opportunity, and its payment schedule then drives
 * the stage invoices. Status changes are compare-and-set on the version, and
 * every step is written to the opportunity's timeline in the same
 * transaction as the change.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type AgreementStatus, type QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import {
  AGREEMENT_DEFAULTS,
  AGREEMENT_STATUS,
  AGREEMENT_TRANSITIONS,
  INSTALLMENT_LABEL,
  INSTALLMENTS,
  MAX_MILESTONES,
  installmentPlan,
  parseMilestones,
  percentagesProblem,
  scheduleTotals,
} from "@/lib/admin/agreement-terms";
import {
  AGREEMENT_TOO_LARGE_MESSAGE,
  AgreementAmountTooLargeError,
  ensureAgreementForQuote,
  onQuoteAccepted,
  syncAgreementFromQuote as syncSnapshotFromQuote,
} from "@/lib/admin/deals";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { documentTotals, formatMoney } from "@/lib/admin/money";
import { nextDocumentNumber } from "@/lib/admin/numbering";
import { addDaysToDateInput, dateInputToDate, toDateInputValue } from "@/lib/admin/time";
import { logLeadEvent } from "@/lib/admin/timeline";
import type { ActionState } from "../_lib/types";
import { MAX_LATE_FEE_BPS, TERM_BOUNDS, parseLateFeeToBps, parseWholeNumber, readList } from "./_lib/parse";
import type { AgreementEditorState, AgreementField, MilestoneInput } from "./_lib/types";

// ─── Shared helpers ──────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

/** FormData value as a string; files and missing keys become "". */
function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * An agreement change shows up across the dashboard: billing lists, the
 * quote, its invoices, the opportunity's timeline and stage, the project. The
 * admin is fully dynamic, so revalidating the /admin layout clears the router
 * cache for all of it.
 */
function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

/** The record changed between our read and our write; nothing was written. */
class StaleError extends Error {}
/** A business rule refused the change mid-transaction; `message` is for the admin. */
class Refused extends Error {}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Unexpected failures are logged and returned as a message instead of hitting the error boundary. */
function unexpectedError(context: string, e: unknown, message: string): { error: string } {
  console.error(`[agreements] ${context} failed`, e);
  return { error: message };
}

const CHANGED_ELSEWHERE = "This agreement changed elsewhere. Reload and try again.";

/**
 * Row lock on a quote for the rest of the transaction. Converting a quote to
 * one full invoice locks the same row (by updating it), so a full conversion
 * and a stage invoice can never both slip through.
 *
 * Lock order: quote first, then lead and agreement — the order accepting a
 * quote takes them in (see onQuoteAccepted) — so concurrent changes queue
 * instead of deadlocking.
 */
async function lockQuote(tx: Tx, quoteId: string): Promise<QuoteStatus | null> {
  const rows = await tx.$queryRaw<{ status: QuoteStatus }[]>`SELECT "status" FROM "Quote" WHERE "id" = ${quoteId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

/** Non-void invoices billing one stage of the payment schedule. */
const STAGE_INVOICES = { installment: { not: null }, status: { not: "VOID" } } satisfies Prisma.InvoiceWhereInput;

// ─── Generate from a quotation ───────────────────────────────────────────────

/** Quotes an agreement can still be generated from. Declined and expired deals can't. */
const GENERATABLE: readonly QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED"];

/** Manual generation, for a quote whose deal isn't won yet (accepting a quote does this on its own). */
export async function generateAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = idSchema.safeParse(field(formData, "quoteId"));
  if (!parsed.success) return { error: "That quote could not be found." };
  const quoteId = parsed.data;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, agreement: { select: { id: true } } },
  });
  if (!quote) return { error: "This quote no longer exists." };
  // Already generated (double click, second tab, or accepted meanwhile): go to it.
  if (quote.agreement) redirect(`/admin/billing/agreements/${quote.agreement.id}`);
  if (!GENERATABLE.includes(quote.status)) {
    return { error: "This quote was declined or has expired. Reopen it as sent before generating an agreement." };
  }

  let agreementId: string;
  try {
    const generated = await db.$transaction(
      async (tx) => {
        const status = await lockQuote(tx, quoteId);
        if (!status) throw new Refused("This quote no longer exists.");
        if (!GENERATABLE.includes(status)) throw new StaleError();
        return ensureAgreementForQuote(tx, quoteId, admin);
      },
      { timeout: 15_000 },
    );
    if (!generated) return { error: "This quote no longer exists." };
    agreementId = generated.id;
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    if (e instanceof StaleError) return { error: "This quote changed elsewhere. Reload and try again." };
    // quoteId is unique on agreements: a concurrent submit already generated it.
    if (!isUniqueViolation(e)) {
      if (e instanceof AgreementAmountTooLargeError) return { error: AGREEMENT_TOO_LARGE_MESSAGE };
      return unexpectedError("generateAgreement", e, "The agreement could not be generated. Please try again.");
    }
    const existing = await db.agreement.findUnique({ where: { quoteId }, select: { id: true } });
    if (!existing) return { error: "The agreement could not be generated. Please try again." };
    agreementId = existing.id;
  }

  revalidateAdmin();
  redirect(`/admin/billing/agreements/${agreementId}`);
}

// ─── Edit a draft ────────────────────────────────────────────────────────────

/** A single-line text field: whitespace collapsed, trimmed, length-checked. */
function line(max: number, tooLong: string) {
  return z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, tooLong));
}

function wholeNumber({ min, max }: { min: number; max: number }) {
  return z.string().transform((value, ctx) => {
    const n = parseWholeNumber(value, min, max);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: `Enter a whole number from ${min} to ${max}` });
      return z.NEVER;
    }
    return n;
  });
}

const percent = wholeNumber({ min: 0, max: 100 });

/** A SOW textarea -> list, one item per line; too many or too long lines are errors, not cut. */
const listField = z
  .string()
  .max(40_000, "This list is too long")
  .transform((raw, ctx) => {
    const { items, problem } = readList(raw);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return items;
  });

const milestoneRow = z.object({ label: z.string().max(1000), date: z.string().max(20) });

/**
 * Timeline rows arrive as one JSON field. Completely empty rows are dropped;
 * every other row needs a label, and a date only if one was entered.
 * Issue paths keep the SUBMITTED row index, so errors land on the right row.
 */
const milestonesField = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "The timeline could not be read. Reload the page and try again." });
      return z.NEVER;
    }
  })
  .pipe(z.array(milestoneRow, { error: "The timeline could not be read. Reload the page and try again." }).max(100))
  .transform((rows, ctx) => {
    const out: { label: string; date: string | null }[] = [];
    rows.forEach((row, index) => {
      const label = row.label.replace(/\s+/g, " ").trim();
      const date = row.date.trim();
      if (!label && !date) return;
      if (!label) ctx.addIssue({ code: "custom", path: [index, "label"], message: "Name this milestone" });
      else if (label.length > 200) ctx.addIssue({ code: "custom", path: [index, "label"], message: "Keep it under 200 characters" });
      if (date && !dateInputToDate(date)) ctx.addIssue({ code: "custom", path: [index, "date"], message: "Enter a valid date" });
      out.push({ label, date: date || null });
    });
    if (out.length > MAX_MILESTONES) {
      ctx.addIssue({ code: "custom", message: `The timeline can have at most ${MAX_MILESTONES} milestones` });
    }
    return out;
  });

const agreementSchema = z
  .object({
    effectiveDate: z.string().transform((value, ctx) => {
      const date = dateInputToDate(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: value.trim() ? "Enter a valid date" : "The effective date is required" });
        return z.NEVER;
      }
      return date;
    }),
    clientName: line(160, "Keep the name under 160 characters").pipe(z.string().min(1, "The client's name is required")),
    clientCompany: line(160, "Keep the company name under 160 characters").transform((v) => v || null),
    clientEmail: z
      .string()
      .trim()
      .max(254, "That email address is too long")
      .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address")
      .transform((v) => v || null),
    depositPct: percent,
    midpointPct: percent,
    finalPct: percent,
    midpointMilestone: line(120, "Keep it under 120 characters").transform((v) => v || AGREEMENT_DEFAULTS.midpointMilestone),
    invoiceDueDays: wholeNumber(TERM_BOUNDS.invoiceDueDays),
    lateFee: z.string().transform((value, ctx) => {
      const bps = parseLateFeeToBps(value);
      if (bps === null) {
        ctx.addIssue({ code: "custom", message: `Enter a monthly rate from 0 to ${MAX_LATE_FEE_BPS / 100}%` });
        return z.NEVER;
      }
      return bps;
    }),
    feedbackDays: wholeNumber(TERM_BOUNDS.feedbackDays),
    warrantyDays: wholeNumber(TERM_BOUNDS.warrantyDays),
    terminationNoticeDays: wholeNumber(TERM_BOUNDS.terminationNoticeDays),
    projectName: line(160, "Keep the project name under 160 characters").pipe(z.string().min(1, "Name the project")),
    packageRef: line(200, "Keep it under 200 characters").transform((v) => v || null),
    background: z
      .string()
      .transform((v) => v.replace(/\r\n?/g, "\n").trim())
      .pipe(z.string().max(4000, "Keep the background under 4,000 characters")),
    scope: listField,
    deliverables: listField,
    outOfScope: listField,
    assumptions: listField,
    milestones: milestonesField,
  })
  .superRefine((d, ctx) => {
    const problem = percentagesProblem(d.depositPct, d.midpointPct, d.finalPct);
    if (problem) ctx.addIssue({ code: "custom", path: ["schedule"], message: problem });
  });

const FORM_KEYS = [
  "effectiveDate",
  "clientName",
  "clientCompany",
  "clientEmail",
  "depositPct",
  "midpointPct",
  "finalPct",
  "midpointMilestone",
  "invoiceDueDays",
  "lateFee",
  "feedbackDays",
  "warrantyDays",
  "terminationNoticeDays",
  "projectName",
  "packageRef",
  "background",
  "scope",
  "deliverables",
  "outOfScope",
  "assumptions",
  "milestones",
] as const satisfies readonly AgreementField[];

const FIELD_SET = new Set<string>([...FORM_KEYS, "schedule"]);

function editorErrors(error: z.ZodError): AgreementEditorState {
  const fieldErrors: Partial<Record<AgreementField, string>> = {};
  const milestoneErrors: Record<number, Partial<Record<keyof MilestoneInput, string>>> = {};
  let other: string | undefined;

  for (const issue of error.issues) {
    const [head, index, sub] = issue.path;
    if (head === "milestones" && typeof index === "number" && (sub === "label" || sub === "date")) {
      const row = (milestoneErrors[index] ??= {});
      row[sub] ??= issue.message;
    } else if (typeof head === "string" && FIELD_SET.has(head)) {
      fieldErrors[head as AgreementField] ??= issue.message;
    } else {
      other ??= "Something in the form was not valid. Reload the page and try again.";
    }
  }
  return { error: other ?? "Please fix the highlighted fields.", fieldErrors, milestoneErrors };
}

export async function updateAgreement(_prev: AgreementEditorState, formData: FormData): Promise<AgreementEditorState> {
  await requireAdmin();

  const id = idSchema.safeParse(field(formData, "id"));
  const version = z.iso.datetime().safeParse(field(formData, "version"));
  if (!id.success) return { error: "This agreement could not be identified. Reload the page and try again." };
  if (!version.success) return { error: "This form is out of date. Reload the page to load the latest version." };

  const parsed = agreementSchema.safeParse(Object.fromEntries(FORM_KEYS.map((k) => [k, field(formData, k)])));
  if (!parsed.success) {
    const state = editorErrors(parsed.error);
    // zod skips the cross-field check while any field is invalid; report a
    // schedule that doesn't add up in the same round rather than the next.
    const [deposit, midpoint, final] = (["depositPct", "midpointPct", "finalPct"] as const).map((k) =>
      parseWholeNumber(field(formData, k), 0, 100),
    );
    if (state?.fieldErrors && !state.fieldErrors.schedule && deposit !== null && midpoint !== null && final !== null) {
      const problem = percentagesProblem(deposit, midpoint, final);
      if (problem) state.fieldErrors.schedule = problem;
    }
    return state;
  }
  const d = parsed.data;

  const data = {
    effectiveDate: d.effectiveDate,
    clientName: d.clientName,
    clientCompany: d.clientCompany,
    clientEmail: d.clientEmail,
    depositPct: d.depositPct,
    midpointPct: d.midpointPct,
    finalPct: d.finalPct,
    midpointMilestone: d.midpointMilestone,
    invoiceDueDays: d.invoiceDueDays,
    lateFeeBps: d.lateFee,
    feedbackDays: d.feedbackDays,
    warrantyDays: d.warrantyDays,
    terminationNoticeDays: d.terminationNoticeDays,
    projectName: d.projectName,
    packageRef: d.packageRef,
    background: d.background,
    scope: d.scope,
    deliverables: d.deliverables,
    outOfScope: d.outOfScope,
    assumptions: d.assumptions,
    milestones: d.milestones,
  } satisfies Prisma.AgreementUpdateManyMutationInput;

  const staleMessage =
    "This agreement changed after you opened the editor (for example, it was refreshed from its quotation). Your edits are still here: save again to replace those changes, or reload to start from the latest version.";

  try {
    const existing = await db.agreement.findUnique({
      where: { id: id.data },
      select: { status: true, updatedAt: true, subtotalFils: true, vatBps: true },
    });
    if (!existing) return { error: "This agreement no longer exists." };
    if (existing.status !== "DRAFT") {
      return { error: "Only draft agreements can be edited. Move it back to draft on the agreement page first." };
    }
    if (existing.updatedAt.getTime() !== new Date(version.data).getTime()) {
      return { error: staleMessage, version: existing.updatedAt.toISOString() };
    }
    // Compare-and-set: if anything saved or synced in between, nothing is written.
    // The stored total is what the stage invoices add up to, and that depends
    // on the split: re-derive it whenever the schedule is saved.
    const { totalFils } = scheduleTotals({
      subtotalFils: existing.subtotalFils,
      vatBps: existing.vatBps,
      depositPct: data.depositPct,
      midpointPct: data.midpointPct,
      finalPct: data.finalPct,
      midpointMilestone: data.midpointMilestone,
    });
    const updated = await db.agreement.updateMany({
      where: { id: id.data, status: "DRAFT", updatedAt: existing.updatedAt },
      data: { ...data, totalFils },
    });
    if (updated.count === 0) {
      const current = await db.agreement.findUnique({ where: { id: id.data }, select: { status: true, updatedAt: true } });
      if (!current) return { error: "This agreement no longer exists." };
      if (current.status !== "DRAFT") return { error: "This agreement was sent or cancelled while you were editing it." };
      return { error: staleMessage, version: current.updatedAt.toISOString() };
    }
  } catch (e) {
    return unexpectedError("updateAgreement", e, "The agreement could not be saved. Your changes are still here — please try again.");
  }

  revalidateAdmin();
  redirect(`/admin/billing/agreements/${id.data}`);
}

// ─── Status ──────────────────────────────────────────────────────────────────

const statusSchema = z.object({ id: idSchema, status: z.enum(["DRAFT", "SENT", "SIGNED", "CANCELLED"]) });

/**
 * Why an agreement can't go out with its quotation in this state, or null.
 * A declined or expired quote means the deal is off until it is reopened.
 */
function quoteBlocksSending(quote: { number: string; status: QuoteStatus }): string | null {
  if (quote.status !== "DECLINED" && quote.status !== "EXPIRED") return null;
  return `Quotation ${quote.number} is marked ${quote.status === "DECLINED" ? "declined" : "expired"}. Reopen it as sent before sending this agreement, or cancel the agreement if the deal is off.`;
}

function statusEvent(number: string, from: AgreementStatus, to: AgreementStatus): string {
  switch (to) {
    case "SENT":
      return `Service agreement ${number} sent for signature.`;
    case "SIGNED":
      return `Service agreement ${number} signed.`;
    case "CANCELLED":
      return `Service agreement ${number} cancelled.`;
    case "DRAFT":
      return from === "CANCELLED"
        ? `Service agreement ${number} reopened as a draft.`
        : `Service agreement ${number} moved back to draft.`;
  }
}

export async function setAgreementStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = statusSchema.safeParse({ id: field(formData, "id"), status: field(formData, "status") });
  if (!parsed.success) return { error: "That status change is not valid." };
  const { id, status } = parsed.data;

  const agreement = await db.agreement.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      updatedAt: true,
      leadId: true,
      depositPct: true,
      midpointPct: true,
      finalPct: true,
      subtotalFils: true,
      vatBps: true,
      lead: { select: { status: true } },
      quote: { select: { id: true, number: true, status: true, leadId: true } },
      _count: { select: { invoices: { where: STAGE_INVOICES } } },
    },
  });
  if (!agreement) return { error: "This agreement no longer exists." };
  if (!AGREEMENT_TRANSITIONS[agreement.status].includes(status)) {
    return {
      error: `A ${AGREEMENT_STATUS[agreement.status].label.toLowerCase()} agreement can't be marked as ${AGREEMENT_STATUS[status].label.toLowerCase()}.`,
    };
  }
  if (status === "SENT") {
    const problem = percentagesProblem(agreement.depositPct, agreement.midpointPct, agreement.finalPct);
    if (problem) return { error: `${problem} Fix the payment schedule before sending.` };
    const blocked = agreement.quote && quoteBlocksSending(agreement.quote);
    if (blocked) return { error: blocked };
  }
  const openStageInvoices = agreement._count.invoices;
  if (status === "DRAFT" && openStageInvoices > 0) {
    return {
      error: "Invoices were already issued from this agreement's payment schedule, so its terms can't change. Void them first.",
    };
  }

  const now = new Date();
  const data: Prisma.AgreementUpdateManyMutationInput =
    status === "SENT"
      ? { status, sentAt: now, signedAt: null }
      : status === "SIGNED"
        ? { status, signedAt: now }
        : status === "DRAFT"
          ? { status, sentAt: null, signedAt: null }
          : { status };

  const quote = agreement.quote;
  // Sending and signing carry the quotation along with the agreement, so both
  // take its row lock first and decide on the status read under that lock.
  const touchesQuote = quote !== null && (status === "SENT" || status === "SIGNED");
  const unchanged = { quoteSent: false, quoteAccepted: false, leadWon: false };
  let outcome = unchanged;
  try {
    outcome = await db.$transaction(
      async (tx) => {
        const quoteStatus = touchesQuote && quote ? await lockQuote(tx, quote.id) : null;
        if (status === "SENT" && quote && quoteStatus) {
          const blocked = quoteBlocksSending({ number: quote.number, status: quoteStatus });
          if (blocked) throw new Refused(blocked);
        }
        const updated = await tx.agreement.updateMany({
          where: { id, status: agreement.status, updatedAt: agreement.updatedAt },
          data,
        });
        if (updated.count === 0) throw new StaleError();
        await logLeadEvent(agreement.leadId, statusEvent(agreement.number, agreement.status, status), admin.id, tx);

        if (!quote || !quoteStatus) return unchanged;

        if (status === "SENT") {
          // What goes out must match the quotation it rests on. The version
          // check above confirmed our copy of the agreement's price; the
          // quote's is read under its lock.
          const current = await tx.quote.findUniqueOrThrow({
            where: { id: quote.id },
            select: { vatBps: true, items: { select: { quantity: true, unitPriceFils: true } } },
          });
          const quoted = documentTotals(current.items, current.vatBps);
          if (quoted.subtotalFils !== agreement.subtotalFils || current.vatBps !== agreement.vatBps) {
            throw new Refused(
              `Quotation ${quote.number}'s price changed after this agreement was generated. Refresh it from the quotation before sending.`,
            );
          }
          if (quoteStatus !== "DRAFT") return unchanged;
          // The quotation goes out with its agreement: it is sent too, which
          // also locks it for editing, so the price can't drift from here on.
          await tx.quote.updateMany({ where: { id: quote.id, status: "DRAFT" }, data: { status: "SENT" } });
          await logLeadEvent(
            quote.leadId,
            `Quotation ${quote.number} sent to the client with service agreement ${agreement.number}.`,
            admin.id,
            tx,
          );
          return { ...unchanged, quoteSent: true };
        }

        // A signature is the client's yes and outranks any earlier answer on
        // the quotation: whether it was still a draft, awaiting an answer,
        // declined or expired, it is accepted with the signature, which also
        // marks the opportunity Won.
        if (quoteStatus === "ACCEPTED") return unchanged;
        await tx.quote.updateMany({ where: { id: quote.id, status: quoteStatus }, data: { status: "ACCEPTED" } });
        const result = await onQuoteAccepted(tx, { id: quote.id, number: quote.number, leadId: quote.leadId }, admin);
        return { ...unchanged, quoteAccepted: true, leadWon: result.leadWon };
      },
      { timeout: 15_000 },
    );
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    if (e instanceof StaleError) return { error: CHANGED_ELSEWHERE };
    if (e instanceof AgreementAmountTooLargeError) return { error: AGREEMENT_TOO_LARGE_MESSAGE };
    return unexpectedError("setAgreementStatus", e, "The status could not be changed. Please try again.");
  }

  revalidateAdmin();

  switch (status) {
    case "SENT":
      return outcome.quoteSent && quote
        ? {
            notice: `${agreement.number} and quotation ${quote.number} marked as sent. Both are locked now; invoice the deposit from the payment schedule when it's due.`,
            links: [{ label: `Quotation ${quote.number}`, href: `/admin/billing/quotes/${quote.id}` }],
          }
        : {
            notice: `${agreement.number} marked as sent for signature. Its terms are locked; invoice the deposit from the payment schedule when it's due.`,
          };
    case "SIGNED": {
      if (outcome.quoteAccepted && quote) {
        return {
          notice: `${agreement.number} signed. Quotation ${quote.number} accepted${outcome.leadWon ? " · opportunity marked Won" : ""}.`,
          links: [
            { label: `Quotation ${quote.number}`, href: `/admin/billing/quotes/${quote.id}` },
            ...(quote.leadId ? [{ label: "Opportunity", href: `/admin/crm/${quote.leadId}` }] : []),
          ],
        };
      }
      // The quote was accepted earlier, but the opportunity has since been
      // moved out of Won by hand: point at it rather than overrule the CRM.
      const lead = agreement.lead;
      if (agreement.leadId && lead && lead.status !== "WON") {
        return {
          notice: `${agreement.number} signed. The opportunity is still in ${LEAD_STATUS[lead.status]?.label ?? lead.status} — mark it Won in the CRM.`,
          links: [{ label: "Opportunity", href: `/admin/crm/${agreement.leadId}` }],
        };
      }
      return { notice: `${agreement.number} signed. Create the stage invoices from the payment schedule as they fall due.` };
    }
    case "CANCELLED":
      return {
        notice:
          openStageInvoices > 0
            ? `${agreement.number} cancelled. ${openStageInvoices} stage invoice${openStageInvoices === 1 ? " is" : "s are"} still on record — void ${openStageInvoices === 1 ? "it" : "them"} if no longer payable.`
            : `${agreement.number} cancelled.`,
      };
    case "DRAFT":
      return { notice: `${agreement.number} is a draft again and can be edited.` };
  }
}

// ─── Refresh from the quotation ──────────────────────────────────────────────

/** Re-copies client and price from the quotation into a DRAFT agreement. */
export async function syncAgreementFromQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = idSchema.safeParse(field(formData, "id"));
  if (!parsed.success) return { error: "That agreement could not be found." };
  const id = parsed.data;

  const agreement = await db.agreement.findUnique({
    where: { id },
    select: { number: true, status: true, leadId: true, quote: { select: { number: true } } },
  });
  if (!agreement) return { error: "This agreement no longer exists." };
  if (agreement.status !== "DRAFT") {
    return { error: "Only a draft agreement can be refreshed from its quotation. Move it back to draft first." };
  }
  const quote = agreement.quote;
  if (!quote) return { error: "This agreement is no longer linked to a quotation." };

  let fresh: { totalFils: number; currency: string } | null;
  try {
    fresh = await db.$transaction(async (tx) => {
      if (!(await syncSnapshotFromQuote(tx, id))) throw new StaleError();
      await logLeadEvent(
        agreement.leadId,
        `Service agreement ${agreement.number} refreshed from quotation ${quote.number}.`,
        admin.id,
        tx,
      );
      return tx.agreement.findUnique({ where: { id }, select: { totalFils: true, currency: true } });
    });
  } catch (e) {
    if (e instanceof StaleError) return { error: CHANGED_ELSEWHERE };
    if (e instanceof AgreementAmountTooLargeError) return { error: AGREEMENT_TOO_LARGE_MESSAGE };
    return unexpectedError("syncAgreementFromQuote", e, "The agreement could not be refreshed. Please try again.");
  }

  revalidateAdmin();
  return {
    notice: `Client and price refreshed from quotation ${quote.number}${fresh ? ` — total now ${formatMoney(fresh.totalFils, fresh.currency)}` : ""}.`,
  };
}

// ─── Delete a draft ──────────────────────────────────────────────────────────

export async function deleteDraftAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = idSchema.safeParse(field(formData, "id"));
  if (!parsed.success) return { error: "That agreement could not be found." };
  const id = parsed.data;

  const agreement = await db.agreement.findUnique({
    where: { id },
    select: { number: true, status: true, leadId: true, quoteId: true, _count: { select: { invoices: true } } },
  });
  if (!agreement) return { error: "This agreement no longer exists." };
  if (agreement.status !== "DRAFT") {
    return { error: "Only draft agreements can be deleted. Cancel it instead, so it stays on record." };
  }
  if (agreement._count.invoices > 0) {
    return { error: "Invoices were issued from this agreement, so it stays on record. Cancel it instead." };
  }

  try {
    await db.$transaction(async (tx) => {
      // Conditional delete: if it was sent or invoiced in the meantime, nothing is removed.
      const deleted = await tx.agreement.deleteMany({ where: { id, status: "DRAFT", invoices: { none: {} } } });
      if (deleted.count === 0) throw new StaleError();
      await logLeadEvent(agreement.leadId, `Draft service agreement ${agreement.number} deleted.`, admin.id, tx);
    });
  } catch (e) {
    if (e instanceof StaleError) return { error: "This agreement is no longer a draft, so it was not deleted." };
    return unexpectedError("deleteDraftAgreement", e, "The agreement could not be deleted. Please try again.");
  }

  revalidateAdmin();
  redirect(agreement.quoteId ? `/admin/billing/quotes/${agreement.quoteId}` : "/admin/billing?tab=agreements");
}

// ─── Project from the SOW ────────────────────────────────────────────────────

/** Longest project description taken from the SOW background. */
const MAX_PROJECT_DESCRIPTION = 2000;
/** Project and task name limits, as in the projects module's own forms. */
const MAX_PROJECT_NAME = 120;
const MAX_TASK_TITLE = 200;

/** Cuts at a word boundary and marks the cut, rather than mid-word. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Project dates from the SOW timeline: from the earliest to the latest dated
 * milestone. With a single date, that date is the delivery target and the
 * work starts on the effective date; with none, only the start is known.
 */
function projectDates(effectiveDate: Date, milestones: unknown): { startDate: Date; dueDate: Date | null } {
  const dated = parseMilestones(milestones)
    .map((m) => (m.date ? dateInputToDate(m.date) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dated.length === 0) return { startDate: effectiveDate, dueDate: null };
  const last = dated[dated.length - 1];
  const first = dated.length > 1 ? dated[0] : effectiveDate;
  return { startDate: first.getTime() <= last.getTime() ? first : last, dueDate: last };
}

export async function createProjectFromAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = idSchema.safeParse(field(formData, "id"));
  if (!parsed.success) return { error: "That agreement could not be found." };
  const id = parsed.data;

  const agreement = await db.agreement.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      projectId: true,
      projectName: true,
      background: true,
      scope: true,
      milestones: true,
      effectiveDate: true,
      subtotalFils: true,
      leadId: true,
      quoteId: true,
    },
  });
  if (!agreement) return { error: "This agreement no longer exists." };
  // One project per agreement: an existing one is where the admin wants to be.
  if (agreement.projectId) redirect(`/admin/projects/${agreement.projectId}`);
  if (agreement.status === "CANCELLED") {
    return { error: "This agreement is cancelled. Reopen it as a draft before starting a project from it." };
  }

  const name = clip(agreement.projectName.trim(), MAX_PROJECT_NAME);
  const background = agreement.background.trim();
  const { startDate, dueDate } = projectDates(agreement.effectiveDate, agreement.milestones);

  let projectId: string;
  try {
    projectId = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description: background
            ? clip(background, MAX_PROJECT_DESCRIPTION)
            : `Delivery under service agreement ${agreement.number}.`,
          status: "PLANNING",
          startDate,
          dueDate,
          valueFils: agreement.subtotalFils,
          leadId: agreement.leadId,
          tasks: {
            create: agreement.scope.map((item, position) => ({
              title: clip(item.trim(), MAX_TASK_TITLE),
              status: "TODO" as const,
              position,
            })),
          },
        },
        select: { id: true },
      });
      // Claim the link; a concurrent submit that got there first wins.
      const linked = await tx.agreement.updateMany({
        where: { id, projectId: null, status: { not: "CANCELLED" } },
        data: { projectId: project.id },
      });
      if (linked.count === 0) throw new StaleError();
      // Invoices already raised for this deal belong to its delivery project.
      await tx.invoice.updateMany({
        where: {
          projectId: null,
          OR: [{ agreementId: id }, ...(agreement.quoteId ? [{ quoteId: agreement.quoteId }] : [])],
        },
        data: { projectId: project.id },
      });
      await logLeadEvent(
        agreement.leadId,
        `Project “${name}” created from service agreement ${agreement.number}.`,
        admin.id,
        tx,
      );
      return project.id;
    });
  } catch (e) {
    if (!(e instanceof StaleError) && !isUniqueViolation(e)) {
      return unexpectedError("createProjectFromAgreement", e, "The project could not be created. Please try again.");
    }
    const current = await db.agreement.findUnique({ where: { id }, select: { projectId: true } });
    if (!current?.projectId) return { error: CHANGED_ELSEWHERE };
    projectId = current.projectId;
  }

  revalidateAdmin();
  redirect(`/admin/projects/${projectId}`);
}

// ─── Stage invoices ──────────────────────────────────────────────────────────

const installmentSchema = z.object({ id: idSchema, installment: z.enum(INSTALLMENTS) });

/** One invoice for one stage of the payment schedule (Section 2), as a DRAFT to review and send. */
export async function createInstallmentInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = installmentSchema.safeParse({ id: field(formData, "id"), installment: field(formData, "installment") });
  if (!parsed.success) return { error: "That payment stage is not valid." };
  const { id, installment } = parsed.data;
  const stageLabel = INSTALLMENT_LABEL[installment];

  const agreement = await db.agreement.findUnique({
    where: { id },
    select: {
      status: true,
      quoteId: true,
      quote: { select: { invoice: { select: { number: true, status: true } } } },
      invoices: { where: { installment }, select: { id: true, status: true } },
    },
  });
  if (!agreement) return { error: "This agreement no longer exists." };
  // One invoice per stage: an existing one is where the admin wants to be.
  const existing = agreement.invoices.find((inv) => inv.status !== "VOID");
  if (existing) redirect(`/admin/billing/invoices/${existing.id}`);
  if (agreement.status !== "SENT" && agreement.status !== "SIGNED") {
    return { error: "Stage invoices can be created once the agreement has been sent for signature or signed." };
  }
  const fullInvoice = agreement.quote?.invoice;
  if (fullInvoice && fullInvoice.status !== "VOID") {
    return {
      error: `The quotation was already billed in full as invoice ${fullInvoice.number}, so it can't also be billed in stages.`,
    };
  }

  const issue = toDateInputValue(new Date());
  const issueDate = dateInputToDate(issue);
  if (!issueDate) return { error: "Could not work out the invoice dates. Try again." };

  let invoiceId: string;
  try {
    invoiceId = await db.$transaction(async (tx) => {
      // The quote first (see lockQuote), then the agreement.
      if (agreement.quoteId) await lockQuote(tx, agreement.quoteId);
      // Lock the agreement and re-read its terms under the lock: it must still
      // be sent or signed, and a concurrent "Back to draft" now fails its
      // version check instead of changing the terms under this invoice.
      const locked = await tx.agreement.updateMany({
        where: { id, status: { in: ["SENT", "SIGNED"] } },
        data: { updatedAt: new Date() },
      });
      if (locked.count === 0) throw new StaleError();
      const terms = await tx.agreement.findUniqueOrThrow({
        where: { id },
        select: {
          number: true,
          projectName: true,
          currency: true,
          subtotalFils: true,
          vatBps: true,
          depositPct: true,
          midpointPct: true,
          finalPct: true,
          midpointMilestone: true,
          invoiceDueDays: true,
          clientName: true,
          clientEmail: true,
          clientCompany: true,
          leadId: true,
          projectId: true,
          quoteId: true,
        },
      });

      // Read under the quote lock, so a full conversion committed meanwhile is seen.
      if (terms.quoteId) {
        const full = await tx.invoice.findUnique({ where: { quoteId: terms.quoteId }, select: { number: true, status: true } });
        if (full && full.status !== "VOID") {
          throw new Refused(
            `The quotation was already billed in full as invoice ${full.number}, so it can't also be billed in stages.`,
          );
        }
      }
      const problem = percentagesProblem(terms.depositPct, terms.midpointPct, terms.finalPct);
      if (problem) throw new Refused(`${problem} Move the agreement back to draft to fix its payment schedule.`);
      const stage = installmentPlan(terms).find((l) => l.installment === installment);
      if (!stage) throw new Refused(`The ${stageLabel.toLowerCase()} is 0% in this payment schedule, so there is nothing to invoice.`);

      // A voided stage invoice stays on record but gives up its slot, so the
      // stage can be billed again.
      await tx.invoice.updateMany({
        where: { agreementId: id, installment, status: "VOID" },
        data: { installment: null },
      });

      const number = await nextDocumentNumber("invoice", tx);
      const dueDate = dateInputToDate(addDaysToDateInput(issue, terms.invoiceDueDays)) ?? issueDate;
      const created = await tx.invoice.create({
        data: {
          number,
          status: "DRAFT",
          issueDate,
          dueDate,
          currency: terms.currency,
          vatBps: terms.vatBps,
          notes: `Payment ${stage.due}, as per Section 2 of Service Agreement ${terms.number}.`.slice(0, 4000),
          clientName: terms.clientName,
          clientEmail: terms.clientEmail ?? "",
          clientCompany: terms.clientCompany,
          leadId: terms.leadId,
          projectId: terms.projectId,
          agreementId: id,
          installment,
          items: {
            create: [
              {
                description: `${stageLabel} (${stage.pct}%) — Service Agreement ${terms.number}: ${terms.projectName}`.slice(0, 500),
                quantity: 1,
                unitPriceFils: stage.subtotalFils,
                position: 0,
              },
            ],
          },
        },
        select: { id: true },
      });
      await logLeadEvent(
        terms.leadId,
        `Invoice ${number} created for the ${stageLabel.toLowerCase()} (${stage.pct}%) of service agreement ${terms.number}.`,
        admin.id,
        tx,
      );
      return created.id;
    });
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    if (e instanceof StaleError) {
      return { error: "This agreement is no longer sent or signed, so no invoice was created. Reload to see its status." };
    }
    // (agreementId, installment) is unique: a concurrent submit already made this stage's invoice.
    if (!isUniqueViolation(e)) {
      return unexpectedError("createInstallmentInvoice", e, "The invoice could not be created. Please try again.");
    }
    const raced = await db.invoice.findFirst({ where: { agreementId: id, installment }, select: { id: true } });
    if (!raced) return { error: "The invoice could not be created. Please try again." };
    invoiceId = raced.id;
  }

  revalidateAdmin();
  redirect(`/admin/billing/invoices/${invoiceId}`);
}

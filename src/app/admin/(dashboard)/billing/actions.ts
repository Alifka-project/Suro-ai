"use server";

/**
 * Billing mutations. Every export here is a public POST endpoint, so each one
 * authorizes first, validates every field with zod, and re-reads the record it
 * touches instead of trusting ids or statuses sent by the browser.
 *
 * Quotes, invoices and service agreements are one chain: accepting a quote
 * generates its agreement and wins the opportunity (see @/lib/admin/deals),
 * and every status change is written to the opportunity's timeline in the
 * same transaction as the change itself.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type AgreementStatus, type QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { INSTALLMENT_LABEL } from "@/lib/admin/agreement-terms";
import {
  AGREEMENT_TOO_LARGE_MESSAGE,
  AgreementAmountTooLargeError,
  advanceClientStatus,
  onQuoteAccepted,
} from "@/lib/admin/deals";
import { DEFAULT_CURRENCY, documentTotals, formatMoney } from "@/lib/admin/money";
import { nextDocumentNumber } from "@/lib/admin/numbering";
import { INVOICE_STATUS, LEAD_STATUS, QUOTE_STATUS } from "@/lib/admin/labels";
import { billingBackHref, clientHref, moduleEnabled } from "@/lib/admin/modules";
import { addDaysToDateInput, dateInputToDate, toDateInputValue } from "@/lib/admin/time";
import { logLeadEvent } from "@/lib/admin/timeline";
import {
  MAX_LINE_ITEMS,
  MAX_QUANTITY,
  parseQuantity,
  parseUnitPriceFils,
  parseVatPercentToBps,
} from "./_lib/parse";
import { INVOICE_TRANSITIONS, QUOTE_TRANSITIONS, isSentMoveUseless } from "./_lib/status";
import type { ActionState, EditorField, EditorItemInput, EditorState, NoticeLink } from "./_lib/types";

// ─── Shared helpers ──────────────────────────────────────────────────────────

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

/** Optional foreign key from a hidden input or select: "" means "not linked". */
const optionalIdSchema = z.union([z.literal(""), idSchema]).transform((v) => (v === "" ? null : v));

function dateSchema(label: string) {
  return z.string().transform((value, ctx) => {
    if (value.trim() === "") {
      ctx.addIssue({ code: "custom", message: `${label} is required` });
      return z.NEVER;
    }
    const date = dateInputToDate(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: `Enter a valid ${label.toLowerCase()}` });
      return z.NEVER;
    }
    return date;
  });
}

const itemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Add a description")
    .max(500, "Keep the description under 500 characters"),
  quantity: z.union([z.string(), z.number()]).transform((value, ctx) => {
    const quantity = parseQuantity(value);
    if (quantity === null) {
      ctx.addIssue({
        code: "custom",
        message: `Quantity must be above 0 and at most ${MAX_QUANTITY.toLocaleString("en-AE")}`,
      });
      return z.NEVER;
    }
    return quantity;
  }),
  unitPrice: z.union([z.string(), z.number()]).transform((value, ctx) => {
    const fils = parseUnitPriceFils(value);
    if (fils === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price of 0 or more, e.g. 2500 or 2,500.00" });
      return z.NEVER;
    }
    return fils;
  }),
});

/** Line items arrive as one JSON string field and are validated item by item. */
const itemsSchema = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Line items could not be read. Reload the page and try again." });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(itemSchema, { error: "Line items could not be read. Reload the page and try again." })
      .min(1, "Add at least one line item")
      .max(MAX_LINE_ITEMS, `A document can have at most ${MAX_LINE_ITEMS} line items`),
  );

const documentFields = {
  id: optionalIdSchema,
  leadId: optionalIdSchema,
  clientName: z.string().trim().min(1, "Client name is required").max(160, "Keep the name under 160 characters"),
  clientEmail: z
    .string()
    .trim()
    .min(1, "Client email is required")
    .max(254, "That email address is too long")
    .pipe(z.email("Enter a valid email address")),
  clientCompany: z
    .string()
    .trim()
    .max(160, "Keep the company name under 160 characters")
    .transform((v) => (v === "" ? null : v)),
  issueDate: dateSchema("Issue date"),
  vat: z.string().transform((value, ctx) => {
    const bps = parseVatPercentToBps(value);
    if (bps === null) {
      ctx.addIssue({ code: "custom", message: "VAT must be between 0 and 100%" });
      return z.NEVER;
    }
    return bps;
  }),
  notes: z
    .string()
    .trim()
    .max(4000, "Keep notes under 4,000 characters")
    .transform((v) => (v === "" ? null : v)),
  items: itemsSchema,
};

const quoteSchema = z
  .object({ ...documentFields, validUntil: dateSchema("Valid-until date") })
  .superRefine((d, ctx) => {
    if (d.validUntil.getTime() < d.issueDate.getTime()) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Must be on or after the issue date" });
    }
  });

const invoiceSchema = z
  .object({ ...documentFields, projectId: optionalIdSchema, dueDate: dateSchema("Due date") })
  .superRefine((d, ctx) => {
    if (d.dueDate.getTime() < d.issueDate.getTime()) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Must be on or after the issue date" });
    }
  });

const EDITOR_FIELDS = new Set<string>([
  "clientName",
  "clientEmail",
  "clientCompany",
  "issueDate",
  "validUntil",
  "dueDate",
  "vat",
  "notes",
  "items",
  "leadId",
  "projectId",
]);
const ITEM_FIELDS = new Set<string>(["description", "quantity", "unitPrice"]);

function editorErrors(error: z.ZodError): EditorState {
  const fieldErrors: Partial<Record<EditorField, string>> = {};
  const itemErrors: Record<number, Partial<Record<keyof EditorItemInput, string>>> = {};
  let other: string | undefined;

  for (const issue of error.issues) {
    const [head, index, sub] = issue.path;
    if (head === "items" && typeof index === "number" && typeof sub === "string" && ITEM_FIELDS.has(sub)) {
      const row = (itemErrors[index] ??= {});
      row[sub as keyof EditorItemInput] ??= issue.message;
    } else if (typeof head === "string" && EDITOR_FIELDS.has(head)) {
      fieldErrors[head as EditorField] ??= issue.message;
    } else {
      other ??= "Something in the form was not valid. Reload the page and try again.";
    }
  }

  return { error: other ?? "Please fix the highlighted fields.", fieldErrors, itemErrors };
}

function readDocumentForm(formData: FormData, extra: string[]) {
  const keys = ["id", "leadId", "clientName", "clientEmail", "clientCompany", "issueDate", "vat", "notes", "items", ...extra];
  return Object.fromEntries(keys.map((k) => [k, field(formData, k)]));
}

function toLineItems(items: { description: string; quantity: number; unitPrice: number }[]) {
  return items.map((item, position) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceFils: item.unitPrice,
    position,
  }));
}

/**
 * A billing change shows up across the dashboard: billing lists and KPIs, the
 * quote's agreement and its payment schedule, the opportunity's timeline, the
 * project's invoiced figures and analytics. The admin is fully dynamic, so
 * revalidating the /admin layout clears the router cache for all of it.
 */
function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

async function leadExists(id: string) {
  return (await db.lead.count({ where: { id } })) > 0;
}

/** The picked client was deleted meanwhile. CRM wording only while the CRM is on. */
function missingLeadError(): EditorState {
  return moduleEnabled("crm")
    ? { error: "The linked lead no longer exists.", fieldErrors: { leadId: "Pick another lead or none" } }
    : { error: "The linked client no longer exists.", fieldErrors: { leadId: "Pick another client or none" } };
}

class StaleDocumentError extends Error {}
/** The quote is billed in stages through its agreement, so it can't be billed in full too. */
class StagedBillingError extends Error {}
/** The quote's agreement was signed meanwhile, so the quote must stay accepted. */
class SignedAgreementError extends Error {}

/** A unique constraint clashed: someone created the same record at the same moment. */
function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const idOnlySchema = z.object({ id: idSchema });

/**
 * An unexpected failure (database unreachable, a Prisma error we don't map)
 * is logged and returned as a form error instead of thrown: a throw would hit
 * the error boundary and discard everything typed into the editor.
 */
function unexpectedError(context: string, e: unknown, message: string): { error: string } {
  console.error(`[billing] ${context} failed`, e);
  return { error: message };
}

const SAVE_FAILED = "The document could not be saved. Your changes are still here — please try again.";

/**
 * Agreement statuses that fix the quotation's price: what the client was sent
 * or signed. Sending an agreement also sends a draft quote (see
 * setAgreementStatus), so this only bites on quotes left in draft before that.
 */
const PRICE_LOCKING_AGREEMENT: AgreementStatus[] = ["SENT", "SIGNED"];

/** Postgres INT4 ceiling: the largest fils amount an agreement column can hold. */
const MAX_AGREEMENT_FILS = 2_147_483_647;

// ─── Create / edit ───────────────────────────────────────────────────────────

export async function saveQuote(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const parsed = quoteSchema.safeParse(readDocumentForm(formData, ["validUntil"]));
  if (!parsed.success) return editorErrors(parsed.error);
  const d = parsed.data;

  const data = {
    clientName: d.clientName,
    clientEmail: d.clientEmail,
    clientCompany: d.clientCompany,
    issueDate: d.issueDate,
    validUntil: d.validUntil,
    vatBps: d.vat,
    notes: d.notes,
    leadId: d.leadId,
  };
  const items = toLineItems(d.items);

  // A quotation becomes a service agreement, whose amounts are INT4 columns.
  // Catch an oversized total here, where the admin can still split it.
  if (documentTotals(items, d.vat).totalFils > MAX_AGREEMENT_FILS) {
    return { error: AGREEMENT_TOO_LARGE_MESSAGE };
  }

  let quoteId: string;

  try {
    if (d.leadId && !(await leadExists(d.leadId))) {
      return missingLeadError();
    }

    if (d.id) {
      const existing = await db.quote.findUnique({
        where: { id: d.id },
        select: { status: true, leadId: true, agreement: { select: { number: true, status: true } } },
      });
      if (!existing) return { error: "This quote no longer exists." };
      if (existing.status !== "DRAFT") return { error: "Only draft quotes can be edited." };
      // The agreement (and any invoices from it) belong to the quote's
      // opportunity; moving only the quote would leave them on the old one.
      if (existing.agreement && (existing.leadId ?? null) !== (d.leadId ?? null)) {
        // With agreements switched off their pages are hidden, so deleting
        // the draft agreement is not an option to offer.
        return moduleEnabled("agreements")
          ? {
              error: `Service agreement ${existing.agreement.number} is linked to this quote's current opportunity. Delete the draft agreement first, then change the lead.`,
              fieldErrors: { leadId: "Can't change while an agreement is linked" },
            }
          : {
              error: `This quote has service agreement ${existing.agreement.number} on record for its current client, so the client can't be changed. Create a new quotation for the other client instead.`,
              fieldErrors: { leadId: "Can't change: this quote has a service agreement on record" },
            };
      }
      const agreement = existing.agreement;
      if (agreement && PRICE_LOCKING_AGREEMENT.includes(agreement.status)) {
        return {
          error:
            agreement.status === "SIGNED"
              ? `Service agreement ${agreement.number} was signed at this quote's price, so the quote can't be edited. Cancel the agreement to change it.`
              : `Service agreement ${agreement.number} was sent at this quote's price, so the quote can't be edited. Move the agreement back to draft to change it.`,
        };
      }
      const id = d.id;

      await db.$transaction(async (tx) => {
        // Conditional update doubles as a row lock: if the quote left DRAFT,
        // or its agreement went out, since we read it, nothing is written.
        const updated = await tx.quote.updateMany({
          where: { id, status: "DRAFT", NOT: { agreement: { is: { status: { in: PRICE_LOCKING_AGREEMENT } } } } },
          data,
        });
        if (updated.count === 0) throw new StaleDocumentError();
        await tx.lineItem.deleteMany({ where: { quoteId: id } });
        await tx.lineItem.createMany({ data: items.map((item) => ({ ...item, quoteId: id })) });
      });
      quoteId = id;
    } else {
      const number = await nextDocumentNumber("quote");
      const created = await db.quote.create({
        data: { ...data, number, status: "DRAFT", currency: DEFAULT_CURRENCY, items: { create: items } },
        select: { id: true },
      });
      quoteId = created.id;
    }
  } catch (e) {
    if (e instanceof StaleDocumentError) {
      return {
        error: "This quote, or its service agreement, was sent or changed elsewhere. Reload to see the latest version.",
      };
    }
    return unexpectedError("saveQuote", e, SAVE_FAILED);
  }

  revalidateAdmin();
  redirect(`/admin/billing/quotes/${quoteId}`);
}

export async function saveInvoice(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const parsed = invoiceSchema.safeParse(readDocumentForm(formData, ["projectId", "dueDate"]));
  if (!parsed.success) return editorErrors(parsed.error);
  const d = parsed.data;

  let leadId = d.leadId;
  let invoiceId: string;

  try {
    if (leadId && !(await leadExists(leadId))) {
      return missingLeadError();
    }
    if (d.projectId) {
      const project = await db.project.findUnique({ where: { id: d.projectId }, select: { leadId: true } });
      if (!project) {
        return { error: "The linked project no longer exists.", fieldErrors: { projectId: "Pick another project or none" } };
      }
      // A project invoice is always attributed to that project's client, so
      // CRM and analytics never credit one client's project to another. The
      // editor keeps the two in step; this is the authoritative check.
      if (project.leadId) {
        if (leadId && leadId !== project.leadId) {
          return {
            error: "The linked lead and project belong to different clients.",
            fieldErrors: { projectId: "This project belongs to a different client than the linked lead" },
          };
        }
        leadId = project.leadId;
      }
    }

    const data = {
      clientName: d.clientName,
      clientEmail: d.clientEmail,
      clientCompany: d.clientCompany,
      issueDate: d.issueDate,
      dueDate: d.dueDate,
      vatBps: d.vat,
      notes: d.notes,
      leadId,
      projectId: d.projectId,
    };
    const items = toLineItems(d.items);

    if (d.id) {
      const existing = await db.invoice.findUnique({ where: { id: d.id }, select: { status: true } });
      if (!existing) return { error: "This invoice no longer exists." };
      if (existing.status !== "DRAFT") return { error: "Only draft invoices can be edited." };
      const id = d.id;

      await db.$transaction(async (tx) => {
        const updated = await tx.invoice.updateMany({ where: { id, status: "DRAFT" }, data });
        if (updated.count === 0) throw new StaleDocumentError();
        await tx.lineItem.deleteMany({ where: { invoiceId: id } });
        await tx.lineItem.createMany({ data: items.map((item) => ({ ...item, invoiceId: id })) });
      });
      invoiceId = id;
    } else {
      const number = await nextDocumentNumber("invoice");
      const created = await db.invoice.create({
        data: { ...data, number, status: "DRAFT", currency: DEFAULT_CURRENCY, items: { create: items } },
        select: { id: true },
      });
      invoiceId = created.id;
    }
  } catch (e) {
    if (e instanceof StaleDocumentError) {
      return { error: "This invoice was sent or changed elsewhere. Reload to see the latest version." };
    }
    return unexpectedError("saveInvoice", e, SAVE_FAILED);
  }

  revalidateAdmin();
  redirect(`/admin/billing/invoices/${invoiceId}`);
}

// ─── Quote status ────────────────────────────────────────────────────────────

const quoteStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["SENT", "ACCEPTED", "DECLINED", "EXPIRED"]),
});

/** What the opportunity's timeline says about a quote status change. */
function quoteStatusEvent(number: string, from: QuoteStatus, to: QuoteStatus): string {
  if (to === "SENT") {
    if (from === "DRAFT") return `Quotation ${number} sent to the client.`;
    if (from === "ACCEPTED") return `Acceptance of quotation ${number} undone — back to sent.`;
    return `Quotation ${number} reopened as sent.`;
  }
  if (to === "DECLINED") return `Quotation ${number} declined by the client.`;
  if (to === "EXPIRED") return `Quotation ${number} expired.`;
  return `Quotation ${number} marked as ${QUOTE_STATUS[to].label.toLowerCase()}.`;
}

/** Non-void invoices billing one stage of an agreement's payment schedule. */
const STAGE_INVOICES = { installment: { not: null }, status: { not: "VOID" } } satisfies Prisma.InvoiceWhereInput;

/**
 * How a notice names the client a quote belongs to, and where its link goes:
 * the opportunity page with the CRM on, otherwise the client's dashboard row.
 */
function clientNotice(leadId: string) {
  return moduleEnabled("crm")
    ? { noun: "opportunity", link: { label: "Opportunity", href: clientHref(leadId) } }
    : { noun: "client", link: { label: "Client", href: clientHref(leadId) } };
}

const stagedLockMessage = (agreementNumber: string) =>
  `This quote is being billed in stages through service agreement ${agreementNumber}, so it can't be un-accepted, declined or expired.`;

const signedLockMessage = (agreementNumber: string) =>
  `Service agreement ${agreementNumber} is signed, so this quote can't be un-accepted, declined or expired. Cancel the agreement first if the deal fell through.`;

export async function setQuoteStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = quoteStatusSchema.safeParse({ id: field(formData, "id"), status: field(formData, "status") });
  if (!parsed.success) return { error: "That status change is not valid." };
  const { id, status } = parsed.data;

  const quote = await db.quote.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      leadId: true,
      updatedAt: true,
      lead: { select: { status: true } },
      invoice: { select: { id: true } },
      agreement: {
        select: {
          id: true,
          number: true,
          status: true,
          _count: { select: { invoices: { where: STAGE_INVOICES } } },
        },
      },
    },
  });
  if (!quote) return { error: "This quote no longer exists." };
  if (!QUOTE_TRANSITIONS[quote.status].includes(status)) {
    return {
      error: `A ${QUOTE_STATUS[quote.status].label.toLowerCase()} quote can't be marked as ${QUOTE_STATUS[status].label.toLowerCase()}.`,
    };
  }
  if (quote.invoice) {
    return { error: "This quote has already been converted to an invoice, so its status is locked." };
  }
  const agreement = quote.agreement;
  // Un-accepting, declining or expiring the quote says the deal is off.
  const backsOut = quote.status === "ACCEPTED" || status === "DECLINED" || status === "EXPIRED";
  // A signed agreement is the client's acceptance (signing accepts the quote):
  // while it stands, the quote may still move towards acceptance, never away.
  if (agreement?.status === "SIGNED" && backsOut) {
    return { error: signedLockMessage(agreement.number) };
  }
  // Billed in stages: the quote may still move towards acceptance (sent,
  // accepted), but never back out of the deal.
  if (agreement && agreement._count.invoices > 0 && backsOut) {
    return { error: stagedLockMessage(agreement.number) };
  }

  // Compare-and-set on the version, not just the status: converting a quote
  // leaves its status ACCEPTED but bumps updatedAt (see convertQuoteToInvoice),
  // so a status change racing a conversion matches no row instead of unlocking
  // a quote that now has an invoice. Postgres re-checks this WHERE against the
  // committed row after waiting on a lock, so both orderings are caught.
  const casWhere = { id, status: quote.status, updatedAt: quote.updatedAt };

  if (status === "ACCEPTED") {
    // Acceptance, the generated agreement, the Won stage and the timeline
    // entries commit together or not at all.
    let accepted: Awaited<ReturnType<typeof onQuoteAccepted>> | undefined;
    for (let attempt = 1; !accepted; attempt++) {
      try {
        accepted = await db.$transaction(
          async (tx) => {
            const updated = await tx.quote.updateMany({ where: casWhere, data: { status } });
            if (updated.count === 0) throw new StaleDocumentError();
            return onQuoteAccepted(tx, { id, number: quote.number, leadId: quote.leadId }, admin);
          },
          { timeout: 15_000 },
        );
      } catch (e) {
        if (e instanceof StaleDocumentError) return { error: "This quote changed elsewhere. Reload and try again." };
        // An agreement for this quote was generated at the same moment (e.g.
        // "Generate service agreement" in another tab). Everything here rolled
        // back, so one retry simply picks the existing agreement up.
        if (isUniqueViolation(e) && attempt === 1) continue;
        if (e instanceof AgreementAmountTooLargeError) return { error: AGREEMENT_TOO_LARGE_MESSAGE };
        return unexpectedError("setQuoteStatus", e, "The quote could not be accepted. Please try again.");
      }
    }

    revalidateAdmin();
    // With the agreements module off nothing is generated, and an agreement
    // from before is neither mentioned nor linked (its pages are switched off).
    const generated = moduleEnabled("agreements") ? accepted.agreement : null;
    const client = quote.leadId ? clientNotice(quote.leadId) : null;
    const parts = [`Quotation ${quote.number} accepted.`];
    if (generated) {
      parts.push(
        generated.created ? `Service agreement ${generated.number} generated` : `Service agreement ${generated.number} linked`,
      );
    }
    if (accepted.leadWon && client) parts.push(`${client.noun} marked ${LEAD_STATUS.WON.label}`);
    const rest = parts.slice(1).join(" · ");
    return {
      notice: rest ? `${parts[0]} ${rest.charAt(0).toUpperCase()}${rest.slice(1)}.` : parts[0],
      links: [
        ...(generated ? [{ label: `Open ${generated.number}`, href: `/admin/billing/agreements/${generated.id}` }] : []),
        ...(client ? [client.link] : []),
      ],
    };
  }

  const leadId = quote.leadId;
  let leadStillWon = false;
  let leadAdvanced = false;
  try {
    ({ leadStillWon, leadAdvanced } = await db.$transaction(async (tx) => {
      const updated = await tx.quote.updateMany({ where: casWhere, data: { status } });
      if (updated.count === 0) throw new StaleDocumentError();
      // Stage invoices and signing both lock this quote row before they
      // commit, so these re-checks (now holding the lock) see one that
      // committed meanwhile.
      if (agreement && backsOut) {
        if ((await tx.invoice.count({ where: { agreementId: agreement.id, ...STAGE_INVOICES } })) > 0) {
          throw new StagedBillingError();
        }
        if ((await tx.agreement.count({ where: { id: agreement.id, status: "SIGNED" } })) > 0) {
          throw new SignedAgreementError();
        }
      }
      await logLeadEvent(leadId, quoteStatusEvent(quote.number, quote.status, status), admin.id, tx);
      // Sending a draft moves a New client to "Quotation sent". Undoing an
      // acceptance (ACCEPTED -> SENT) is not a send.
      if (status === "SENT" && quote.status === "DRAFT") {
        const advanced = await advanceClientStatus(tx, leadId, "PROPOSAL", ` — quotation ${quote.number} sent`, admin);
        return { leadStillWon: false, leadAdvanced: advanced };
      }
      // Won with no accepted quotation left: the deal this quote carried is off.
      if (!backsOut || !leadId || quote.lead?.status !== "WON") return { leadStillWon: false, leadAdvanced: false };
      const stillWon = (await tx.quote.count({ where: { leadId, status: "ACCEPTED" } })) === 0;
      return { leadStillWon: stillWon, leadAdvanced: false };
    }));
  } catch (e) {
    if (e instanceof StaleDocumentError) return { error: "This quote changed elsewhere. Reload and try again." };
    if (e instanceof StagedBillingError && agreement) return { error: stagedLockMessage(agreement.number) };
    if (e instanceof SignedAgreementError && agreement) return { error: signedLockMessage(agreement.number) };
    return unexpectedError("setQuoteStatus", e, "The status could not be changed. Please try again.");
  }

  revalidateAdmin();

  if (leadAdvanced && leadId) {
    const client = clientNotice(leadId);
    const noun = client.noun.charAt(0).toUpperCase() + client.noun.slice(1);
    return {
      notice: `Quotation ${quote.number} sent. ${noun} marked ${LEAD_STATUS.PROPOSAL.label}.`,
      links: [client.link],
    };
  }

  // Backing out of a deal changes neither the agreement nor the opportunity:
  // point at whatever still says the deal is on, so it isn't left that way silently.
  if (!backsOut) return {};
  const still: string[] = [];
  const fixes: string[] = [];
  const links: NoticeLink[] = [];
  if (moduleEnabled("agreements") && agreement && (agreement.status === "DRAFT" || agreement.status === "SENT")) {
    still.push(
      `service agreement ${agreement.number} is still ${agreement.status === "DRAFT" ? "a draft" : "out for signature"}`,
    );
    fixes.push("cancel the agreement");
    links.push({ label: `Open ${agreement.number}`, href: `/admin/billing/agreements/${agreement.id}` });
  }
  if (leadStillWon && leadId) {
    const client = clientNotice(leadId);
    still.push(`the ${client.noun} is still marked ${LEAD_STATUS.WON.label}`);
    fixes.push(
      moduleEnabled("crm") ? "move the opportunity back to an open stage" : "change the client's status on the dashboard",
    );
    links.push(client.link);
  }
  if (still.length === 0) return {};
  const what = status === "SENT" ? "Acceptance undone" : `Quotation ${QUOTE_STATUS[status].label.toLowerCase()}`;
  const stillText = still.join(" and ");
  return {
    notice: `${what}. ${stillText.charAt(0).toUpperCase()}${stillText.slice(1)} — ${fixes.join(" and ")} if the deal is off.`,
    links,
  };
}

// ─── Invoice status ──────────────────────────────────────────────────────────

const invoiceStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["SENT", "PAID", "VOID"]),
});

export async function setInvoiceStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = invoiceStatusSchema.safeParse({ id: field(formData, "id"), status: field(formData, "status") });
  if (!parsed.success) return { error: "That status change is not valid." };
  const { id, status } = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      dueDate: true,
      leadId: true,
      vatBps: true,
      currency: true,
      installment: true,
      items: { select: { quantity: true, unitPriceFils: true } },
      agreement: { select: { number: true } },
    },
  });
  if (!invoice) return { error: "This invoice no longer exists." };
  if (!INVOICE_TRANSITIONS[invoice.status].includes(status)) {
    return {
      error: `A ${INVOICE_STATUS[invoice.status].label.toLowerCase()} invoice can't be marked as ${INVOICE_STATUS[status].label.toLowerCase()}.`,
    };
  }
  if (status === "SENT" && isSentMoveUseless(invoice)) {
    return {
      error: "This invoice is past its due date, so it would still count as overdue. Mark it as paid or void it instead.",
    };
  }

  const data: Prisma.InvoiceUpdateManyMutationInput =
    status === "PAID"
      ? { status, paidAt: new Date() }
      : status === "SENT"
        ? { status, paidAt: null }
        : { status };

  // Payments and voids are the moments the opportunity's timeline cares about.
  const stage =
    invoice.installment && invoice.agreement
      ? ` (${INSTALLMENT_LABEL[invoice.installment].toLowerCase()} of service agreement ${invoice.agreement.number})`
      : "";
  const total = formatMoney(documentTotals(invoice.items, invoice.vatBps).totalFils, invoice.currency);
  const event =
    status === "PAID"
      ? `Invoice ${invoice.number}${stage} paid — ${total}.`
      : status === "VOID"
        ? `Invoice ${invoice.number}${stage} voided.`
        : invoice.status === "PAID"
          ? `Payment of invoice ${invoice.number}${stage} undone — outstanding again.`
          : null;

  // Sending an invoice moves the client to "Invoice sent", a payment to "Goal"
  // (forward only: see advanceClientStatus). Undoing a payment moves nothing.
  const advanceTo = status === "PAID" ? "WON" : status === "SENT" && invoice.status === "DRAFT" ? "INVOICED" : null;

  let leadAdvanced = false;
  try {
    leadAdvanced = await db.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({ where: { id, status: invoice.status }, data });
      if (updated.count === 0) throw new StaleDocumentError();
      if (event) await logLeadEvent(invoice.leadId, event, admin.id, tx);
      if (!advanceTo) return false;
      const reason = advanceTo === "WON" ? ` — invoice ${invoice.number} paid` : ` — invoice ${invoice.number} sent`;
      return advanceClientStatus(tx, invoice.leadId, advanceTo, reason, admin);
    });
  } catch (e) {
    if (e instanceof StaleDocumentError) return { error: "This invoice changed elsewhere. Reload and try again." };
    return unexpectedError("setInvoiceStatus", e, "The status could not be changed. Please try again.");
  }

  revalidateAdmin();
  if (leadAdvanced && advanceTo && invoice.leadId) {
    const client = clientNotice(invoice.leadId);
    const noun = client.noun.charAt(0).toUpperCase() + client.noun.slice(1);
    const what = advanceTo === "WON" ? `Invoice ${invoice.number} paid.` : `Invoice ${invoice.number} sent.`;
    return { notice: `${what} ${noun} marked ${LEAD_STATUS[advanceTo].label}.`, links: [client.link] };
  }
  return {};
}

// ─── Convert quote -> invoice ────────────────────────────────────────────────

export async function convertQuoteToInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = idOnlySchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return { error: "That quote could not be found." };
  const { id } = parsed.data;

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      invoice: { select: { id: true } },
      agreement: {
        select: { id: true, number: true, projectId: true, _count: { select: { invoices: { where: STAGE_INVOICES } } } },
      },
    },
  });
  if (!quote) return { error: "This quote no longer exists." };

  // Already converted (double click, second tab, or an earlier run): go to it.
  if (quote.invoice) redirect(`/admin/billing/invoices/${quote.invoice.id}`);

  if (quote.status !== "ACCEPTED") return { error: "Only accepted quotes can be converted to an invoice." };
  if (quote.items.length === 0) return { error: "This quote has no line items to invoice." };
  const agreement = quote.agreement;
  const stagedMessage = agreement
    ? `This quote is billed in stages through service agreement ${agreement.number}. Create the next invoice from its payment schedule instead.`
    : "";
  if (agreement && agreement._count.invoices > 0) return { error: stagedMessage };

  const issue = toDateInputValue(new Date());
  const issueDate = dateInputToDate(issue);
  const dueDate = dateInputToDate(addDaysToDateInput(issue, 30));
  if (!issueDate || !dueDate) return { error: "Could not work out the invoice dates. Try again." };

  let invoiceId: string;
  try {
    invoiceId = await db.$transaction(async (tx) => {
      // Lock the quote row and bump its version before creating the invoice.
      // If the quote left ACCEPTED since we read it (e.g. "Undo acceptance" or
      // "Mark declined" in another tab), nothing is created; and a status
      // change still in flight will now fail its updatedAt check instead of
      // unlocking a converted quote.
      const locked = await tx.quote.updateMany({
        where: { id: quote.id, status: "ACCEPTED" },
        data: { updatedAt: new Date() },
      });
      if (locked.count === 0) throw new StaleDocumentError();
      // Stage invoices lock this same quote row before they are created (see
      // createInstallmentInvoice), so this re-check sees any that committed.
      if (agreement) {
        const staged = await tx.invoice.count({ where: { agreementId: agreement.id, ...STAGE_INVOICES } });
        if (staged > 0) throw new StagedBillingError();
      }

      const number = await nextDocumentNumber("invoice", tx);
      const created = await tx.invoice.create({
        data: {
          number,
          status: "DRAFT",
          issueDate,
          dueDate,
          currency: quote.currency,
          vatBps: quote.vatBps,
          notes: quote.notes,
          clientName: quote.clientName,
          clientEmail: quote.clientEmail,
          clientCompany: quote.clientCompany,
          leadId: quote.leadId,
          quoteId: quote.id,
          // Delivery already under way for this deal: bill it to that project.
          projectId: agreement?.projectId ?? null,
          items: {
            create: quote.items.map((item, position) => ({
              description: item.description,
              quantity: item.quantity,
              unitPriceFils: item.unitPriceFils,
              position,
            })),
          },
        },
        select: { id: true },
      });
      await logLeadEvent(quote.leadId, `Quotation ${quote.number} converted to invoice ${number}.`, admin.id, tx);
      return created.id;
    });
  } catch (e) {
    if (e instanceof StaleDocumentError) {
      return { error: "This quote is no longer accepted, so it was not converted. Reload to see its current status." };
    }
    if (e instanceof StagedBillingError) return { error: stagedMessage };
    // quoteId is unique: a concurrent submit that won the race already made the invoice.
    if (isUniqueViolation(e)) {
      const existing = await db.invoice.findUnique({ where: { quoteId: quote.id }, select: { id: true } });
      if (existing) invoiceId = existing.id;
      else return { error: "The invoice could not be created. Please try again." };
    } else {
      return unexpectedError("convertQuoteToInvoice", e, "The invoice could not be created. Please try again.");
    }
  }

  revalidateAdmin();
  redirect(`/admin/billing/invoices/${invoiceId}`);
}

// ─── Delete drafts ───────────────────────────────────────────────────────────

export async function deleteDraftQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = idOnlySchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return { error: "That quote could not be found." };
  const { id } = parsed.data;

  const quote = await db.quote.findUnique({
    where: { id },
    select: { number: true, status: true, leadId: true, agreement: { select: { number: true } } },
  });
  if (!quote) return { error: "This quote no longer exists." };
  if (quote.status !== "DRAFT") return { error: "Only draft quotes can be deleted." };
  if (quote.agreement) {
    return {
      error: `Service agreement ${quote.agreement.number} was generated from this quote. Delete the draft agreement first.`,
    };
  }

  try {
    await db.$transaction(async (tx) => {
      // Lock the quote first, in its own statement (the same order agreement
      // generation and "Mark won" lock it in). That waits for an in-flight
      // generation to commit, and the delete below then runs with a fresh
      // snapshot that sees its agreement — so the agreement can't be orphaned.
      await tx.$queryRaw`SELECT "id" FROM "Quote" WHERE "id" = ${id} FOR UPDATE`;
      // Conditional delete: if it was sent — or an agreement was generated
      // from it — in the meantime, nothing is removed.
      const deleted = await tx.quote.deleteMany({ where: { id, status: "DRAFT", agreement: { is: null } } });
      if (deleted.count === 0) throw new StaleDocumentError();
      await logLeadEvent(quote.leadId, `Draft quotation ${quote.number} deleted.`, admin.id, tx);
    });
  } catch (e) {
    if (e instanceof StaleDocumentError) {
      return { error: "This quote is no longer a draft, or now has a service agreement, so it was not deleted." };
    }
    return unexpectedError("deleteDraftQuote", e, "The quote could not be deleted. Please try again.");
  }

  revalidateAdmin();
  redirect(billingBackHref("quotes").href);
}

export async function deleteDraftInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = idOnlySchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return { error: "That invoice could not be found." };
  const { id } = parsed.data;

  const invoice = await db.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!invoice) return { error: "This invoice no longer exists." };
  if (invoice.status !== "DRAFT") return { error: "Only draft invoices can be deleted." };

  const deleted = await db.invoice.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count === 0) return { error: "This invoice is no longer a draft, so it was not deleted." };

  revalidateAdmin();
  redirect(billingBackHref("invoices").href);
}

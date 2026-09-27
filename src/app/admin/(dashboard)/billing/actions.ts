"use server";

/**
 * Billing mutations. Every export here is a public POST endpoint, so each one
 * authorizes first, validates every field with zod, and re-reads the record it
 * touches instead of trusting ids or statuses sent by the browser.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { DEFAULT_CURRENCY } from "@/lib/admin/money";
import { nextDocumentNumber } from "@/lib/admin/numbering";
import { INVOICE_STATUS, QUOTE_STATUS } from "@/lib/admin/labels";
import { addDaysToDateInput, dateInputToDate, toDateInputValue } from "@/lib/admin/time";
import {
  MAX_LINE_ITEMS,
  MAX_QUANTITY,
  parseQuantity,
  parseUnitPriceFils,
  parseVatPercentToBps,
} from "./_lib/parse";
import { INVOICE_TRANSITIONS, QUOTE_TRANSITIONS, isSentMoveUseless } from "./_lib/status";
import type { ActionState, EditorField, EditorItemInput, EditorState } from "./_lib/types";

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

/** Pages whose numbers or lists change when a billing document changes. */
function revalidateBilling(refs: {
  quoteIds?: (string | null | undefined)[];
  invoiceIds?: (string | null | undefined)[];
  leadIds?: (string | null | undefined)[];
  projectIds?: (string | null | undefined)[];
}) {
  revalidatePath("/admin");
  revalidatePath("/admin/billing");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/projects");
  const unique = (ids?: (string | null | undefined)[]) => [...new Set((ids ?? []).filter((v): v is string => !!v))];
  for (const id of unique(refs.quoteIds)) revalidatePath(`/admin/billing/quotes/${id}`);
  for (const id of unique(refs.invoiceIds)) revalidatePath(`/admin/billing/invoices/${id}`);
  for (const id of unique(refs.leadIds)) revalidatePath(`/admin/crm/${id}`);
  for (const id of unique(refs.projectIds)) revalidatePath(`/admin/projects/${id}`);
}

async function leadExists(id: string) {
  return (await db.lead.count({ where: { id } })) > 0;
}

class StaleDocumentError extends Error {}

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

  let quoteId: string;
  let previousLeadId: string | null = null;

  try {
    if (d.leadId && !(await leadExists(d.leadId))) {
      return { error: "The linked lead no longer exists.", fieldErrors: { leadId: "Pick another lead or none" } };
    }

    if (d.id) {
      const existing = await db.quote.findUnique({ where: { id: d.id }, select: { status: true, leadId: true } });
      if (!existing) return { error: "This quote no longer exists." };
      if (existing.status !== "DRAFT") return { error: "Only draft quotes can be edited." };
      previousLeadId = existing.leadId;
      const id = d.id;

      await db.$transaction(async (tx) => {
        // Conditional update doubles as a row lock: if the quote left DRAFT
        // since we read it, nothing is written.
        const updated = await tx.quote.updateMany({ where: { id, status: "DRAFT" }, data });
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
      return { error: "This quote was sent or changed elsewhere. Reload to see the latest version." };
    }
    return unexpectedError("saveQuote", e, SAVE_FAILED);
  }

  revalidateBilling({ quoteIds: [quoteId], leadIds: [d.leadId, previousLeadId] });
  redirect(`/admin/billing/quotes/${quoteId}`);
}

export async function saveInvoice(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const parsed = invoiceSchema.safeParse(readDocumentForm(formData, ["projectId", "dueDate"]));
  if (!parsed.success) return editorErrors(parsed.error);
  const d = parsed.data;

  let leadId = d.leadId;
  let invoiceId: string;
  let previous: { leadId: string | null; projectId: string | null; quoteId: string | null } = {
    leadId: null,
    projectId: null,
    quoteId: null,
  };

  try {
    if (leadId && !(await leadExists(leadId))) {
      return { error: "The linked lead no longer exists.", fieldErrors: { leadId: "Pick another lead or none" } };
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
      const existing = await db.invoice.findUnique({
        where: { id: d.id },
        select: { status: true, leadId: true, projectId: true, quoteId: true },
      });
      if (!existing) return { error: "This invoice no longer exists." };
      if (existing.status !== "DRAFT") return { error: "Only draft invoices can be edited." };
      previous = existing;
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

  revalidateBilling({
    invoiceIds: [invoiceId],
    quoteIds: [previous.quoteId],
    leadIds: [leadId, previous.leadId],
    projectIds: [d.projectId, previous.projectId],
  });
  redirect(`/admin/billing/invoices/${invoiceId}`);
}

// ─── Quote status ────────────────────────────────────────────────────────────

const quoteStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["SENT", "ACCEPTED", "DECLINED", "EXPIRED"]),
});

export async function setQuoteStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = quoteStatusSchema.safeParse({ id: field(formData, "id"), status: field(formData, "status") });
  if (!parsed.success) return { error: "That status change is not valid." };
  const { id, status } = parsed.data;

  const quote = await db.quote.findUnique({
    where: { id },
    select: { status: true, leadId: true, updatedAt: true, invoice: { select: { id: true } } },
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

  // Compare-and-set on the version, not just the status: converting a quote
  // leaves its status ACCEPTED but bumps updatedAt (see convertQuoteToInvoice),
  // so a status change racing a conversion matches no row instead of unlocking
  // a quote that now has an invoice. Postgres re-checks this WHERE against the
  // committed row after waiting on a lock, so both orderings are caught.
  const updated = await db.quote.updateMany({
    where: { id, status: quote.status, updatedAt: quote.updatedAt },
    data: { status },
  });
  if (updated.count === 0) return { error: "This quote changed elsewhere. Reload and try again." };

  revalidateBilling({ quoteIds: [id], leadIds: [quote.leadId] });
  return {};
}

// ─── Invoice status ──────────────────────────────────────────────────────────

const invoiceStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["SENT", "PAID", "VOID"]),
});

export async function setInvoiceStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = invoiceStatusSchema.safeParse({ id: field(formData, "id"), status: field(formData, "status") });
  if (!parsed.success) return { error: "That status change is not valid." };
  const { id, status } = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { status: true, dueDate: true, leadId: true, projectId: true, quoteId: true },
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

  const updated = await db.invoice.updateMany({ where: { id, status: invoice.status }, data });
  if (updated.count === 0) return { error: "This invoice changed elsewhere. Reload and try again." };

  revalidateBilling({
    invoiceIds: [id],
    quoteIds: [invoice.quoteId],
    leadIds: [invoice.leadId],
    projectIds: [invoice.projectId],
  });
  return {};
}

// ─── Convert quote -> invoice ────────────────────────────────────────────────

export async function convertQuoteToInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = idOnlySchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return { error: "That quote could not be found." };
  const { id } = parsed.data;

  const quote = await db.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } }, invoice: { select: { id: true } } },
  });
  if (!quote) return { error: "This quote no longer exists." };

  // Already converted (double click, second tab, or an earlier run): go to it.
  if (quote.invoice) redirect(`/admin/billing/invoices/${quote.invoice.id}`);

  if (quote.status !== "ACCEPTED") return { error: "Only accepted quotes can be converted to an invoice." };
  if (quote.items.length === 0) return { error: "This quote has no line items to invoice." };

  const issue = toDateInputValue(new Date());
  const issueDate = dateInputToDate(issue);
  const dueDate = dateInputToDate(addDaysToDateInput(issue, 30));
  if (!issueDate || !dueDate) return { error: "Could not work out the invoice dates. Try again." };

  let invoiceId: string;
  try {
    const number = await nextDocumentNumber("invoice");
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
      return created.id;
    });
  } catch (e) {
    if (e instanceof StaleDocumentError) {
      return { error: "This quote is no longer accepted, so it was not converted. Reload to see its current status." };
    }
    // quoteId is unique: a concurrent submit that won the race already made the invoice.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.invoice.findUnique({ where: { quoteId: quote.id }, select: { id: true } });
      if (existing) invoiceId = existing.id;
      else return { error: "The invoice could not be created. Please try again." };
    } else {
      return unexpectedError("convertQuoteToInvoice", e, "The invoice could not be created. Please try again.");
    }
  }

  revalidateBilling({ quoteIds: [quote.id], invoiceIds: [invoiceId], leadIds: [quote.leadId] });
  redirect(`/admin/billing/invoices/${invoiceId}`);
}

// ─── Delete drafts ───────────────────────────────────────────────────────────

export async function deleteDraftQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = idOnlySchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return { error: "That quote could not be found." };
  const { id } = parsed.data;

  const quote = await db.quote.findUnique({ where: { id }, select: { status: true, leadId: true } });
  if (!quote) return { error: "This quote no longer exists." };
  if (quote.status !== "DRAFT") return { error: "Only draft quotes can be deleted." };

  // Conditional delete: if it was sent in the meantime, nothing is removed.
  const deleted = await db.quote.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count === 0) return { error: "This quote is no longer a draft, so it was not deleted." };

  revalidateBilling({ quoteIds: [id], leadIds: [quote.leadId] });
  redirect("/admin/billing?tab=quotes");
}

export async function deleteDraftInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = idOnlySchema.safeParse({ id: field(formData, "id") });
  if (!parsed.success) return { error: "That invoice could not be found." };
  const { id } = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { status: true, leadId: true, projectId: true, quoteId: true },
  });
  if (!invoice) return { error: "This invoice no longer exists." };
  if (invoice.status !== "DRAFT") return { error: "Only draft invoices can be deleted." };

  const deleted = await db.invoice.deleteMany({ where: { id, status: "DRAFT" } });
  if (deleted.count === 0) return { error: "This invoice is no longer a draft, so it was not deleted." };

  revalidateBilling({
    invoiceIds: [id],
    quoteIds: [invoice.quoteId],
    leadIds: [invoice.leadId],
    projectIds: [invoice.projectId],
  });
  redirect("/admin/billing?tab=invoices");
}

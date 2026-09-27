"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/dal";
import { LEAD_PIPELINE, LEAD_STATUS } from "@/lib/admin/labels";
import { formatMoney, parseMoneyToFils } from "@/lib/admin/money";
import { db } from "@/lib/db";

/*
 * CRM Server Actions.
 *
 * Every export here is a public POST endpoint, so each one re-checks the admin
 * session first, validates every field with zod, and confirms the record it
 * touches actually exists before mutating it. Ids from a form are never
 * trusted on their own.
 */

/**
 * `null` is the idle state. `at` changes on every submission so a form can key
 * its inputs on it and re-seed them from `value` after a failed attempt.
 */
export type CrmActionState = {
  ok: boolean;
  message: string;
  /** The text the admin submitted, echoed back on failure so nothing is lost. */
  value?: string;
  at: number;
} | null;

/** Postgres INT4 ceiling — the largest fils amount the column can hold. */
const MAX_FILS = 2_147_483_647;

const recordId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

function failure(message: string, value?: string): CrmActionState {
  return { ok: false, message, value, at: Date.now() };
}

function success(message: string): CrmActionState {
  return { ok: true, message, at: Date.now() };
}

function text(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The existence checks below run as separate queries, so a lead (or note)
 * deleted in another tab between the check and the write surfaces here as
 * P2025 (record to update/delete not found) or P2003 (foreign key gone).
 */
function isGoneError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2025" || err.code === "P2003")
  );
}

const LEAD_GONE = "This lead no longer exists. It may have been deleted in another tab.";

/**
 * Leads feed the CRM list, the lead page and the analytics overview. Status
 * changes and deletions also move the "new leads" badge in the dashboard
 * layout, and a deleted lead unlinks from billing and project pages — those
 * callers revalidate the whole /admin layout.
 */
function revalidateLeadViews(leadId: string, { layout = false }: { layout?: boolean } = {}) {
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${leadId}`);
  revalidatePath("/admin");
  if (layout) revalidatePath("/admin", "layout");
}

// ─── Status ──────────────────────────────────────────────────────────────────

const statusSchema = z.object({
  leadId: recordId,
  status: z.enum(LEAD_PIPELINE),
});

export async function updateLeadStatus(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = statusSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return failure("Choose one of the pipeline stages.");
  const { leadId, status } = parsed.data;
  const label = LEAD_STATUS[status].label;

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    if (!lead) return failure(LEAD_GONE);
    if (lead.status === status) return success(`Already in ${label}.`);

    await db.lead.update({ where: { id: leadId }, data: { status } });
  } catch (err) {
    if (isGoneError(err)) return failure(LEAD_GONE);
    console.error("[crm] updateLeadStatus failed:", err);
    return failure("Could not update the status. Please try again.");
  }

  revalidateLeadViews(leadId, { layout: true });
  return success(`Moved to ${label}.`);
}

// ─── Estimated deal value ────────────────────────────────────────────────────

const AMOUNT_HINT = "Enter an amount in AED, for example 45,000 or 45000.50.";

const valueSchema = z.object({
  leadId: recordId,
  value: z.string().trim().max(32, "That amount is too long."),
});

export async function updateLeadValue(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await requireAdmin();

  const raw = text(formData.get("value"));
  const parsed = valueSchema.safeParse({ leadId: formData.get("leadId"), value: raw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(
      issue?.path[0] === "value" ? issue.message : "This lead could not be found.",
      raw,
    );
  }
  const { leadId, value } = parsed.data;

  // Empty clears the estimate. Anything else must be a plain AED amount
  // ("45000", "45,000", "AED 45,000.50"): the shared parser is strict and
  // returns null for "45k", "1e5", "12.500,50", "USD 100" or negatives,
  // which are refused here rather than saved as the wrong amount.
  let fils: number | null = null;
  if (value !== "") {
    fils = parseMoneyToFils(value);
    if (fils === null) return failure(AMOUNT_HINT, raw);
    if (fils > MAX_FILS) return failure("That amount is too large to store.", raw);
  }

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return failure(LEAD_GONE, raw);

    await db.lead.update({ where: { id: leadId }, data: { estimatedValueFils: fils } });
  } catch (err) {
    if (isGoneError(err)) return failure(LEAD_GONE, raw);
    console.error("[crm] updateLeadValue failed:", err);
    return failure("Could not save the deal value. Please try again.", raw);
  }

  revalidateLeadViews(leadId);
  return success(fils === null ? "Deal value cleared." : `Deal value set to ${formatMoney(fils)}.`);
}

// ─── Notes ───────────────────────────────────────────────────────────────────

const noteSchema = z.object({
  leadId: recordId,
  body: z
    .string()
    // Browsers submit textarea line breaks as CRLF; count them as one character,
    // the same way the textarea's own maxLength does.
    .transform((s) => s.replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(1, "Write something before saving the note.")
        .max(4000, "Notes are limited to 4,000 characters."),
    ),
});

export async function addNote(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();

  const raw = text(formData.get("body"));
  const parsed = noteSchema.safeParse({ leadId: formData.get("leadId"), body: raw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(
      issue?.path[0] === "body" ? issue.message : "This lead could not be found.",
      raw,
    );
  }
  const { leadId, body } = parsed.data;

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return failure(LEAD_GONE, raw);

    await db.note.create({ data: { leadId, body } });
  } catch (err) {
    if (isGoneError(err)) return failure(LEAD_GONE, raw);
    console.error("[crm] addNote failed:", err);
    return failure("Could not save the note. Please try again.", raw);
  }

  revalidateLeadViews(leadId);
  return success("Note added.");
}

const deleteNoteSchema = z.object({
  leadId: recordId,
  noteId: recordId,
});

export async function deleteNote(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = deleteNoteSchema.safeParse({
    leadId: formData.get("leadId"),
    noteId: formData.get("noteId"),
  });
  if (!parsed.success) return failure("That note could not be found.");
  const { leadId, noteId } = parsed.data;

  let deleted: number;
  try {
    // One atomic statement, scoped to the lead so a forged noteId can't reach
    // another lead's notes. A note already removed elsewhere deletes 0 rows
    // instead of throwing.
    ({ count: deleted } = await db.note.deleteMany({ where: { id: noteId, leadId } }));
  } catch (err) {
    console.error("[crm] deleteNote failed:", err);
    return failure("Could not delete the note. Please try again.");
  }

  // Refresh either way: if it was already gone, the stale note leaves the page.
  revalidateLeadViews(leadId);
  return deleted > 0 ? success("Note deleted.") : failure("That note has already been deleted.");
}

// ─── Delete lead ─────────────────────────────────────────────────────────────

const deleteLeadSchema = z.object({
  leadId: recordId,
  confirm: z.literal("yes"),
});

/**
 * Notes cascade with the lead. Quotes, invoices and projects survive with
 * leadId set to null (onDelete: SetNull in the schema) — financial records
 * must outlive the CRM entry that produced them.
 */
export async function deleteLead(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = deleteLeadSchema.safeParse({
    leadId: formData.get("leadId"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return failure("Tick the confirmation box to delete this lead.");
  const { leadId } = parsed.data;

  try {
    // Atomic, and a no-op when the lead is already gone (deleted in another
    // tab or by a concurrent request): either way the outcome is "no lead", so
    // both paths revalidate and leave the page. The id is still validated
    // above and the delete is scoped to exactly that row.
    await db.lead.deleteMany({ where: { id: leadId } });
  } catch (err) {
    console.error("[crm] deleteLead failed:", err);
    return failure("Could not delete the lead. Please try again.");
  }

  revalidateLeadViews(leadId, { layout: true });
  redirect("/admin/crm");
}

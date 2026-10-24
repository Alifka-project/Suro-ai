"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/dal";
import { EXPENSE_CATEGORY_KEYS } from "@/lib/admin/expenses";
import { DEFAULT_CURRENCY, formatMoney, parseMoneyToFils } from "@/lib/admin/money";
import { calendarDay, dateInputToDate } from "@/lib/admin/time";
import { db } from "@/lib/db";
import { singleLine, stripControlChars } from "./_lib/text";
import type { DeleteExpenseResult, ExpenseFormState } from "./_lib/types";

/*
 * Recording, editing and deleting expenses. Each is a public POST endpoint
 * like every Server Action, so it re-checks the admin session, validates its
 * input and re-reads what it depends on (the expense, the linked client).
 *
 * Nothing here writes to a client's timeline: the dashboard counts timeline
 * events as engagement, and recording a cost isn't the team working with the
 * client.
 */

/** Postgres INT4 ceiling — the largest fils amount the column can hold. */
const MAX_FILS = 2_147_483_647;

const recordId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Trimmed single-line text (no control characters), or null when blank. */
const optionalLine = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((s) => singleLine(s ?? ""))
    .pipe(z.string().max(max, `Keep the ${label} under ${max} characters.`))
    .transform((s) => s || null);

/** The last day an expense may be dated: the same calendar day next year (Dubai clock). */
function latestAllowedDate(now: Date): Date {
  const today = calendarDay(now);
  return new Date(Date.UTC(today.year + 1, today.month, today.day, 12));
}

const expenseSchema = z.object({
  date: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const value = (raw ?? "").trim();
      if (!value) {
        ctx.addIssue({ code: "custom", message: "Choose the date it was paid." });
        return z.NEVER;
      }
      const date = dateInputToDate(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date, in the year 2000 or later." });
        return z.NEVER;
      }
      // Planned or prepaid costs may be dated ahead, but not indefinitely.
      if (date.getTime() > latestAllowedDate(new Date()).getTime()) {
        ctx.addIssue({ code: "custom", message: "Choose a date no more than a year from today." });
        return z.NEVER;
      }
      return date;
    }),
  amount: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const value = (raw ?? "").trim();
      if (!value) {
        ctx.addIssue({ code: "custom", message: "Enter the amount paid." });
        return z.NEVER;
      }
      const fils = parseMoneyToFils(value);
      if (fils === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount, for example 1,250 or 1250.50." });
        return z.NEVER;
      }
      if (fils <= 0) {
        ctx.addIssue({ code: "custom", message: "The amount must be more than zero." });
        return z.NEVER;
      }
      if (fils > MAX_FILS) {
        ctx.addIssue({ code: "custom", message: "That amount is too large to store." });
        return z.NEVER;
      }
      return fils;
    }),
  category: z.enum(EXPENSE_CATEGORY_KEYS, { error: "Choose a category." }),
  description: z
    .string()
    .optional()
    .transform((s) => singleLine(s ?? ""))
    .pipe(
      z
        .string()
        .min(1, "Say what it was for.")
        .max(160, "Keep the description under 160 characters."),
    ),
  vendor: optionalLine(120, "name"),
  project: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .pipe(z.union([z.literal(""), recordId], { error: "Choose a client from the list." }))
    .transform((s) => s || null),
  notes: z
    .string()
    .optional()
    // Line breaks stay; other control characters (a pasted NUL) never reach the database.
    .transform((s) => stripControlChars((s ?? "").replace(/\r\n?/g, "\n")).trim())
    .pipe(z.string().max(1000, "Keep the notes under 1,000 characters."))
    .transform((s) => s || null),
});

type ExpenseInput = z.output<typeof expenseSchema>;

function text(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

function failure(message: string, fieldErrors?: Record<string, string>): ExpenseFormState {
  return { ok: false, message, fieldErrors, at: Date.now() };
}

function parseExpense(formData: FormData): { data: ExpenseInput } | { error: ExpenseFormState } {
  const parsed = expenseSchema.safeParse({
    date: text(formData, "date"),
    amount: text(formData, "amount"),
    category: text(formData, "category") ?? "",
    description: text(formData, "description"),
    vendor: text(formData, "vendor"),
    project: text(formData, "project"),
    notes: text(formData, "notes"),
  });
  if (parsed.success) return { data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { error: failure("Some fields need attention.", fieldErrors) };
}

const PROJECT_GONE = "That client no longer exists. Choose another, or no project.";

/**
 * The linked client must exist, and a new link must be to a client still on
 * the dashboard. An expense already linked to a since-removed client may keep
 * that link (`current`), so editing its amount doesn't force a change.
 */
async function projectError(leadId: string | null, current: string | null = null): Promise<string | null> {
  if (!leadId) return null;
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { removedAt: true } });
  if (!lead) return PROJECT_GONE;
  if (lead.removedAt && leadId !== current) {
    return "That client was removed from the dashboard. Choose another, or no project.";
  }
  return null;
}

function isForeignKeyError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

/** The dashboard shows project costs too, so refresh every admin page. */
function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function savedMessage(verb: string, d: ExpenseInput, currency: string = DEFAULT_CURRENCY): string {
  return `${verb} ${formatMoney(d.amount, currency)} for “${d.description}”.`;
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createExpense(formData: FormData): Promise<ExpenseFormState> {
  const admin = await requireAdmin();
  const parsed = parseExpense(formData);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;

  try {
    const leadProblem = await projectError(d.project);
    if (leadProblem) return failure("Some fields need attention.", { project: leadProblem });

    await db.expense.create({
      data: {
        date: d.date,
        amountFils: d.amount,
        currency: DEFAULT_CURRENCY,
        category: d.category,
        description: d.description,
        vendor: d.vendor,
        notes: d.notes,
        leadId: d.project,
        createdById: admin.id,
      },
      select: { id: true },
    });
  } catch (err) {
    // The client was deleted between the check and the insert.
    if (isForeignKeyError(err)) return failure("Some fields need attention.", { project: PROJECT_GONE });
    console.error("[expenses] createExpense failed:", err);
    return failure("Could not save the expense. Please try again.");
  }

  revalidateAdmin();
  return { ok: true, message: savedMessage("Added", d), at: Date.now() };
}

// ─── Update ─────────────────────────────────────────────────────────────────

const GONE = "This expense no longer exists. It may have been deleted. The list has been refreshed.";

export async function updateExpense(formData: FormData): Promise<ExpenseFormState> {
  await requireAdmin();
  const idParsed = recordId.safeParse(text(formData, "id") ?? "");
  if (!idParsed.success) return failure("That expense couldn't be found.");
  const id = idParsed.data;

  const parsed = parseExpense(formData);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;

  // The form has no currency field: an expense keeps the currency it has (AED
  // unless it was imported, and the dialog labels the amount with it), and the
  // confirmation names that currency.
  let currency: string;
  try {
    const existing = await db.expense.findUnique({ where: { id }, select: { leadId: true, currency: true } });
    if (!existing) {
      revalidateAdmin();
      return failure(GONE);
    }

    const leadProblem = await projectError(d.project, existing.leadId);
    if (leadProblem) return failure("Some fields need attention.", { project: leadProblem });

    // updateMany: a row deleted since the read above is a count of 0, not a throw.
    const { count } = await db.expense.updateMany({
      where: { id },
      data: {
        date: d.date,
        amountFils: d.amount,
        category: d.category,
        description: d.description,
        vendor: d.vendor,
        notes: d.notes,
        leadId: d.project,
      },
    });
    if (count === 0) {
      revalidateAdmin();
      return failure(GONE);
    }
    currency = existing.currency;
  } catch (err) {
    if (isForeignKeyError(err)) return failure("Some fields need attention.", { project: PROJECT_GONE });
    console.error("[expenses] updateExpense failed:", err);
    return failure("Could not save the changes. Please try again.");
  }

  revalidateAdmin();
  return { ok: true, message: savedMessage("Saved", d, currency), at: Date.now() };
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteExpense(id: string): Promise<DeleteExpenseResult> {
  await requireAdmin();
  const parsed = recordId.safeParse(typeof id === "string" ? id : "");
  if (!parsed.success) return { ok: false, message: "That expense couldn't be found.", at: Date.now() };

  try {
    const { count } = await db.expense.deleteMany({ where: { id: parsed.data } });
    if (count === 0) {
      revalidateAdmin();
      return { ok: false, gone: true, message: "That expense was already deleted. The list has been refreshed.", at: Date.now() };
    }
  } catch (err) {
    console.error("[expenses] deleteExpense failed:", err);
    return { ok: false, message: "Could not delete the expense. Please try again.", at: Date.now() };
  }

  revalidateAdmin();
  return { ok: true, message: "Expense deleted.", at: Date.now() };
}

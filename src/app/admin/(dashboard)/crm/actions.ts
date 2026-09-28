"use server";

import { Prisma, type LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, type AdminSession } from "@/lib/admin/dal";
import { LeadLostError, LeadNotFoundError, lockLead, markLeadWon, sortOrderAtTop } from "@/lib/admin/deals";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { formatMoney, parseMoneyToFils } from "@/lib/admin/money";
import {
  ACTIVITY_TYPE,
  BOARD_STAGES,
  OPEN_STAGES,
  PRIORITY_MAX,
  isActivityType,
  isOpenStage,
  parseTags,
  sortOrderBetween,
} from "@/lib/admin/pipeline";
import { dateInputToDate } from "@/lib/admin/time";
import { logLeadEvent } from "@/lib/admin/timeline";
import { db } from "@/lib/db";

/*
 * CRM Server Actions — every mutation of a lead (opportunity), its notes and
 * its activities.
 *
 * Every export here is a public POST endpoint, so each one re-checks the admin
 * session first, validates every field with zod, and confirms the record it
 * touches actually exists before mutating it. Ids from a form are never
 * trusted on their own.
 *
 * Two calling styles:
 * - Form actions `(prev, formData) => CrmActionState`, for useActionState.
 * - Direct actions `(input) => LeadActionResult`, for client interactions
 *   that aren't forms: drag-and-drop on the pipeline, priority stars.
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
  /** Per-field messages for multi-field forms, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Follow-up links shown with the message, e.g. the generated agreement. */
  links?: { label: string; href: string }[];
  /** The record created or changed, when the caller needs it (e.g. to navigate). */
  leadId?: string;
  at: number;
} | null;

export type LeadActionResult = {
  ok: boolean;
  message: string;
  links?: { label: string; href: string }[];
};

/** Postgres INT4 ceiling — the largest fils amount the column can hold. */
const MAX_FILS = 2_147_483_647;

const recordId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

function failure(message: string, extra: { value?: string; fieldErrors?: Record<string, string> } = {}): CrmActionState {
  return { ok: false, message, ...extra, at: Date.now() };
}

function success(
  message: string,
  extra: { links?: { label: string; href: string }[]; leadId?: string } = {},
): CrmActionState {
  return { ok: true, message, ...extra, at: Date.now() };
}

function text(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Trimmed string, or null when blank. */
function optionalText(max: number) {
  return z
    .string()
    .optional()
    .transform((s) => {
      const v = (s ?? "").replace(/\s+/g, " ").trim();
      return v ? v.slice(0, max) : null;
    });
}

const multiline = (max: number, message: string) =>
  z
    .string()
    .optional()
    // Browsers submit textarea line breaks as CRLF; count them as one character,
    // the same way the textarea's own maxLength does.
    .transform((s) => (s ?? "").replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(max, message));

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

/** Stage changes below lock the lead and re-read its stage, so this also catches a "Mark lost" from another tab. */
const LEAD_LOST_MOVE = "This opportunity is marked lost. Restore it before moving it.";

/**
 * A lead change can show up almost anywhere in the dashboard: the pipeline,
 * the lead list and page, activities, the analytics overview, the sidebar
 * badges, and — when a deal is won — billing, agreements and projects. The
 * admin is fully dynamic, so revalidating the /admin layout simply clears the
 * client router cache for every admin page at once.
 */
function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function wonLinks(result: Awaited<ReturnType<typeof markLeadWon>>): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  if (result.agreement) {
    links.push({ label: `Agreement ${result.agreement.number}`, href: `/admin/billing/agreements/${result.agreement.id}` });
  }
  if (result.quote) links.push({ label: `Quotation ${result.quote.number}`, href: `/admin/billing/quotes/${result.quote.id}` });
  return links;
}

// ─── Stage moves (pipeline drag-and-drop and the stage bar) ─────────────────

const moveSchema = z.object({
  leadId: recordId,
  toStage: z.enum(BOARD_STAGES),
  /** Neighbours at the drop position, top to bottom. Omit both for "top of column". */
  beforeId: recordId.nullish(),
  afterId: recordId.nullish(),
});

/**
 * Moves an opportunity to a stage, at a position within that stage's column.
 *
 * - Into Won: runs the deal automation (markLeadWon) — accepts/creates the
 *   quotation and generates the service agreement — then places the card.
 * - Out of Won into an open stage: reopens the deal. Paperwork already
 *   generated is kept (agreements and quotes are never deleted by a drag).
 * - Lost opportunities are not on the board; restore them first.
 */
export async function moveLead(input: z.input<typeof moveSchema>): Promise<LeadActionResult> {
  const admin = await requireAdmin();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That move is not valid." };
  const { leadId, toStage, beforeId, afterId } = parsed.data;
  if (beforeId === leadId || afterId === leadId) return { ok: false, message: "That move is not valid." };

  let result: LeadActionResult;
  try {
    // A first look, to pick the path. Both paths lock the lead and decide
    // again from what they read under the lock.
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    if (!lead) return { ok: false, message: LEAD_GONE };
    if (lead.status === "LOST") return { ok: false, message: LEAD_LOST_MOVE };

    if (toStage === "WON" && lead.status !== "WON") {
      const won = await markLeadWon(leadId, admin);
      result = { ok: true, message: won.message, links: wonLinks(won) };
    } else {
      result = { ok: true, message: lead.status === toStage ? "Card moved." : `Moved to ${LEAD_STATUS[toStage].label}.` };
    }

    await db.$transaction(async (tx) => {
      const current = await lockLead(tx, leadId);
      if (!current) throw new LeadNotFoundError();
      // Marked lost in another tab since the first look: leave it lost.
      if (current === "LOST") throw new LeadLostError();
      // Won just above, then reopened elsewhere before this placement: the
      // other change is newer, so don't place the card in the Won column.
      if (toStage === "WON" && current !== "WON") return;

      const sortOrder = await positionInColumn(tx, toStage, leadId, beforeId ?? null, afterId ?? null);
      if (current !== toStage) {
        await tx.lead.update({
          where: { id: leadId },
          data: { status: toStage, sortOrder, wonAt: null },
        });
        await logLeadEvent(
          leadId,
          current === "WON"
            ? `Deal reopened: stage changed from Won to ${LEAD_STATUS[toStage].label}.`
            : `Stage changed from ${LEAD_STATUS[current].label} to ${LEAD_STATUS[toStage].label}.`,
          admin.id,
          tx,
        );
      } else {
        await tx.lead.update({ where: { id: leadId }, data: { sortOrder } });
      }
      await rebalanceIfNeeded(tx, toStage);
    });
  } catch (err) {
    if (err instanceof LeadNotFoundError || isGoneError(err)) return { ok: false, message: LEAD_GONE };
    if (err instanceof LeadLostError) {
      revalidateAdmin();
      return { ok: false, message: LEAD_LOST_MOVE };
    }
    console.error("[crm] moveLead failed:", err);
    return { ok: false, message: "Could not move the card. Please try again." };
  }

  revalidateAdmin();
  return result;
}

/**
 * sortOrder for a drop between two cards of `stage` (ids that aren't in that
 * column are ignored). When the neighbours are too close to split — or tied,
 * like cards that predate manual ordering and all sit at 0 — the column is
 * renumbered first and the neighbours re-read, so the card lands exactly
 * where it was dropped instead of wherever a tie-break would put it.
 */
async function positionInColumn(
  tx: Prisma.TransactionClient,
  stage: LeadStatus,
  leadId: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<number> {
  if (!beforeId && !afterId) return sortOrderAtTop(tx, stage);
  const ids = [beforeId, afterId].filter((v): v is string => !!v);
  for (let attempt = 0; ; attempt++) {
    const neighbours = await tx.lead.findMany({
      where: { id: { in: ids }, status: stage },
      select: { id: true, sortOrder: true },
    });
    let before = neighbours.find((n) => n.id === beforeId)?.sortOrder ?? null;
    let after = neighbours.find((n) => n.id === afterId)?.sortOrder ?? null;
    if (before === null && after === null) return sortOrderAtTop(tx, stage);
    // With only one neighbour known (bottom or top of what the board showed),
    // the real card on the other side may be one the board didn't load or
    // filtered out. Split against it rather than jumping past it.
    if (after === null) {
      const next = await tx.lead.findFirst({
        where: { status: stage, id: { not: leadId }, sortOrder: { gt: before as number } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });
      after = next?.sortOrder ?? null;
    } else if (before === null) {
      const prev = await tx.lead.findFirst({
        where: { status: stage, id: { not: leadId }, sortOrder: { lt: after } },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "asc" }],
        select: { sortOrder: true },
      });
      before = prev?.sortOrder ?? null;
    }
    const { value, needsRebalance } = sortOrderBetween(before, after);
    // One renumber gives every pair a 1024 gap; if the neighbours still don't
    // split (sent out of order by a stale board), the midpoint will do.
    if (!needsRebalance || attempt > 0) return value;
    await renumberColumn(tx, stage);
  }
}

/** Renumbers a column 1024, 2048, … in its current order (ties: newest first). */
async function renumberColumn(tx: Prisma.TransactionClient, stage: LeadStatus) {
  const cards = await tx.lead.findMany({
    where: { status: stage },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    select: { id: true, sortOrder: true },
  });
  for (const [i, c] of cards.entries()) {
    const sortOrder = (i + 1) * 1024;
    if (c.sortOrder !== sortOrder) await tx.lead.update({ where: { id: c.id }, data: { sortOrder } });
  }
}

/**
 * Renumbers a column once two cards' sortOrders get too close to split
 * again, or collide. Cheap: columns are small and this only runs when needed.
 */
async function rebalanceIfNeeded(tx: Prisma.TransactionClient, stage: LeadStatus) {
  const cards = await tx.lead.findMany({
    where: { status: stage },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    select: { sortOrder: true },
  });
  const crowded = cards.some((c, i) => i > 0 && c.sortOrder - cards[i - 1].sortOrder < 1e-6);
  if (crowded) await renumberColumn(tx, stage);
}

// ─── Won / Lost / Restore ────────────────────────────────────────────────────

const leadOnlySchema = z.object({ leadId: recordId });

/** "Mark won" button: same automation as dropping the card on Won. */
export async function markWon(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const parsed = leadOnlySchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return failure("This lead could not be found.");

  let won: Awaited<ReturnType<typeof markLeadWon>>;
  try {
    won = await markLeadWon(parsed.data.leadId, admin);
  } catch (err) {
    if (err instanceof LeadNotFoundError || isGoneError(err)) return failure(LEAD_GONE);
    if (err instanceof LeadLostError) {
      revalidateAdmin();
      return failure("This opportunity was marked lost. Restore it before marking it won.");
    }
    console.error("[crm] markWon failed:", err);
    return failure("Could not mark the deal as won. Please try again.");
  }
  revalidateAdmin();
  return success(won.message, { links: wonLinks(won) });
}

const lostSchema = z.object({
  leadId: recordId,
  reason: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Choose or type a lost reason.").max(120, "Keep the reason under 120 characters.")),
  note: multiline(2000, "Keep the closing note under 2,000 characters."),
});

/**
 * Odoo's "Lost" dialog: a reason (from the list or typed) plus an optional
 * closing note. Only open opportunities can be lost — a deal won meanwhile
 * (in another tab, or by a quotation accepted in Billing) is reopened to an
 * open stage first, so a stale page never overwrites a win and its paperwork.
 */
export async function markLost(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const reasonChoice = text(formData.get("reason")) ?? "";
  const reason = reasonChoice === "__other" ? (text(formData.get("customReason")) ?? "") : reasonChoice;
  const parsed = lostSchema.safeParse({ leadId: formData.get("leadId"), reason, note: text(formData.get("note")) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === "note" ? "note" : reasonChoice === "__other" ? "customReason" : "reason";
    return failure(issue?.message ?? "Check the form.", { fieldErrors: { [field]: issue?.message ?? "" } });
  }
  const { leadId, note } = parsed.data;

  let outcome: "lost" | "already-lost" | "won";
  try {
    outcome = await db.$transaction(async (tx) => {
      const status = await lockLead(tx, leadId);
      if (!status) throw new LeadNotFoundError();
      if (status === "LOST") return "already-lost";
      if (status === "WON") return "won";
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: "LOST",
          stageBeforeLost: status,
          lostAt: new Date(),
          lostReason: parsed.data.reason,
          lostNote: note || null,
          wonAt: null,
        },
      });
      await logLeadEvent(
        leadId,
        `Marked as lost (was ${LEAD_STATUS[status].label}). Reason: ${parsed.data.reason}.${note ? `\n${note}` : ""}`,
        admin.id,
        tx,
      );
      return "lost";
    });
  } catch (err) {
    if (err instanceof LeadNotFoundError || isGoneError(err)) return failure(LEAD_GONE);
    console.error("[crm] markLost failed:", err);
    return failure("Could not mark the opportunity as lost. Please try again.");
  }

  revalidateAdmin();
  if (outcome === "won") {
    return failure("This deal has been marked won meanwhile. Move it back to an open stage first if it fell through.");
  }
  return success(
    outcome === "already-lost"
      ? "Already marked as lost (possibly in another tab). Restore it any time."
      : "Marked as lost. It has left the pipeline; restore it any time.",
  );
}

/** Puts a lost opportunity back in the stage it was lost from (New if unknown). */
export async function restoreLead(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const parsed = leadOnlySchema.safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return failure("This lead could not be found.");
  const { leadId } = parsed.data;

  let stage: LeadStatus = "NEW";
  try {
    await db.$transaction(async (tx) => {
      if (!(await lockLead(tx, leadId))) throw new LeadNotFoundError();
      const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { status: true, stageBeforeLost: true } });
      if (!lead) throw new LeadNotFoundError();
      if (lead.status !== "LOST") {
        stage = lead.status;
        return;
      }
      // Won is decided by the deal automation, never by a restore.
      stage = lead.stageBeforeLost && isOpenStage(lead.stageBeforeLost) ? lead.stageBeforeLost : "NEW";
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: stage,
          stageBeforeLost: null,
          lostAt: null,
          lostReason: null,
          lostNote: null,
          sortOrder: await sortOrderAtTop(tx, stage),
        },
      });
      await logLeadEvent(leadId, `Restored to ${LEAD_STATUS[stage].label}.`, admin.id, tx);
    });
  } catch (err) {
    if (err instanceof LeadNotFoundError || isGoneError(err)) return failure(LEAD_GONE);
    console.error("[crm] restoreLead failed:", err);
    return failure("Could not restore the opportunity. Please try again.");
  }

  revalidateAdmin();
  return success(`Restored to ${LEAD_STATUS[stage].label}.`);
}

// ─── Priority stars ──────────────────────────────────────────────────────────

const prioritySchema = z.object({
  leadId: recordId,
  priority: z.number().int().min(0).max(PRIORITY_MAX),
});

export async function setLeadPriority(input: { leadId: string; priority: number }): Promise<LeadActionResult> {
  await requireAdmin();
  const parsed = prioritySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That priority is not valid." };
  try {
    const updated = await db.lead.updateMany({ where: { id: parsed.data.leadId }, data: { priority: parsed.data.priority } });
    if (updated.count === 0) return { ok: false, message: LEAD_GONE };
  } catch (err) {
    console.error("[crm] setLeadPriority failed:", err);
    return { ok: false, message: "Could not save the priority. Please try again." };
  }
  revalidateAdmin();
  return { ok: true, message: "Priority saved." };
}

// ─── Quick create (pipeline "notes card") ────────────────────────────────────

const AMOUNT_HINT = "Enter an amount in AED, for example 45,000 or 45000.50.";

/** Money field: blank -> null; otherwise the strict shared parser. */
const moneyField = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    const value = (raw ?? "").trim();
    if (!value) return null;
    const fils = parseMoneyToFils(value);
    if (fils === null) {
      ctx.addIssue({ code: "custom", message: AMOUNT_HINT });
      return z.NEVER;
    }
    if (fils > MAX_FILS) {
      ctx.addIssue({ code: "custom", message: "That amount is too large to store." });
      return z.NEVER;
    }
    return fils;
  });

const emailField = z
  .string()
  .optional()
  .transform((s) => (s ?? "").trim())
  .pipe(z.union([z.literal(""), z.email("Enter a valid email address.").max(254)]))
  .transform((s) => s || null);

const quickCreateSchema = z.object({
  stage: z.enum(OPEN_STAGES),
  fullName: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Add the contact's name.").max(120, "Keep the name under 120 characters.")),
  companyName: optionalText(160),
  title: optionalText(160),
  email: emailField,
  phone: optionalText(40),
  value: moneyField,
  note: multiline(4000, "Notes are limited to 4,000 characters."),
});

/**
 * Pipeline quick-create: a card for a client you're approaching, with just a
 * name and whatever you know so far. Lands at the top of the chosen column,
 * owned by whoever created it; the note becomes the first timeline entry.
 */
export async function quickCreateLead(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const parsed = quickCreateSchema.safeParse({
    stage: formData.get("stage"),
    fullName: text(formData.get("fullName")) ?? "",
    companyName: text(formData.get("companyName")),
    title: text(formData.get("title")),
    email: text(formData.get("email")),
    phone: text(formData.get("phone")),
    value: text(formData.get("value")),
    note: text(formData.get("note")),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return failure(parsed.error.issues[0]?.message ?? "Check the form.", { fieldErrors });
  }
  const d = parsed.data;

  let leadId: string;
  try {
    leadId = await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          source: "manual",
          status: d.stage,
          clientType: d.companyName ? "COMPANY" : "INDIVIDUAL",
          fullName: d.fullName,
          companyName: d.companyName,
          title: d.title,
          email: d.email,
          phone: d.phone,
          estimatedValueFils: d.value,
          ownerId: admin.id,
          sortOrder: await sortOrderAtTop(tx, d.stage),
        },
        select: { id: true },
      });
      await logLeadEvent(lead.id, `Opportunity created in ${LEAD_STATUS[d.stage].label}.`, admin.id, tx);
      if (d.note) await tx.note.create({ data: { leadId: lead.id, body: d.note, kind: "NOTE", authorId: admin.id } });
      return lead.id;
    });
  } catch (err) {
    console.error("[crm] quickCreateLead failed:", err);
    return failure("Could not create the opportunity. Please try again.");
  }

  revalidateAdmin();
  return success(`Added ${d.title ?? d.companyName ?? d.fullName}${d.value !== null ? ` (${formatMoney(d.value)})` : ""}.`, {
    leadId,
  });
}

// ─── Edit opportunity details ────────────────────────────────────────────────

const detailsSchema = z.object({
  leadId: recordId,
  title: optionalText(160),
  fullName: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Add the contact's name.").max(120, "Keep the name under 120 characters.")),
  clientType: z.enum(["COMPANY", "INDIVIDUAL"]),
  companyName: optionalText(160),
  role: optionalText(120),
  industry: optionalText(120),
  email: emailField,
  phone: optionalText(40),
  city: optionalText(120),
  country: optionalText(120),
  value: moneyField,
  probability: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const v = (raw ?? "").trim().replace(/%$/, "");
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        ctx.addIssue({ code: "custom", message: "Probability is a whole number from 0 to 100." });
        return z.NEVER;
      }
      return n;
    }),
  expectedCloseDate: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const v = (raw ?? "").trim();
      if (!v) return null;
      const date = dateInputToDate(v);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date." });
        return z.NEVER;
      }
      return date;
    }),
  tags: z
    .string()
    .optional()
    .transform((s) => parseTags(s ?? "")),
  ownerId: z.union([z.literal(""), recordId]).transform((v) => v || null),
});

/** The opportunity form: name, contact, company, revenue, probability, close date, tags, salesperson. */
export async function updateLeadDetails(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const get = (k: string) => text(formData.get(k));
  const parsed = detailsSchema.safeParse({
    leadId: formData.get("leadId"),
    title: get("title"),
    fullName: get("fullName") ?? "",
    clientType: get("clientType") ?? "COMPANY",
    companyName: get("companyName"),
    role: get("role"),
    industry: get("industry"),
    email: get("email"),
    phone: get("phone"),
    city: get("city"),
    country: get("country"),
    value: get("value"),
    probability: get("probability"),
    expectedCloseDate: get("expectedCloseDate"),
    tags: get("tags"),
    ownerId: get("ownerId") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return failure("Some fields need attention.", { fieldErrors });
  }
  const { leadId, ownerId, value, ...d } = parsed.data;

  let outcome: "saved" | "gone" | "inactive-owner";
  try {
    // Under the lead's lock, so the change log compares against the values
    // this save actually replaces, not ones another tab changed meanwhile.
    outcome = await db.$transaction(async (tx) => {
      if (!(await lockLead(tx, leadId))) return "gone";
      const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { estimatedValueFils: true, ownerId: true } });
      if (!lead) return "gone";

      // Only a change of salesperson must name an active admin. Keeping the
      // current one is always allowed, even after their account was
      // deactivated, so the rest of the form can still be saved.
      let ownerName: string | null = null;
      if (ownerId && ownerId !== lead.ownerId) {
        const owner = await tx.adminUser.findFirst({ where: { id: ownerId, active: true }, select: { name: true } });
        if (!owner) return "inactive-owner";
        ownerName = owner.name;
      }

      await tx.lead.update({
        where: { id: leadId },
        data: {
          ...d,
          estimatedValueFils: value,
          ownerId,
        },
      });
      if (lead.estimatedValueFils !== value) {
        await logLeadEvent(
          leadId,
          `Expected revenue changed from ${formatMoney(lead.estimatedValueFils)} to ${formatMoney(value)}.`,
          admin.id,
          tx,
        );
      }
      if (lead.ownerId !== ownerId) {
        await logLeadEvent(leadId, ownerName ? `Salesperson set to ${ownerName}.` : "Salesperson removed.", admin.id, tx);
      }
      return "saved";
    });
  } catch (err) {
    if (isGoneError(err)) return failure(LEAD_GONE);
    console.error("[crm] updateLeadDetails failed:", err);
    return failure("Could not save the details. Please try again.");
  }

  if (outcome === "gone") return failure(LEAD_GONE);
  if (outcome === "inactive-owner") {
    return failure("Choose an active team member as salesperson.", { fieldErrors: { ownerId: "Not an active admin." } });
  }
  revalidateAdmin();
  return success("Details saved.");
}

// ─── Notes ───────────────────────────────────────────────────────────────────

const noteSchema = z.object({
  leadId: recordId,
  body: z
    .string()
    .transform((s) => s.replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(1, "Write something before saving the note.")
        .max(4000, "Notes are limited to 4,000 characters."),
    ),
});

export async function addNote(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();

  const raw = text(formData.get("body"));
  const parsed = noteSchema.safeParse({ leadId: formData.get("leadId"), body: raw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(issue?.path[0] === "body" ? issue.message : "This lead could not be found.", { value: raw });
  }
  const { leadId, body } = parsed.data;

  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return failure(LEAD_GONE, { value: raw });
    await db.note.create({ data: { leadId, body, kind: "NOTE", authorId: admin.id } });
  } catch (err) {
    if (isGoneError(err)) return failure(LEAD_GONE, { value: raw });
    console.error("[crm] addNote failed:", err);
    return failure("Could not save the note. Please try again.", { value: raw });
  }

  revalidateAdmin();
  return success("Note added.");
}

const deleteNoteSchema = z.object({ leadId: recordId, noteId: recordId });

/** Deletes a written note. System events are the audit trail and can't be deleted. */
export async function deleteNote(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = deleteNoteSchema.safeParse({ leadId: formData.get("leadId"), noteId: formData.get("noteId") });
  if (!parsed.success) return failure("That note could not be found.");
  const { leadId, noteId } = parsed.data;

  let deleted: number;
  try {
    // One atomic statement, scoped to the lead and to written notes, so a
    // forged id can't reach another lead's notes or the event log.
    ({ count: deleted } = await db.note.deleteMany({ where: { id: noteId, leadId, kind: "NOTE" } }));
  } catch (err) {
    console.error("[crm] deleteNote failed:", err);
    return failure("Could not delete the note. Please try again.");
  }

  revalidateAdmin();
  return deleted > 0 ? success("Note deleted.") : failure("That note has already been deleted.");
}

// ─── Activities ──────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  leadId: recordId,
  type: z.string().refine(isActivityType, "Choose an activity type."),
  summary: optionalText(200),
  dueDate: z.string().transform((raw, ctx) => {
    const date = dateInputToDate(raw.trim());
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Choose a due date." });
      return z.NEVER;
    }
    return date;
  }),
  note: multiline(2000, "Keep the note under 2,000 characters."),
  assigneeId: z.union([z.literal(""), recordId]).transform((v) => v || null),
});

/** Schedules a call / email / meeting / to-do / follow-up on a lead. */
export async function scheduleActivity(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const get = (k: string) => text(formData.get(k));
  const parsed = scheduleSchema.safeParse({
    leadId: formData.get("leadId"),
    type: get("type") ?? "",
    summary: get("summary"),
    dueDate: get("dueDate") ?? "",
    note: get("note"),
    assigneeId: get("assigneeId") ?? admin.id,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return failure(parsed.error.issues[0]?.message ?? "Check the form.", { fieldErrors });
  }
  const d = parsed.data;
  const type = d.type as keyof typeof ACTIVITY_TYPE;

  try {
    const [lead, assignee] = await Promise.all([
      db.lead.findUnique({ where: { id: d.leadId }, select: { id: true } }),
      d.assigneeId ? db.adminUser.findFirst({ where: { id: d.assigneeId, active: true }, select: { id: true } }) : null,
    ]);
    if (!lead) return failure(LEAD_GONE);
    if (d.assigneeId && !assignee) return failure("Assign it to an active team member.", { fieldErrors: { assigneeId: "Not an active admin." } });

    await db.activity.create({
      data: {
        leadId: d.leadId,
        type,
        summary: d.summary ?? ACTIVITY_TYPE[type].label,
        dueDate: d.dueDate,
        note: d.note || null,
        assigneeId: d.assigneeId,
      },
    });
  } catch (err) {
    if (isGoneError(err)) return failure(LEAD_GONE);
    console.error("[crm] scheduleActivity failed:", err);
    return failure("Could not schedule the activity. Please try again.");
  }

  revalidateAdmin();
  return success(`${ACTIVITY_TYPE[type].label} scheduled.`);
}

const completeSchema = z.object({
  activityId: recordId,
  feedback: multiline(2000, "Keep the feedback under 2,000 characters."),
});

/** Marks an activity done and posts it, with any feedback, to the lead's timeline. */
export async function completeActivity(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const admin = await requireAdmin();
  const parsed = completeSchema.safeParse({ activityId: formData.get("activityId"), feedback: text(formData.get("feedback")) });
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "That activity could not be found.");
  const { activityId, feedback } = parsed.data;

  try {
    const done = await db.$transaction(async (tx) => {
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { leadId: true, type: true, summary: true, doneAt: true },
      });
      if (!activity) return false;
      if (activity.doneAt) return true;
      const updated = await tx.activity.updateMany({
        where: { id: activityId, doneAt: null },
        data: { doneAt: new Date(), feedback: feedback || null },
      });
      if (updated.count === 1) {
        const label = ACTIVITY_TYPE[activity.type].label;
        const summary = activity.summary !== label ? `: ${activity.summary}` : "";
        await logLeadEvent(activity.leadId, `${label} done${summary}.${feedback ? `\nFeedback: ${feedback}` : ""}`, admin.id, tx);
      }
      return true;
    });
    if (!done) return failure("That activity no longer exists.");
  } catch (err) {
    console.error("[crm] completeActivity failed:", err);
    return failure("Could not complete the activity. Please try again.");
  }

  revalidateAdmin();
  return success("Activity done.");
}

/** Cancels (deletes) a planned activity. Completed ones stay as history. */
export async function cancelActivity(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  await requireAdmin();
  const parsed = z.object({ activityId: recordId }).safeParse({ activityId: formData.get("activityId") });
  if (!parsed.success) return failure("That activity could not be found.");

  let deleted: number;
  try {
    ({ count: deleted } = await db.activity.deleteMany({ where: { id: parsed.data.activityId, doneAt: null } }));
  } catch (err) {
    console.error("[crm] cancelActivity failed:", err);
    return failure("Could not cancel the activity. Please try again.");
  }

  revalidateAdmin();
  return deleted > 0 ? success("Activity cancelled.") : failure("That activity was already completed or removed.");
}

// ─── Delete lead ─────────────────────────────────────────────────────────────

const deleteLeadSchema = z.object({
  leadId: recordId,
  confirm: z.literal("yes"),
});

/**
 * Notes and activities cascade with the lead. Quotes, agreements, invoices and
 * projects survive with leadId set to null (onDelete: SetNull in the schema) —
 * financial and contractual records must outlive the CRM entry that produced them.
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
    // Atomic, and a no-op when the lead is already gone: either way the
    // outcome is "no lead", so both paths revalidate and leave the page.
    await db.lead.deleteMany({ where: { id: leadId } });
  } catch (err) {
    console.error("[crm] deleteLead failed:", err);
    return failure("Could not delete the lead. Please try again.");
  }

  revalidateAdmin();
  redirect("/admin/crm");
}

/** Used by server pages to type the admin list for owner/assignee pickers. */
export type TeamMember = Pick<AdminSession, "id" | "name">;

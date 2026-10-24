"use server";

import { Prisma, type LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/dal";
import { sortOrderAtTop } from "@/lib/admin/deals";
import { CLIENT_STATUSES, LEAD_PIPELINE, LEAD_STATUS } from "@/lib/admin/labels";
import { parseMoneyToFils } from "@/lib/admin/money";
import { SERVICE_OPTIONS } from "@/lib/packages";
import { logLeadEvent } from "@/lib/admin/timeline";
import { db } from "@/lib/db";

/*
 * The dashboard's mutations: changing a client's status from the table,
 * removing a client from the list (and undoing that), and adding a project by
 * hand ("Add project", further down).
 *
 * A public POST endpoint like every Server Action, so it re-checks the admin
 * session, validates its input and locks the client's row. The table sends the
 * status it was showing (`from`); if someone changed it in the meantime the
 * change is refused instead of silently overwriting theirs.
 *
 * Deliberately just a status change: setting "Goal" here records the deal as
 * closed without generating any paperwork. Quotations and invoices are made
 * from the table's own buttons.
 */

export type StatusChangeResult = {
  ok: boolean;
  message: string;
  /** The status the client is in after the call (the current one on failure, when known). */
  status?: LeadStatus;
};

const recordId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const schema = z.object({
  leadId: recordId,
  // Any stored status, so a client left in a CRM-only stage can still be moved.
  from: z.enum(LEAD_PIPELINE),
  to: z.enum(CLIENT_STATUSES),
});

class StaleStatusError extends Error {
  constructor(readonly current: LeadStatus) {
    super("Status changed elsewhere");
  }
}

class GoneError extends Error {}

/**
 * Locks the client's row until the transaction ends (the lock every status
 * change takes; see lockLead in deals.ts) and returns what the dashboard
 * decides from. Null if the client doesn't exist.
 */
async function lockClient(
  tx: Prisma.TransactionClient,
  leadId: string,
): Promise<{ status: LeadStatus; removed: boolean; name: string } | null> {
  const rows = await tx.$queryRaw<{ status: LeadStatus; removedAt: Date | null; fullName: string }[]>`
    SELECT "status", "removedAt", "fullName" FROM "Lead" WHERE "id" = ${leadId} FOR NO KEY UPDATE`;
  const row = rows[0];
  return row ? { status: row.status, removed: row.removedAt !== null, name: row.fullName } : null;
}

export async function setClientStatus(input: z.input<typeof schema>): Promise<StatusChangeResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That status isn't valid." };
  const { leadId, from, to } = parsed.data;
  if (from === to) return { ok: true, message: `Already ${LEAD_STATUS[to].label}.`, status: to };

  try {
    await db.$transaction(async (tx) => {
      const client = await lockClient(tx, leadId);
      if (!client || client.removed) throw new GoneError();
      const current = client.status;
      if (current !== from) throw new StaleStatusError(current);

      const now = new Date();
      const data: Prisma.LeadUpdateInput = { status: to, sortOrder: await sortOrderAtTop(tx, to) };
      if (to === "WON") {
        Object.assign(data, { wonAt: now, lostAt: null, lostReason: null, lostNote: null, stageBeforeLost: null });
      } else if (to === "LOST") {
        Object.assign(data, { lostAt: now, lostReason: "Cancelled", stageBeforeLost: from, wonAt: null });
      } else {
        Object.assign(data, { wonAt: null, lostAt: null, lostReason: null, lostNote: null, stageBeforeLost: null });
      }

      await tx.lead.update({ where: { id: leadId }, data });
      await logLeadEvent(
        leadId,
        `Status changed from ${LEAD_STATUS[from].label} to ${LEAD_STATUS[to].label}.`,
        admin.id,
        tx,
      );
    });
  } catch (err) {
    revalidatePath("/admin", "layout");
    if (err instanceof GoneError || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
      return { ok: false, message: "This client no longer exists. The table has been refreshed." };
    }
    if (err instanceof StaleStatusError) {
      return {
        ok: false,
        message: `Someone changed this client to ${LEAD_STATUS[err.current].label} a moment ago. The table has been refreshed.`,
        status: err.current,
      };
    }
    console.error("[dashboard] setClientStatus failed:", err);
    return { ok: false, message: "Could not change the status. Please try again." };
  }

  // The page, the sidebar badge and the KPIs all read statuses.
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Status set to ${LEAD_STATUS[to].label}.`, status: to };
}

// ─── Remove a client from the list ──────────────────────────────────────────

export type RemoveClientResult = { ok: boolean; message: string };

const removeSchema = z.object({ leadId: recordId });

/**
 * "Remove": takes the client off the table and out of the figures. Nothing is
 * deleted (Lead.removedAt is set), so the client's quotations, invoices,
 * expenses and timeline stay intact and restoreClient can undo it.
 */
export async function removeClient(input: z.input<typeof removeSchema>): Promise<RemoveClientResult> {
  return setRemoved(input, true);
}

/** Undo for "Remove": puts the client back on the list, status unchanged. */
export async function restoreClient(input: z.input<typeof removeSchema>): Promise<RemoveClientResult> {
  return setRemoved(input, false);
}

async function setRemoved(input: z.input<typeof removeSchema>, remove: boolean): Promise<RemoveClientResult> {
  const admin = await requireAdmin();
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That client isn't valid." };
  const { leadId } = parsed.data;

  let name: string;
  try {
    name = await db.$transaction(async (tx) => {
      const client = await lockClient(tx, leadId);
      if (!client) throw new GoneError();
      // Already done (another tab, a double click): nothing to change or log.
      if (client.removed === remove) return client.name;
      await tx.lead.update({ where: { id: leadId }, data: { removedAt: remove ? new Date() : null } });
      await logLeadEvent(
        leadId,
        remove ? "Removed from the client list." : "Restored to the client list.",
        admin.id,
        tx,
      );
      return client.name;
    });
  } catch (err) {
    revalidatePath("/admin", "layout");
    if (err instanceof GoneError || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
      return { ok: false, message: "This client no longer exists. The table has been refreshed." };
    }
    console.error(`[dashboard] ${remove ? "removeClient" : "restoreClient"} failed:`, err);
    return { ok: false, message: remove ? "Could not remove the client. Please try again." : "Could not restore the client. Please try again." };
  }

  // The table, the KPIs, the charts and the sidebar badge all skip removed clients.
  revalidatePath("/admin", "layout");
  return { ok: true, message: remove ? `${name} was removed from the list.` : `${name} is back on the list.` };
}

// ─── Add a project by hand ──────────────────────────────────────────────────

/** Form state for the "Add project" dialog. `null` is the idle state. */
export type AddProjectState = {
  ok: boolean;
  message: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** The new client's id, so the dialog can open its row. */
  leadId?: string;
  /** Changes on every submission, so the dialog can react to each one. */
  at: number;
} | null;

/** Postgres INT4 ceiling — the largest fils amount the column can hold. */
const MAX_FILS = 2_147_483_647;

/** Trimmed single-line text, or null when blank. */
const optionalLine = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((s) => (s ?? "").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, `Keep the ${label} under ${max} characters.`))
    .transform((s) => s || null);

const addProjectSchema = z.object({
  fullName: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Add the client's name.").max(120, "Keep the name under 120 characters.")),
  companyName: optionalLine(160, "company name"),
  title: optionalLine(160, "project name"),
  email: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .pipe(z.union([z.literal(""), z.email("Enter a valid email address.").max(254, "That email address is too long.")]))
    .transform((s) => s || null),
  phone: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .pipe(
      z.union([
        z.literal(""),
        z
          .string()
          .transform((s) => s.replace(/\s+/g, " "))
          .pipe(
            z
              .string()
              .max(32, "That number looks too long.")
              .regex(/^[+()\d .-]+$/, "Use digits, spaces and + ( ) . - only.")
              .refine((s) => (s.match(/\d/g)?.length ?? 0) >= 6, "Enter at least 6 digits."),
          ),
      ]),
    )
    .transform((s) => s || null),
  country: optionalLine(80, "country"),
  city: optionalLine(80, "city"),
  services: z
    .array(z.enum(SERVICE_OPTIONS))
    .max(SERVICE_OPTIONS.length)
    .transform((list) => [...new Set(list)]),
  value: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const v = (raw ?? "").trim();
      if (!v) return null;
      const fils = parseMoneyToFils(v);
      if (fils === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount in AED, for example 45,000 or 45000.50." });
        return z.NEVER;
      }
      if (fils > MAX_FILS) {
        ctx.addIssue({ code: "custom", message: "That amount is too large to store." });
        return z.NEVER;
      }
      return fils;
    }),
  status: z.enum(CLIENT_STATUSES),
  notes: z
    .string()
    .optional()
    .transform((s) => (s ?? "").replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(2000, "Keep the notes under 2,000 characters."))
    .transform((s) => s || null),
});

/**
 * "Add project": a client or deal the team found itself, added straight to
 * the table. Stored like a website enquiry, marked source "manual" (shown as
 * "Added manually"), owned by whoever added it.
 */
export async function addProject(_prev: AddProjectState, formData: FormData): Promise<AddProjectState> {
  const admin = await requireAdmin();
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = addProjectSchema.safeParse({
    fullName: text("fullName") ?? "",
    companyName: text("companyName"),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    country: text("country"),
    city: text("city"),
    services: formData.getAll("services").filter((v): v is string => typeof v === "string"),
    value: text("value"),
    status: text("status") ?? "NEW",
    notes: text("notes"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, message: "Some fields need attention.", fieldErrors, at: Date.now() };
  }
  const d = parsed.data;
  const now = new Date();

  let leadId: string;
  try {
    leadId = await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          source: "manual",
          status: d.status,
          clientType: d.companyName ? "COMPANY" : "INDIVIDUAL",
          fullName: d.fullName,
          companyName: d.companyName,
          title: d.title,
          email: d.email,
          phone: d.phone,
          country: d.country,
          city: d.city,
          services: d.services,
          estimatedValueFils: d.value,
          message: d.notes,
          ownerId: admin.id,
          sortOrder: await sortOrderAtTop(tx, d.status),
          ...(d.status === "WON" ? { wonAt: now } : {}),
          ...(d.status === "LOST" ? { lostAt: now, lostReason: "Cancelled" } : {}),
        },
        select: { id: true },
      });
      await logLeadEvent(
        lead.id,
        `Opportunity created manually as ${LEAD_STATUS[d.status].label}.`,
        admin.id,
        tx,
      );
      return lead.id;
    });
  } catch (err) {
    console.error("[dashboard] addProject failed:", err);
    return { ok: false, message: "Could not add the project. Please try again.", at: Date.now() };
  }

  revalidatePath("/admin", "layout");
  return { ok: true, message: `Added ${d.title ?? d.companyName ?? d.fullName}.`, leadId, at: Date.now() };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { PROJECT_PIPELINE } from "@/lib/admin/labels";
import { parseMoneyToFils } from "@/lib/admin/money";
import { dateInputToDate } from "@/lib/admin/time";
import { toProjectFormValues } from "./_lib/format";
import type {
  ClientChangeWarning,
  ProjectFormErrors,
  ProjectFormState,
  ProjectFormValues,
  TaskFormErrors,
  TaskFormState,
  TaskFormValues,
} from "./_lib/types";

/*
 * Every export here is a public POST endpoint. Each one re-checks the admin
 * session first, validates every field with zod, and confirms that any id it
 * was handed points at a real record (and, for tasks, the right project)
 * before writing anything.
 */

/** valueFils is a Postgres INT4 column. */
const MAX_FILS = 2_147_483_647;
const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const;

/**
 * A repeat of the same create inside this window is treated as a double
 * submit (a double click, or a browser resubmit before hydration) and returns
 * the record that already exists instead of making a second one.
 */
const DUPLICATE_WINDOW_MS = 10_000;

const AMOUNT_HINT = "Enter an amount like 12,500 or 12500.50.";

// ─── Field schemas ───────────────────────────────────────────────────────────

const recordId = z
  .string({ error: "Missing id." })
  .trim()
  .min(1, "Missing id.")
  .max(64, "Invalid id.")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id.");

const optionalDate = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .default("")
    .transform((value, ctx) => {
      if (!value) return null;
      const date = dateInputToDate(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return date;
    });

const optionalMoney = z
  .string({ error: AMOUNT_HINT })
  .trim()
  .max(32, "That amount is too long.")
  .default("")
  .transform((value, ctx) => {
    if (!value) return null;
    // Strict: "12.500,50", "1e5" or "12500.555" are errors, not silently different amounts.
    const fils = parseMoneyToFils(value);
    if (fils === null) {
      ctx.addIssue({ code: "custom", message: AMOUNT_HINT });
      return z.NEVER;
    }
    if (fils > MAX_FILS) {
      ctx.addIssue({ code: "custom", message: "That amount is too large." });
      return z.NEVER;
    }
    return fils;
  });

const projectSchema = z.object({
  name: z
    .string({ error: "Give the project a name." })
    .trim()
    .min(1, "Give the project a name.")
    .max(120, "Keep the name under 120 characters."),
  description: z
    .string({ error: "Invalid description." })
    .trim()
    .max(4000, "Keep the description under 4,000 characters.")
    .default("")
    .transform((value) => value || null),
  leadId: z
    .string({ error: "Choose a client from the list." })
    .trim()
    .max(64, "Choose a client from the list.")
    .regex(/^[A-Za-z0-9_-]*$/, "Choose a client from the list.")
    .default("")
    .transform((value) => value || null),
  status: z.enum(PROJECT_PIPELINE, { error: "Choose a valid status." }),
  startDate: optionalDate("Enter a valid start date."),
  dueDate: optionalDate("Enter a valid due date."),
  value: optionalMoney,
});

const PROJECT_FIELDS = ["name", "description", "leadId", "status", "startDate", "dueDate", "value"] as const;

/** updatedAt of the project as the edit form last saw it (an ISO timestamp). */
const versionSchema = z.iso.datetime();
/** Second-step confirmation for moving a project with invoices to another client. */
const confirmClientChangeSchema = z.literal("yes");

const taskSchema = z.object({
  projectId: recordId,
  title: z
    .string({ error: "Give the task a title." })
    .trim()
    .min(1, "Give the task a title.")
    .max(200, "Keep the task under 200 characters."),
  dueDate: optionalDate("Enter a valid due date."),
});

const moveProjectSchema = z.object({ projectId: recordId, status: z.enum(PROJECT_PIPELINE) });
const taskStatusSchema = z.object({ projectId: recordId, taskId: recordId, status: z.enum(TASK_STATUSES) });
/** `confirm` is only sent by the second, explicit "yes, delete" button. */
const deleteTaskSchema = z.object({ projectId: recordId, taskId: recordId, confirm: z.literal("yes") });
const deleteProjectSchema = z.object({ projectId: recordId, confirm: z.literal("yes") });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** FormData -> plain object for zod. Missing fields become undefined so `.default()` applies. */
function readForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, FormDataEntryValue | undefined> {
  const out = {} as Record<K, FormDataEntryValue | undefined>;
  for (const key of keys) out[key] = formData.get(key) ?? undefined;
  return out;
}

function asText(value: FormDataEntryValue | undefined): string {
  return typeof value === "string" ? value : "";
}

/** First message per top-level field. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) out[key] = issue.message;
  }
  return out;
}

function isPrismaError(error: unknown, ...codes: string[]): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && codes.includes(error.code);
}

function revalidateProject(projectId: string, ...leadIds: (string | null | undefined)[]) {
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  // Lead detail pages list the lead's projects.
  for (const leadId of new Set(leadIds)) {
    if (leadId) revalidatePath(`/admin/crm/${leadId}`);
  }
}

function projectError(
  values: ProjectFormValues,
  message: string,
  errors: ProjectFormErrors = {},
  extra: { version?: string; clientChange?: ClientChangeWarning } = {},
): ProjectFormState {
  return { status: "error", message, errors, values, submittedAt: Date.now(), ...extra };
}

/** Distinct client names on the invoices, for the change-of-client warning. */
function billedToLabel(invoices: { clientCompany: string | null; clientName: string }[]): string {
  const names = [...new Set(invoices.map((invoice) => invoice.clientCompany ?? invoice.clientName))];
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} other${names.length === 3 ? "" : "s"}`;
}

function taskError(values: TaskFormValues, message: string, errors: TaskFormErrors = {}): TaskFormState {
  return { status: "error", message, errors, values, submittedAt: Date.now() };
}

/**
 * Shared create/update validation: field schema, the start/due ordering rule,
 * and — only once everything else is valid — that the chosen client exists.
 */
async function validateProject(formData: FormData) {
  const raw = readForm(formData, PROJECT_FIELDS);
  const values: ProjectFormValues = {
    name: asText(raw.name),
    description: asText(raw.description),
    leadId: asText(raw.leadId),
    status: asText(raw.status),
    startDate: asText(raw.startDate),
    dueDate: asText(raw.dueDate),
    value: asText(raw.value),
  };

  const parsed = projectSchema.safeParse(raw);
  const errors: ProjectFormErrors = parsed.success ? {} : (fieldErrors(parsed.error) as ProjectFormErrors);

  // Checked on the raw strings so the message shows alongside any other field errors.
  const start = dateInputToDate(values.startDate);
  const due = dateInputToDate(values.dueDate);
  if (start && due && due < start && !errors.dueDate) {
    errors.dueDate = "The due date can't be before the start date.";
  }

  if (parsed.success && parsed.data.leadId && Object.keys(errors).length === 0) {
    const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId }, select: { id: true } });
    if (!lead) errors.leadId = "That client no longer exists. Choose another or leave it empty.";
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { values, errors, data: null };
  }
  return { values, errors, data: parsed.data };
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  await requireAdmin();

  const { values, errors, data } = await validateProject(formData);
  if (!data) return projectError(values, "Check the highlighted fields.", errors);

  let projectId: string;
  try {
    projectId = await db.$transaction(async (tx) => {
      // Serialise creates of the same name + client, so two copies of one
      // submit can't both pass the duplicate check below.
      const lockKey = `project:${data.leadId ?? ""}:${data.name}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const duplicate = await tx.project.findFirst({
        where: {
          name: data.name,
          leadId: data.leadId,
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (duplicate) return duplicate.id;

      const project = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          status: data.status,
          startDate: data.startDate,
          dueDate: data.dueDate,
          valueFils: data.value,
          leadId: data.leadId,
        },
        select: { id: true },
      });
      return project.id;
    });
  } catch (error) {
    // The client was deleted between the existence check and the insert.
    if (isPrismaError(error, "P2003")) {
      return projectError(values, "Check the highlighted fields.", {
        leadId: "That client no longer exists. Choose another or leave it empty.",
      });
    }
    throw error;
  }

  revalidateProject(projectId, data.leadId);
  redirect(`/admin/projects/${projectId}`);
}

export async function updateProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  await requireAdmin();

  const id = recordId.safeParse(formData.get("projectId") ?? undefined);
  const version = versionSchema.safeParse(formData.get("version") ?? undefined);
  const confirmClientChange = confirmClientChangeSchema.safeParse(formData.get("confirmClientChange")).success;
  const { values, errors, data } = await validateProject(formData);
  if (!id.success) return projectError(values, "This project could not be identified. Reload the page and try again.");
  if (!version.success) {
    return projectError(values, "This form is out of date. Reload the page to load the latest version of the project.");
  }
  // Echoed back on every error, so a failed save keeps checking against the version the user started from.
  const keepVersion = { version: version.data };

  const existing = await db.project.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      leadId: true,
      updatedAt: true,
      invoices: {
        where: { status: { not: "VOID" } },
        select: { leadId: true, clientName: true, clientCompany: true },
      },
    },
  });
  if (!existing) return projectError(values, "This project no longer exists. It may have been deleted in another tab.");
  if (!data) return projectError(values, "Check the highlighted fields.", errors, keepVersion);

  // Someone (another tab, the board's Move) saved since this form was loaded.
  // Keep the user's edits on screen, and hand back the current version so a
  // deliberate second save goes through.
  if (existing.updatedAt.getTime() !== new Date(version.data).getTime()) {
    return projectError(
      values,
      "This project was changed somewhere else after you opened this form. Your edits are still below: save again to replace those changes, or reload the page to start from the latest version.",
      {},
      { version: existing.updatedAt.toISOString() },
    );
  }

  // Invoices keep the client they were billed to. Moving the project to
  // another client leaves them attached, so that needs an explicit yes.
  if (data.leadId !== existing.leadId && !confirmClientChange) {
    const billedElsewhere = existing.invoices.filter((invoice) => invoice.leadId !== data.leadId);
    if (billedElsewhere.length > 0) {
      const count = billedElsewhere.length;
      const billedTo = billedToLabel(billedElsewhere);
      return projectError(
        values,
        "Confirm the change of client before saving.",
        {
          leadId: `${count} invoice${count === 1 ? " on this project is" : "s on this project are"} billed to ${billedTo}. They stay linked to the project and are not re-addressed.`,
        },
        { ...keepVersion, clientChange: { invoiceCount: count, billedTo } },
      );
    }
  }

  try {
    // Compare-and-set on updatedAt: if anything saved in between, nothing is written.
    const { count } = await db.project.updateMany({
      where: { id: existing.id, updatedAt: existing.updatedAt },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        startDate: data.startDate,
        dueDate: data.dueDate,
        valueFils: data.value,
        leadId: data.leadId,
        updatedAt: new Date(),
      },
    });

    const updated = await db.project.findUnique({
      where: { id: existing.id },
      select: {
        name: true,
        description: true,
        leadId: true,
        status: true,
        startDate: true,
        dueDate: true,
        valueFils: true,
        updatedAt: true,
      },
    });
    if (!updated) {
      return projectError(values, "This project no longer exists. It may have been deleted in another tab.");
    }
    if (count === 0) {
      return projectError(
        values,
        "This project was changed somewhere else while you were saving. Your edits are still below: save again to replace those changes, or reload the page to start from the latest version.",
        {},
        { version: updated.updatedAt.toISOString() },
      );
    }

    revalidateProject(existing.id, existing.leadId, data.leadId);
    return {
      status: "success",
      message: "Changes saved.",
      values: toProjectFormValues(updated),
      submittedAt: Date.now(),
      version: updated.updatedAt.toISOString(),
    };
  } catch (error) {
    if (isPrismaError(error, "P2003")) {
      return projectError(
        values,
        "Check the highlighted fields.",
        { leadId: "That client no longer exists. Choose another or leave it empty." },
        keepVersion,
      );
    }
    throw error;
  }
}

/** Board quick-move. A stale card (project deleted elsewhere) just refreshes the board. */
export async function moveProject(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = moveProjectSchema.safeParse(readForm(formData, ["projectId", "status"]));
  if (!parsed.success) throw new Error("Invalid project move request.");
  const { projectId, status } = parsed.data;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, leadId: true },
  });
  if (!project) {
    revalidatePath("/admin/projects");
    return;
  }

  if (project.status !== status) {
    // updateMany: a concurrent delete becomes a no-op instead of a thrown P2025.
    // updatedAt is set explicitly: it is the version an open edit form checks against.
    await db.project.updateMany({ where: { id: project.id }, data: { status, updatedAt: new Date() } });
  }
  revalidateProject(project.id, project.leadId);
}

/**
 * Deletes the project and its tasks. Linked invoices are financial records,
 * so they are kept and simply unlinked. Done explicitly in one transaction
 * rather than leaning on the foreign-key rules alone.
 */
export async function deleteProject(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = deleteProjectSchema.safeParse(readForm(formData, ["projectId", "confirm"]));
  if (!parsed.success) throw new Error("Invalid delete request.");
  const { projectId } = parsed.data;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, leadId: true, invoices: { select: { id: true } } },
  });

  if (project) {
    await db.$transaction([
      db.invoice.updateMany({ where: { projectId: project.id }, data: { projectId: null } }),
      db.task.deleteMany({ where: { projectId: project.id } }),
      db.project.deleteMany({ where: { id: project.id } }),
    ]);

    revalidateProject(project.id, project.leadId);
    if (project.invoices.length > 0) {
      revalidatePath("/admin/billing");
      for (const invoice of project.invoices) revalidatePath(`/admin/billing/invoices/${invoice.id}`);
    }
  } else {
    revalidatePath("/admin/projects");
  }

  redirect("/admin/projects");
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function addTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await requireAdmin();

  const raw = readForm(formData, ["projectId", "title", "dueDate"]);
  const values: TaskFormValues = { title: asText(raw.title), dueDate: asText(raw.dueDate) };

  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.projectId) return taskError(values, "This project could not be identified. Reload the page and try again.");
    return taskError(values, errors.title ?? errors.dueDate ?? "Check the task details.", {
      title: errors.title,
      dueDate: errors.dueDate,
    });
  }
  const { projectId, title, dueDate } = parsed.data;

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, leadId: true } });
  if (!project) return taskError(values, "This project no longer exists. It may have been deleted in another tab.");

  try {
    await db.$transaction(async (tx) => {
      // One task insert per project at a time: keeps positions unique and lets
      // the duplicate check below see a concurrent copy of the same submit.
      const lockKey = `tasks:${project.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const duplicate = await tx.task.findFirst({
        where: {
          projectId: project.id,
          title,
          dueDate,
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (duplicate) return;

      const { _max } = await tx.task.aggregate({ where: { projectId: project.id }, _max: { position: true } });
      await tx.task.create({
        data: { projectId: project.id, title, dueDate, position: (_max.position ?? -1) + 1 },
      });
    });
  } catch (error) {
    if (isPrismaError(error, "P2003")) {
      return taskError(values, "This project no longer exists. It may have been deleted in another tab.");
    }
    throw error;
  }

  revalidateProject(project.id, project.leadId);
  return { status: "success", submittedAt: Date.now() };
}

export async function setTaskStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = taskStatusSchema.safeParse(readForm(formData, ["projectId", "taskId", "status"]));
  if (!parsed.success) throw new Error("Invalid task update.");
  const { projectId, taskId, status } = parsed.data;

  // Scoped by projectId: a task id from another project is treated as missing.
  const task = await db.task.findFirst({
    where: { id: taskId, projectId },
    select: { id: true, status: true, project: { select: { leadId: true } } },
  });
  if (!task) {
    revalidateProject(projectId);
    return;
  }

  if (task.status !== status) {
    await db.task.updateMany({ where: { id: task.id, projectId }, data: { status } });
  }
  revalidateProject(projectId, task.project.leadId);
}

export async function deleteTask(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = deleteTaskSchema.safeParse(readForm(formData, ["projectId", "taskId", "confirm"]));
  if (!parsed.success) throw new Error("Invalid delete request.");
  const { projectId, taskId } = parsed.data;

  const task = await db.task.findFirst({
    where: { id: taskId, projectId },
    select: { id: true, project: { select: { leadId: true } } },
  });
  if (!task) {
    revalidateProject(projectId);
    return;
  }

  await db.task.deleteMany({ where: { id: task.id, projectId } });
  revalidateProject(projectId, task.project.leadId);
}

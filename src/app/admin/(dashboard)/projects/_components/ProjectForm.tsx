"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Field, buttonClass, cn, fieldMessageId } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { PROJECT_PIPELINE, PROJECT_STATUS } from "@/lib/admin/labels";
import { createProject, updateProject } from "../actions";
import type {
  ClientChangeWarning,
  LeadOption,
  ProjectFormErrors,
  ProjectFormField,
  ProjectFormState,
  ProjectFormValues,
} from "../_lib/types";
import { fieldClass, fieldTextareaClass } from "./field-styles";

const INITIAL_STATE: ProjectFormState = { status: "idle" };

/**
 * Create / edit form for a project. Server-side validation errors come back
 * through useActionState along with the submitted values, and the fields are
 * remounted with those values so a failed save never wipes what was typed
 * (a <select>'s defaultValue is otherwise ignored after the first render).
 *
 * In edit mode the form also carries the project's `version` (its updatedAt).
 * The server refuses a save if the project changed after that version, so a
 * form opened earlier can't silently undo a newer change.
 */
export function ProjectForm({
  mode,
  projectId,
  version,
  initialValues,
  leads,
  cancelHref,
}: {
  mode: "create" | "edit";
  projectId?: string;
  /** Edit mode: the project's updatedAt as an ISO string. */
  version?: string;
  initialValues: ProjectFormValues;
  leads: LeadOption[];
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    mode === "create" ? createProject : updateProject,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const values = state.status === "idle" ? initialValues : state.values;
  const errors: ProjectFormErrors = state.status === "error" ? state.errors : {};
  const fieldsKey = state.status === "idle" ? "initial" : String(state.submittedAt);
  const fieldsVersion = state.status === "idle" ? version : (state.version ?? version);
  const clientChange = state.status === "error" ? state.clientChange : undefined;

  // After a failed save, put the cursor on the first field that needs fixing.
  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {projectId && <input type="hidden" name="projectId" value={projectId} />}

      {state.status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 px-3.5 py-3 text-[0.82rem] text-red-700"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{state.message}</p>
        </div>
      )}

      <ProjectFields
        key={fieldsKey}
        values={values}
        errors={errors}
        leads={leads}
        version={mode === "edit" ? fieldsVersion : undefined}
        clientChange={clientChange}
      />

      <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
        {state.status === "success" && (
          <p role="status" className="flex items-center gap-1.5 text-[0.8rem] font-medium text-[#2f8a78] sm:mr-auto">
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            {state.message}
          </p>
        )}
        {cancelHref && (
          <Link href={cancelHref} className={buttonClass("secondary")}>
            Cancel
          </Link>
        )}
        <SubmitButton pendingLabel={mode === "create" ? "Creating" : "Saving"}>
          {mode === "create" ? "Create project" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}

function ProjectFields({
  values,
  errors,
  leads,
  version,
  clientChange,
}: {
  values: ProjectFormValues;
  errors: ProjectFormErrors;
  leads: LeadOption[];
  version?: string;
  clientChange?: ClientChangeWarning;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  // Keeps the due date picker from offering days before the chosen start.
  const [startDate, setStartDate] = useState(values.startDate);
  // Captured when these fields mount, so the version always matches the values
  // shown. A later refresh of the page (a newer version in props) must not
  // quietly bless edits that were started from older values.
  const [fieldsVersion] = useState(version);

  /**
   * Error or hint text for a field. Rendered through Field's hint slot (red for
   * an error) rather than its error slot, whose role="alert" would announce
   * every field on top of the form-level alert. Field gives the message
   * fieldMessageId(htmlFor), which the control points at via aria-describedby.
   */
  const describe = (name: ProjectFormField, hint?: ReactNode) => {
    const error = errors[name];
    const help = error ? <span className="text-red-600">{error}</span> : hint;
    return {
      help,
      inputProps: {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": help ? fieldMessageId(id(name)) : undefined,
      },
    };
  };

  const name = describe("name");
  const description = describe("description", "Scope, deliverables, links — anything the team should know.");
  const lead = describe(
    "leadId",
    leads.length === 0 ? "No leads yet — clients arrive through the website form." : "Optional. Links the project to a CRM lead.",
  );
  const status = describe("status");
  const start = describe("startDate", "Optional.");
  const due = describe("dueDate", "Optional. Can’t be before the start date.");
  const value = describe("value", "Optional. Agreed fee in AED, before VAT.");

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fieldsVersion && <input type="hidden" name="version" value={fieldsVersion} />}

      <Field label="Project name" htmlFor={id("name")} hint={name.help} className="sm:col-span-2">
        <input
          id={id("name")}
          name="name"
          required
          maxLength={120}
          defaultValue={values.name}
          placeholder="e.g. Purchase order automation"
          className={fieldClass}
          {...name.inputProps}
        />
      </Field>

      <Field label="Description" htmlFor={id("description")} hint={description.help} className="sm:col-span-2">
        <textarea
          id={id("description")}
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={values.description}
          className={fieldTextareaClass}
          {...description.inputProps}
        />
      </Field>

      <div>
        <Field label="Client" htmlFor={id("leadId")} hint={lead.help}>
          <select id={id("leadId")} name="leadId" defaultValue={values.leadId} className={fieldClass} {...lead.inputProps}>
            <option value="">No client</option>
            {leads.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {clientChange && (
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-[0.8rem] text-ink-800">
            <input
              type="checkbox"
              name="confirmClientChange"
              value="yes"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-abyss-600"
            />
            <span>
              Change the client anyway. The {clientChange.invoiceCount === 1 ? "invoice" : `${clientChange.invoiceCount} invoices`}{" "}
              billed to {clientChange.billedTo} stay{clientChange.invoiceCount === 1 ? "s" : ""} on this project.
            </span>
          </label>
        )}
      </div>

      <Field label="Status" htmlFor={id("status")} hint={status.help}>
        <select
          id={id("status")}
          name="status"
          defaultValue={values.status || "PLANNING"}
          className={fieldClass}
          {...status.inputProps}
        >
          {PROJECT_PIPELINE.map((option) => (
            <option key={option} value={option}>
              {PROJECT_STATUS[option].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Start date" htmlFor={id("startDate")} hint={start.help}>
        <input
          id={id("startDate")}
          name="startDate"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          defaultValue={values.startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className={fieldClass}
          {...start.inputProps}
        />
      </Field>

      <Field label="Due date" htmlFor={id("dueDate")} hint={due.help}>
        <input
          id={id("dueDate")}
          name="dueDate"
          type="date"
          min={startDate || "2000-01-01"}
          max="2100-12-31"
          defaultValue={values.dueDate}
          className={fieldClass}
          {...due.inputProps}
        />
      </Field>

      <Field label="Project value" htmlFor={id("value")} hint={value.help} className="sm:col-span-2">
        <div className="relative sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.7rem] font-medium tracking-[0.08em] text-ink-500">
            AED
          </span>
          <input
            id={id("value")}
            name="value"
            inputMode="decimal"
            autoComplete="off"
            maxLength={32}
            placeholder="0.00"
            defaultValue={values.value}
            className={cn(fieldClass, "pl-12 tabular-nums")}
            {...value.inputProps}
          />
        </div>
      </Field>
    </div>
  );
}

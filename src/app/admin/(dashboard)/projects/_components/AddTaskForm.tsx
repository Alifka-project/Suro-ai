"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { addTask } from "../actions";
import type { TaskFormState, TaskFormValues } from "../_lib/types";
import { fieldClass } from "./field-styles";

const INITIAL_STATE: TaskFormState = { status: "idle" };
const EMPTY: TaskFormValues = { title: "", dueDate: "" };

/**
 * Quick-add row. On success React resets the form and focus returns to the
 * title so several tasks can be entered in a row; on error the typed values
 * are restored alongside the message.
 */
export function AddTaskForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState<TaskFormState, FormData>(addTask, INITIAL_STATE);
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const errorId = `${uid}-error`;

  const values = state.status === "error" ? state.values : EMPTY;
  const fieldsKey = state.status === "error" ? String(state.submittedAt) : "fresh";
  const titleError = state.status === "error" ? (state.errors.title ?? null) : null;
  const dueError = state.status === "error" ? (state.errors.dueDate ?? null) : null;

  // After a submit, focus goes back to the title (ready for the next task),
  // or to the due date when that is the only field that needs fixing.
  useEffect(() => {
    if (state.status === "idle") return;
    const onlyDueDateWrong = state.status === "error" && state.errors.dueDate && !state.errors.title;
    (onlyDueDateWrong ? dueRef : titleRef).current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="rounded-xl border border-ink-100 bg-canvas/70 p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div key={fieldsKey} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={`${uid}-title`} className="sr-only">
          New task
        </label>
        <input
          ref={titleRef}
          id={`${uid}-title`}
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Add a task…"
          defaultValue={values.title}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? errorId : undefined}
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
        {/* The visible "Due" caption matters on touch devices: an empty date
            input shows no placeholder there, and a title tooltip never appears. */}
        <div className="relative sm:w-48">
          <label
            htmlFor={`${uid}-due`}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-500"
          >
            Due<span className="sr-only"> date (optional)</span>
          </label>
          <input
            ref={dueRef}
            id={`${uid}-due`}
            name="dueDate"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            defaultValue={values.dueDate}
            aria-invalid={dueError ? true : undefined}
            aria-describedby={dueError ? errorId : undefined}
            className={cn(fieldClass, "pl-12 [&::-webkit-date-and-time-value]:text-left")}
          />
        </div>
        <SubmitButton pendingLabel="Adding" className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add task
        </SubmitButton>
      </div>
      {state.status === "error" && (
        <p id={errorId} role="alert" className="mt-2 px-1 text-[0.76rem] text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

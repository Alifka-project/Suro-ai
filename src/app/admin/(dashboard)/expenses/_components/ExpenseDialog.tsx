"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
import { buttonClass, cn, inputClass, textareaClass } from "@/components/admin/ui";
import { EXPENSE_CATEGORIES } from "@/lib/admin/expenses";
import { DEFAULT_CURRENCY, filsToInput } from "@/lib/admin/money";
import { addDaysToDateInput, toDateInputValue } from "@/lib/admin/time";
import { createExpense, updateExpense } from "../actions";
import { ADD_BUTTON_ID, LIST_HEADING_ID } from "../_lib/filters";
import type { ExpenseFormState, ExpenseRow, ProjectOption } from "../_lib/types";

/*
 * "Add expense" and "Edit expense": one native <dialog> in two modes, opened
 * with showModal() so the browser traps focus, closes it on Escape and puts
 * focus back on the button that opened it.
 *
 * Same pattern as the dashboard's "Add project": the form submits through
 * onSubmit + a transition rather than `<form action>`, because React resets a
 * form after an action and a failed save would wipe what was typed. Closing
 * "Add" without saving (Cancel, Escape, a stray backdrop click) keeps what was
 * typed for the next "Add expense". A new key remounts, and so clears, the
 * form after a save, for each edit, when switching between edit and add, and
 * when the preselected client changes.
 *
 * Focus: when there is no button to go back to (the dialog opened by itself
 * for ?add=1), or the refreshed list drops it (the first expense replaces the
 * empty state; an edit moves a row out of this view), focus lands on the
 * header's "Add expense" button or the list heading, never the top of the page.
 */

export type ExpenseDialogHandle = {
  /** Open in add mode, with this client preselected ("" for none). */
  openAdd: (leadId: string) => void;
  openEdit: (expense: ExpenseRow) => void;
};

type Editor =
  | { mode: "add"; key: number; date: string; maxDate: string; leadId: string }
  | { mode: "edit"; key: number; maxDate: string; expense: ExpenseRow };

/** Form order: the first of these with an error gets focus. */
const FIELDS = ["date", "amount", "description", "category", "vendor", "project", "notes"] as const;

const LABEL = "mb-1.5 block text-[0.78rem] font-semibold text-ink-700";
const SELECT = cn(inputClass, "appearance-auto pr-2");
/** Same dimming as a disabled button, without `disabled` (which would drop keyboard focus). */
const BUSY = "aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/** A year ahead, give or take a leap day; the server holds the exact rule. */
const maxDateFor = (today: string) => addDaysToDateInput(today, 365);

/** Show the dialog as a modal and start in the first field (the browser would pick the Close button). */
function showDialog(dialog: HTMLDialogElement | null, form: HTMLFormElement | null) {
  if (dialog && !dialog.open) dialog.showModal();
  form?.querySelector<HTMLElement>('[name="date"]')?.focus();
}

export function ExpenseDialog({
  ref,
  projects,
  today,
  initialLeadId,
  openOnLoad,
  onSaved,
}: {
  ref: Ref<ExpenseDialogHandle>;
  projects: ProjectOption[];
  /** Today on the business clock, from the server (the first render must match it). */
  today: string;
  /** Preselected client for the dialog opened by ?add=1. */
  initialLeadId: string;
  /** ?add=1: open in add mode as soon as the page loads. */
  openOnLoad: boolean;
  onSaved: (message: string, at: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ExpenseFormState>(null);
  const [editor, setEditor] = useState<Editor>(() => ({
    mode: "add",
    key: 0,
    date: today,
    maxDate: maxDateFor(today),
    leadId: initialLeadId,
  }));
  // Set by an open request; the effect below shows the dialog once the new
  // form has rendered, then focuses its first field.
  const openRequested = useRef(openOnLoad);
  // The field to focus once a failed attempt's errors have rendered.
  const focusAfterRender = useRef<string | null>(null);
  // True when the current press started on the backdrop (see onClick below).
  const pressOnBackdrop = useRef(false);
  // True once something has been typed into the mounted add form, and false
  // again after it is saved: a draft worth keeping when "Add" reopens.
  const draft = useRef(false);
  // After a save: the button focus went back to, until the refreshed list
  // shows whether it is still there (see the effect below).
  const savedFrom = useRef<HTMLElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      openAdd: (leadId) => {
        if (editor.mode === "add" && editor.leadId === leadId && draft.current) {
          // Field errors still describe the kept values; a server or network
          // message from the last attempt is stale.
          setState((prev) => (prev?.fieldErrors ? prev : null));
          showDialog(dialogRef.current, formRef.current);
          return;
        }
        const now = toDateInputValue(new Date());
        openRequested.current = true;
        draft.current = false;
        setState(null);
        setEditor((prev) => ({ mode: "add", key: prev.key + 1, date: now, maxDate: maxDateFor(now), leadId }));
      },
      openEdit: (expense) => {
        openRequested.current = true;
        draft.current = false;
        setState(null);
        setEditor((prev) => ({
          mode: "edit",
          key: prev.key + 1,
          maxDate: maxDateFor(toDateInputValue(new Date())),
          expense,
        }));
      },
    }),
    [editor],
  );

  useEffect(() => {
    if (!openRequested.current) return;
    openRequested.current = false;
    showDialog(dialogRef.current, formRef.current);
  }, [editor]);

  // ?add=1 has done its job once the dialog is open: drop it, so a refresh or
  // a shared link doesn't reopen the dialog. Only the URL changes, so the
  // native History API (which the App Router keeps in sync) rather than
  // router.replace, which would have the server render the whole page again.
  useEffect(() => {
    if (!openOnLoad) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("add")) return;
    url.searchParams.delete("add");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [openOnLoad]);

  // Runs after every render, including the one that brings the refreshed list
  // after a save. If that list no longer has the button focus went back to,
  // and focus hasn't moved on since, land on the list heading.
  useEffect(() => {
    const from = savedFrom.current;
    if (!from) return;
    const active = document.activeElement;
    if (from.isConnected) {
      if (active !== from) savedFrom.current = null;
      return;
    }
    savedFrom.current = null;
    if (!active || active === document.body) document.getElementById(LIST_HEADING_ID)?.focus();
  });

  useEffect(() => {
    const name = focusAfterRender.current;
    if (!name) return;
    focusAfterRender.current = null;
    formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  }, [state]);

  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    const save = editor.mode === "edit" ? updateExpense : createExpense;
    startTransition(async () => {
      let result: ExpenseFormState;
      try {
        result = await save(data);
      } catch {
        result = { ok: false, message: "Could not reach the server. Check your connection and try again.", at: Date.now() };
      }
      if (result?.ok) {
        dialogRef.current?.close();
        // close() has put focus back on the opening button, if there was one.
        const back = document.activeElement;
        savedFrom.current = back instanceof HTMLElement && back !== document.body ? back : null;
        // The next "Add expense" starts from a blank form.
        draft.current = false;
        setState(null);
        onSaved(result.message, result.at);
        return;
      }
      const errors = result?.fieldErrors ?? {};
      focusAfterRender.current = FIELDS.find((name) => errors[name]) ?? null;
      setState(result);
    });
  };

  const editing = editor.mode === "edit" ? editor.expense : null;
  // New expenses are AED; an imported one in another currency keeps it when edited.
  const currency = editing?.currency ?? DEFAULT_CURRENCY;
  const foreign = currency !== DEFAULT_CURRENCY;
  const defaults = editing
    ? {
        date: editing.date,
        amount: filsToInput(editing.amountFils),
        category: editing.category,
        description: editing.description,
        vendor: editing.vendor ?? "",
        project: editing.project?.id ?? "",
        notes: editing.notes ?? "",
      }
    : {
        date: editor.mode === "add" ? editor.date : today,
        amount: "",
        category: "",
        description: "",
        vendor: "",
        project: editor.mode === "add" ? editor.leadId : "",
        notes: "",
      };

  // Clients still on the dashboard, plus (when editing) a removed client the
  // expense is already linked to, so saving doesn't silently unlink it.
  const projectOptions = projects.filter((p) => !p.removed || p.id === defaults.project);
  // A category since retired from the list is still shown as the stored value
  // (rather than a blank select); saving asks for a current one.
  const categoryOptions: { key: string; label: string }[] = [...EXPENSE_CATEGORIES];
  if (defaults.category && !categoryOptions.some((c) => c.key === defaults.category)) {
    categoryOptions.push({ key: defaults.category, label: defaults.category });
  }

  const title = editing ? "Edit expense" : "Add expense";
  const err = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined);
  const fieldId = (name: string) => `${ids}-${name}`;
  const errId = (name: string) => `${ids}-${name}-error`;
  const hintId = (name: string) => `${ids}-${name}-hint`;
  const describe = (name: string, hint = false) => {
    const by = [hint ? hintId(name) : null, err(name) ? errId(name) : null].filter(Boolean).join(" ");
    return { "aria-invalid": err(name) ? true : undefined, "aria-describedby": by || undefined };
  };
  const fieldError = (name: string) =>
    err(name) ? (
      <p id={errId(name)} className="mt-1 text-[0.76rem] text-red-600">
        {err(name)}
      </p>
    ) : null;
  const hint = (name: string, children: ReactNode) => (
    <p id={hintId(name)} className="mt-1 text-[0.74rem] text-ink-550">
      {children}
    </p>
  );
  const required = (
    <>
      {" "}
      <span className="text-red-600" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-intro`}
      // While saving, Escape must not close it: an error would go unseen.
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      // The browser has just put focus back on the button that opened the
      // dialog. When there was none (?add=1) or it is gone, focus would be
      // left on the page itself.
      onClose={() => {
        const active = document.activeElement;
        if (active && active !== document.body && !dialogRef.current?.contains(active)) return;
        document.getElementById(editor.mode === "add" ? ADD_BUTTON_ID : LIST_HEADING_ID)?.focus();
      }}
      className={cn(
        "m-auto w-[min(40rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-3xl bg-white p-0 text-left text-ink-900",
        "shadow-[0_30px_80px_-30px_rgb(7_38_60/0.45)] ring-1 ring-ink-100",
        "backdrop:bg-ink-900/40 backdrop:backdrop-blur-[2px]",
      )}
      // A click on the backdrop lands on the dialog element itself. Only a
      // press that also started there closes it, so ending a text-selection
      // drag outside the form doesn't.
      onPointerDown={(e) => {
        pressOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressOnBackdrop.current && e.target === e.currentTarget) close();
        pressOnBackdrop.current = false;
      }}
    >
      <form
        key={editor.key}
        ref={formRef}
        onSubmit={onSubmit}
        onInput={() => {
          if (editor.mode === "add") draft.current = true;
        }}
        noValidate
        aria-busy={pending}
        className="flex max-h-[calc(100dvh-1.5rem)] flex-col"
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={`${ids}-title`} className="font-display text-[1.1rem] font-bold text-ink-900">
              {title}
            </h2>
            <p id={`${ids}-intro`} className="mt-0.5 text-[0.8rem] text-ink-550">
              {editing
                ? `Change any detail and save. Amounts are in ${currency}, VAT included.`
                : "A cost for a client's project, or a running cost of the business. Amounts are in AED, VAT included."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-disabled={pending || undefined}
            aria-label="Close"
            className={cn(
              "-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-550 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400",
              BUSY,
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Fields */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={fieldId("date")} className={LABEL}>
                Date paid{required}
              </label>
              <input
                id={fieldId("date")}
                name="date"
                type="date"
                required
                min="2000-01-01"
                max={editor.maxDate}
                defaultValue={defaults.date}
                className={inputClass}
                {...describe("date")}
              />
              {fieldError("date")}
            </div>

            <div>
              <label htmlFor={fieldId("amount")} className={LABEL}>
                Amount ({currency}){required}
              </label>
              <input
                id={fieldId("amount")}
                name="amount"
                required
                inputMode="decimal"
                autoComplete="off"
                maxLength={20}
                placeholder="e.g. 1,250.00"
                defaultValue={defaults.amount}
                className={cn(inputClass, "tabular-nums")}
                {...describe("amount", true)}
              />
              {hint(
                "amount",
                foreign
                  ? `What was paid, VAT included. This expense is in ${currency}, so the AED totals leave it out.`
                  : "What was paid, VAT included.",
              )}
              {fieldError("amount")}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={fieldId("description")} className={LABEL}>
                Description{required}
              </label>
              <input
                id={fieldId("description")}
                name="description"
                required
                maxLength={160}
                autoComplete="off"
                placeholder="What it was for, e.g. Figma licence for October"
                defaultValue={defaults.description}
                className={inputClass}
                {...describe("description")}
              />
              {fieldError("description")}
            </div>

            <div>
              <label htmlFor={fieldId("category")} className={LABEL}>
                Category{required}
              </label>
              <select
                id={fieldId("category")}
                name="category"
                required
                defaultValue={defaults.category}
                className={SELECT}
                {...describe("category")}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {categoryOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              {fieldError("category")}
            </div>

            <div>
              <label htmlFor={fieldId("vendor")} className={LABEL}>
                Paid to
              </label>
              <input
                id={fieldId("vendor")}
                name="vendor"
                maxLength={120}
                autoComplete="off"
                placeholder="Supplier, freelancer or shop"
                defaultValue={defaults.vendor}
                className={inputClass}
                {...describe("vendor")}
              />
              {fieldError("vendor")}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={fieldId("project")} className={LABEL}>
                Project
              </label>
              <select
                id={fieldId("project")}
                name="project"
                defaultValue={defaults.project}
                className={SELECT}
                {...describe("project", true)}
              >
                <option value="">No project — running cost</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.removed ? `${p.label} (removed)` : p.label}
                  </option>
                ))}
              </select>
              {hint("project", "Link it to a client to count it as a cost of their project.")}
              {fieldError("project")}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={fieldId("notes")} className={LABEL}>
                Notes
              </label>
              <textarea
                id={fieldId("notes")}
                name="notes"
                rows={3}
                maxLength={1000}
                placeholder="Invoice or receipt number, what it covers…"
                defaultValue={defaults.notes}
                className={textareaClass}
                {...describe("notes")}
              />
              {fieldError("notes")}
            </div>
          </div>
        </div>

        {/* Footer. On phones the message sits above the buttons and takes no room until there is one. */}
        <div className="flex flex-col border-t border-ink-100 bg-canvas/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-6">
          <p role="status" aria-live="polite" className="text-[0.8rem] text-red-600 sm:min-h-5">
            {state && !state.ok ? (
              <span key={state.at} className="mb-2 block sm:mb-0">
                {state.message}
              </span>
            ) : null}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={close}
              aria-disabled={pending || undefined}
              className={cn(buttonClass("secondary", "sm"), "h-10 flex-1 sm:flex-none", BUSY)}
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={pending || undefined}
              aria-busy={pending}
              className={cn(buttonClass("primary", "sm"), "h-10 flex-1 sm:flex-none", BUSY)}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : editing ? (
                <Save className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {pending ? "Saving…" : editing ? "Save changes" : "Add expense"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

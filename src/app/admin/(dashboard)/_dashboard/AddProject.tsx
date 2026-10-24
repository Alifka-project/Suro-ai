"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { buttonClass, cn, inputClass, textareaClass } from "@/components/admin/ui";
import { CLIENT_STATUSES, LEAD_STATUS } from "@/lib/admin/labels";
import { NOT_SURE_OPTION, PACKAGES } from "@/lib/packages";
import { addProject, type AddProjectState } from "./actions";

/*
 * "Add project": a button in the Clients header that opens a dialog for a
 * client or deal the team found itself (not through the website form). The
 * new entry appears in the table as "Added manually", with the same WhatsApp,
 * call, quotation, invoice and status controls, and its row opens straight
 * away.
 *
 * A native <dialog> opened with showModal(): the browser traps focus inside,
 * closes it on Escape and puts focus back on the button afterwards.
 *
 * The form submits through onSubmit + a transition rather than
 * `<form action>`: React resets a form after an action, which would wipe
 * everything typed whenever validation fails. The success steps (close, clear,
 * open the new row) run right after the action returns, not in an effect, so
 * they still happen when the table re-renders around the button.
 */

const LABEL = "mb-1.5 block text-[0.78rem] font-semibold text-ink-700";

export function AddProjectButton({ className }: { className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AddProjectState>(null);
  // Read by the polite live region outside the dialog, so a screen reader
  // hears the result after the dialog closes.
  const [announcement, setAnnouncement] = useState<{ text: string; at: number } | null>(null);
  // The field to focus once a failed attempt's errors have rendered.
  const focusAfterRender = useRef<string | null>(null);
  // True when the current press started on the backdrop (see onClick below).
  const pressOnBackdrop = useRef(false);

  useEffect(() => {
    const name = focusAfterRender.current;
    if (!name) return;
    focusAfterRender.current = null;
    formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  }, [state]);

  const open = () => {
    dialogRef.current?.showModal();
    // The browser would focus the first focusable element, the Close button;
    // start in the first field instead.
    formRef.current?.querySelector<HTMLInputElement>('[name="title"]')?.focus();
  };
  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      let result: AddProjectState;
      try {
        result = await addProject(null, data);
      } catch {
        result = { ok: false, message: "Could not reach the server. Check your connection and try again.", at: Date.now() };
      }
      if (result?.ok && result.leadId) {
        dialogRef.current?.close();
        formRef.current?.reset();
        setState(null);
        setAnnouncement({ text: `${result.message} Its row is open in the table.`, at: result.at });
        router.push(`/admin?client=${encodeURIComponent(result.leadId)}#clients`);
        return;
      }
      focusAfterRender.current = result?.fieldErrors ? (Object.keys(result.fieldErrors)[0] ?? null) : null;
      setState(result);
    });
  };

  const err = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined);
  const fieldId = (name: string) => `${ids}-${name}`;
  const errId = (name: string) => `${ids}-${name}-error`;
  const describe = (name: string) => (err(name) ? { "aria-invalid": true, "aria-describedby": errId(name) } : {});
  const fieldError = (name: string) =>
    err(name) ? (
      <p id={errId(name)} className="mt-1 text-[0.76rem] text-red-600">
        {err(name)}
      </p>
    ) : null;

  return (
    <>
      <button type="button" onClick={open} className={cn(buttonClass("primary", "sm"), "h-10 shrink-0 px-4", className)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add project
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement ? <span key={announcement.at}>{announcement.text}</span> : null}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-intro`}
        // While saving, Escape must not close it: an error would go unseen.
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className={cn(
          // text-left: a dialog still inherits alignment from where the button sits.
          "m-auto w-[min(42rem,calc(100vw-1.5rem))] text-left max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-3xl bg-white p-0 text-ink-900",
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
        <form ref={formRef} onSubmit={onSubmit} noValidate className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 pb-4 pt-5 sm:px-6">
            <div className="min-w-0">
              <h2 id={`${ids}-title`} className="font-display text-[1.1rem] font-bold text-ink-900">
                Add project
              </h2>
              <p id={`${ids}-intro`} className="mt-0.5 text-[0.8rem] text-ink-550">
                A client or deal you found yourself. It joins the table as &ldquo;Added manually&rdquo;.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              aria-label="Close"
              className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-550 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Fields */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={fieldId("title")} className={LABEL}>
                  Project name
                </label>
                <input
                  id={fieldId("title")}
                  name="title"
                  maxLength={160}
                  placeholder="e.g. Supplier invoice automation"
                  className={inputClass}
                  {...describe("title")}
                />
                {fieldError("title")}
              </div>

              <div>
                <label htmlFor={fieldId("fullName")} className={LABEL}>
                  Client name <span className="text-red-600" aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <input
                  id={fieldId("fullName")}
                  name="fullName"
                  required
                  maxLength={120}
                  autoComplete="off"
                  className={inputClass}
                  {...describe("fullName")}
                />
                {fieldError("fullName")}
              </div>
              <div>
                <label htmlFor={fieldId("companyName")} className={LABEL}>
                  Company
                </label>
                <input
                  id={fieldId("companyName")}
                  name="companyName"
                  maxLength={160}
                  autoComplete="off"
                  placeholder="Leave empty for an individual"
                  className={inputClass}
                  {...describe("companyName")}
                />
                {fieldError("companyName")}
              </div>

              <div>
                <label htmlFor={fieldId("email")} className={LABEL}>
                  Email
                </label>
                <input
                  id={fieldId("email")}
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                  className={inputClass}
                  {...describe("email")}
                />
                {fieldError("email")}
              </div>
              <div>
                <label htmlFor={fieldId("phone")} className={LABEL}>
                  Phone / WhatsApp
                </label>
                <input
                  id={fieldId("phone")}
                  name="phone"
                  type="tel"
                  maxLength={32}
                  autoComplete="off"
                  placeholder="+971 50 123 4567"
                  className={inputClass}
                  {...describe("phone")}
                />
                {fieldError("phone")}
              </div>

              <div>
                <label htmlFor={fieldId("country")} className={LABEL}>
                  Country
                </label>
                <input
                  id={fieldId("country")}
                  name="country"
                  maxLength={80}
                  defaultValue="United Arab Emirates"
                  className={inputClass}
                  {...describe("country")}
                />
                {fieldError("country")}
              </div>
              <div>
                <label htmlFor={fieldId("city")} className={LABEL}>
                  City
                </label>
                <input
                  id={fieldId("city")}
                  name="city"
                  maxLength={80}
                  defaultValue="Dubai"
                  className={inputClass}
                  {...describe("city")}
                />
                {fieldError("city")}
              </div>

              <div>
                <label htmlFor={fieldId("value")} className={LABEL}>
                  Expected value (AED)
                </label>
                <input
                  id={fieldId("value")}
                  name="value"
                  inputMode="decimal"
                  maxLength={20}
                  placeholder="e.g. 45,000"
                  className={inputClass}
                  {...describe("value")}
                />
                {fieldError("value")}
              </div>
              <div>
                <label htmlFor={fieldId("status")} className={LABEL}>
                  Status
                </label>
                <select
                  id={fieldId("status")}
                  name="status"
                  defaultValue="NEW"
                  className={cn(inputClass, "appearance-auto pr-2")}
                  {...describe("status")}
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS[s].label}
                    </option>
                  ))}
                </select>
                {fieldError("status")}
              </div>
            </div>

            <fieldset>
              <legend className={LABEL}>Interested in</legend>
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {PACKAGES.map((p) => (
                  <label key={p.id} className="flex min-w-0 items-start gap-2 text-[0.84rem] text-ink-800">
                    <input
                      type="checkbox"
                      name="services"
                      value={p.formLabel}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-abyss-600"
                    />
                    <span className="min-w-0">
                      <span className="tabular-nums text-ink-550">{p.number} · </span>
                      {p.name}
                    </span>
                  </label>
                ))}
                <label className="flex min-w-0 items-start gap-2 text-[0.84rem] text-ink-800">
                  <input
                    type="checkbox"
                    name="services"
                    value={NOT_SURE_OPTION}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-abyss-600"
                  />
                  <span className="min-w-0">{NOT_SURE_OPTION}</span>
                </label>
              </div>
              {fieldError("services")}
            </fieldset>

            <div>
              <label htmlFor={fieldId("notes")} className={LABEL}>
                Notes
              </label>
              <textarea
                id={fieldId("notes")}
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="How you met, what they need, next step…"
                className={textareaClass}
                {...describe("notes")}
              />
              {fieldError("notes")}
            </div>
          </div>

          {/* Footer */}
          {/* On phones the message sits above the buttons and takes no room until there is one. */}
          <div className="flex flex-col border-t border-ink-100 bg-canvas/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-6">
            <p role="status" aria-live="polite" className="text-[0.8rem] text-red-600 sm:min-h-5">
              {state && !state.ok ? (
                <span key={state.at} className="mb-2 block sm:mb-0">
                  {state.message}
                </span>
              ) : null}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className={cn(buttonClass("secondary", "sm"), "h-10 flex-1 sm:flex-none")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className={cn(buttonClass("primary", "sm"), "h-10 flex-1 sm:flex-none")}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {pending ? "Adding…" : "Add project"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}

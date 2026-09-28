"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button, Field, cn, fieldMessageId, inputClass, textareaClass } from "@/components/admin/ui";
import type { OpenStage } from "@/lib/admin/pipeline";
import { quickCreateLead, type CrmActionState } from "../../actions";
import { FormMessage } from "../../_components/FormMessage";

/**
 * Odoo's quick-create card at the top of a column: just enough to start
 * tracking a client you're approaching. Only the contact name is required.
 *
 * Submitted through onSubmit + startTransition rather than `action={…}`:
 * React resets a form after every action submission, which would wipe what
 * the admin typed whenever validation fails. Here the fields are cleared only
 * after a successful save, and the composer stays open for the next card.
 */
export function QuickCreateForm({
  id,
  stage,
  stageLabel,
  nonce,
  onClose,
}: {
  id: string;
  stage: OpenStage;
  stageLabel: string;
  /** Changes whenever the composer is (re)opened: focus returns to the first field. */
  nonce: number;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<CrmActionState, FormData>(quickCreateLead, null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const fid = (name: string) => `${id}-${name}`;

  useEffect(() => {
    nameRef.current?.focus();
  }, [nonce]);

  // Saved: clear the fields for the next card (the card itself arrives with
  // the revalidated board). Rejected: take the admin to the first bad field.
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      formRef.current?.reset();
      nameRef.current?.focus();
    } else {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    // Ctrl/Cmd + Enter saves from the note field too.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.repeat) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const describedBy = (name: string) => (errors[name] ? fieldMessageId(fid(name)) : undefined);

  return (
    <form
      ref={formRef}
      id={id}
      onSubmit={submit}
      onKeyDown={onKeyDown}
      aria-label={`New opportunity in ${stageLabel}`}
      aria-busy={pending || undefined}
      noValidate
      className="mb-2 space-y-2.5 rounded-xl border border-azure-300 bg-white p-3 shadow-[0_10px_24px_-16px_rgb(7_38_60/0.45)]"
    >
      <input type="hidden" name="stage" value={stage} />

      <Field label="Contact name (required)" htmlFor={fid("fullName")} error={errors.fullName}>
        <input
          ref={nameRef}
          id={fid("fullName")}
          name="fullName"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="e.g. Omar Al Haddad"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={describedBy("fullName")}
          className={inputClass}
        />
      </Field>
      <Field label="Company" htmlFor={fid("companyName")} error={errors.companyName}>
        <input
          id={fid("companyName")}
          name="companyName"
          maxLength={160}
          autoComplete="off"
          aria-invalid={errors.companyName ? true : undefined}
          aria-describedby={describedBy("companyName")}
          className={inputClass}
        />
      </Field>
      <Field label="Opportunity" htmlFor={fid("title")} error={errors.title}>
        <input
          id={fid("title")}
          name="title"
          maxLength={160}
          autoComplete="off"
          placeholder="e.g. B/L intake automation"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy("title")}
          className={inputClass}
        />
      </Field>
      <Field label="Expected revenue (AED)" htmlFor={fid("value")} error={errors.value}>
        <input
          id={fid("value")}
          name="value"
          inputMode="decimal"
          autoComplete="off"
          placeholder="45,000"
          aria-invalid={errors.value ? true : undefined}
          aria-describedby={describedBy("value")}
          className={cn(inputClass, "tabular-nums")}
        />
      </Field>
      <Field label="Email" htmlFor={fid("email")} error={errors.email}>
        <input
          id={fid("email")}
          name="email"
          type="email"
          maxLength={254}
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email")}
          className={inputClass}
        />
      </Field>
      <Field label="Phone" htmlFor={fid("phone")} error={errors.phone}>
        <input
          id={fid("phone")}
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="off"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={describedBy("phone")}
          className={inputClass}
        />
      </Field>
      <Field label="First note" htmlFor={fid("note")} error={errors.note}>
        <textarea
          id={fid("note")}
          name="note"
          rows={2}
          maxLength={4000}
          placeholder="How you met, what they need, next step…"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={describedBy("note")}
          className={cn(textareaClass, "min-h-[4rem] resize-y")}
        />
      </Field>

      <div className="flex items-center gap-2 pt-0.5">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Adding
            </>
          ) : (
            "Add"
          )}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Field problems are announced beside their fields; this line carries
          success and anything that isn't about one field. */}
      <FormMessage state={state && (state.ok || !state.fieldErrors) ? state : null} className="-mt-1" />
      {state?.ok && state.leadId && (
        <Link
          href={`/admin/crm/${state.leadId}`}
          className="inline-flex items-center gap-1 text-[0.76rem] font-semibold text-abyss-600 hover:underline"
        >
          Open the new opportunity
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </form>
  );
}

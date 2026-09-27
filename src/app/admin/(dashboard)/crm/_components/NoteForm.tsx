"use client";

import { useActionState, useEffect, useRef, type KeyboardEvent } from "react";
import { cn, textareaClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { addNote, type CrmActionState } from "../actions";
import { FormMessage } from "./FormMessage";

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<CrmActionState, FormData>(addNote, null);
  const failed = state !== null && !state.ok;
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The textarea remounts after every attempt (see its key), which drops focus
  // to <body>. Put it back so the admin can keep typing — but only if focus was
  // still in this form, never pulling it away from wherever they moved on to.
  useEffect(() => {
    if (!state) return;
    const active = document.activeElement;
    if (active === null || active === document.body || formRef.current?.contains(active)) {
      textareaRef.current?.focus();
    }
  }, [state]);

  function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    // requestSubmit() ignores the disabled SubmitButton, so guard here too:
    // a second press (or key auto-repeat) mid-save would queue a duplicate note.
    if (pending || event.repeat) return;
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-2.5">
      <input type="hidden" name="leadId" value={leadId} />
      <label htmlFor="note-body" className="sr-only">
        New note
      </label>
      {/* Remounted per attempt: empty after a save, the typed text after a failure. */}
      <textarea
        ref={textareaRef}
        key={state?.at ?? 0}
        id="note-body"
        name="body"
        rows={3}
        required
        maxLength={4000}
        readOnly={pending}
        aria-busy={pending || undefined}
        defaultValue={failed ? (state.value ?? "") : ""}
        placeholder="Log a call, a meeting or the next step..."
        onKeyDown={submitOnModEnter}
        aria-invalid={failed || undefined}
        className={cn(textareaClass, "min-h-[5.5rem] resize-y read-only:opacity-70")}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.72rem] text-ink-600">Private to admins. Ctrl or Cmd + Enter to save.</p>
        <SubmitButton size="sm" pendingLabel="Adding">
          Add note
        </SubmitButton>
      </div>
      {/* Success is announced too ("Note added."), not only failures. */}
      <FormMessage state={state} />
    </form>
  );
}

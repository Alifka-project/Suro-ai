"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { deleteNote, type CrmActionState } from "../actions";

/**
 * Two-step delete: the first click only asks; the second, explicit one deletes.
 * `noteLabel` (the note's timestamp) names which note each button acts on, so
 * screen-reader and voice-control users can tell the "Delete" buttons apart.
 */
export function DeleteNoteButton({
  leadId,
  noteId,
  noteLabel,
}: {
  leadId: string;
  noteId: string;
  noteLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<CrmActionState, FormData>(deleteNote, null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus into the confirmation so keyboard users land on a safe choice.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete note from ${noteLabel}`}
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[0.74rem] font-medium text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Delete
      </button>
    );
  }

  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) setConfirming(false);
      }}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="noteId" value={noteId} />
      <span className="text-[0.76rem] font-medium text-ink-600">Delete this note?</span>
      <Button ref={cancelRef} type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <SubmitButton variant="danger" size="sm" pendingLabel="Deleting" aria-label={`Delete note from ${noteLabel}`}>
        Delete
      </SubmitButton>
      {state && !state.ok && (
        <p role="alert" className="w-full text-right text-[0.74rem] text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

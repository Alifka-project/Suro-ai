"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { deleteLead, type CrmActionState } from "../actions";
import { plural } from "../_lib/helpers";

/**
 * Danger zone. Deleting takes two deliberate steps — open the panel, tick
 * "I understand" — and the server independently refuses without the tick.
 */
export function DeleteLeadPanel({
  leadId,
  leadName,
  noteCount,
  linkedCount,
  activityCount = 0,
}: {
  leadId: string;
  leadName: string;
  /** Timeline entries (notes and events), deleted with the opportunity. */
  noteCount: number;
  linkedCount: number;
  /** Scheduled and completed activities, deleted with the opportunity. */
  activityCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CrmActionState, FormData>(deleteLead, null);

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="rounded-2xl border border-red-200 bg-red-50/40 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="danger-zone-title" className="font-display text-[0.98rem] font-bold text-ink-900">
            Danger zone
          </h2>
          <p className="mt-0.5 text-[0.78rem] leading-relaxed text-ink-500">
            Deleting removes this opportunity, its timeline ({plural(noteCount, "entry", "entries")})
            {activityCount > 0 && ` and ${plural(activityCount, "activity", "activities")}`} for good.
            {linkedCount > 0 &&
              ` Its ${plural(linkedCount, "linked record")} (quotations, agreements, invoices, projects) will be kept but unlinked.`}
          </p>
        </div>
      </div>

      {!open ? (
        <Button type="button" variant="danger" className="mt-4 w-full" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete opportunity
        </Button>
      ) : (
        /*
         * Remounted after every attempt. React resets a form once its action
         * settles, which unticks the checkbox on screen; a fresh mount resets
         * the "understood" state with it, so the box and the Delete button can
         * never disagree after a failed delete.
         */
        <ConfirmDeleteForm
          key={state?.at ?? 0}
          leadId={leadId}
          leadName={leadName}
          formAction={formAction}
          pending={pending}
          error={state && !state.ok ? state.message : null}
          onCancel={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function ConfirmDeleteForm({
  leadId,
  leadName,
  formAction,
  pending,
  error,
  onCancel,
}: {
  leadId: string;
  leadName: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);

  // On open, and again after a failed attempt, start keyboard users on the tick box.
  useEffect(() => {
    checkboxRef.current?.focus();
  }, []);

  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onCancel();
      }}
      className="mt-4 space-y-3 rounded-xl border border-red-200 bg-white p-4"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <label className="flex cursor-pointer items-start gap-2.5 text-[0.8rem] leading-snug text-ink-700">
        <input
          ref={checkboxRef}
          type="checkbox"
          name="confirm"
          value="yes"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-red-600"
        />
        <span>
          I understand that <strong className="font-semibold text-ink-900">{leadName}</strong> will be
          permanently deleted. This cannot be undone.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-[0.76rem] text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="dangerSolid" size="sm" disabled={!understood || pending}>
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Deleting
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete permanently
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

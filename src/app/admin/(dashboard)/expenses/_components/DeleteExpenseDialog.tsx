"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { buttonClass, cn } from "@/components/admin/ui";
import { deleteExpense } from "../actions";
import type { DeleteExpenseResult, ExpenseRow } from "../_lib/types";

/** Same dimming as a disabled button, without `disabled` (which would drop keyboard focus). */
const BUSY = "aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/**
 * "Delete this expense?" A native modal <dialog> with role="alertdialog":
 * it traps focus, makes the page inert and starts on Cancel (first in the
 * DOM), so Enter or Escape straight away never deletes anything. While the
 * delete is in flight it can't be dismissed, so its outcome is always seen.
 * Closing returns focus to the button that opened it.
 */
export function DeleteExpenseDialog({
  expense,
  onClose,
  onDeleted,
}: {
  expense: ExpenseRow;
  /** Fired after the dialog has closed, whatever closed it. */
  onClose: () => void;
  /** The expense is gone: deleted now, or already deleted elsewhere. */
  onDeleted: (message: string, at: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const bodyId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ message: string; at: number } | null>(null);

  // Mounted only while there is something to confirm: open as a modal straight away.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      let result: DeleteExpenseResult;
      try {
        result = await deleteExpense(expense.id);
      } catch {
        result = { ok: false, message: "Could not reach the server. Check your connection and try again.", at: Date.now() };
      }
      if (result.ok || result.gone) {
        dialogRef.current?.close();
        onDeleted(
          result.ok ? `Deleted ${expense.amountLabel} for “${expense.description}”.` : result.message,
          result.at,
        );
        return;
      }
      setError({ message: result.message, at: result.at });
    });
  };

  const cancel = () => {
    if (!pending) dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-ink-100 bg-white p-0 text-left text-ink-900 shadow-[0_24px_48px_-24px_rgb(7_38_60/0.55)] backdrop:bg-ink-900/30 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={headingId} className="font-display text-[1rem] font-bold leading-snug text-ink-900">
              Delete this expense?
            </h2>
            <div id={bodyId} className="mt-2 space-y-2 text-[0.84rem] leading-relaxed text-ink-700">
              <p className="[overflow-wrap:anywhere]">
                <span className="font-semibold tabular-nums text-ink-900">{expense.amountLabel}</span> for &ldquo;
                {expense.description}&rdquo;, paid on {expense.dateLabel}.
              </p>
              <p>This can&apos;t be undone.</p>
            </div>
          </div>
        </div>

        <p role="status" aria-live="polite" className="text-[0.8rem] text-red-600">
          {error ? (
            <span key={error.at} className="mt-3 block">
              {error.message}
            </span>
          ) : null}
        </p>

        {/* Cancel comes first, so it is what the dialog focuses when it opens. */}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            aria-disabled={pending || undefined}
            className={cn(buttonClass("secondary", "sm"), "h-10 flex-1 sm:flex-none", BUSY)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            aria-disabled={pending || undefined}
            aria-busy={pending}
            className={cn(buttonClass("dangerSolid", "sm"), "h-10 flex-1 sm:flex-none", BUSY)}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            {pending ? "Deleting…" : "Delete expense"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

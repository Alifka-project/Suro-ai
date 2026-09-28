"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { buttonClass } from "@/components/admin/ui";

/** Opens the dialog as a modal as soon as it mounts (a stable callback ref, not an effect). */
function showAsModal(dialog: HTMLDialogElement | null) {
  if (dialog && !dialog.open) dialog.showModal();
}

/**
 * Confirms moving a card out of Won, the board's counterpart of the
 * opportunity page's "Reopen" panel (same wording). A native modal <dialog>:
 * it traps focus, makes the board inert and closes on Escape. Every way of
 * closing it goes through the close event; the button pressed is its
 * returnValue, so Escape counts as Cancel.
 */
export function ReopenDialog({
  title,
  stageLabel,
  onClose,
}: {
  /** The opportunity being moved. */
  title: string;
  stageLabel: string;
  onClose: (confirmed: boolean) => void;
}) {
  const headingId = useId();
  const bodyId = useId();

  return (
    <dialog
      ref={showAsModal}
      role="alertdialog"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      onClose={(event) => onClose(event.currentTarget.returnValue === "reopen")}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-ink-100 bg-white p-0 text-ink-900 shadow-[0_24px_48px_-24px_rgb(7_38_60/0.55)] backdrop:bg-ink-900/30 backdrop:backdrop-blur-sm motion-safe:animate-rise"
    >
      <form method="dialog" className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={headingId} className="font-display text-[1rem] font-bold leading-snug text-ink-900">
              Reopen the deal in {stageLabel}?
            </h2>
            <p className="mt-0.5 truncate text-[0.8rem] text-ink-550">{title}</p>
            <p id={bodyId} className="mt-3 text-[0.84rem] leading-relaxed text-ink-700">
              The opportunity leaves Won and its win date is cleared. Quotations, service agreements and invoices already
              generated are kept as they are.
            </p>
          </div>
        </div>
        {/* Cancel comes first, so it is what the dialog focuses when it opens. */}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="submit" value="cancel" className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
          <button type="submit" value="reopen" className={buttonClass("primary", "sm")}>
            Reopen in {stageLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

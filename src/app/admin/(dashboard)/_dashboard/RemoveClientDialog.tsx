"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { buttonClass, cn } from "@/components/admin/ui";

/** The client a "Remove" button asks about, with what is kept for the confirmation text. */
export type RemoveTarget = {
  leadId: string;
  name: string;
  quoteCount: number;
  invoiceCount: number;
  costCount: number;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2 quotations, 1 invoice and 3 expenses", or null when there are none. */
function keptRecords({ quoteCount, invoiceCount, costCount }: RemoveTarget): string | null {
  const parts = [
    quoteCount > 0 && plural(quoteCount, "quotation", "quotations"),
    invoiceCount > 0 && plural(invoiceCount, "invoice", "invoices"),
    costCount > 0 && plural(costCount, "expense", "expenses"),
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * "Remove {name}?" One dialog for the whole table (rendered by StatusProvider),
 * opened as a modal so it sits above the table's clipping and traps focus.
 * Cancel comes first and has focus, so Enter or Escape never removes by
 * accident; the browser puts focus back on the Remove button that opened it
 * (after a removal, StatusProvider moves it to the section heading).
 */
export function RemoveClientDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: RemoveTarget | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ids = useId();
  // Keep showing the last client while the dialog closes (render-time sync).
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  const kept = shown ? keptRecords(shown) : null;

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-body`}
      // Escape and Cancel end up here. A click outside does nothing: a
      // confirmation shouldn't vanish on a stray (or double) click.
      onClose={() => {
        if (target) onCancel();
      }}
      className={cn(
        "m-auto w-[min(28rem,calc(100vw-1.5rem))] rounded-3xl bg-white p-0 text-left text-ink-900",
        "shadow-[0_30px_80px_-30px_rgb(7_38_60/0.45)] ring-1 ring-ink-100",
        "backdrop:bg-ink-900/40 backdrop:backdrop-blur-[2px]",
      )}
    >
      {shown && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600"
            >
              <Trash2 className="h-[1.1rem] w-[1.1rem]" />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id={`${ids}-title`} className="font-display text-[1.05rem] font-bold [overflow-wrap:anywhere]">
                Remove {shown.name}?
              </h2>
              <div id={`${ids}-body`} className="mt-1.5 space-y-1.5 text-[0.86rem] leading-relaxed text-ink-700">
                <p>They will be taken off the client list and out of the client figures.</p>
                {kept && (
                  <p>
                    Their {kept} {kept.includes(" and ") || !kept.startsWith("1 ") ? "are" : "is"} kept, and their
                    invoices still count in Revenue.
                  </p>
                )}
                <p className="text-ink-550">You can undo this straight after.</p>
              </div>
            </div>
          </div>
          <form method="dialog" className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={onCancel}
              className={cn(buttonClass("secondary"), "sm:w-auto")}
            >
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className={cn(buttonClass("dangerSolid"), "sm:w-auto")}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove client
            </button>
          </form>
        </div>
      )}
    </dialog>
  );
}

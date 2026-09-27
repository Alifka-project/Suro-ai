"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";
import { buttonClass, cn } from "@/components/admin/ui";

/**
 * Two-step destructive submit. The first click only arms it; the real submit
 * is a second, explicit button that sends confirm=yes, which the Server Action
 * requires. Escape or Cancel disarms. Must be rendered inside the <form>.
 */
export function ConfirmSubmit({
  label,
  confirmLabel = "Delete",
  pendingLabel = "Deleting",
  prompt,
  compact = false,
}: {
  /** Trigger text (and accessible name of the compact icon trigger). */
  label: string;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Explanation shown once armed (full-size variant only). */
  prompt?: string;
  /** Icon-only trigger with an inline confirm, for dense rows. */
  compact?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wasArmed = useRef(false);

  // Move focus into the confirmation (onto Cancel, the safe choice), and back
  // to the trigger when it is dismissed, so keyboard users never lose their place.
  useEffect(() => {
    if (armed) cancelRef.current?.focus();
    else if (wasArmed.current) triggerRef.current?.focus();
    wasArmed.current = armed;
  }, [armed]);

  const size = compact ? "sm" : "md";

  if (!armed) {
    return compact ? (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setArmed(true)}
        aria-label={label}
        title={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    ) : (
      <button ref={triggerRef} type="button" onClick={() => setArmed(true)} className={buttonClass("danger")}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Confirm: ${label}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) setArmed(false);
      }}
      className={cn(
        compact ? "flex shrink-0 items-center gap-1.5" : "rounded-xl border border-red-200 bg-red-50/60 p-3.5",
      )}
    >
      {compact ? (
        <span className="text-[0.75rem] font-semibold text-red-600">Delete?</span>
      ) : (
        prompt && <p className="mb-3 text-[0.82rem] text-red-700">{prompt}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="submit" name="confirm" value="yes" disabled={pending} className={buttonClass("dangerSolid", size)}>
          {pending ? (
            <>
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {pendingLabel}
            </>
          ) : (
            confirmLabel
          )}
        </button>
        <button
          ref={cancelRef}
          type="button"
          disabled={pending}
          onClick={() => setArmed(false)}
          className={buttonClass(compact ? "ghost" : "secondary", size)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

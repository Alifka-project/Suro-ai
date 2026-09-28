"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { PRIORITY_LABELS, PRIORITY_MAX } from "@/lib/admin/pipeline";
import { setLeadPriority } from "../../actions";

/**
 * Odoo's priority stars. Clicking a star sets the priority to it; clicking the
 * highest lit star again clears it back to Normal. Saved straight away, shown
 * optimistically, and rolled back (with a message) if the save fails.
 */
export function PriorityStars({ leadId, priority }: { leadId: string; priority: number }) {
  const [shown, setShown] = useOptimistic(priority);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(star: number) {
    const next = star === shown ? 0 : star;
    setError(null);
    startTransition(async () => {
      setShown(next);
      let message: string | null = null;
      try {
        const result = await setLeadPriority({ leadId, priority: next });
        if (!result.ok) message = result.message;
      } catch {
        message = "Could not save the priority. Check your connection and try again.";
      }
      if (message) startTransition(() => setError(message));
    });
  }

  return (
    <div>
      <div role="group" aria-label="Priority" className="flex items-center gap-2">
        <div className="-ml-1 flex">
          {Array.from({ length: PRIORITY_MAX }, (_, i) => {
            const star = i + 1;
            const lit = star <= shown;
            return (
              <button
                key={star}
                type="button"
                onClick={() => choose(star)}
                aria-label={star === shown ? `Clear priority (now ${PRIORITY_LABELS[star]})` : `Set priority to ${PRIORITY_LABELS[star]}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-amber-400/10"
              >
                <Star
                  className={cn("h-[1.1rem] w-[1.1rem] transition-colors", lit ? "fill-amber-400 text-amber-500" : "text-ink-300")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <span className="text-[0.82rem] text-ink-700" aria-live="polite">
          {PRIORITY_LABELS[shown] ?? PRIORITY_LABELS[0]}
          {pending && <span className="sr-only"> (saving)</span>}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[0.74rem] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

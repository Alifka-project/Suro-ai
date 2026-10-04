"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { PRIORITY_LABELS, PRIORITY_MAX } from "@/lib/admin/pipeline";
import { setLeadPriority } from "../../actions";

const STARS = Array.from({ length: PRIORITY_MAX }, (_, i) => i + 1);

/**
 * Odoo's 0–3 star priority. Clicking a star sets that many; clicking the
 * highest filled star again clears it. The stars fill at once (optimistic)
 * and fall back to the saved value if the save fails.
 */
export function PriorityStars({
  leadId,
  title,
  priority,
  onError,
}: {
  leadId: string;
  title: string;
  priority: number;
  onError: (message: string) => void;
}) {
  const [shown, setShown] = useOptimistic(priority);
  const [, startTransition] = useTransition();

  function choose(stars: number) {
    const next = stars === shown ? 0 : stars;
    startTransition(async () => {
      setShown(next);
      try {
        const result = await setLeadPriority({ leadId, priority: next });
        if (!result.ok) onError(result.message);
      } catch {
        onError("Could not reach the server to save the priority. Please try again.");
      }
    });
  }

  return (
    <div
      role="group"
      aria-label={`Priority of ${title}: ${PRIORITY_LABELS[shown]}`}
      // Clicks here must never start a card drag.
      data-no-drag=""
      className="relative z-10 -ml-1 flex shrink-0 items-center"
    >
      {STARS.map((n) => {
        const filled = n <= shown;
        return (
          <button
            key={n}
            type="button"
            aria-pressed={filled}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${PRIORITY_LABELS[n]}`}
            title={PRIORITY_LABELS[n]}
            onClick={() => choose(n)}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-amber-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400"
          >
            <Star
              className={cn("h-3.5 w-3.5 transition-colors", filled ? "fill-amber-400 text-amber-600" : "text-ink-500")}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

/** Non-interactive stars for the drag preview. */
export function PriorityStarsStatic({ priority }: { priority: number }) {
  return (
    <span className="-ml-1 flex shrink-0 items-center" aria-hidden="true">
      {STARS.map((n) => (
        <span key={n} className="flex h-6 w-6 items-center justify-center">
          <Star className={cn("h-3.5 w-3.5", n <= priority ? "fill-amber-400 text-amber-600" : "text-ink-500")} />
        </span>
      ))}
    </span>
  );
}

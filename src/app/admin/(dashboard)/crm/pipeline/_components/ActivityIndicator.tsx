import { Clock } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { ACTIVITY_STATE } from "@/lib/admin/pipeline";
import type { ActivityBrief } from "../../_lib/helpers";

/** Legend order and colours for the activity states, shared by the column bars and the legend. */
export const ACTIVITY_LEGEND = [
  { key: "overdue", label: "Overdue", dot: ACTIVITY_STATE.overdue.dot },
  { key: "today", label: "Due today", dot: ACTIVITY_STATE.today.dot },
  { key: "planned", label: "Planned", dot: ACTIVITY_STATE.planned.dot },
  { key: "none", label: "No activity", dot: "bg-ink-200" },
] as const;

/**
 * Odoo's activity clock on a card: coloured by the most urgent open activity,
 * with a short visible label ("2d late", "Today", "12 Oct") so the state is
 * never carried by colour alone. The full summary is in the tooltip and read
 * out to screen readers. `relative z-10` lifts it above a card's stretched
 * link so the tooltip shows. Server-safe: no hooks.
 */
export function ActivityIndicator({
  activity,
}: {
  activity: (ActivityBrief & { openCount?: number }) | null;
}) {
  if (!activity) {
    return (
      <span title="No activity scheduled" className="relative z-10 inline-flex items-center text-ink-400">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">No activity scheduled</span>
      </span>
    );
  }
  const more = activity.openCount && activity.openCount > 1 ? ` (${activity.openCount} open)` : "";
  const description = `Next activity: ${activity.label}, ${activity.due.toLowerCase()}${more}`;
  return (
    <span
      title={description}
      className={cn(
        "relative z-10 inline-flex min-w-0 items-center gap-1 text-[0.7rem] font-semibold tabular-nums",
        ACTIVITY_STATE[activity.state].text,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true" className="truncate">
        {activity.short}
      </span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

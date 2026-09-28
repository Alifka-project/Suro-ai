import type { ActivityType } from "@prisma/client";
import { activityState } from "@/lib/admin/pipeline";
import { dueHint, formatBusinessDate, toDateInputValue } from "@/lib/admin/time";
import type { ActivityRow } from "./ActivityList";

/**
 * Server-side: turns an activity record into the row <ActivityItem> renders,
 * with its state, due hint and date computed once on the business clock (the
 * browser's clock and zone never decide what is overdue). Kept out of the
 * "use client" ActivityList module so Server Components can call it.
 */
export function toActivityRow(
  activity: {
    id: string;
    type: ActivityType;
    summary: string;
    note: string | null;
    dueDate: Date;
    assignee: { name: string } | null;
  },
  now: Date,
  lead?: ActivityRow["lead"],
): ActivityRow {
  return {
    id: activity.id,
    type: activity.type,
    summary: activity.summary,
    note: activity.note,
    state: activityState(activity.dueDate, now),
    hint: dueHint(activity.dueDate, now),
    dueLabel: formatBusinessDate(activity.dueDate),
    dueIso: toDateInputValue(activity.dueDate),
    assignee: activity.assignee?.name ?? null,
    lead,
  };
}

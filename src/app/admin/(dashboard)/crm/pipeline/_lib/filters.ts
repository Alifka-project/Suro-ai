/*
 * Pipeline filters, read from and written to the URL so a filtered board can
 * be bookmarked or shared. Pure — safe in Server and Client Components.
 */

export const ACTIVITY_FILTERS = ["overdue", "today", "none"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export const ACTIVITY_FILTER_LABEL: Record<ActivityFilter, string> = {
  overdue: "Overdue",
  today: "Due today",
  none: "No activity",
};

export function isActivityFilter(value: unknown): value is ActivityFilter {
  return typeof value === "string" && (ACTIVITY_FILTERS as readonly string[]).includes(value);
}

/**
 * `owner` is "" (everyone), "me", "unassigned" or an admin's id. The page
 * checks an id against the active team before using it.
 */
export type PipelineFilters = { q: string; owner: string; activity: ActivityFilter | null };

export const OWNER_ME = "me";
export const OWNER_UNASSIGNED = "unassigned";

/** Builds a /admin/crm/pipeline URL, leaving empty filters out. */
export function pipelineHref({ q, owner, activity }: Partial<PipelineFilters> = {}): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (owner) sp.set("owner", owner);
  if (activity) sp.set("activity", activity);
  const qs = sp.toString();
  return qs ? `/admin/crm/pipeline?${qs}` : "/admin/crm/pipeline";
}

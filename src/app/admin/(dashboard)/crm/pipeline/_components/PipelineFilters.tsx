import Link from "next/link";
import { cn } from "@/components/admin/ui";
import { ACTIVITY_STATE } from "@/lib/admin/pipeline";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_FILTER_LABEL,
  pipelineHref,
  type ActivityFilter,
  type PipelineFilters as Filters,
} from "../_lib/filters";
import { FilterForm } from "./FilterForm";

const FILTER_DOT: Record<ActivityFilter, string> = {
  overdue: ACTIVITY_STATE.overdue.dot,
  today: ACTIVITY_STATE.today.dot,
  none: "bg-ink-300",
};

/**
 * Search, salesperson and activity filters. All of it lives in the URL: the
 * search box and salesperson picker are one GET form (FilterForm), the
 * activity chips are plain links that keep the other filters.
 */
export function PipelineFilters({
  filters,
  team,
  meId,
}: {
  filters: Filters;
  team: { id: string; name: string }[];
  meId: string;
}) {
  const { q, owner, activity } = filters;
  const chips: { value: ActivityFilter | null; label: string }[] = [
    { value: null, label: "Any activity" },
    ...ACTIVITY_FILTERS.map((value) => ({ value, label: ACTIVITY_FILTER_LABEL[value] })),
  ];

  return (
    <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <FilterForm filters={filters} team={team} meId={meId} />

      <nav aria-label="Filter by activity" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {chips.map((chip) => {
            const active = chip.value === activity;
            return (
              <li key={chip.label}>
                <Link
                  href={pipelineHref({ q, owner, activity: chip.value })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[0.8rem] font-medium transition-colors",
                    active
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
                  )}
                >
                  {chip.value && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", FILTER_DOT[chip.value])} />}
                  {chip.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

import { cn } from "@/components/admin/ui";
import { SUMMARY_GRID, SUMMARY_SPANS } from "./_components/SummaryTiles";

/** Column heights for the chart placeholder (percent of the plot). */
const BARS = [38, 52, 30, 64, 46, 58, 34, 70, 50, 42, 60, 48];
const CATEGORY_WIDTHS = ["w-[82%]", "w-[60%]", "w-[44%]", "w-[30%]", "w-[18%]"];

/**
 * Skeleton for the Expenses page while it loads: the same header, tiles,
 * chart, category list and list card, so nothing jumps when the data lands.
 */
export default function ExpensesLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Loading expenses</span>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-16 rounded-full bg-ink-100" />
          <div className="h-7 w-36 rounded-lg bg-ink-200/70" />
          <div className="h-3.5 w-80 max-w-full rounded-full bg-ink-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-ink-100" />
          <div className="h-10 w-36 rounded-xl bg-ink-200/70" />
        </div>
      </div>

      <div className="space-y-4 lg:space-y-5">
        {/* Tiles */}
        <ul className={SUMMARY_GRID} aria-hidden="true">
          {SUMMARY_SPANS.map((span, i) => (
            <li key={i} className={cn("min-w-0", span)}>
              <div className="h-[118px] rounded-2xl border border-ink-100 bg-white p-4 sm:h-[126px] sm:p-5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-ink-100" />
                  <div className="h-3 w-24 rounded-full bg-ink-100" />
                </div>
                <div className="mt-3 h-6 w-28 rounded-lg bg-ink-200/70" />
                <div className="mt-2.5 h-2.5 w-36 max-w-full rounded-full bg-ink-100" />
              </div>
            </li>
          ))}
        </ul>

        {/* Chart and categories */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5" aria-hidden="true">
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3.5 w-52 max-w-full rounded-full bg-ink-200/70" />
                <div className="h-2.5 w-64 max-w-full rounded-full bg-ink-100" />
              </div>
              <div className="h-8 w-16 rounded-lg bg-ink-100" />
            </div>
            <div className="mt-6 flex h-[220px] items-end gap-[3%] border-b border-ink-100 px-2">
              {BARS.map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-ink-100" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <div className="space-y-2">
              <div className="h-3.5 w-48 max-w-full rounded-full bg-ink-200/70" />
              <div className="h-2.5 w-28 rounded-full bg-ink-100" />
            </div>
            <div className="mt-5 space-y-4">
              {CATEGORY_WIDTHS.map((w, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <div className="h-3 w-32 rounded-full bg-ink-100" />
                    <div className="h-3 w-20 rounded-full bg-ink-200/70" />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-ink-100">
                    <div className={cn("h-full rounded-full bg-ink-200", w)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-8 rounded-2xl border border-ink-100 bg-white lg:mt-10" aria-hidden="true">
        <div className="space-y-4 border-b border-ink-100 px-4 pb-4 pt-5 sm:px-5">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded-full bg-ink-200/70" />
            <div className="h-2.5 w-72 max-w-full rounded-full bg-ink-100" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
            {["sm:col-span-2 xl:col-span-1", "", "", "sm:col-span-2 xl:col-span-1"].map((span, i) => (
              <div key={i} className={cn("space-y-1.5", span)}>
                <div className="h-2 w-14 rounded-full bg-ink-100" />
                <div className="h-10 rounded-xl bg-ink-100" />
              </div>
            ))}
          </div>
          <div className="h-3 w-44 rounded-full bg-ink-100" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-start gap-4 border-b border-ink-100/70 px-4 py-4 last:border-b-0 sm:px-5">
            <div className="hidden h-3 w-20 shrink-0 rounded-full bg-ink-100 xl:block" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-56 max-w-full rounded-full bg-ink-200/70" />
              <div className="h-2.5 w-32 max-w-full rounded-full bg-ink-100" />
            </div>
            <div className="hidden h-3 w-28 rounded-full bg-ink-100 xl:block" />
            <div className="hidden h-3 w-32 rounded-full bg-ink-100 xl:block" />
            <div className="h-3 w-20 shrink-0 rounded-full bg-ink-200/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

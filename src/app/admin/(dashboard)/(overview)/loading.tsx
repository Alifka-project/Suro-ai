import { cn } from "@/components/admin/ui";
import { KPI_GRID, KPI_SPANS } from "../_dashboard/Kpis";

/** Column heights for the chart placeholders (fixed, so server and client agree). */
const BARS = [38, 52, 44, 63, 58, 71, 49, 66, 80, 61, 74, 57];

/** Status chip widths, roughly matching All, New, Quotation sent, Invoice sent, Goal, Cancel. */
const CHIPS = ["w-14", "w-[4.5rem]", "w-32", "w-[7.5rem]", "w-[4.5rem]", "w-20"];

const CARD = "rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgb(7_38_60_/_0.04),0_8px_24px_-14px_rgb(7_38_60_/_0.10)]";

function ChartPlaceholder() {
  return (
    <div className={cn(CARD, "flex min-w-0 flex-col p-5")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-40 max-w-full rounded-full bg-ink-200/70" />
          <div className="h-2.5 w-64 max-w-full rounded-full bg-ink-100" />
        </div>
        <div className="h-8 w-16 shrink-0 rounded-lg bg-ink-100" />
      </div>
      <div className="mb-2 flex gap-4">
        <div className="h-2.5 w-20 rounded-full bg-ink-100" />
        <div className="h-2.5 w-20 rounded-full bg-ink-100" />
      </div>
      <div className="flex h-[240px] items-end gap-2 border-b border-ink-100 pb-6 pl-9 sm:gap-3">
        {BARS.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[4px] bg-ink-100" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the dashboard: header, five figures, two charts and the clients table. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Loading the dashboard</span>

      {/* Header */}
      <div className="mb-6 space-y-2">
        <div className="h-2.5 w-16 rounded-full bg-ink-100" />
        <div className="h-7 w-36 rounded-lg bg-ink-200/70" />
        <div className="h-3.5 w-80 max-w-full rounded-full bg-ink-100" />
      </div>

      <div className="space-y-4 lg:space-y-5">
        {/* Five figures, on the same grid as the real tiles */}
        <div className={KPI_GRID}>
          {KPI_SPANS.map((span, i) => (
            <div key={i} className={cn(CARD, "min-w-0 p-4 sm:p-5", span)}>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 shrink-0 rounded-lg bg-ink-100" />
                <div className="h-3 w-20 rounded-full bg-ink-200/70" />
              </div>
              <div className="mt-3 h-[1.4rem] w-24 max-w-full rounded-lg bg-ink-200/70 sm:h-[1.6rem]" />
              <div className="mt-2 h-2.5 w-28 max-w-full rounded-full bg-ink-100" />
            </div>
          ))}
        </div>

        {/* Two charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <ChartPlaceholder />
          <ChartPlaceholder />
        </div>
      </div>

      {/* Clients table */}
      <div className={cn(CARD, "mt-8 lg:mt-10")}>
        {/* Heading and toolbar, laid out like ClientsTable's header so nothing
            moves when the data arrives: row 1 is the heading with the search
            on the right from md; row 2 is the status chips with "Showing x–y"
            on the right from lg. */}
        <div className="space-y-4 border-b border-ink-100 px-4 pb-4 pt-5 sm:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="min-w-0 space-y-2">
              <div className="h-4 w-20 rounded-full bg-ink-200/70" />
              <div className="h-3 w-72 max-w-full rounded-full bg-ink-100" />
            </div>
            <div className="h-10 w-full rounded-xl bg-ink-100 md:w-72 md:shrink-0" />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {CHIPS.map((w, i) => (
                <div key={i} className={cn("h-8 rounded-full bg-ink-100", w)} />
              ))}
            </div>
            <div className="h-3 w-28 shrink-0 rounded-full bg-ink-100" />
          </div>
        </div>
        <div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-ink-100/70 px-4 py-3.5 last:border-b-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-ink-100" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-40 max-w-full rounded-full bg-ink-200/70" />
                <div className="h-2.5 w-56 max-w-full rounded-full bg-ink-100" />
              </div>
              <div className="hidden h-3 w-28 rounded-full bg-ink-100 md:block" />
              <div className="hidden gap-1.5 sm:flex">
                <div className="h-8 w-8 rounded-lg bg-ink-100" />
                <div className="h-8 w-8 rounded-lg bg-ink-100" />
              </div>
              <div className="hidden h-8 w-24 rounded-lg bg-ink-100 lg:block" />
              <div className="h-7 w-28 shrink-0 rounded-full bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

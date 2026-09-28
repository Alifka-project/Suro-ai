import { Card } from "@/components/admin/ui";

/** Skeleton for the Activities planner, shaped like the real layout to avoid a jump. */
export default function ActivitiesLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading activities</span>

      {/* CRM tabs */}
      <div className="mb-6 h-11 w-80 max-w-full rounded-2xl bg-ink-100" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-12 rounded-full bg-ink-100" />
          <div className="h-7 w-32 rounded-lg bg-ink-200/70" />
          <div className="h-3.5 w-48 rounded-full bg-ink-100" />
        </div>
        <div className="h-10 w-64 max-w-full rounded-xl bg-ink-100" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[3.25rem] rounded-2xl border border-ink-100 bg-white" />
        ))}
      </div>

      <div className="space-y-5">
        {Array.from({ length: 3 }, (_, g) => (
          <Card key={g}>
            <div className="mb-4 h-4 w-28 rounded-full bg-ink-200/70" />
            <div className="space-y-2">
              {Array.from({ length: g === 0 ? 3 : 2 }, (_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-ink-100 p-3.5">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-ink-100" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-48 max-w-full rounded-full bg-ink-200/70" />
                    <div className="h-2.5 w-64 max-w-full rounded-full bg-ink-100" />
                  </div>
                  <div className="hidden h-8 w-32 rounded-xl bg-ink-100 sm:block" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

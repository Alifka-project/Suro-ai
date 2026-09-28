import { Card } from "@/components/admin/ui";

function Line({ className }: { className: string }) {
  return <div className={`rounded-full bg-ink-100 ${className}`} />;
}

/** Skeleton for an opportunity, shaped like the real layout to avoid a jump. */
export default function OpportunityLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading opportunity</span>

      {/* CRM tabs */}
      <div className="mb-6 h-11 w-80 max-w-full rounded-2xl bg-ink-100" />

      <Line className="mb-3 h-3 w-40" />
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-full bg-ink-200/70" />
          <div className="space-y-2">
            <Line className="h-2.5 w-36" />
            <div className="h-7 w-60 max-w-full rounded-lg bg-ink-200/70" />
            <Line className="h-3.5 w-72 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-10 rounded-xl bg-ink-100 sm:w-28" />
          ))}
        </div>
      </div>

      {/* Stage strip */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-xl bg-ink-100" />
          <div className="h-8 w-28 rounded-xl bg-ink-100" />
        </div>
        <div className="h-9 w-full rounded-lg bg-ink-100 lg:max-w-[40rem]" />
      </div>

      {/* Smart buttons */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[3.75rem] rounded-2xl border border-ink-100 bg-white" />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          <Card>
            <Line className="h-3.5 w-28" />
            <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Line className="h-2 w-16" />
                  <Line className="h-3 w-28" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Line className="h-3.5 w-40" />
            <div className="mt-4 space-y-2">
              <div className="h-14 rounded-xl bg-ink-100" />
              <div className="h-14 rounded-xl bg-ink-100" />
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <Line className="h-3.5 w-24" />
            <div className="mt-4 space-y-2">
              <div className="h-16 rounded-xl bg-ink-100" />
              <div className="h-10 rounded-xl bg-ink-100" />
            </div>
          </Card>
          <Card>
            <Line className="h-3.5 w-24" />
            <div className="mt-4 h-24 rounded-xl bg-ink-100" />
            <div className="mt-5 space-y-3">
              <Line className="h-3 w-full" />
              <Line className="h-3 w-4/5" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

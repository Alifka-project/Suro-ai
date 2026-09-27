import { Card } from "@/components/admin/ui";

function Line({ className }: { className: string }) {
  return <div className={`rounded-full bg-ink-100 ${className}`} />;
}

/** Skeleton for a lead page, shaped like the real layout to avoid a jump. */
export default function LeadLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading lead</span>

      <div className="mb-6">
        <Line className="h-3 w-20" />
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 rounded-full bg-ink-200/70" />
            <div className="space-y-2">
              <Line className="h-2.5 w-28" />
              <div className="h-7 w-52 max-w-full rounded-lg bg-ink-200/70" />
              <Line className="h-3.5 w-64 max-w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-10 rounded-xl bg-ink-100 sm:w-32" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3 xl:items-start">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <Line className="h-3.5 w-32" />
            <div className="mt-5 space-y-2.5 rounded-xl bg-haze/70 p-4">
              <Line className="h-3 w-full" />
              <Line className="h-3 w-11/12" />
              <Line className="h-3 w-3/4" />
            </div>
          </Card>
          <Card>
            <Line className="h-3.5 w-24" />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Line className="h-2 w-16" />
                  <Line className="h-3 w-32" />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <Line className="h-3.5 w-20" />
            <div className="mt-4 h-1.5 w-full rounded-full bg-ink-100" />
            <div className="mt-6 h-10 w-full rounded-xl bg-ink-100" />
            <div className="mt-5 h-10 w-full rounded-xl bg-ink-100" />
          </Card>
          <Card>
            <Line className="h-3.5 w-32" />
            <div className="mt-4 space-y-2">
              <div className="h-14 rounded-xl bg-ink-100" />
              <div className="h-14 rounded-xl bg-ink-100" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

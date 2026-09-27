import { Card } from "@/components/admin/ui";

/** Skeleton for the lead list while filters, search or pages load. */
export default function CrmLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading leads</span>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-16 rounded-full bg-ink-100" />
          <div className="h-7 w-24 rounded-lg bg-ink-200/70" />
          <div className="h-3.5 w-40 rounded-full bg-ink-100" />
        </div>
        <div className="h-10 w-44 rounded-xl bg-ink-100" />
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="h-10 w-full rounded-xl bg-ink-100 xl:order-last xl:w-80" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-ink-100" />
          ))}
        </div>
      </div>

      <Card padded={false}>
        <div className="border-b border-ink-100 px-4 py-3">
          <div className="h-2.5 w-1/3 rounded-full bg-ink-100" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-ink-100/70 px-4 py-3.5 last:border-b-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-ink-100" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-40 max-w-full rounded-full bg-ink-200/70" />
              <div className="h-2.5 w-56 max-w-full rounded-full bg-ink-100" />
            </div>
            <div className="hidden h-5 w-20 rounded-full bg-ink-100 sm:block" />
          </div>
        ))}
      </Card>
    </div>
  );
}

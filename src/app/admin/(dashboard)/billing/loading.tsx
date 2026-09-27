/**
 * Neutral skeleton shared by the billing list, document and editor routes while
 * a tab, filter, search or document loads.
 */
export default function BillingLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading billing</span>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-16 rounded-full bg-ink-100" />
          <div className="h-7 w-40 rounded-lg bg-ink-200/70" />
          <div className="h-3.5 w-64 max-w-full rounded-full bg-ink-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-ink-100" />
          <div className="h-10 w-32 rounded-xl bg-ink-100" />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[108px] rounded-2xl border border-ink-100 bg-white" />
        ))}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="h-10 w-full rounded-xl bg-ink-100 md:w-64" />
          <div className="h-10 w-full rounded-xl bg-ink-100 md:w-72" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-ink-100/70 px-4 py-3.5 last:border-b-0">
            <div className="h-3 w-24 shrink-0 rounded-full bg-ink-200/70" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-40 max-w-full rounded-full bg-ink-200/70" />
              <div className="h-2.5 w-28 max-w-full rounded-full bg-ink-100" />
            </div>
            <div className="hidden h-3 w-20 rounded-full bg-ink-100 sm:block" />
            <div className="h-5 w-16 shrink-0 rounded-full bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

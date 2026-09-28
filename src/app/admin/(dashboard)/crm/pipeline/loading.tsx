/** Skeleton for the pipeline board while it loads or its filters change. */
export default function PipelineLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading the pipeline</span>

      {/* CRM tabs */}
      <div className="mb-6 flex w-full max-w-[22rem] gap-1 rounded-2xl border border-ink-100 bg-white/80 p-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-9 flex-1 rounded-xl bg-ink-100" />
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-12 rounded-full bg-ink-100" />
          <div className="h-7 w-32 rounded-lg bg-ink-200/70" />
          <div className="h-3.5 w-72 max-w-full rounded-full bg-ink-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-xl bg-ink-100" />
          <div className="h-10 w-44 rounded-xl bg-ink-200/70" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 bg-white p-4">
            <div className="h-2.5 w-20 rounded-full bg-ink-100" />
            <div className="h-5 w-24 rounded-lg bg-ink-200/70" />
            <div className="h-2.5 w-28 max-w-full rounded-full bg-ink-100" />
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl">
          <div className="h-10 flex-1 rounded-xl bg-ink-100" />
          <div className="h-10 rounded-xl bg-ink-100 sm:w-52" />
          <div className="h-10 rounded-xl bg-ink-100 sm:w-20" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-8 w-24 shrink-0 rounded-full bg-ink-100" />
          ))}
        </div>
      </div>

      <div className="-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-3 pt-1">
          {[3, 2, 2, 1, 1].map((cards, i) => (
            <div key={i} className="w-[17.5rem] shrink-0 rounded-2xl border border-ink-100 bg-ink-100/45 p-2.5">
              <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
                <div className="h-2 w-2 rounded-full bg-ink-200" />
                <div className="h-3.5 w-20 rounded-full bg-ink-200/70" />
                <div className="ml-auto h-3 w-12 rounded-full bg-ink-200/70" />
              </div>
              <div className="mx-1.5 mb-3 h-1.5 rounded-full bg-ink-200/60" />
              <div className="space-y-2">
                {Array.from({ length: cards }, (_, j) => (
                  <div key={j} className="space-y-2 rounded-xl border border-ink-100 bg-white p-3">
                    <div className="h-3 w-40 max-w-full rounded-full bg-ink-200/70" />
                    <div className="h-2.5 w-28 rounded-full bg-ink-100" />
                    <div className="h-3 w-24 rounded-full bg-ink-100" />
                    <div className="flex items-center justify-between border-t border-ink-100 pt-2">
                      <div className="h-3 w-16 rounded-full bg-ink-100" />
                      <div className="h-6 w-6 rounded-full bg-ink-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

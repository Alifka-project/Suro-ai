/** Neutral skeleton shared by the board, new-project and project detail routes. */
export default function ProjectsLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading projects</span>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-24 rounded-full bg-ink-100" />
          <div className="h-7 w-48 rounded-lg bg-ink-100" />
          <div className="h-3.5 w-64 max-w-full rounded-full bg-ink-100" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-ink-100" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl border border-ink-100 bg-white" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-2xl border border-ink-100 bg-white lg:col-span-2" />
        <div className="h-72 rounded-2xl border border-ink-100 bg-white" />
      </div>
    </div>
  );
}

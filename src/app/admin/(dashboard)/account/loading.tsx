import { Card } from "@/components/admin/ui";

/** Skeleton in the shape of the Account page: password form, profile, sessions, team. */
export default function AccountLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading your account</span>

      <div className="mb-6 space-y-2">
        <div className="h-2.5 w-16 rounded-full bg-ink-100" />
        <div className="h-7 w-44 rounded-lg bg-ink-200/70" />
        <div className="h-3.5 w-80 max-w-full rounded-full bg-ink-100" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Card className="min-w-0 lg:col-span-2">
          <div className="mb-5 space-y-2">
            <div className="h-4 w-36 rounded-full bg-ink-200/70" />
            <div className="h-3 w-64 max-w-full rounded-full bg-ink-100" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={i === 0 ? "space-y-2 sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]" : "space-y-2"}>
                <div className="h-3 w-28 rounded-full bg-ink-100" />
                <div className="h-10 rounded-xl bg-ink-100" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-3 w-72 max-w-full rounded-full bg-ink-100" />
            <div className="h-10 w-44 rounded-xl bg-ink-200/70" />
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-14 shrink-0 rounded-full bg-ink-200/70" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded-full bg-ink-200/70" />
                <div className="h-3 w-28 rounded-full bg-ink-100" />
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-ink-100 pt-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 w-20 rounded-full bg-ink-100" />
                  <div className="h-3.5 w-40 rounded-full bg-ink-100" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-4 space-y-2">
              <div className="h-4 w-20 rounded-full bg-ink-200/70" />
              <div className="h-3 w-full rounded-full bg-ink-100" />
            </div>
            <div className="h-10 w-full rounded-xl bg-ink-100 sm:w-56" />
          </Card>
        </div>

        <Card className="min-w-0 lg:col-span-3">
          <div className="mb-5 space-y-2">
            <div className="h-4 w-16 rounded-full bg-ink-200/70" />
            <div className="h-3 w-40 rounded-full bg-ink-100" />
          </div>
          <div className="divide-y divide-ink-100/70">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="h-9 w-9 shrink-0 rounded-full bg-ink-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-36 rounded-full bg-ink-100" />
                  <div className="h-3 w-24 rounded-full bg-ink-100" />
                </div>
                <div className="hidden h-6 w-16 rounded-full bg-ink-100 sm:block" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

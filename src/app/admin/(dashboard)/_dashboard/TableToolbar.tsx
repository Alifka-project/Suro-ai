import Form from "next/form";
import Link from "next/link";
import type { LeadStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { buttonClass, cn, inputClass } from "@/components/admin/ui";
import { LEAD_PIPELINE, LEAD_STATUS, TONE_DOT } from "@/lib/admin/labels";
import type { StatusCount } from "./types";

/*
 * Search, status filter and paging for the clients table. Plain links and a
 * GET form: the filters live in the URL (?q=, ?status=, ?page=), so they
 * survive a refresh and can be shared, and every link lands back on the table
 * (#clients) rather than the top of the dashboard.
 */

/** /admin?status=…&q=…&page=…#clients, leaving defaults out. */
export function dashboardHref({
  q,
  status,
  page,
}: {
  q?: string;
  status?: LeadStatus | null;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return `/admin${qs ? `?${qs}` : ""}#clients`;
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500";

export function TableSearch({ q, status }: { q: string; status: LeadStatus | null }) {
  return (
    <Form action="/admin#clients" role="search" aria-label="Search clients" className="relative w-full">
      {status && <input type="hidden" name="status" value={status} />}
      <label htmlFor="clients-search" className="sr-only">
        Search clients by name, company or email
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-550"
        aria-hidden="true"
      />
      <input
        // Keyed on the query so the field re-seeds when a link changes it.
        key={q}
        id="clients-search"
        type="search"
        name="q"
        defaultValue={q}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Name, company or email"
        // The label is visually hidden, so the placeholder is the field's visible
        // label: AA contrast (ink-550), not inputClass's ink-400 placeholder.
        className={cn(
          inputClass,
          "pl-9 pr-9 placeholder:text-ink-550 [&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      {q && (
        <Link
          href={dashboardHref({ status })}
          aria-label="Clear search"
          className={cn(
            "absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-550 transition-colors hover:bg-ink-100 hover:text-ink-800",
            FOCUS_RING,
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </Form>
  );
}

export function TableStatusFilter({
  active,
  counts,
  all,
  q,
}: {
  active: LeadStatus | null;
  counts: StatusCount[];
  /** Clients matching the search, any status. */
  all: number;
  q: string;
}) {
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  const chips: { key: string; label: string; count: number; status: LeadStatus | null; dot?: string; hint?: string }[] = [
    { key: "ALL", label: "All", count: all, status: null },
    ...LEAD_PIPELINE.map((s) => ({
      key: s,
      label: LEAD_STATUS[s].label,
      count: byStatus.get(s) ?? 0,
      status: s,
      dot: TONE_DOT[LEAD_STATUS[s].tone],
      hint: LEAD_STATUS[s].hint,
    })),
  ];

  return (
    <nav aria-label="Filter clients by status" className="min-w-0">
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const isActive = chip.status === active;
          return (
            <li key={chip.key}>
              <Link
                href={dashboardHref({ status: chip.status, q })}
                aria-current={isActive ? "page" : undefined}
                title={chip.hint}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border pl-2.5 pr-2 text-[0.78rem] font-medium transition-colors",
                  FOCUS_RING,
                  isActive
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:text-ink-900",
                )}
              >
                {chip.dot && (
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 rounded-full", chip.dot, isActive && "ring-2 ring-white/40")}
                  />
                )}
                {chip.label}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[0.68rem] font-semibold tabular-nums",
                    isActive ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600",
                  )}
                >
                  {chip.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TablePagination({
  page,
  pageCount,
  q,
  status,
}: {
  page: number;
  pageCount: number;
  q: string;
  status: LeadStatus | null;
}) {
  if (pageCount <= 1) return null;
  const off = cn(buttonClass("secondary", "sm"), "pointer-events-none opacity-50");
  const on = cn(buttonClass("secondary", "sm"), FOCUS_RING);

  return (
    <nav aria-label="Clients pages" className="flex items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 sm:px-5">
      {page > 1 ? (
        <Link href={dashboardHref({ q, status, page: page - 1 })} rel="prev" className={on}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={off}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </span>
      )}
      <p className="text-[0.78rem] tabular-nums text-ink-550">
        Page <span className="font-semibold text-ink-800">{page}</span> of{" "}
        <span className="font-semibold text-ink-800">{pageCount}</span>
      </p>
      {page < pageCount ? (
        <Link href={dashboardHref({ q, status, page: page + 1 })} rel="next" className={on}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={off}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

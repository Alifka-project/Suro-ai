import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, List, Search, SquareKanban, X } from "lucide-react";
import { buttonClass, cn, inputClass } from "@/components/admin/ui";
import { LEAD_PIPELINE, LEAD_STATUS, TONE_DOT } from "@/lib/admin/labels";
import { crmHref, type CrmView, type LeadStatusKey } from "../_lib/helpers";

// ─── View toggle ─────────────────────────────────────────────────────────────

export function ViewToggle({ view, q, status }: { view: CrmView; q: string; status: LeadStatusKey | null }) {
  const options = [
    { value: "table" as const, label: "Table", icon: List, href: crmHref({ q, status }) },
    // The board already lays out every stage, so the stage filter is dropped.
    { value: "board" as const, label: "Board", icon: SquareKanban, href: crmHref({ q, view: "board" }) },
  ];
  return (
    <div role="group" aria-label="Layout" className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
      {options.map(({ value, label, icon: Icon, href }) => {
        const active = view === value;
        return (
          <Link
            key={value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-semibold transition-colors",
              active ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-800",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function SearchForm({ q, view, status }: { q: string; view: CrmView; status: LeadStatusKey | null }) {
  return (
    // Keyed on q so the uncontrolled input re-seeds when the query changes by link.
    <Form key={q} action="/admin/crm" role="search" className="relative w-full">
      {view === "board" && <input type="hidden" name="view" value="board" />}
      {status && <input type="hidden" name="status" value={status} />}
      <label htmlFor="crm-search" className="sr-only">
        Search leads
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        id="crm-search"
        type="search"
        name="q"
        defaultValue={q}
        maxLength={100}
        autoComplete="off"
        placeholder="Search name, email or company"
        className={cn(inputClass, "pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none")}
      />
      {q && (
        <Link
          href={crmHref({ view, status })}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </Form>
  );
}

// ─── Pipeline chips ──────────────────────────────────────────────────────────

export function StatusChips({
  active,
  counts,
  total,
  q,
}: {
  active: LeadStatusKey | null;
  counts: Map<string, number>;
  total: number;
  q: string;
}) {
  const chips: { key: string; label: string; count: number; status: LeadStatusKey | null; dot?: string }[] = [
    { key: "ALL", label: "All", count: total, status: null },
    ...LEAD_PIPELINE.map((s) => ({
      key: s,
      label: LEAD_STATUS[s].label,
      count: counts.get(s) ?? 0,
      status: s,
      dot: TONE_DOT[LEAD_STATUS[s].tone],
    })),
  ];

  return (
    <nav aria-label="Filter by pipeline stage">
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const isActive = chip.status === active;
          return (
            <li key={chip.key}>
              <Link
                href={crmHref({ status: chip.status, q })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[0.8rem] font-medium transition-colors",
                  isActive
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
                )}
              >
                {chip.dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />}
                {chip.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[0.68rem] font-semibold tabular-nums",
                    isActive ? "bg-white/15 text-white" : "bg-ink-100 text-ink-500",
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

// ─── Pagination ──────────────────────────────────────────────────────────────

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[0.78rem] text-ink-500">
        Showing{" "}
        <span className="font-semibold tabular-nums text-ink-700">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold tabular-nums text-ink-700">{total}</span>
      </p>
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={buttonClass("secondary", "sm")}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(buttonClass("secondary", "sm"), disabled)}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </span>
          )}
          <span className="px-1 text-[0.76rem] tabular-nums text-ink-500">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} rel="next" className={buttonClass("secondary", "sm")}>
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(buttonClass("secondary", "sm"), disabled)}>
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

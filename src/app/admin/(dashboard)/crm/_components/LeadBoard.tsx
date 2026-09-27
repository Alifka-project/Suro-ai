import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { LEAD_STATUS, TONE_DOT, formatDateTime, timeAgo } from "@/lib/admin/labels";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { companyLabel, crmHref, type LeadStatusKey } from "../_lib/helpers";
import type { LeadListItem } from "../_lib/select";

export type BoardColumn = {
  status: LeadStatusKey;
  /** Leads in this stage matching the search — may exceed `leads.length`. */
  count: number;
  valueFils: number;
  leads: LeadListItem[];
};

/**
 * Kanban lanes, one per pipeline stage. The lanes scroll sideways inside their
 * own container, so the page itself never overflows on a phone.
 *
 * From sm up, six lanes never fit the content width, so each lane's card list
 * is capped to the viewport height and scrolls on its own. That keeps the
 * board — and its horizontal scrollbar — on screen however many leads a stage
 * holds. The offsets approximate the header and toolbar above the board at
 * each breakpoint (taller below xl, where the toolbar stacks, and below lg,
 * where the mobile top bar appears); the 14rem floor keeps short windows usable.
 * On phones lanes stay full height and the page scrolls as normal.
 */
const LANE_LIST_HEIGHT =
  "sm:max-h-[max(14rem,calc(100dvh-26rem))] sm:overflow-y-auto lg:max-h-[max(14rem,calc(100dvh-23rem))] xl:max-h-[max(14rem,calc(100dvh-21rem))]";
export function LeadBoard({ columns, q }: { columns: BoardColumn[]; q: string }) {
  return (
    <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:snap-none sm:px-0">
      <div className="flex w-max gap-3">
        {columns.map((col) => {
          const meta = LEAD_STATUS[col.status];
          const headingId = `lane-${col.status.toLowerCase()}`;
          return (
            <section
              key={col.status}
              aria-labelledby={headingId}
              className="flex w-[16.5rem] shrink-0 snap-start flex-col rounded-2xl border border-ink-100 bg-ink-100/45 p-2.5"
            >
              <header className="flex items-center justify-between gap-2 px-1.5 pb-2.5 pt-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[meta.tone])} />
                  <h2 id={headingId} className="truncate font-display text-[0.86rem] font-bold text-ink-900">
                    {meta.label}
                  </h2>
                  <span className="rounded-full bg-white px-1.5 py-px text-[0.68rem] font-semibold tabular-nums text-ink-500 ring-1 ring-ink-100">
                    {col.count}
                  </span>
                </div>
                {col.valueFils > 0 && (
                  <span
                    className="shrink-0 text-[0.72rem] font-medium tabular-nums text-ink-500"
                    title={`Estimated value: ${formatMoney(col.valueFils)}`}
                  >
                    {formatMoneyCompact(col.valueFils)}
                  </span>
                )}
              </header>

              {col.leads.length > 0 ? (
                // -m-1 p-1 leaves room so card focus rings and hover lift aren't clipped by the scroller.
                <ol className={cn("space-y-2 sm:-m-1 sm:p-1", LANE_LIST_HEIGHT)}>
                  {col.leads.map((lead) => (
                    <li key={lead.id}>
                      <BoardCard lead={lead} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-xl border border-dashed border-ink-200 bg-white/50 px-3 py-6 text-center text-[0.76rem] text-ink-600">
                  No leads in this stage
                </p>
              )}

              {col.count > col.leads.length && (
                <Link
                  href={crmHref({ status: col.status, q })}
                  className="mt-2 inline-flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.76rem] font-semibold text-abyss-600 transition-colors hover:bg-white"
                >
                  View all {col.count} in table
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ lead }: { lead: LeadListItem }) {
  const [firstService, ...otherServices] = lead.services;
  return (
    <Link
      href={`/admin/crm/${lead.id}`}
      className="block rounded-xl border border-ink-100 bg-white p-3.5 shadow-[0_1px_2px_rgb(7_38_60_/_0.04)] transition-all hover:-translate-y-px hover:border-azure-300 hover:shadow-[0_10px_22px_-14px_rgb(7_38_60_/_0.35)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[0.86rem] font-semibold text-ink-900">{lead.fullName}</p>
        <time
          dateTime={lead.createdAt.toISOString()}
          title={formatDateTime(lead.createdAt)}
          className="shrink-0 whitespace-nowrap text-[0.68rem] text-ink-600"
        >
          {timeAgo(lead.createdAt)}
        </time>
      </div>
      <p className="truncate text-[0.76rem] text-ink-500">{companyLabel(lead)}</p>

      {firstService && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.74rem] text-ink-600">
          <span className="truncate">{firstService}</span>
          {otherServices.length > 0 && (
            <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-px text-[0.66rem] font-semibold text-ink-500">
              +{otherServices.length}
            </span>
          )}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-[0.72rem]">
        <span className="truncate text-ink-500">{lead.budget}</span>
        {lead.estimatedValueFils !== null && (
          <span className="shrink-0 font-semibold tabular-nums text-ink-800">
            {formatMoneyCompact(lead.estimatedValueFils)}
          </span>
        )}
      </div>
    </Link>
  );
}

"use client";

import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { formatDate, formatDateTime } from "@/lib/admin/labels";
import {
  ContactIconButtons,
  DocumentCell,
  ServiceChips,
  companyOf,
  locationOf,
  relativeTime,
  sourceMarker,
} from "./ClientCells";
import { ClientDetails } from "./ClientDetails";
import { StatusSelect } from "./StatusSelect";
import type { ClientRow } from "./types";

/*
 * The clients table for wide screens (xl and up). Fixed column widths so it
 * fits the content area next to the sidebar without scrolling sideways. Names
 * wrap (up to three lines); other long values truncate. Every value keeps its
 * full text in a tooltip and in the details row.
 *
 * Each client is two <tr>s: the summary row and its details row (hidden until
 * the chevron opens it). The header sticks to the top of the viewport while
 * the list scrolls, so no ancestor may clip overflow.
 */

const TH =
  "sticky top-0 z-10 bg-white/95 px-2.5 py-2.5 text-left align-bottom font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-550 shadow-[inset_0_-1px_0_var(--color-ink-100)] backdrop-blur";
const TD = "px-2.5 py-3 align-top";

export function TableDesktop({
  rows,
  now,
  focusId,
  expanded,
  onToggle,
}: {
  rows: ClientRow[];
  now: string;
  focusId: string | null;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[0.82rem]">
      <caption className="sr-only">
        Clients who filled in the website form, newest first. Open a row&apos;s details to see the full enquiry.
      </caption>
      <colgroup>
        {/* Sized for the narrowest table (960px, at a 1280px window): the
            dates, document numbers and the longest status label fit unclipped. */}
        <col className="w-[19%]" />
        <col className="w-[16.5%]" />
        <col className="w-[12%]" />
        <col className="w-[10.5%]" />
        <col className="w-[12.25%]" />
        <col className="w-[12.25%]" />
        <col className="w-[17.5%]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn(TH, "pl-4")}>
            Client
          </th>
          <th scope="col" className={TH}>
            Contact
          </th>
          <th scope="col" className={TH}>
            Interested in
          </th>
          <th scope="col" className={TH}>
            Received
          </th>
          <th scope="col" className={TH}>
            Quotation
          </th>
          <th scope="col" className={TH}>
            Invoice
          </th>
          <th scope="col" className={cn(TH, "pr-4")}>
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const open = expanded.has(row.id);
          const focused = row.id === focusId;
          const detailsId = `client-details-${row.id}`;
          const location = locationOf(row);
          const source = sourceMarker(row.source);
          // One band for the row and its open details, so they read as one unit.
          const band = cn(
            "transition-colors",
            focused ? "bg-azure-500/[0.06]" : open ? "bg-haze/45" : "group-hover:bg-haze/45",
          );
          const rule = "border-b border-ink-100";

          return (
            <Fragment key={row.id}>
              <tr
                id={`client-row-${row.id}`}
                aria-current={focused ? "true" : undefined}
                className="group"
              >
                <td
                  className={cn(
                    TD,
                    band,
                    !open && rule,
                    "pl-3",
                    focused && "shadow-[inset_3px_0_0_var(--color-azure-500)]",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      onClick={() => onToggle(row.id)}
                      className={cn(
                        "mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-550 ring-1 ring-inset transition-colors hover:bg-white hover:text-ink-900",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500",
                        open ? "bg-white ring-ink-300" : "ring-ink-200",
                      )}
                    >
                      <ChevronRight
                        className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-90")}
                        aria-hidden="true"
                      />
                      <span className="sr-only">Details for {row.fullName}</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      {/* Wraps, up to three lines, rather than truncating: the name is how a
                          client is recognised, and at 1280px "Mohammed Abdullah" alone is
                          wider than the column. */}
                      <p className="line-clamp-3 font-semibold text-ink-900 [overflow-wrap:anywhere]" title={row.fullName}>
                        {row.fullName}
                      </p>
                      <p className="truncate text-[0.76rem] text-ink-700" title={companyOf(row)}>
                        {companyOf(row)}
                      </p>
                      {location && (
                        <p className="truncate text-[0.72rem] text-ink-550" title={location}>
                          {location}
                        </p>
                      )}
                      {source && (
                        <span className="mt-1 inline-block rounded bg-ink-100 px-1.5 py-px text-[0.64rem] font-semibold text-ink-600">
                          {source}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                <td className={cn(TD, band, !open && rule)}>
                  <div className="min-w-0 space-y-0.5">
                    {row.email ? (
                      <a
                        href={`mailto:${row.email}`}
                        title={row.email}
                        className="block truncate rounded text-[0.78rem] text-abyss-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azure-500"
                      >
                        {row.email}
                      </a>
                    ) : (
                      <p className="text-[0.78rem] text-ink-550">No email</p>
                    )}
                    <p
                      className={cn("truncate text-[0.76rem] tabular-nums", row.phone ? "text-ink-700" : "text-ink-550")}
                      title={row.phone ?? undefined}
                    >
                      {row.phone ?? "No phone"}
                    </p>
                  </div>
                  <div className="mt-2">
                    <ContactIconButtons row={row} />
                  </div>
                </td>

                <td className={cn(TD, band, !open && rule)}>
                  <ServiceChips services={row.services} />
                </td>

                <td className={cn(TD, band, !open && rule)}>
                  <time
                    dateTime={row.createdAt}
                    title={formatDateTime(row.createdAt)}
                    className="block whitespace-nowrap text-[0.78rem] text-ink-800"
                  >
                    {formatDate(row.createdAt)}
                  </time>
                  <p className="text-[0.72rem] text-ink-550">{relativeTime(row.createdAt, now)}</p>
                </td>

                <td className={cn(TD, band, !open && rule)}>
                  <DocumentCell kind="quote" row={row} />
                </td>

                <td className={cn(TD, band, !open && rule)}>
                  <DocumentCell kind="invoice" row={row} />
                </td>

                <td className={cn(TD, band, !open && rule, "pr-4")}>
                  <StatusSelect leadId={row.id} name={row.fullName} status={row.status} />
                </td>
              </tr>

              <tr id={detailsId} hidden={!open}>
                <td
                  colSpan={7}
                  className={cn(
                    band,
                    rule,
                    "px-4 pb-4 pt-0",
                    focused && "shadow-[inset_3px_0_0_var(--color-azure-500)]",
                  )}
                >
                  <ClientDetails row={row} now={now} />
                </td>
              </tr>
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

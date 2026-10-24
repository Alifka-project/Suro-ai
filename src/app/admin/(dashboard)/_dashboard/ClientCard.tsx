"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { formatDate, formatDateTime } from "@/lib/admin/labels";
import { LeadAvatar } from "../crm/_components/LeadAvatar";
import {
  ContactButtons,
  DocumentCell,
  ServiceChips,
  companyOf,
  contactNote,
  locationOf,
  relativeTime,
  sourceMarker,
} from "./ClientCells";
import { ClientDetails } from "./ClientDetails";
import { RemoveButton } from "./RemoveButton";
import { StatusSelect } from "./StatusSelect";
import type { ClientRow } from "./types";

/*
 * One client as a card, for screens narrower than the table (below xl). Same
 * information and actions as a table row, stacked so nothing scrolls sideways
 * at 375px.
 */

const LABEL = "font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-550";

export function ClientCard({
  row,
  now,
  focused,
  open,
  onToggle,
}: {
  row: ClientRow;
  now: string;
  focused: boolean;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const panelId = `client-panel-${row.id}`;
  const location = locationOf(row);
  const source = sourceMarker(row.source);
  const note = contactNote(row);

  return (
    <li
      id={`client-card-${row.id}`}
      aria-current={focused ? "true" : undefined}
      className={cn(
        "min-w-0 px-4 py-4 sm:px-5",
        focused && "bg-azure-500/[0.06] shadow-[inset_3px_0_0_var(--color-azure-500)]",
      )}
    >
      {/* Who */}
      <div className="flex min-w-0 items-start gap-3">
        <LeadAvatar name={row.companyName || row.fullName} />
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-[0.95rem] font-semibold tracking-normal text-ink-900 [overflow-wrap:anywhere]">
            {row.fullName}
          </h3>
          <p className="text-[0.8rem] text-ink-700 [overflow-wrap:anywhere]">
            {companyOf(row)}
            {location && <span className="text-ink-550"> · {location}</span>}
          </p>
          {row.title && (
            <p className="text-[0.78rem] font-medium text-abyss-600 [overflow-wrap:anywhere]">
              <span className="sr-only">Project: </span>
              {row.title}
            </p>
          )}
          <p className="mt-0.5 text-[0.74rem] text-ink-550">
            Received{" "}
            <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
              {formatDate(row.createdAt)}
            </time>{" "}
            · {relativeTime(row.createdAt, now)}
            {source && <> · {source}</>}
          </p>
          <div className="mt-2">
            <p className="sr-only">Interested in</p>
            <ServiceChips services={row.services} max={3} layout="wrap" />
          </div>
        </div>
      </div>

      {/* Phones: status, contact, then quotation | invoice. sm: two columns. md+: one row of four. */}
      <div className="mt-4 grid min-w-0 grid-cols-2 gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.75fr)] md:gap-x-5">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <p className={cn(LABEL, "mb-1.5")} aria-hidden="true">
            Status
          </p>
          <StatusSelect leadId={row.id} name={row.fullName} status={row.status} size="card" />
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <p className={cn(LABEL, "mb-1.5")}>Contact</p>
          <div className="flex min-w-0 flex-col gap-0.5 text-[0.84rem]">
            {row.email ? (
              <a
                href={`mailto:${row.email}`}
                className="w-fit max-w-full rounded text-abyss-600 underline-offset-2 [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500"
              >
                {row.email}
              </a>
            ) : (
              <span className="text-ink-550">No email</span>
            )}
            <span className={cn("tabular-nums", row.phone ? "text-ink-700" : "text-ink-550")}>
              {row.phone ?? "No phone"}
            </span>
          </div>
          <ContactButtons row={row} stretch className="mt-2.5" />
          {note && <p className="mt-1.5 text-[0.74rem] text-ink-550">{note}</p>}
        </div>

        <div className="min-w-0">
          <p className={cn(LABEL, "mb-1.5")}>Quotation</p>
          <DocumentCell kind="quote" row={row} size="card" />
        </div>
        <div className="min-w-0">
          <p className={cn(LABEL, "mb-1.5")}>Invoice</p>
          <DocumentCell kind="invoice" row={row} size="card" />
        </div>
      </div>

      {/* Details, and Remove at the far end of the same row */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(row.id)}
          className="-ml-2 mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[0.82rem] font-semibold text-abyss-600 transition-colors hover:bg-azure-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
          {open ? "Hide details" : "Show details"}
          <span className="sr-only"> for {row.fullName}</span>
        </button>
        <RemoveButton row={row} variant="card" />
      </div>
      <div id={panelId} hidden={!open} className="mt-2">
        <ClientDetails row={row} now={now} />
      </div>
    </li>
  );
}

import type { ReactNode } from "react";
import { Detail, cn } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin/labels";
import { ContactButtons, ServiceList, locationOf, relativeTime, sourceMarker } from "./ClientCells";
import type { ClientRow } from "./types";

/*
 * Everything the client wrote in the website form, for the expandable row
 * (desktop) and the card's details panel (phones). Rendered with the page,
 * never fetched on demand.
 */

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-550">{children}</p>;
}

export function ClientDetails({ row, now, className }: { row: ClientRow; now: string; className?: string }) {
  const isCompany = row.clientType === "COMPANY";
  const source = sourceMarker(row.source);
  const location = locationOf(row);

  return (
    <div className={cn("rounded-xl border border-ink-100 bg-canvas p-3 sm:p-5", className)}>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* What they asked for, in their own words. */}
        <div className="min-w-0 space-y-4">
          <div>
            <Label>Message</Label>
            {row.message ? (
              <blockquote className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border-l-[3px] border-azure-400 bg-white px-3.5 py-3 sm:px-4 text-[0.88rem] leading-relaxed text-ink-800 [overflow-wrap:anywhere]">
                {row.message}
              </blockquote>
            ) : (
              <p className="mt-1 text-[0.86rem] text-ink-550">No message.</p>
            )}
          </div>
          <div>
            <Label>Services requested</Label>
            {row.services.length > 0 ? (
              <ServiceList services={row.services} />
            ) : (
              <p className="mt-1 text-[0.86rem] text-ink-550">None selected.</p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 xs:grid-cols-2">
            <Detail label="Name">
              <span className="[overflow-wrap:anywhere]">{row.fullName}</span>
            </Detail>
            <Detail label="Client type">{isCompany ? "Company" : "Individual"}</Detail>
            <Detail label={isCompany ? "Company" : "Company (if any)"}>{row.companyName}</Detail>
            <Detail label="Role">{row.role}</Detail>
            <Detail label="Company size">{row.companySize}</Detail>
            <Detail label="Industry">{row.industry}</Detail>
            <Detail label="Location">{location}</Detail>
            <Detail label="Prefers to be contacted by">{row.contactPreference}</Detail>
            <Detail label="Timeline">{row.timeline}</Detail>
            <Detail label="Budget">{row.budget}</Detail>
            <Detail label="Received">
              <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
              <span className="text-ink-550"> · {relativeTime(row.createdAt, now)}</span>
            </Detail>
            <Detail label="Systems they use" className="xs:col-span-2">
              {row.systems ? <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{row.systems}</span> : null}
            </Detail>
            <Detail label="Email">
              {row.email ? (
                <a
                  href={`mailto:${row.email}`}
                  className="text-abyss-600 underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                >
                  {row.email}
                </a>
              ) : null}
            </Detail>
            <Detail label="Phone">{row.phone ? <span className="tabular-nums">{row.phone}</span> : null}</Detail>
            <Detail label="Documents">
              {plural(row.quoteCount, "quotation", "quotations")} · {plural(row.invoiceCount, "invoice", "invoices")}
            </Detail>
            <Detail label="Source">{source ?? "Website form"}</Detail>
          </dl>

          <div>
            <Label>Get in touch</Label>
            <ContactButtons row={row} email className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

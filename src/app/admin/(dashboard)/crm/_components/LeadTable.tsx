import Link from "next/link";
import { Clock } from "lucide-react";
import { StatusBadge, Table, Td, Th, cn } from "@/components/admin/ui";
import { LEAD_STATUS, formatDateTime, timeAgo } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { ACTIVITY_STATE, leadTitle } from "@/lib/admin/pipeline";
import { companyLabel, describeActivity } from "../_lib/helpers";
import type { LeadListItem } from "../_lib/select";
import { OwnerAvatar } from "../pipeline/_components/OwnerAvatar";
import { LeadAvatar } from "./LeadAvatar";

/**
 * The opportunity title is a real link; its ::after stretches over the whole
 * row so the entire row is clickable without nesting interactive elements.
 * Elements that carry a hover tooltip sit above that overlay (`relative z-10`),
 * otherwise the overlay would take the hover and the tooltip would never show.
 */
export function LeadTable({ leads, now }: { leads: LeadListItem[]; now: Date }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Opportunity</Th>
          <Th>Company</Th>
          <Th>Stage</Th>
          <Th>Salesperson</Th>
          <Th className="text-right">Expected revenue</Th>
          <Th>Next activity</Th>
          <Th className="text-right">Created</Th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => {
          const title = leadTitle(lead);
          const contact = [title !== lead.fullName ? lead.fullName : null, lead.email ?? lead.phone]
            .filter(Boolean)
            .join(" · ");
          const next = lead.activities[0] ? describeActivity(lead.activities[0], now) : null;
          return (
            <tr key={lead.id} className="group relative transition-colors hover:bg-haze/60">
              <Td>
                <div className="flex min-w-0 max-w-[16rem] items-center gap-3">
                  <LeadAvatar name={lead.companyName || lead.fullName} />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/crm/${lead.id}`}
                      className="block truncate font-semibold text-ink-900 transition-colors after:absolute after:inset-0 group-hover:text-abyss-600"
                    >
                      {title}
                    </Link>
                    {contact && <p className="truncate text-[0.76rem] text-ink-550">{contact}</p>}
                  </div>
                </div>
              </Td>
              <Td>
                <span className="block max-w-[11rem] truncate text-ink-700">{companyLabel(lead)}</span>
              </Td>
              <Td>
                <StatusBadge status={lead.status} map={LEAD_STATUS} />
                {lead.status === "LOST" && lead.lostReason && (
                  <p
                    className="relative z-10 mt-1 max-w-[10rem] truncate text-[0.72rem] text-ink-550"
                    title={`Lost: ${lead.lostReason}`}
                  >
                    <span className="sr-only">Lost reason: </span>
                    {lead.lostReason}
                  </p>
                )}
              </Td>
              <Td>
                <div className="flex max-w-[9rem] items-center gap-2">
                  <OwnerAvatar owner={lead.owner} className="relative z-10" />
                  <span className={cn("truncate text-[0.8rem]", lead.owner ? "text-ink-700" : "text-ink-550")} aria-hidden="true">
                    {lead.owner?.name ?? "Unassigned"}
                  </span>
                </div>
              </Td>
              <Td className="whitespace-nowrap text-right tabular-nums">
                <span className={lead.estimatedValueFils === null ? "text-ink-550" : "font-semibold text-ink-800"}>
                  {formatMoney(lead.estimatedValueFils)}
                </span>
              </Td>
              <Td>
                {next ? (
                  <div
                    className="relative z-10 flex max-w-[13rem] items-start gap-1.5"
                    title={`${next.label} · ${next.due}`}
                  >
                    <Clock
                      className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ACTIVITY_STATE[next.state].text)}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[0.8rem] text-ink-800">{next.label}</p>
                      <p className={cn("text-[0.72rem] font-semibold", ACTIVITY_STATE[next.state].text)}>{next.due}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-[0.8rem] text-ink-550">None planned</span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-right text-ink-600">
                <time
                  dateTime={lead.createdAt.toISOString()}
                  title={formatDateTime(lead.createdAt)}
                  className="relative z-10"
                >
                  {timeAgo(lead.createdAt)}
                </time>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

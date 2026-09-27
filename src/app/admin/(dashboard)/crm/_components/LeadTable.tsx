import Link from "next/link";
import { StatusBadge, Table, Td, Th } from "@/components/admin/ui";
import { LEAD_STATUS, formatDateTime, timeAgo } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { companyLabel } from "../_lib/helpers";
import type { LeadListItem } from "../_lib/select";
import { LeadAvatar } from "./LeadAvatar";

/**
 * The name is a real link; its ::after stretches over the whole row so the
 * entire row is clickable without nesting interactive elements. Elements that
 * carry a hover tooltip sit above that overlay (`relative z-10`), otherwise the
 * overlay would take the hover and the tooltip would never show.
 */
export function LeadTable({ leads }: { leads: LeadListItem[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>Company</Th>
          <Th className="hidden 2xl:table-cell">Services</Th>
          <Th className="hidden 2xl:table-cell">Budget</Th>
          <Th className="text-right">Est. value</Th>
          <Th>Status</Th>
          <Th className="text-right">Received</Th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => {
          const [firstService, ...otherServices] = lead.services;
          return (
            <tr key={lead.id} className="group relative transition-colors hover:bg-haze/60">
              <Td>
                <div className="flex min-w-0 max-w-[14rem] items-center gap-3">
                  <LeadAvatar name={lead.fullName} />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/crm/${lead.id}`}
                      className="block truncate font-semibold text-ink-900 transition-colors after:absolute after:inset-0 group-hover:text-abyss-600"
                    >
                      {lead.fullName}
                    </Link>
                    <p className="truncate text-[0.76rem] text-ink-500">{lead.email}</p>
                  </div>
                </div>
              </Td>
              <Td>
                <span
                  className={
                    lead.companyName
                      ? "block max-w-[11rem] truncate text-ink-700"
                      : "block max-w-[11rem] truncate text-ink-600"
                  }
                >
                  {companyLabel(lead)}
                </span>
              </Td>
              <Td className="hidden 2xl:table-cell">
                {firstService ? (
                  <div className="flex max-w-[12rem] items-center gap-1.5">
                    <span className="relative z-10 truncate text-ink-700" title={lead.services.join(", ")}>
                      {firstService}
                    </span>
                    {otherServices.length > 0 && (
                      <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-0.5 text-[0.68rem] font-semibold text-ink-500">
                        +{otherServices.length}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Td>
              <Td className="hidden whitespace-nowrap 2xl:table-cell">{lead.budget}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">
                <span className={lead.estimatedValueFils === null ? "text-ink-400" : "font-semibold text-ink-800"}>
                  {formatMoney(lead.estimatedValueFils)}
                </span>
              </Td>
              <Td>
                <StatusBadge status={lead.status} map={LEAD_STATUS} />
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

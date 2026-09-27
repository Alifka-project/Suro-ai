import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Clock,
  FolderKanban,
  Inbox,
  TriangleAlert,
} from "lucide-react";
import { Card, CardHeader, EmptyState, LinkButton, StatusBadge, cn } from "@/components/admin/ui";
import { LEAD_STATUS, PROJECT_STATUS, initials, timeAgo } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { formatBusinessDate } from "@/lib/admin/time";
import type { ActiveProject, AttentionInvoice, RecentLead } from "./data";

/* Presentational server components for the overview's lists. They receive
   plain data from the page (which has already passed requireAdmin) and never
   touch the database themselves. */

const rowLink =
  "group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-haze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400/60";

function ViewAll({ href, children = "View all" }: { href: string; children?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[0.76rem] font-semibold text-abyss-600 transition-colors hover:bg-haze hover:text-abyss-700"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

// ─── Recent leads ───────────────────────────────────────────────────────────

export function RecentLeads({ leads, className }: { leads: RecentLead[]; className?: string }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title="Recent leads"
        subtitle="Latest enquiries from the website form"
        action={<ViewAll href="/admin/crm" />}
      />
      {leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No leads yet"
          description="When a visitor submits the enquiry form on the website, the lead appears here."
        />
      ) : (
        <ul className="divide-y divide-ink-100/70">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link href={`/admin/crm/${lead.id}`} className={rowLink}>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-azure-500/15 to-aqua-500/20 font-display text-[0.72rem] font-bold text-abyss-600"
                >
                  {initials(lead.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[0.86rem] font-semibold text-ink-900 group-hover:text-abyss-600"
                    title={lead.name}
                  >
                    {lead.name}
                  </span>
                  <span className="block truncate text-[0.76rem] text-ink-500" title={lead.company ?? undefined}>
                    {lead.company || (lead.isIndividual ? "Individual" : "No company given")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={lead.status} map={LEAD_STATUS} />
                  <time dateTime={lead.createdAt.toISOString()} className="text-[0.7rem] text-ink-600">
                    {timeAgo(lead.createdAt)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Invoices needing attention ─────────────────────────────────────────────

export function AttentionInvoices({
  invoices,
  total,
  overdueTotal,
  className,
}: {
  invoices: AttentionInvoice[];
  total: number;
  overdueTotal: number;
  className?: string;
}) {
  const dueSoon = total - overdueTotal;
  const subtitle =
    total === 0
      ? "Overdue, or due in the next 7 days"
      : [overdueTotal > 0 && `${overdueTotal} overdue`, dueSoon > 0 && `${dueSoon} due within 7 days`]
          .filter(Boolean)
          .join(" · ");

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title="Invoices needing attention"
        subtitle={subtitle}
        action={<ViewAll href="/admin/billing?tab=invoices" />}
      />
      {invoices.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="All caught up"
          description="Nothing is overdue and no sent invoice falls due in the next 7 days."
        />
      ) : (
        <>
          <ul className="divide-y divide-ink-100/70">
            {invoices.map((inv) => {
              const Icon = inv.overdue ? TriangleAlert : Clock;
              return (
                <li key={inv.id}>
                  <Link href={`/admin/billing/invoices/${inv.id}`} className={rowLink}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        inv.overdue ? "bg-red-500/10 text-red-600" : "bg-amber-400/15 text-amber-700",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {/* Client leads the row on a line of its own, so it keeps
                        the full width beside the amount. The due line wraps its
                        status under the date when a narrow card can't fit both. */}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className="min-w-0 truncate text-[0.86rem] font-semibold text-ink-900 group-hover:text-abyss-600"
                          title={inv.client}
                        >
                          {inv.client}
                        </span>
                        <span className="shrink-0 text-[0.86rem] font-semibold text-ink-900 tabular-nums">
                          {formatMoney(inv.totalFils, inv.currency)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="min-w-0 truncate text-[0.76rem] text-ink-500">
                          <span className="font-mono text-[0.72rem]">{inv.number}</span>
                          <span aria-hidden="true"> · </span>
                          <time dateTime={inv.dueDate.toISOString()}>Due {formatBusinessDate(inv.dueDate)}</time>
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0 text-[0.72rem] font-semibold",
                            inv.overdue ? "text-red-600" : "text-amber-700",
                          )}
                        >
                          {inv.dueLabel}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {total > invoices.length && (
            <p className="mt-3 text-[0.75rem] text-ink-500">
              {total - invoices.length} more in{" "}
              <Link href="/admin/billing?tab=invoices" className="font-semibold text-abyss-600 hover:text-abyss-700">
                Billing
              </Link>
              .
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Active projects ────────────────────────────────────────────────────────

export function ActiveProjects({
  projects,
  total,
  className,
}: {
  projects: ActiveProject[];
  total: number;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title="Active projects"
        subtitle={
          total === 0
            ? "Planning, in progress or in review"
            : `${total} ${total === 1 ? "project" : "projects"} in planning, in progress or in review`
        }
        action={<ViewAll href="/admin/projects">View board</ViewAll>}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No active projects"
          description="Projects in planning, in progress or in review show up here with their task progress."
          action={
            <LinkButton href="/admin/projects/new" variant="secondary" size="sm">
              New project
            </LinkButton>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const pct = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
              return (
                <li key={p.id} className="min-w-0">
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="group flex h-full flex-col rounded-xl border border-ink-100 bg-white p-4 transition-colors hover:border-ink-200 hover:bg-haze/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400/60"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        {/* Two lines before clipping: project names are long and
                            share the row with the status badge. */}
                        <span
                          className="line-clamp-2 break-words font-display text-[0.92rem] font-bold leading-snug text-ink-900 group-hover:text-abyss-600"
                          title={p.name}
                        >
                          {p.name}
                        </span>
                        <span className="block truncate text-[0.76rem] text-ink-500" title={p.client ?? undefined}>
                          {p.client ?? "No client linked"}
                        </span>
                      </span>
                      <StatusBadge status={p.status} map={PROJECT_STATUS} />
                    </span>

                    <span className="mt-4 block">
                      <span className="flex items-baseline justify-between gap-3 text-[0.74rem]">
                        <span className="text-ink-500">
                          {p.totalTasks === 0
                            ? "No tasks yet"
                            : `${p.doneTasks} of ${p.totalTasks} ${p.totalTasks === 1 ? "task" : "tasks"} done`}
                        </span>
                        <span className="font-semibold text-ink-800 tabular-nums">{pct}%</span>
                      </span>
                      <span
                        role="progressbar"
                        aria-label={`${p.name} task progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-azure-500/15"
                      >
                        <span className="block h-full rounded-full bg-azure-500" style={{ width: `${pct}%` }} />
                      </span>
                    </span>

                    <span
                      className={cn(
                        "mt-auto flex items-center gap-1.5 pt-3 text-[0.74rem]",
                        p.overdue ? "font-semibold text-red-600" : "text-ink-500",
                      )}
                    >
                      {p.overdue ? (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      {p.dueDate ? (
                        <time dateTime={p.dueDate.toISOString()}>
                          {p.overdue ? "Overdue · was due " : "Due "}
                          {formatBusinessDate(p.dueDate)}
                        </time>
                      ) : (
                        "No due date"
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {total > projects.length && (
            <p className="mt-3 text-[0.75rem] text-ink-500">
              Showing the {projects.length} due soonest of {total}.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

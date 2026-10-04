import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Clock,
  FileSignature,
  FolderKanban,
  Inbox,
  ListTodo,
  Mail,
  Phone,
  Repeat,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, EmptyState, LinkButton, StatusBadge, cn } from "@/components/admin/ui";
import { LEAD_STATUS, PROJECT_STATUS, TONE_DOT, initials, timeAgo } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { ACTIVITY_TYPE } from "@/lib/admin/pipeline";
import { formatBusinessDate } from "@/lib/admin/time";
import type {
  ActiveProject,
  AgreementStatusCount,
  AttentionInvoice,
  AwaitingAgreement,
  OverdueFollowUp,
  RecentLead,
} from "./data";

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
        subtitle="Newest opportunities, from the website form or added by hand"
        action={<ViewAll href="/admin/crm" />}
      />
      {leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No leads yet"
          description="Website enquiries appear here as they arrive, along with any opportunity you add on the pipeline."
        />
      ) : (
        <ul className="divide-y divide-ink-100/70">
          {leads.map((lead) => {
            // Under the opportunity title: whichever of company and contact the
            // title doesn't already say.
            const secondary =
              [lead.company, lead.name].filter((part): part is string => !!part && part !== lead.title).join(" · ") ||
              (lead.isIndividual ? "Individual" : "No company given");
            return (
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
                      title={lead.title}
                    >
                      {lead.title}
                    </span>
                    <span className="block truncate text-[0.76rem] text-ink-500" title={secondary}>
                      {secondary}
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
            );
          })}
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

// ─── Overdue follow-ups ─────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<(typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE]["icon"], LucideIcon> = {
  Phone,
  Mail,
  Users,
  ListTodo,
  Repeat,
};

export function OverdueFollowUps({
  items,
  overdueTotal,
  dueToday,
  className,
}: {
  items: OverdueFollowUp[];
  overdueTotal: number;
  dueToday: number;
  className?: string;
}) {
  const subtitle =
    overdueTotal === 0 && dueToday === 0
      ? "Calls, emails and meetings past their due date"
      : [overdueTotal > 0 && `${overdueTotal} overdue`, dueToday > 0 && `${dueToday} due today`].filter(Boolean).join(" · ");

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader
        title="Overdue follow-ups"
        subtitle={subtitle}
        action={<ViewAll href="/admin/crm/activities">Open planner</ViewAll>}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="No overdue follow-ups"
          description={
            dueToday > 0
              ? `Nothing is late. ${dueToday} ${dueToday === 1 ? "activity is" : "activities are"} due today.`
              : "Every scheduled call, email and meeting is on time."
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-ink-100/70">
            {items.map((a) => {
              const type = ACTIVITY_TYPE[a.type];
              const Icon = ACTIVITY_ICONS[type.icon];
              return (
                <li key={a.id}>
                  <Link href={`/admin/crm/${a.leadId}`} className={rowLink}>
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className="min-w-0 truncate text-[0.86rem] font-semibold text-ink-900 group-hover:text-abyss-600"
                          title={a.summary}
                        >
                          {a.summary}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[0.72rem] font-semibold text-red-600">
                          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          {a.dueLabel}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.76rem] text-ink-500" title={a.lead}>
                        <span className="font-medium text-ink-700">{a.lead}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                        {type.label}
                        {a.assignee && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="sr-only">, assigned to </span>
                            {a.assignee}
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {overdueTotal > items.length && (
            <p className="mt-3 text-[0.75rem] text-ink-500">
              {overdueTotal - items.length} more in{" "}
              <Link href="/admin/crm/activities" className="font-semibold text-abyss-600 hover:text-abyss-700">
                Activities
              </Link>
              .
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Service agreements ─────────────────────────────────────────────────────

export function AgreementsPanel({
  counts,
  total,
  awaiting,
  awaitingTotal,
  className,
}: {
  counts: AgreementStatusCount[];
  total: number;
  awaiting: AwaitingAgreement[];
  awaitingTotal: number;
  className?: string;
}) {
  const drafts = counts.find((c) => c.status === "DRAFT")?.count ?? 0;
  const subtitle =
    total === 0
      ? "Generated from quotations when a deal is won"
      : [
          awaitingTotal > 0 ? `${awaitingTotal} awaiting signature` : "None awaiting signature",
          drafts > 0 && `${drafts} ${drafts === 1 ? "draft" : "drafts"} to review`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader title="Service agreements" subtitle={subtitle} action={<ViewAll href="/admin/billing/agreements" />} />
      {total === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No agreements yet"
          description="Accepting a quotation, or marking a deal Won in the CRM, generates its service agreement automatically."
          action={
            <LinkButton href="/admin/crm/pipeline" variant="secondary" size="sm">
              Open pipeline
            </LinkButton>
          }
        />
      ) : (
        <>
          <ul aria-label="Agreements by status" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {counts.map((c) => (
              <li key={c.status} className="min-w-0">
                <Link
                  href={`/admin/billing/agreements?status=${c.status}`}
                  className="flex h-full flex-col justify-between gap-1 rounded-xl border border-ink-100 px-3 py-2.5 transition-colors hover:border-ink-200 hover:bg-haze/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400/60"
                >
                  <span className="flex items-start gap-1.5 text-[0.72rem] font-medium leading-tight text-ink-600">
                    <span aria-hidden="true" className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[c.tone])} />
                    {c.label}
                  </span>
                  <span
                    className={cn(
                      "font-display text-[1.3rem] font-bold leading-none tabular-nums",
                      c.count === 0 ? "text-ink-550" : "text-ink-900",
                    )}
                  >
                    {c.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mb-1 mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-550">
            Awaiting signature
          </h3>
          {awaiting.length === 0 ? (
            <p className="py-2 text-[0.8rem] text-ink-550">Nothing is out for signature right now.</p>
          ) : (
            <ul className="divide-y divide-ink-100/70">
              {awaiting.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/billing/agreements/${a.id}`} className={rowLink}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        a.stale ? "bg-amber-400/15 text-amber-700" : "bg-azure-500/10 text-abyss-600",
                      )}
                    >
                      <FileSignature className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className="min-w-0 truncate text-[0.86rem] font-semibold text-ink-900 group-hover:text-abyss-600"
                          title={a.client}
                        >
                          {a.client}
                        </span>
                        <span className="shrink-0 text-[0.86rem] font-semibold text-ink-900 tabular-nums">
                          {formatMoney(a.totalFils, a.currency)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="min-w-0 truncate text-[0.76rem] text-ink-500" title={a.projectName}>
                          <span className="font-mono text-[0.72rem]">{a.number}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="sr-only">, </span>
                          {a.projectName}
                        </span>
                        <time
                          dateTime={a.sentAt.toISOString()}
                          title={formatBusinessDate(a.sentAt)}
                          className={cn(
                            "ml-auto inline-flex shrink-0 items-center gap-1 text-[0.72rem] font-semibold",
                            a.stale ? "text-amber-700" : "text-ink-600",
                          )}
                        >
                          {a.stale && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                          {a.waitingLabel}
                          {a.stale && <span className="sr-only">, time to follow up</span>}
                        </time>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {awaitingTotal > awaiting.length && (
            <p className="mt-3 text-[0.75rem] text-ink-500">
              Showing the {awaiting.length} waiting longest of {awaitingTotal}.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

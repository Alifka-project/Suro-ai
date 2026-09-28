import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, ChevronDown, CircleCheck, UserRound } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { formatDateTime, timeAgo } from "@/lib/admin/labels";
import { ACTIVITY_TYPE, leadTitle } from "@/lib/admin/pipeline";
import { DAY_MS, daysFromToday, startOfBusinessDay } from "@/lib/admin/time";
import { db } from "@/lib/db";
import { ActivityActions, ActivityItem, type ActivityRow } from "../_components/ActivityList";
import { toActivityRow } from "../_components/ActivityRows";
import { ActivityTypeIcon } from "../_components/ActivityTypeIcon";
import { CrmTabs } from "../_components/CrmTabs";
import { firstParam, plural } from "../_lib/helpers";

export const metadata: Metadata = { title: "Activities · CRM" };

/** More open activities than anyone can act on in a sitting; the rest wait their turn. */
const PLANNED_LIMIT = 300;
const DONE_LIMIT = 60;

type GroupKey = "overdue" | "today" | "week" | "later";

const GROUPS: { key: GroupKey; title: string; dot: string; empty: string }[] = [
  { key: "overdue", title: "Overdue", dot: "bg-red-500", empty: "Nothing overdue." },
  { key: "today", title: "Today", dot: "bg-amber-400", empty: "Nothing due today." },
  { key: "week", title: "Next 7 days", dot: "bg-azure-500", empty: "Nothing due in the next 7 days." },
  { key: "later", title: "Later", dot: "bg-ink-300", empty: "Nothing planned further out." },
];

/** Which planner group a due date falls in, on the business calendar. */
function groupFor(dueDate: Date, now: Date): GroupKey {
  const days = daysFromToday(dueDate, now);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 7 ? "week" : "later";
}

const activitySelect = {
  id: true,
  type: true,
  summary: true,
  note: true,
  dueDate: true,
  doneAt: true,
  feedback: true,
  assignee: { select: { name: true } },
  lead: { select: { id: true, title: true, companyName: true, fullName: true } },
} satisfies Prisma.ActivitySelect;

/**
 * Odoo's activity planner: every open activity across the pipeline, grouped
 * by when it's due, with Done / Cancel inline. Activities on lost
 * opportunities are left out — the deal is closed, so they're not work.
 */
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const onlyMine = firstParam(sp.who) === "me";

  const now = new Date();
  const startOfToday = startOfBusinessDay(now);
  // Today plus the six days before it.
  const doneSince = new Date(startOfToday.getTime() - 6 * DAY_MS);

  const inPlay: Prisma.ActivityWhereInput = { lead: { status: { not: "LOST" } } };
  const scope: Prisma.ActivityWhereInput = onlyMine ? { ...inPlay, assigneeId: me.id } : inPlay;

  const [planned, done, openAll, openMine, overdueAll] = await Promise.all([
    db.activity.findMany({
      where: { ...scope, doneAt: null },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: PLANNED_LIMIT,
      select: activitySelect,
    }),
    db.activity.findMany({
      where: { ...scope, doneAt: { gte: doneSince } },
      orderBy: [{ doneAt: "desc" }, { id: "desc" }],
      take: DONE_LIMIT,
      select: activitySelect,
    }),
    db.activity.count({ where: { ...inPlay, doneAt: null } }),
    db.activity.count({ where: { ...inPlay, doneAt: null, assigneeId: me.id } }),
    // Same rule as the sidebar badge: open, due before today began in Dubai.
    db.activity.count({ where: { ...inPlay, doneAt: null, dueDate: { lt: startOfToday } } }),
  ]);

  const grouped: Record<GroupKey, ActivityRow[]> = { overdue: [], today: [], week: [], later: [] };
  for (const a of planned) {
    grouped[groupFor(a.dueDate, now)].push(
      toActivityRow(a, now, { id: a.lead.id, title: leadTitle(a.lead), company: a.lead.companyName }),
    );
  }
  const openCount = onlyMine ? openMine : openAll;

  return (
    <>
      <CrmTabs active="activities" overdueActivities={overdueAll} />

      <PageHeader
        eyebrow="CRM"
        title="Activities"
        description={
          openCount === 0 ? (
            onlyMine ? "Nothing assigned to you right now." : "Nothing planned right now."
          ) : (
            <>
              {plural(openCount, "planned activity", "planned activities")}
              {grouped.overdue.length > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-red-600">{grouped.overdue.length} overdue</span>
                </>
              )}
            </>
          )
        }
        actions={<WhoFilter onlyMine={onlyMine} openAll={openAll} openMine={openMine} />}
      />

      <ActivityActions>
        {planned.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={onlyMine ? "Nothing assigned to you" : "No activities planned"}
            description={
              onlyMine
                ? "Calls, emails and meetings assigned to you on any opportunity show up here, grouped by due date."
                : "Schedule the next call, email or meeting from an opportunity and it shows up here, grouped by due date."
            }
            action={
              onlyMine ? (
                <LinkButton href="/admin/crm/activities" variant="secondary" size="sm">
                  Show everyone&apos;s
                </LinkButton>
              ) : (
                <LinkButton href="/admin/crm/pipeline" variant="secondary" size="sm">
                  Open the pipeline
                </LinkButton>
              )
            }
          />
        ) : (
          <>
            <nav aria-label="Jump to a group" className="mb-5">
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {GROUPS.map((g) => (
                  <li key={g.key}>
                    <a
                      href={`#${g.key}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgb(7_38_60/0.04)] transition-colors hover:border-azure-300 hover:bg-haze/50"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[0.82rem] font-semibold text-ink-700">
                        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", g.dot)} />
                        <span className="truncate">{g.title}</span>
                      </span>
                      <span
                        className={cn(
                          "font-display text-[1.1rem] font-bold tabular-nums",
                          g.key === "overdue" && grouped.overdue.length > 0 ? "text-red-600" : "text-ink-900",
                        )}
                      >
                        {grouped[g.key].length}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-5">
              {GROUPS.map((g) => {
                const rows = grouped[g.key];
                const headingId = `${g.key}-heading`;
                return (
                  <section key={g.key} id={g.key} aria-labelledby={headingId} className="scroll-mt-24">
                    <Card>
                      <h2 id={headingId} className="mb-3 flex items-center gap-2 font-display text-[0.98rem] font-bold text-ink-900">
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", g.dot)} />
                        {g.title}
                        <span className="rounded-full bg-ink-100 px-2 py-px text-[0.72rem] font-semibold tabular-nums text-ink-600">
                          {rows.length}
                        </span>
                      </h2>
                      {rows.length > 0 ? (
                        <ol className="space-y-2">
                          {rows.map((row) => (
                            <ActivityItem key={row.id} activity={row} />
                          ))}
                        </ol>
                      ) : (
                        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-[0.78rem] text-ink-600">
                          {g.empty}
                        </p>
                      )}
                    </Card>
                  </section>
                );
              })}
            </div>

            {planned.length === PLANNED_LIMIT && (
              <p className="mt-4 text-center text-[0.78rem] text-ink-550">
                Showing the {PLANNED_LIMIT} most urgent activities. Complete a few to see the rest.
              </p>
            )}
          </>
        )}
      </ActivityActions>

      {/* ─── Recently done ───────────────────────────────────────────────── */}
      <details className="group mt-6 rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgb(7_38_60/0.04)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-colors hover:bg-haze/40 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2 font-display text-[0.98rem] font-bold text-ink-900">
            <CalendarCheck2 className="h-4 w-4 shrink-0 text-mint-ink" aria-hidden="true" />
            Done in the last 7 days
            <span className="rounded-full bg-ink-100 px-2 py-px text-[0.72rem] font-semibold tabular-nums text-ink-600">
              {done.length === DONE_LIMIT ? `${DONE_LIMIT}+` : done.length}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-ink-100 px-4 py-4 sm:px-5">
          {done.length > 0 ? (
            <ol className="space-y-2">
              {done.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint-200/45 text-mint-ink ring-1 ring-inset ring-mint-300/70">
                    <ActivityTypeIcon type={a.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.86rem]">
                      <CircleCheck className="h-3.5 w-3.5 shrink-0 text-mint-ink" aria-hidden="true" />
                      <span className="sr-only">Done: </span>
                      <span className="min-w-0 break-words font-semibold text-ink-900">{a.summary}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[0.78rem] text-ink-550">
                      <Link href={`/admin/crm/${a.lead.id}`} className="rounded font-semibold text-abyss-600 hover:underline">
                        {leadTitle(a.lead)}
                      </Link>
                      {a.lead.companyName && a.lead.companyName !== leadTitle(a.lead) && <span> · {a.lead.companyName}</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.74rem] text-ink-550">
                      <span className="font-medium text-ink-700">{ACTIVITY_TYPE[a.type].label}</span>
                      <span aria-hidden="true">·</span>
                      {a.doneAt && (
                        <span>
                          Done{" "}
                          <time dateTime={a.doneAt.toISOString()} title={formatDateTime(a.doneAt)}>
                            {timeAgo(a.doneAt)}
                          </time>
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="sr-only">Assigned to </span>
                        {a.assignee?.name ?? "Unassigned"}
                      </span>
                    </p>
                    {a.feedback && (
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-canvas px-3 py-2 text-[0.8rem] leading-relaxed text-ink-700">
                        {a.feedback}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[0.82rem] text-ink-600">
              Nothing completed in the last 7 days{onlyMine ? " on activities assigned to you" : ""}.
            </p>
          )}
        </div>
      </details>
    </>
  );
}

function WhoFilter({ onlyMine, openAll, openMine }: { onlyMine: boolean; openAll: number; openMine: number }) {
  const options = [
    { mine: false, label: "Everyone", count: openAll, href: "/admin/crm/activities" },
    { mine: true, label: "Assigned to me", count: openMine, href: "/admin/crm/activities?who=me" },
  ];
  return (
    <nav aria-label="Whose activities" className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
      {options.map((o) => {
        const active = o.mine === onlyMine;
        return (
          <Link
            key={o.label}
            href={o.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-semibold transition-colors",
              active ? "bg-ink-900 text-white" : "text-ink-550 hover:text-ink-900",
            )}
          >
            {o.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums",
                active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600",
              )}
            >
              {o.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

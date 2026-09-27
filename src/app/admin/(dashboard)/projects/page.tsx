import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CircleCheckBig,
  Columns3,
  FolderKanban,
  List,
  Plus,
  TriangleAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/dal";
import { db } from "@/lib/db";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { PROJECT_PIPELINE, PROJECT_STATUS } from "@/lib/admin/labels";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Th,
  cn,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { moveProject } from "./actions";
import { DueDate, StatusDot, TaskProgress } from "./_components/bits";
import { isPastDue } from "./_lib/format";

export const metadata: Metadata = { title: "Projects" };

type ProjectStatus = (typeof PROJECT_PIPELINE)[number];

/** Work that is actually moving. On hold and done are excluded from "active". */
const ACTIVE_STATUSES: ReadonlySet<ProjectStatus> = new Set(["PLANNING", "IN_PROGRESS", "REVIEW"]);

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  dueDate: Date | null;
  valueFils: number | null;
  client: { name: string; company: string | null } | null;
  done: number;
  total: number;
  overdue: boolean;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await requireAdmin();
  const { view } = await searchParams;
  const listView = view === "list";

  const [projects, taskGroups] = await Promise.all([
    db.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        valueFils: true,
        lead: { select: { fullName: true, companyName: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    // One grouped count instead of loading every task of every project.
    db.task.groupBy({ by: ["projectId", "status"], _count: { _all: true } }),
  ]);

  const taskCounts = new Map<string, { done: number; total: number }>();
  for (const group of taskGroups) {
    const entry = taskCounts.get(group.projectId) ?? { done: 0, total: 0 };
    entry.total += group._count._all;
    if (group.status === "DONE") entry.done += group._count._all;
    taskCounts.set(group.projectId, entry);
  }

  const now = new Date();
  const rows: ProjectRow[] = projects.map((project) => {
    const counts = taskCounts.get(project.id) ?? { done: 0, total: 0 };
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      dueDate: project.dueDate,
      valueFils: project.valueFils,
      client: project.lead ? { name: project.lead.fullName, company: project.lead.companyName } : null,
      done: counts.done,
      total: counts.total,
      overdue: project.status !== "DONE" && isPastDue(project.dueDate, now),
    };
  });

  const active = rows.filter((row) => ACTIVE_STATUSES.has(row.status));
  const activeValue = active.reduce((sum, row) => sum + (row.valueFils ?? 0), 0);
  const overdueCount = rows.filter((row) => row.overdue).length;
  const doneCount = rows.filter((row) => row.status === "DONE").length;
  const onHoldCount = rows.filter((row) => row.status === "ON_HOLD").length;
  const countOf = (status: ProjectStatus) => rows.filter((row) => row.status === status).length;

  return (
    <>
      <PageHeader
        eyebrow="Project management"
        title="Projects"
        description={
          rows.length > 0
            ? `${active.length} active · ${formatMoney(activeValue)} in active work`
            : "Track every client project from planning to done."
        }
        actions={
          <>
            {rows.length > 0 && <ViewToggle listView={listView} />}
            <LinkButton href="/admin/projects/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New project
            </LinkButton>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project when a deal is won to track its tasks, deadlines and invoicing in one place."
          action={
            <LinkButton href="/admin/projects/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New project
            </LinkButton>
          }
        />
      ) : (
        <>
          <section aria-label="Project summary" className="mb-6 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Active projects"
              value={active.length}
              hint={`${countOf("PLANNING")} planning · ${countOf("IN_PROGRESS")} in progress · ${countOf("REVIEW")} review`}
              icon={FolderKanban}
            />
            <StatCard
              label="Active value"
              value={formatMoneyCompact(activeValue)}
              hint={formatMoney(activeValue)}
              icon={Wallet}
              accent="from-aqua-500 to-mint-500"
            />
            <StatCard
              label="Overdue"
              value={overdueCount}
              hint={overdueCount > 0 ? "Past due date and not done" : "Everything is on schedule"}
              icon={TriangleAlert}
              accent="from-blush-500 to-lilac-500"
            />
            <StatCard
              label="Completed"
              value={doneCount}
              hint={`${onHoldCount} on hold`}
              icon={CircleCheckBig}
              accent="from-lilac-500 to-azure-500"
            />
          </section>

          {listView ? <ProjectTable rows={rows} /> : <ProjectBoard rows={rows} />}
        </>
      )}
    </>
  );
}

// ─── View toggle ─────────────────────────────────────────────────────────────

function ViewToggle({ listView }: { listView: boolean }) {
  const item = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.78rem] font-semibold transition-colors",
      active ? "bg-ink-900/[0.06] text-ink-900" : "text-ink-500 hover:text-ink-800",
    );
  return (
    <nav aria-label="Project view" className="inline-flex rounded-xl border border-ink-200 bg-white p-[3px]">
      <Link href="/admin/projects" aria-current={!listView ? "page" : undefined} className={item(!listView)}>
        <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
        Board
      </Link>
      <Link href="/admin/projects?view=list" aria-current={listView ? "page" : undefined} className={item(listView)}>
        <List className="h-3.5 w-3.5" aria-hidden="true" />
        List
      </Link>
    </nav>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────

function ProjectBoard({ rows }: { rows: ProjectRow[] }) {
  const columns = PROJECT_PIPELINE.map((status) => {
    const projects = rows.filter((row) => row.status === status);
    return {
      status,
      meta: PROJECT_STATUS[status],
      projects,
      value: projects.reduce((sum, row) => sum + (row.valueFils ?? 0), 0),
    };
  });

  return (
    <>
      {/* Below xl the five columns don't fit and the board scrolls sideways.
          This strip names every column with its count, so none is hidden
          without a hint, and jumps straight to it. */}
      <nav aria-label="Board columns" className="mb-3 xl:hidden">
        <p className="mb-2 text-[0.74rem] text-ink-500">
          {columns.length} columns · scroll the board sideways or jump to one
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {columns.map(({ status, meta, projects }) => (
            <li key={status}>
              <a
                href={`#column-${status}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-[0.76rem] font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-haze"
              >
                <StatusDot tone={meta.tone} />
                {meta.label}
                <span className="tabular-nums text-ink-500">{projects.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Below xl: bleeds to the page gutters so columns scroll edge to edge.
          The negative margins match the main element's padding at each
          breakpoint, so the scroller never widens the page itself. From xl up
          the five columns share the width and nothing scrolls. */}
      <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:snap-none lg:px-8 xl:mx-0 xl:overflow-visible xl:px-0">
        <div className="flex w-max gap-4 xl:grid xl:w-full xl:grid-cols-5 xl:gap-3">
          {columns.map(({ status, meta, projects, value }) => {
            const headingId = `column-${status}-heading`;
            return (
              <section
                key={status}
                id={`column-${status}`}
                aria-labelledby={headingId}
                className="flex w-[17rem] shrink-0 snap-start scroll-mt-20 flex-col rounded-2xl border border-ink-100 bg-haze/60 p-2.5 lg:scroll-mt-4 xl:w-auto xl:min-w-0 xl:p-2"
              >
                <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1.5 pb-2.5 pt-1">
                  <h2
                    id={headingId}
                    className="flex min-w-0 items-center gap-2 font-display text-[0.86rem] font-bold text-ink-800"
                  >
                    <StatusDot tone={meta.tone} />
                    <span className="truncate">{meta.label}</span>
                    <span className="rounded-full bg-white px-1.5 py-px text-[0.68rem] font-semibold text-ink-600 ring-1 ring-ink-100">
                      {projects.length}
                    </span>
                  </h2>
                  {value > 0 && (
                    <span className="font-mono text-[0.65rem] text-ink-600 tabular-nums" title={formatMoney(value)}>
                      {formatMoneyCompact(value)}
                    </span>
                  )}
                </header>

                {projects.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-200 px-3 py-8 text-center text-[0.78rem] text-ink-600">
                    No projects
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5 xl:gap-2">
                    {projects.map((row) => (
                      <li key={row.id}>
                        <ProjectCard row={row} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ClientLine({ client }: { client: ProjectRow["client"] }) {
  if (!client) {
    return <span className="text-ink-500">No client</span>;
  }
  const Icon = client.company ? Building2 : UserRound;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
      <span className="truncate">{client.company ? `${client.company} · ${client.name}` : client.name}</span>
    </span>
  );
}

function ProjectCard({ row }: { row: ProjectRow }) {
  return (
    <article className="rounded-xl border border-ink-100 bg-white p-3.5 shadow-[0_1px_2px_rgb(7_38_60_/_0.04)] transition-shadow hover:shadow-[0_1px_2px_rgb(7_38_60_/_0.04),0_10px_24px_-16px_rgb(7_38_60_/_0.25)]">
      <h3 className="break-words text-[0.9rem] leading-snug">
        <Link
          href={`/admin/projects/${row.id}`}
          className="font-display font-bold text-ink-900 transition-colors hover:text-abyss-600"
        >
          {row.name}
        </Link>
      </h3>
      <div className="mt-1 text-[0.76rem] text-ink-500">
        <ClientLine client={row.client} />
      </div>

      <div className="mt-3 space-y-1.5 text-[0.76rem]">
        <p className="flex items-center gap-1.5 font-semibold text-ink-800 tabular-nums">
          <Wallet className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          {row.valueFils === null ? <span className="font-normal text-ink-500">No value set</span> : formatMoney(row.valueFils)}
        </p>
        <div>
          <DueDate date={row.dueDate} overdue={row.overdue} />
        </div>
      </div>

      <div className="mt-3">
        <TaskProgress done={row.done} total={row.total} label={`Task progress for ${row.name}`} />
      </div>

      {/* One row when there is room (the select takes the spare width). In the
          narrow xl columns it wraps: select on the first row, a full-width Move below. */}
      <form action={moveProject} className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        <input type="hidden" name="projectId" value={row.id} />
        <label htmlFor={`move-${row.id}`} className="sr-only">
          Move {row.name} to
        </label>
        <select
          id={`move-${row.id}`}
          name="status"
          defaultValue={row.status}
          className="h-8 min-w-0 flex-[999_1_7.5rem] cursor-pointer rounded-lg border border-ink-200 bg-white px-2 text-base font-medium text-ink-700 transition hover:border-ink-300 focus:border-azure-400 focus:outline-none focus:ring-4 focus:ring-azure-400/15 sm:text-[0.78rem]"
        >
          {PROJECT_PIPELINE.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS[status].label}
            </option>
          ))}
        </select>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Moving" className="grow">
          Move
        </SubmitButton>
      </form>
    </article>
  );
}

// ─── List ────────────────────────────────────────────────────────────────────

function ProjectTable({ rows }: { rows: ProjectRow[] }) {
  const order = new Map<string, number>(PROJECT_PIPELINE.map((status, index) => [status, index]));
  // Stable sort: keeps the due-date order from the query within each status.
  const sorted = [...rows].sort((a, b) => (order.get(a.status) ?? 0) - (order.get(b.status) ?? 0));

  return (
    <Card padded={false}>
      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Client</Th>
            <Th>Status</Th>
            <Th className="text-right">Value</Th>
            <Th>Due</Th>
            <Th className="w-48">Progress</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-haze/50">
              <Td className="max-w-[16rem]">
                <Link
                  href={`/admin/projects/${row.id}`}
                  className="font-semibold text-ink-900 transition-colors hover:text-abyss-600"
                >
                  {row.name}
                </Link>
              </Td>
              <Td className="max-w-[14rem]">
                {row.client ? (
                  <div className="min-w-0">
                    <p className="truncate text-ink-800">{row.client.name}</p>
                    {row.client.company && <p className="truncate text-[0.76rem] text-ink-500">{row.client.company}</p>}
                  </div>
                ) : (
                  <span className="text-ink-500">No client</span>
                )}
              </Td>
              <Td>
                <StatusBadge status={row.status} map={PROJECT_STATUS} />
              </Td>
              <Td className="whitespace-nowrap text-right font-medium text-ink-800 tabular-nums">
                {formatMoney(row.valueFils)}
              </Td>
              <Td className="whitespace-nowrap text-[0.8rem]">
                <DueDate date={row.dueDate} overdue={row.overdue} />
              </Td>
              <Td>
                <TaskProgress done={row.done} total={row.total} label={`Task progress for ${row.name}`} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

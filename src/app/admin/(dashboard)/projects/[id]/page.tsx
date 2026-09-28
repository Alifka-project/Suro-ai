import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  FileSignature,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Receipt,
  TriangleAlert,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/dal";
import { db } from "@/lib/db";
import { AGREEMENT_STATUS, INSTALLMENT_LABEL } from "@/lib/admin/agreement-terms";
import { DEFAULT_CURRENCY, documentTotals, formatMoney } from "@/lib/admin/money";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import {
  INVOICE_STATUS,
  LEAD_STATUS,
  PROJECT_STATUS,
  QUOTE_STATUS,
  TASK_STATUS,
  formatDate,
  initials,
  timeAgo,
} from "@/lib/admin/labels";
import { dueHint } from "@/lib/admin/time";
import {
  Badge,
  Card,
  CardHeader,
  Detail,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
  cn,
} from "@/components/admin/ui";
import { deleteProject, deleteTask, setTaskStatus } from "../actions";
import { AddTaskForm } from "../_components/AddTaskForm";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";
import { ProgressBar, StatusDot } from "../_components/bits";
import { ProjectForm } from "../_components/ProjectForm";
import { TaskStatusButtons } from "../_components/TaskStatusButtons";
import { isPastDue, progressPercent, toProjectFormValues } from "../_lib/format";
import { getLeadOptions } from "../_lib/queries";

type Params = Promise<{ id: string }>;

const TASK_GROUPS = ["TODO", "DOING", "DONE"] as const;
const EMPTY_GROUP_TEXT: Record<(typeof TASK_GROUPS)[number], string> = {
  TODO: "Nothing queued.",
  DOING: "Nothing in progress.",
  DONE: "Nothing finished yet.",
};

/**
 * formatMoney joins the currency and the number with a no-break space, so a
 * narrow cell could only wrap by splitting the digits. A plain space lets it
 * break between "AED" and the amount instead.
 */
function breakableMoney(fils: number | null): string {
  return formatMoney(fils).replace(/\u00a0/g, " ");
}

/** Shared by generateMetadata and the page — one query per request. */
const getProject = cache(async (id: string) => {
  await requireAdmin();
  return db.project.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, fullName: true, companyName: true, email: true, status: true } },
      agreement: {
        select: {
          id: true,
          number: true,
          status: true,
          totalFils: true,
          currency: true,
          signedAt: true,
          quote: { select: { id: true, number: true, status: true } },
        },
      },
      tasks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      invoices: {
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          vatBps: true,
          leadId: true,
          clientName: true,
          clientCompany: true,
          installment: true,
          agreement: { select: { number: true } },
          items: { select: { quantity: true, unitPriceFils: true } },
        },
      },
    },
  });
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? project.name : "Project not found" };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const leads = await getLeadOptions(project.leadId);
  const now = new Date();

  // ── Tasks ──
  const grouped = {
    TODO: project.tasks.filter((task) => task.status === "TODO"),
    DOING: project.tasks.filter((task) => task.status === "DOING"),
    DONE: project.tasks.filter((task) => task.status === "DONE"),
  };
  const totalTasks = project.tasks.length;
  const doneTasks = grouped.DONE.length;
  const percent = progressPercent(doneTasks, totalTasks);

  // ── Schedule ──
  const isDone = project.status === "DONE";
  const overdue = !isDone && isPastDue(project.dueDate, now);

  // ── Billing: totals are always computed from line items, never stored ──
  const invoices = project.invoices.map((invoice) => {
    const totals = documentTotals(invoice.items, invoice.vatBps);
    return {
      ...invoice,
      effectiveStatus: effectiveInvoiceStatus(invoice, now),
      subtotalFils: totals.subtotalFils,
      totalFils: totals.totalFils,
      // Billed to someone other than the project's current client (e.g. the client was changed later).
      billedElsewhere: invoice.leadId !== project.leadId,
    };
  });
  const billable = invoices.filter((invoice) => invoice.status !== "VOID");
  // Project value is in AED; an invoice in another currency can't be summed with it.
  const comparable = billable.filter((invoice) => invoice.currency === DEFAULT_CURRENCY);
  const otherCurrencyCount = billable.length - comparable.length;
  // The project value is the agreed fee before VAT, so it is compared with
  // invoice subtotals. VAT-inclusive totals are what the client actually pays.
  const invoicedNetFils = comparable.reduce((sum, invoice) => sum + invoice.subtotalFils, 0);
  const invoicedGrossFils = comparable.reduce((sum, invoice) => sum + invoice.totalFils, 0);
  const receivedFils = comparable
    .filter((invoice) => invoice.status === "PAID")
    .reduce((sum, invoice) => sum + invoice.totalFils, 0);
  const valueFils = project.valueFils;
  // A value of 0 leaves nothing to invoice against, just like no value: no
  // percentage and no "left to invoice" / "over value" figure for either.
  const hasValue = valueFils !== null && valueFils > 0;
  const invoicedPercent = hasValue ? Math.round((invoicedNetFils / valueFils) * 100) : null;
  const remainingFils = hasValue ? valueFils - invoicedNetFils : null;

  const invoiceQuery = new URLSearchParams({ projectId: project.id });
  if (project.leadId) invoiceQuery.set("leadId", project.leadId);
  const newInvoiceHref = `/admin/billing/invoices/new?${invoiceQuery.toString()}`;

  const lead = project.lead;
  const agreement = project.agreement;

  return (
    <>
      <Link
        href="/admin/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All projects
      </Link>

      <PageHeader
        eyebrow="Project"
        // PageHeader truncates its title to one line; a project name should wrap instead.
        title={<span className="block whitespace-normal break-words">{project.name}</span>}
        description={
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={project.status} map={PROJECT_STATUS} />
            {lead ? (
              <Link
                href={`/admin/crm/${lead.id}`}
                className="inline-flex items-center gap-1 font-medium text-abyss-600 hover:underline"
              >
                {lead.companyName ?? lead.fullName}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <span className="text-ink-500">No client</span>
            )}
            <span className="text-[0.8rem] text-ink-500">Updated {timeAgo(project.updatedAt)}</span>
          </span>
        }
        actions={
          <>
            <LinkButton href="#edit" variant="secondary">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </LinkButton>
            <LinkButton href={newInvoiceHref}>
              <Receipt className="h-4 w-4" aria-hidden="true" />
              Create invoice
            </LinkButton>
          </>
        }
      />

      {/* ── Row 1: progress + schedule/budget ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-[0.98rem] font-bold text-ink-900">Progress</h2>
              <p className="mt-0.5 text-[0.8rem] text-ink-500">
                {totalTasks === 0
                  ? "No tasks yet — add the first one below."
                  : `${doneTasks} of ${totalTasks} tasks done`}
              </p>
            </div>
            <p className="font-display text-[2rem] font-bold leading-none text-ink-900 tabular-nums">
              {percent}
              <span className="text-[1rem] text-ink-500">%</span>
            </p>
          </div>
          <div className="mt-5">
            <ProgressBar size="lg" value={percent} label="Tasks completed" />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {TASK_GROUPS.map((status) => (
              <div key={status} className="min-w-0 rounded-xl border border-ink-100 bg-canvas/70 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-500">
                  <StatusDot tone={TASK_STATUS[status].tone} />
                  {TASK_STATUS[status].label}
                </dt>
                <dd className="mt-1 font-display text-[1.25rem] font-bold text-ink-900 tabular-nums">
                  {grouped[status].length}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Schedule & budget" />
          {/* One column while this card is at its narrowest (lg), so dates and amounts never break mid-value. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-1 xl:grid-cols-2">
            <Detail label="Start">{formatDate(project.startDate)}</Detail>
            <Detail label="Due">
              <span className="flex flex-wrap items-center gap-1.5">
                {formatDate(project.dueDate)}
                {overdue && <Badge tone="red">Overdue</Badge>}
              </span>
              {project.dueDate && !isDone && (
                <span className={cn("mt-0.5 block text-[0.72rem]", overdue ? "text-red-600" : "text-ink-500")}>
                  {dueHint(project.dueDate, now)}
                </span>
              )}
            </Detail>
            <Detail label="Project value">
              <span className="tabular-nums">{breakableMoney(valueFils)}</span>
              {valueFils !== null && <span className="mt-0.5 block text-[0.72rem] text-ink-500">excl. VAT</span>}
            </Detail>
            <Detail label="Invoiced">
              <span className="tabular-nums">{breakableMoney(invoicedNetFils)}</span>
              <span className="mt-0.5 block text-[0.72rem] text-ink-500">
                excl. VAT{invoicedGrossFils > 0 && ` · ${breakableMoney(invoicedGrossFils)} incl.`}
              </span>
            </Detail>
          </dl>

          <div className="mt-5 border-t border-ink-100 pt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.74rem]">
              <span className="text-ink-500">Invoiced against value</span>
              <span className="font-semibold text-ink-700 tabular-nums">
                {invoicedPercent !== null ? `${invoicedPercent}%` : valueFils === 0 ? "Zero value" : "No value set"}
              </span>
            </div>
            <ProgressBar tone="mint" value={invoicedPercent ?? 0} label="Invoiced against project value, before VAT" />
            <p className="mt-2 text-[0.74rem] text-ink-500">
              {remainingFils !== null &&
                (remainingFils >= 0
                  ? `${formatMoney(remainingFils)} left to invoice · `
                  : `${formatMoney(-remainingFils)} over value · `)}
              {formatMoney(receivedFils)} received incl. VAT
            </p>
            {otherCurrencyCount > 0 && (
              <p className="mt-1 text-[0.72rem] text-amber-700">
                Excludes {otherCurrencyCount} invoice{otherCurrencyCount === 1 ? "" : "s"} in another currency.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Row 2: tasks + overview/invoices ── */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Tasks"
            subtitle={totalTasks === 0 ? "Break the work into steps to track progress." : `${totalTasks} total · ${doneTasks} done`}
          />
          <AddTaskForm projectId={project.id} />

          {totalTasks === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={ListChecks}
                title="No tasks yet"
                description="Add the first task above. Progress on the board updates as tasks move to done."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {TASK_GROUPS.map((status) => {
                const tasks = grouped[status];
                const headingId = `tasks-${status}`;
                return (
                  <section key={status} aria-labelledby={headingId}>
                    <h3
                      id={headingId}
                      className="mb-2 flex items-center gap-2 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink-500"
                    >
                      <StatusDot tone={TASK_STATUS[status].tone} />
                      {TASK_STATUS[status].label}
                      <span className="text-ink-600 tabular-nums">{tasks.length}</span>
                    </h3>
                    {tasks.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-[0.8rem] text-ink-500">
                        {EMPTY_GROUP_TEXT[status]}
                      </p>
                    ) : (
                      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                        {tasks.map((task) => {
                          const taskDone = task.status === "DONE";
                          const taskOverdue = !taskDone && isPastDue(task.dueDate, now);
                          return (
                            // Wraps instead of squeezing: the title never gets less than
                            // 12rem beside the controls; below that (or while a delete
                            // is being confirmed) the controls drop under it.
                            <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                              <div className="min-w-0 flex-[1_1_12rem]">
                                <p
                                  className={cn(
                                    "break-words text-[0.86rem]",
                                    taskDone
                                      ? "text-ink-500 line-through decoration-ink-400"
                                      : "font-medium text-ink-800",
                                  )}
                                >
                                  {task.title}
                                </p>
                                {task.dueDate && (
                                  <p
                                    className={cn(
                                      "mt-0.5 flex items-center gap-1 text-[0.72rem]",
                                      taskOverdue ? "font-medium text-red-600" : "text-ink-500",
                                    )}
                                  >
                                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    {taskOverdue ? `Overdue · was due ${formatDate(task.dueDate)}` : `Due ${formatDate(task.dueDate)}`}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <form action={setTaskStatus}>
                                  <input type="hidden" name="projectId" value={project.id} />
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <TaskStatusButtons current={task.status} taskTitle={task.title} />
                                </form>
                                <form action={deleteTask}>
                                  <input type="hidden" name="projectId" value={project.id} />
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <ConfirmSubmit compact label={`Delete task “${task.title}”`} />
                                </form>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Overview"
              action={
                lead && (
                  <Link
                    href={`/admin/crm/${lead.id}`}
                    className="shrink-0 text-[0.78rem] font-semibold text-abyss-600 hover:underline"
                  >
                    Open opportunity
                  </Link>
                )
              }
            />
            {lead ? (
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-abyss-600 to-aqua-500 font-display text-[0.8rem] font-bold text-white"
                >
                  {initials(lead.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{lead.fullName}</p>
                  <p className="truncate text-[0.8rem] text-ink-500">{lead.companyName ?? "Individual client"}</p>
                  {/* Contact details are optional in the CRM. */}
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="mt-0.5 block truncate text-[0.8rem] text-abyss-600 hover:underline"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-[0.8rem] text-ink-500">No email on file</p>
                  )}
                  <div className="mt-2">
                    <StatusBadge status={lead.status} map={LEAD_STATUS} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[0.84rem] text-ink-500">
                No client linked.{" "}
                <a href="#edit" className="font-medium text-abyss-600 hover:underline">
                  Link a lead
                </a>{" "}
                in the edit form.
              </p>
            )}

            <dl className="mt-5 space-y-4 border-t border-ink-100 pt-4">
              <Detail label="Description">
                {project.description ? (
                  <span className="block whitespace-pre-line text-ink-700">{project.description}</span>
                ) : (
                  <span className="text-ink-500">No description yet.</span>
                )}
              </Detail>
              <Detail label="Created">{formatDate(project.createdAt)}</Detail>
            </dl>
          </Card>

          {agreement && (
            <Card>
              <CardHeader
                title="Service agreement"
                subtitle="The terms and SOW this project delivers."
                action={<StatusBadge status={agreement.status} map={AGREEMENT_STATUS} />}
              />
              <ul className="-mx-2 space-y-0.5">
                <li>
                  <Link
                    href={`/admin/billing/agreements/${agreement.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-haze"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FileSignature className="h-4 w-4 shrink-0 text-abyss-600" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[0.78rem] font-medium text-ink-800">
                          {agreement.number}
                        </span>
                        <span className="block text-[0.72rem] text-ink-500">
                          {formatMoney(agreement.totalFils, agreement.currency)} incl. VAT
                          {agreement.signedAt ? ` · signed ${formatDate(agreement.signedAt)}` : ""}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                  </Link>
                </li>
                {agreement.quote && (
                  <li>
                    <Link
                      href={`/admin/billing/quotes/${agreement.quote.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-haze"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[0.78rem] font-medium text-ink-800">
                            {agreement.quote.number}
                          </span>
                          <span className="block text-[0.72rem] text-ink-500">Quotation</span>
                        </span>
                      </span>
                      <StatusBadge status={agreement.quote.status} map={QUOTE_STATUS} />
                    </Link>
                  </li>
                )}
              </ul>
              <Link
                href={`/admin/billing/agreements/${agreement.id}#payment-schedule`}
                className="mt-3 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-abyss-600 hover:underline"
              >
                Payment schedule
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Invoices"
              subtitle={invoices.length > 0 ? `${formatMoney(invoicedGrossFils)} invoiced incl. VAT` : undefined}
              action={
                <LinkButton href={newInvoiceHref} variant="secondary" size="sm">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  New
                </LinkButton>
              }
            />
            {invoices.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                description="Invoices created for this project will show here."
              />
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      href={`/admin/billing/invoices/${invoice.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-haze"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[0.78rem] font-medium text-ink-800">{invoice.number}</p>
                        <p className="text-[0.72rem] text-ink-500">
                          {invoice.installment && invoice.agreement
                            ? `${INSTALLMENT_LABEL[invoice.installment]} · ${invoice.agreement.number} · `
                            : ""}
                          Due {formatDate(invoice.dueDate)}
                        </p>
                        {invoice.billedElsewhere && (
                          <p className="mt-0.5 flex items-start gap-1 text-[0.72rem] font-medium text-amber-700">
                            <TriangleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">
                              Billed to {invoice.clientCompany ?? invoice.clientName}, not this project’s client
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "text-[0.84rem] font-semibold tabular-nums",
                            invoice.status === "VOID" ? "text-ink-500 line-through" : "text-ink-900",
                          )}
                        >
                          {formatMoney(invoice.totalFils, invoice.currency)}
                        </span>
                        <StatusBadge status={invoice.effectiveStatus} map={INVOICE_STATUS} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* ── Row 3: edit + danger zone ── */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <section id="edit" aria-label="Edit project" className="min-w-0 lg:col-span-2">
          <Card className="sm:p-6">
            <CardHeader title="Edit project" subtitle="Update the details, schedule, value and client." />
            <ProjectForm
              mode="edit"
              projectId={project.id}
              version={project.updatedAt.toISOString()}
              initialValues={toProjectFormValues(project)}
              leads={leads}
            />
          </Card>
        </section>

        <Card className="min-w-0">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-[0.98rem] font-bold text-ink-900">Danger zone</h2>
          </div>
          <p className="text-[0.82rem] leading-relaxed text-ink-600">
            Deleting removes this project and its {totalTasks} task{totalTasks === 1 ? "" : "s"} permanently.
            {invoices.length > 0 &&
              ` ${invoices.length} linked invoice${invoices.length === 1 ? " is" : "s are"} kept in billing and unlinked from the project.`}
            {agreement && ` Service agreement ${agreement.number} is kept and can start a new project.`}
          </p>
          <form action={deleteProject} className="mt-4">
            <input type="hidden" name="projectId" value={project.id} />
            <ConfirmSubmit
              label="Delete project"
              confirmLabel="Yes, delete project"
              pendingLabel="Deleting"
              prompt={`Delete “${project.name}”? This can’t be undone.`}
            />
          </form>
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, FileSignature, FileText, FolderKanban, Plus, Receipt, type LucideIcon } from "lucide-react";
import { Badge, Card, CardHeader, StatusBadge, cn } from "@/components/admin/ui";
import { AGREEMENT_STATUS, INSTALLMENT_LABEL } from "@/lib/admin/agreement-terms";
import { effectiveInvoiceStatus, isQuoteLapsed } from "@/lib/admin/invoices";
import { INVOICE_STATUS, PROJECT_STATUS, QUOTE_STATUS } from "@/lib/admin/labels";
import { documentTotals, formatMoney } from "@/lib/admin/money";
import { formatBusinessDate } from "@/lib/admin/time";
import { plural } from "../../_lib/helpers";
import type { Opportunity } from "../_lib/queries";

/*
 * The opportunity's paperwork and delivery, in deal order: quotations ->
 * service agreements -> invoices -> projects. Every row links to its record,
 * and each section has an anchor the smart buttons jump to.
 */
export function LinkedRecords({ lead, now }: { lead: Opportunity; now: Date }) {
  const total = lead.quotes.length + lead.agreements.length + lead.invoices.length + lead.projects.length;
  // A live agreement with no project yet starts delivery from its SOW (tasks
  // and dates filled in, linked back to the agreement), not from a blank
  // project that the agreement would never know about.
  const sowAgreement = lead.agreements.find((a) => a.status !== "CANCELLED" && !a.project);

  return (
    <Card>
      <CardHeader
        title="Documents & delivery"
        subtitle={total > 0 ? `${plural(total, "record")} linked to this opportunity` : "Nothing linked yet."}
      />
      <div className="space-y-6">
        <Section
          id="quotations"
          title="Quotations"
          icon={FileText}
          count={lead.quotes.length}
          action={{ href: `/admin/billing/quotes/new?leadId=${lead.id}`, label: "New quotation" }}
          empty="No quotations yet. Price the work to move this opportunity to Proposal."
        >
          {lead.quotes.map((quote) => {
            const { totalFils } = documentTotals(quote.items, quote.vatBps);
            const lapsed = isQuoteLapsed(quote, now);
            return (
              <RecordRow
                key={quote.id}
                href={`/admin/billing/quotes/${quote.id}`}
                title={quote.number}
                mono
                meta={`Issued ${formatBusinessDate(quote.issueDate)} · Valid until ${formatBusinessDate(quote.validUntil)}`}
                badges={
                  <>
                    <StatusBadge status={quote.status} map={QUOTE_STATUS} />
                    {lapsed && <Badge tone="amber">Validity ended</Badge>}
                  </>
                }
                note={quote.agreement ? `Agreement ${quote.agreement.number}` : undefined}
                amount={formatMoney(totalFils, quote.currency)}
              />
            );
          })}
        </Section>

        <Section
          id="agreements"
          title="Service agreements"
          icon={FileSignature}
          count={lead.agreements.length}
          empty="Generated automatically, with its statement of work, when a quotation is accepted or the deal is marked won."
        >
          {lead.agreements.map((agreement) => (
            <RecordRow
              key={agreement.id}
              href={`/admin/billing/agreements/${agreement.id}`}
              title={agreement.number}
              mono
              subtitle={agreement.projectName}
              meta={`Effective ${formatBusinessDate(agreement.effectiveDate)}${agreement.quote ? ` · From ${agreement.quote.number}` : ""}`}
              badges={<StatusBadge status={agreement.status} map={AGREEMENT_STATUS} />}
              amount={formatMoney(agreement.totalFils, agreement.currency)}
            />
          ))}
        </Section>

        <Section
          id="invoices"
          title="Invoices"
          icon={Receipt}
          count={lead.invoices.length}
          action={{ href: `/admin/billing/invoices/new?leadId=${lead.id}`, label: "New invoice" }}
          empty="No invoices yet. Bill the agreement's deposit once it is signed."
        >
          {lead.invoices.map((invoice) => {
            const { totalFils } = documentTotals(invoice.items, invoice.vatBps);
            // Overdue once the due date's whole Dubai day has ended — the rule every module shares.
            const status = effectiveInvoiceStatus(invoice, now);
            const stage = invoice.installment ? INSTALLMENT_LABEL[invoice.installment] : null;
            const when =
              invoice.status === "PAID" && invoice.paidAt
                ? `Paid ${formatBusinessDate(invoice.paidAt)}`
                : `Due ${formatBusinessDate(invoice.dueDate)}`;
            return (
              <RecordRow
                key={invoice.id}
                href={`/admin/billing/invoices/${invoice.id}`}
                title={invoice.number}
                mono
                meta={[stage, when].filter(Boolean).join(" · ")}
                badges={<StatusBadge status={status} map={INVOICE_STATUS} />}
                note={invoice.agreement ? `Agreement ${invoice.agreement.number}` : undefined}
                amount={formatMoney(totalFils, invoice.currency)}
              />
            );
          })}
        </Section>

        <Section
          id="projects"
          title="Projects"
          icon={FolderKanban}
          count={lead.projects.length}
          action={
            sowAgreement
              ? {
                  href: `/admin/billing/agreements/${sowAgreement.id}`,
                  label: "Create project from SOW",
                  hint: `, on agreement ${sowAgreement.number}`,
                  icon: FileSignature,
                }
              : { href: `/admin/projects/new?leadId=${lead.id}`, label: "New project" }
          }
          empty={
            sowAgreement
              ? `No projects yet. Start delivery from the statement of work in ${sowAgreement.number}: its tasks and dates are filled in for you.`
              : "No projects yet. Start one once the agreement is signed."
          }
        >
          {lead.projects.map((project) => {
            const done = project.tasks.filter((t) => t.status === "DONE").length;
            const tasks = project.tasks.length;
            return (
              <RecordRow
                key={project.id}
                href={`/admin/projects/${project.id}`}
                title={project.name}
                meta={
                  tasks > 0
                    ? `${done} of ${tasks} tasks done`
                    : project.dueDate
                      ? `Due ${formatBusinessDate(project.dueDate)}`
                      : "No tasks yet"
                }
                badges={<StatusBadge status={project.status} map={PROJECT_STATUS} />}
                amount={project.valueFils !== null ? formatMoney(project.valueFils) : undefined}
                progress={tasks > 0 ? done / tasks : undefined}
              />
            );
          })}
        </Section>
      </div>
    </Card>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  count,
  action,
  empty,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  count: number;
  /** `hint` is read after the label by screen readers; `icon` replaces the default plus. */
  action?: { href: string; label: string; hint?: string; icon?: LucideIcon };
  empty: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  const ActionIcon = action?.icon ?? Plus;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3
          id={headingId}
          className="flex items-center gap-1.5 font-mono text-[0.64rem] font-medium uppercase tracking-[0.14em] text-ink-550"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {title}
          {count > 0 && <span className="tabular-nums">({count})</span>}
        </h3>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.76rem] font-semibold text-abyss-600 transition-colors hover:bg-haze"
          >
            <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {action.label}
            {action.hint && <span className="sr-only">{action.hint}</span>}
          </Link>
        )}
      </div>
      {count > 0 ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-[0.78rem] leading-snug text-ink-600">
          {empty}
        </p>
      )}
    </section>
  );
}

function RecordRow({
  href,
  title,
  subtitle,
  meta,
  badges,
  note,
  amount,
  mono = false,
  progress,
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta: string;
  badges: ReactNode;
  /** A cross-reference shown as a small chip, e.g. the agreement a quotation produced. */
  note?: string;
  amount?: string;
  mono?: boolean;
  /** 0..1 task completion, drawn as a thin bar. */
  progress?: number;
}) {
  // Laid out from the row's own width (a container query), so in a narrow
  // column the status and amount drop below the title instead of squeezing it.
  return (
    <li className="@container">
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-xl border border-ink-100 px-3 py-2.5 transition-colors hover:border-azure-300 hover:bg-haze/50 @md:flex-row @md:items-start @md:justify-between @md:gap-4"
      >
        <div className="min-w-0 @md:flex-1">
          <p
            className={cn(
              "flex items-center gap-1 font-semibold text-ink-900 group-hover:text-abyss-600",
              mono ? "font-mono text-[0.8rem]" : "text-[0.86rem]",
            )}
          >
            <span className="truncate">{title}</span>
            <ArrowUpRight
              className="h-3 w-3 shrink-0 text-ink-300 transition-colors group-hover:text-abyss-600"
              aria-hidden="true"
            />
          </p>
          {subtitle && <p className="mt-0.5 truncate text-[0.8rem] text-ink-700">{subtitle}</p>}
          <p className="mt-0.5 text-[0.74rem] text-ink-550">{meta}</p>
          {note && (
            <span className="mt-1.5 inline-flex rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[0.66rem] font-medium text-ink-600">
              {note}
            </span>
          )}
          {progress !== undefined && (
            <span aria-hidden="true" className="mt-1.5 block h-1 w-full max-w-60 overflow-hidden rounded-full bg-ink-100">
              <span
                className="block h-full rounded-full bg-linear-to-r from-azure-500 to-aqua-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 @md:shrink-0 @md:flex-col @md:items-end @md:justify-start @md:gap-1">
          <span className="flex flex-wrap items-center gap-1.5">{badges}</span>
          {amount && (
            <span className="whitespace-nowrap text-[0.82rem] font-semibold tabular-nums text-ink-800">{amount}</span>
          )}
        </div>
      </Link>
    </li>
  );
}

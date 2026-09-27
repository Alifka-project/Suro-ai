import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  FolderKanban,
  Mail,
  MessageCircle,
  Plus,
  Receipt,
  StickyNote,
} from "lucide-react";
import {
  Badge,
  Card,
  CardHeader,
  Detail,
  EmptyState,
  LinkButton,
  StatusBadge,
  buttonClass,
  cn,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import {
  INVOICE_STATUS,
  LEAD_PIPELINE,
  LEAD_STATUS,
  PROJECT_STATUS,
  QUOTE_STATUS,
  formatDate,
  formatDateTime,
} from "@/lib/admin/labels";
import { documentTotals, formatMoney } from "@/lib/admin/money";
import { db } from "@/lib/db";
import { DeleteLeadPanel } from "../_components/DeleteLeadPanel";
import { DeleteNoteButton } from "../_components/DeleteNoteButton";
import { LeadAvatar } from "../_components/LeadAvatar";
import { NoteForm } from "../_components/NoteForm";
import { StatusForm } from "../_components/StatusForm";
import { ValueForm } from "../_components/ValueForm";
import { companyLabel, plural, sourceLabel, telHref, whatsappNumber } from "../_lib/helpers";

type Params = Promise<{ id: string }>;

const lineSelect = { select: { quantity: true, unitPriceFils: true } } as const;

/**
 * One query for the whole page. `cache` shares the result between
 * generateMetadata and the page within a request; the admin check runs before
 * the database is touched on either path.
 */
const getLead = cache(async (id: string) => {
  await requireAdmin();
  return db.lead.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          currency: true,
          vatBps: true,
          validUntil: true,
          items: lineSelect,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          currency: true,
          vatBps: true,
          dueDate: true,
          paidAt: true,
          items: lineSelect,
        },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          dueDate: true,
          valueFils: true,
          tasks: { select: { status: true } },
        },
      },
    },
  });
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLead(id);
  return { title: lead ? `${lead.fullName} · CRM` : "Lead not found" };
}

export default async function LeadPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const now = new Date();
  const whatsapp = whatsappNumber(lead.phone);
  const isCompany = lead.clientType === "COMPANY";
  const linkedCount = lead.quotes.length + lead.invoices.length + lead.projects.length;

  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href="/admin/crm"
          className="inline-flex items-center gap-1.5 rounded-lg text-[0.8rem] font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All leads
        </Link>

        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <LeadAvatar name={lead.fullName} size="lg" />
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-ink-550">
                Lead · {sourceLabel(lead.source)}
              </p>
              <h1 className="mt-1 break-words font-display text-[1.6rem] font-bold leading-tight text-ink-900">
                {lead.fullName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.85rem] text-ink-500">
                <StatusBadge status={lead.status} map={LEAD_STATUS} />
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <span className="truncate">{companyLabel(lead)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <span>
                    Received{" "}
                    <time dateTime={lead.createdAt.toISOString()} title={formatDateTime(lead.createdAt)}>
                      {formatDate(lead.createdAt)}
                    </time>
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:shrink-0">
            <a href={`mailto:${lead.email}`} className={buttonClass("secondary")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </a>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("secondary")}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            )}
            <LinkButton href={`/admin/projects/new?leadId=${lead.id}`} variant="secondary">
              <FolderKanban className="h-4 w-4" aria-hidden="true" />
              Create project
            </LinkButton>
            <LinkButton href={`/admin/billing/quotes/new?leadId=${lead.id}`}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Create quote
            </LinkButton>
          </div>
        </div>
      </div>

      {/* ─── Body ───────────────────────────────────────────────────────────
          Below xl the two columns dissolve (display: contents) into one
          ordered stack: message, pipeline, details, notes, records, danger.
          Not lg: from 1024px the 256px sidebar is showing too, which would
          leave the side column ~220px wide — too narrow for its forms and
          related-record rows. */}
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-3 xl:items-start">
        <div className="contents xl:col-span-2 xl:flex xl:flex-col xl:gap-5">
          {/* Their message */}
          <Card className="order-1">
            <CardHeader
              title="Their message"
              subtitle={`Submitted ${formatDateTime(lead.createdAt)}`}
            />
            <blockquote className="whitespace-pre-wrap break-words rounded-xl border-l-[3px] border-azure-400 bg-haze/70 px-4 py-3.5 text-[0.95rem] leading-relaxed text-ink-800">
              {lead.message}
            </blockquote>
          </Card>

          {/* Details */}
          <Card className="order-3">
            <CardHeader title="Details" subtitle="Everything captured by the enquiry form." />
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Detail label="Client type">{isCompany ? "Company" : "Individual"}</Detail>
              <Detail label="Preferred contact">{lead.contactPreference}</Detail>
              <Detail label="Email">
                <a href={`mailto:${lead.email}`} className="text-abyss-600 hover:underline">
                  {lead.email}
                </a>
              </Detail>
              <Detail label="Phone">
                <a href={telHref(lead.phone)} className="text-abyss-600 hover:underline">
                  {lead.phone}
                </a>
              </Detail>
              <Detail label="Location">{[lead.city, lead.country].filter(Boolean).join(", ")}</Detail>
              <Detail label="Source">{sourceLabel(lead.source)}</Detail>
              {(isCompany || lead.companyName || lead.role || lead.companySize || lead.industry) && (
                <>
                  <Detail label="Company">{lead.companyName}</Detail>
                  <Detail label="Role">{lead.role}</Detail>
                  <Detail label="Company size">{lead.companySize}</Detail>
                  <Detail label="Industry">{lead.industry}</Detail>
                </>
              )}
              <Detail label="Services" className="sm:col-span-2">
                {lead.services.length > 0 ? (
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    {lead.services.map((service) => (
                      <Badge key={service} tone="blue">
                        {service}
                      </Badge>
                    ))}
                  </span>
                ) : null}
              </Detail>
              <Detail label="Current systems" className="sm:col-span-2">
                {lead.systems ? <span className="whitespace-pre-wrap">{lead.systems}</span> : null}
              </Detail>
              <Detail label="Timeline">{lead.timeline}</Detail>
              <Detail label="Budget">{lead.budget}</Detail>
            </dl>
          </Card>

          {/* Notes */}
          <Card className="order-4">
            <CardHeader
              title="Notes"
              subtitle={lead.notes.length > 0 ? `${plural(lead.notes.length, "note")}, newest first` : "Your private log for this lead."}
            />
            <NoteForm leadId={lead.id} />
            <div className="mt-5">
              {lead.notes.length > 0 ? (
                <ol className="space-y-3">
                  {lead.notes.map((note) => (
                    <li key={note.id} className="rounded-xl border border-ink-100 bg-canvas/70 px-4 py-3">
                      <p className="whitespace-pre-wrap break-words text-[0.88rem] leading-relaxed text-ink-800">
                        {note.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <time
                          dateTime={note.createdAt.toISOString()}
                          className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-600"
                        >
                          {formatDateTime(note.createdAt)}
                        </time>
                        <DeleteNoteButton
                          leadId={lead.id}
                          noteId={note.id}
                          noteLabel={formatDateTime(note.createdAt)}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  icon={StickyNote}
                  title="No notes yet"
                  description="Log calls, meetings and next steps so the whole history of this deal lives in one place."
                />
              )}
            </div>
          </Card>
        </div>

        <div className="contents xl:flex xl:flex-col xl:gap-5">
          {/* Pipeline */}
          <Card className="order-2">
            <CardHeader title="Pipeline" />
            <PipelineProgress status={lead.status} />
            <div className="mt-5 space-y-5">
              <StatusForm leadId={lead.id} status={lead.status} />
              <div className="border-t border-ink-100 pt-5">
                <ValueForm leadId={lead.id} valueFils={lead.estimatedValueFils} />
              </div>
            </div>
          </Card>

          {/* Related records */}
          <Card className="order-5">
            <CardHeader
              title="Related records"
              subtitle={linkedCount > 0 ? `${plural(linkedCount, "record")} linked to this lead` : "Nothing linked yet."}
            />
            <div className="space-y-5">
              <RelatedSection
                title="Quotes"
                icon={FileText}
                newHref={`/admin/billing/quotes/new?leadId=${lead.id}`}
                newLabel="New quote"
                empty="No quotes yet. Price up the work to move this lead to Proposal."
              >
                {lead.quotes.map((quote) => {
                  const { totalFils } = documentTotals(quote.items, quote.vatBps);
                  return (
                    <RelatedRow
                      key={quote.id}
                      href={`/admin/billing/quotes/${quote.id}`}
                      title={quote.number}
                      mono
                      meta={`Valid until ${formatDate(quote.validUntil)}`}
                      badge={<StatusBadge status={quote.status} map={QUOTE_STATUS} />}
                      amount={formatMoney(totalFils, quote.currency)}
                    />
                  );
                })}
              </RelatedSection>

              <RelatedSection
                title="Invoices"
                icon={Receipt}
                newHref={`/admin/billing/invoices/new?leadId=${lead.id}`}
                newLabel="New invoice"
                empty="No invoices yet."
              >
                {lead.invoices.map((invoice) => {
                  const { totalFils } = documentTotals(invoice.items, invoice.vatBps);
                  // Overdue only once the due date's whole Dubai calendar day has ended —
                  // the same rule Billing, Analytics and Projects use.
                  const status = effectiveInvoiceStatus(invoice, now);
                  return (
                    <RelatedRow
                      key={invoice.id}
                      href={`/admin/billing/invoices/${invoice.id}`}
                      title={invoice.number}
                      mono
                      meta={
                        invoice.status === "PAID" && invoice.paidAt
                          ? `Paid ${formatDate(invoice.paidAt)}`
                          : `Due ${formatDate(invoice.dueDate)}`
                      }
                      badge={<StatusBadge status={status} map={INVOICE_STATUS} />}
                      amount={formatMoney(totalFils, invoice.currency)}
                    />
                  );
                })}
              </RelatedSection>

              <RelatedSection
                title="Projects"
                icon={FolderKanban}
                newHref={`/admin/projects/new?leadId=${lead.id}`}
                newLabel="New project"
                empty="No projects yet. Start one once the deal is won."
              >
                {lead.projects.map((project) => {
                  const done = project.tasks.filter((t) => t.status === "DONE").length;
                  const total = project.tasks.length;
                  return (
                    <RelatedRow
                      key={project.id}
                      href={`/admin/projects/${project.id}`}
                      title={project.name}
                      meta={
                        total > 0
                          ? `${done}/${total} tasks done`
                          : project.dueDate
                            ? `Due ${formatDate(project.dueDate)}`
                            : "No tasks yet"
                      }
                      badge={<StatusBadge status={project.status} map={PROJECT_STATUS} />}
                      amount={project.valueFils !== null ? formatMoney(project.valueFils) : undefined}
                      progress={total > 0 ? done / total : undefined}
                    />
                  );
                })}
              </RelatedSection>
            </div>
          </Card>

          <div className="order-6">
            <DeleteLeadPanel
              leadId={lead.id}
              leadName={lead.fullName}
              noteCount={lead.notes.length}
              linkedCount={linkedCount}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page-local pieces ───────────────────────────────────────────────────────

/** Five open stages as a segmented bar; Lost sits outside the funnel. */
function PipelineProgress({ status }: { status: string }) {
  const stages = LEAD_PIPELINE.filter((s) => s !== "LOST");
  const index = (stages as readonly string[]).indexOf(status);
  const lost = status === "LOST";
  const won = status === "WON";

  return (
    <div>
      <div className="flex gap-1" aria-hidden="true">
        {stages.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              lost
                ? "bg-ink-200"
                : i <= index
                  ? won
                    ? "bg-mint-500"
                    : "bg-linear-to-r from-azure-500 to-aqua-500"
                  : "bg-ink-100",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-[0.76rem] text-ink-500">
        {lost
          ? "Marked as lost. Move it to an open stage to reopen the deal."
          : `Stage ${index + 1} of ${stages.length}: ${LEAD_STATUS[status]?.label ?? status}`}
      </p>
    </div>
  );
}

function RelatedSection({
  title,
  icon: Icon,
  newHref,
  newLabel,
  empty,
  children,
}: {
  title: string;
  icon: typeof FileText;
  newHref: string;
  newLabel: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="flex items-center gap-1.5 font-mono text-[0.64rem] font-medium uppercase tracking-[0.14em] text-ink-550">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {title}
          {children.length > 0 && <span className="tabular-nums">({children.length})</span>}
        </h3>
        <Link
          href={newHref}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.74rem] font-semibold text-abyss-600 transition-colors hover:bg-haze"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          {newLabel}
        </Link>
      </div>
      {children.length > 0 ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-[0.76rem] leading-snug text-ink-600">
          {empty}
        </p>
      )}
    </section>
  );
}

function RelatedRow({
  href,
  title,
  meta,
  badge,
  amount,
  mono = false,
  progress,
}: {
  href: string;
  title: string;
  meta: string;
  badge: ReactNode;
  amount?: string;
  mono?: boolean;
  /** 0..1 task completion, drawn as a thin bar. */
  progress?: number;
}) {
  // The row lays itself out from its own width (a container query), not the
  // viewport: in a narrow column the status and amount drop below the title
  // instead of squeezing it down to a couple of characters.
  return (
    <li className="@container">
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-xl border border-ink-100 px-3 py-2.5 transition-colors hover:border-azure-300 hover:bg-haze/50 @2xs:flex-row @2xs:items-start @2xs:justify-between @2xs:gap-3"
      >
        <div className="min-w-0 @2xs:flex-1">
          <p
            className={cn(
              "flex items-center gap-1 truncate font-semibold text-ink-900 group-hover:text-abyss-600",
              mono ? "font-mono text-[0.78rem]" : "text-[0.84rem]",
            )}
          >
            <span className="truncate">{title}</span>
            <ArrowUpRight
              className="h-3 w-3 shrink-0 text-ink-300 transition-colors group-hover:text-abyss-600"
              aria-hidden="true"
            />
          </p>
          <p className="mt-0.5 truncate text-[0.72rem] text-ink-600">{meta}</p>
          {progress !== undefined && (
            <span aria-hidden="true" className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-ink-100">
              <span
                className="block h-full rounded-full bg-linear-to-r from-azure-500 to-aqua-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 @2xs:shrink-0 @2xs:flex-col @2xs:items-end @2xs:justify-start @2xs:gap-1">
          {badge}
          {amount && (
            <span className="whitespace-nowrap text-[0.78rem] font-semibold tabular-nums text-ink-800">{amount}</span>
          )}
        </div>
      </Link>
    </li>
  );
}

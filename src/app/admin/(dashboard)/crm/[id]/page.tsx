import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ChevronRight,
  FilePlus2,
  FileSignature,
  FileText,
  FolderKanban,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  UserRound,
} from "lucide-react";
import type { AgreementStatus } from "@prisma/client";
import { Badge, Card, CardHeader, Detail, LinkButton, StatusBadge, buttonClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { AGREEMENT_STATUS } from "@/lib/admin/agreement-terms";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import { LEAD_STATUS, formatDate, formatDateTime } from "@/lib/admin/labels";
import { documentTotals, filsToInput, formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import {
  STAGE_PROBABILITY,
  effectiveProbability,
  isOpenStage,
  leadTitle,
  tagTone,
  weightedRevenueFils,
} from "@/lib/admin/pipeline";
import { formatBusinessDate, isPastDay, startOfBusinessDay, toDateInputValue } from "@/lib/admin/time";
import { db } from "@/lib/db";
import { ActivityActions, ActivityItem } from "../_components/ActivityList";
import { toActivityRow } from "../_components/ActivityRows";
import { CrmTabs } from "../_components/CrmTabs";
import { DeleteLeadPanel } from "../_components/DeleteLeadPanel";
import { LeadAvatar } from "../_components/LeadAvatar";
import { companyLabel, crmHref, plural, sourceLabel, telHref, whatsappNumber } from "../_lib/helpers";
import { DetailsCard, type DetailsValues } from "./_components/DetailsCard";
import { LinkedRecords } from "./_components/LinkedRecords";
import { PriorityStars } from "./_components/PriorityStars";
import { ScheduleActivity } from "./_components/ScheduleActivity";
import { SmartButtons, type SmartButton } from "./_components/SmartButtons";
import { StageControl, type LostInfo, type WonInfo } from "./_components/StageControl";
import { Timeline } from "./_components/Timeline";
import { getOpportunity, getTeam, type Opportunity } from "./_lib/queries";
import { describeWinPlan } from "./_lib/win-plan";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lead = await getOpportunity(id);
  return { title: lead ? `${leadTitle(lead)} · CRM` : "Opportunity not found" };
}

/** How far along each agreement status is, for the smart button's "most advanced" summary. */
const AGREEMENT_PROGRESS: Record<AgreementStatus, number> = { CANCELLED: 0, DRAFT: 1, SENT: 2, SIGNED: 3 };

/**
 * An opportunity, laid out like Odoo's lead form: status strip (stage bar,
 * won / lost), smart buttons, the editable opportunity, planned activities,
 * the chatter, and every quotation, agreement, invoice and project it led to.
 */
export default async function OpportunityPage({ params }: { params: Params }) {
  const me = await requireAdmin();
  const { id } = await params;
  const lead = await getOpportunity(id);
  if (!lead) notFound();

  const now = new Date();
  const [team, overdueActivities] = await Promise.all([
    getTeam(),
    // Same rule as the sidebar badge and the planner: open, due before today
    // began on the business clock, on an opportunity still in play.
    db.activity.count({
      where: { doneAt: null, dueDate: { lt: startOfBusinessDay(now) }, lead: { status: { not: "LOST" } } },
    }),
  ]);

  const title = leadTitle(lead);
  const whatsapp = lead.phone ? whatsappNumber(lead.phone) : null;
  const winPlan = describeWinPlan(lead, now);
  const activityRows = lead.activities.map((a) => toActivityRow(a, now));
  const overdueHere = activityRows.filter((a) => a.state === "overdue").length;

  // ─── Won / lost banners ───────────────────────────────────────────────────
  let won: WonInfo | null = null;
  if (lead.status === "WON") {
    const agreement = lead.agreements.find((a) => a.status !== "CANCELLED") ?? lead.agreements[0];
    const quote = lead.quotes.find((q) => q.status === "ACCEPTED") ?? lead.quotes.find((q) => q.id === agreement?.quote?.id);
    const links: WonInfo["links"] = [];
    if (agreement) links.push({ label: `Agreement ${agreement.number}`, href: `/admin/billing/agreements/${agreement.id}` });
    if (quote) links.push({ label: `Quotation ${quote.number}`, href: `/admin/billing/quotes/${quote.id}` });
    won = { date: lead.wonAt ? formatBusinessDate(lead.wonAt) : null, links };
  }
  const lost: LostInfo | null =
    lead.status === "LOST"
      ? {
          date: lead.lostAt ? formatBusinessDate(lead.lostAt) : null,
          reason: lead.lostReason,
          note: lead.lostNote,
          // Mirrors restoreLead: back to the open stage it was lost from, else New.
          restoreTo: LEAD_STATUS[isOpenStage(lead.stageBeforeLost) ? lead.stageBeforeLost : "NEW"].label,
        }
      : null;

  const linkedCount = lead.quotes.length + lead.agreements.length + lead.invoices.length + lead.projects.length;

  return (
    <>
      {/* An opportunity lives under the Leads list (/admin/crm/<id>), which is
          also where the sidebar places it, so both navs agree on one tab. */}
      <CrmTabs active="leads" overdueActivities={overdueActivities} />

      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex min-w-0 items-center gap-1 text-[0.8rem] text-ink-550">
          <li className="shrink-0">
            <Link href="/admin/crm" className="rounded font-medium transition-colors hover:text-ink-900">
              Leads
            </Link>
          </li>
          <li aria-hidden="true" className="shrink-0">
            <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
          </li>
          <li className="shrink-0">
            <Link
              href={crmHref({ status: lead.status })}
              className="rounded font-medium transition-colors hover:text-ink-900"
            >
              {LEAD_STATUS[lead.status].label}
            </Link>
          </li>
          <li aria-hidden="true" className="shrink-0">
            <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
          </li>
          <li aria-current="page" className="min-w-0 truncate font-medium text-ink-800">
            {title}
          </li>
        </ol>
      </nav>

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <LeadAvatar name={lead.companyName || lead.fullName} size="lg" />
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-ink-550">
              Opportunity · {sourceLabel(lead.source)}
            </p>
            <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight text-ink-900 [overflow-wrap:anywhere]">
              {title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.86rem] text-ink-550">
              <StatusBadge status={lead.status} map={LEAD_STATUS} />
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="[overflow-wrap:anywhere]">
                  {lead.fullName}
                  {lead.role && <span className="text-ink-500">, {lead.role}</span>}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="[overflow-wrap:anywhere]">{companyLabel(lead)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:shrink-0 lg:justify-end">
          {lead.email && (
            <a href={`mailto:${lead.email}`} className={buttonClass("secondary")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </a>
          )}
          {lead.phone && (
            <a href={telHref(lead.phone)} className={buttonClass("secondary")}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary")}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <LinkButton href={`/admin/billing/quotes/new?leadId=${lead.id}`}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            New quotation
          </LinkButton>
        </div>
      </header>

      <StageControl leadId={lead.id} status={lead.status} winPlan={winPlan} won={won} lost={lost} />

      <SmartButtons items={smartButtons(lead, activityRows, now)} />

      {/* ─── Body ─────────────────────────────────────────────────────────────
          Odoo's layout: the form (details, documents, original enquiry), then
          the "chatter" (activities, timeline). From xl the chatter is a side
          column next to the form; below xl it follows the form, as on Odoo's
          mobile view. No CSS reordering, so the reading and focus order is the
          visual order at every width. The smart buttons above jump straight
          to the activities on a phone. */}
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <section id="details" aria-label="Opportunity details" className="min-w-0 scroll-mt-24">
            <DetailsCard
              leadId={lead.id}
              values={detailsValues(lead)}
              team={team}
              inactiveOwner={lead.owner && !lead.owner.active ? { id: lead.owner.id, name: lead.owner.name } : null}
              stageProbability={STAGE_PROBABILITY[lead.status]}
              probabilityHint={
                lead.status === "WON" || lead.status === "LOST"
                  ? `Fixed at ${STAGE_PROBABILITY[lead.status]}% while ${lead.status === "WON" ? "won" : "lost"}; used again if the deal reopens.`
                  : `Leave empty for the ${LEAD_STATUS[lead.status].label} default (${STAGE_PROBABILITY[lead.status]}%).`
              }
              readView={<DetailsReadView lead={lead} whatsapp={whatsapp} now={now} />}
            />
          </section>

          <section id="records" aria-label="Documents and delivery" className="min-w-0">
            <LinkedRecords lead={lead} now={now} />
          </section>

          {hasEnquiry(lead) && (
            <section id="enquiry" aria-label="Original enquiry" className="min-w-0 scroll-mt-24">
              <EnquiryCard lead={lead} />
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section id="activities" aria-label="Activities" className="min-w-0 scroll-mt-24">
            <Card>
              <ActivityActions>
                <CardHeader
                  title="Activities"
                  subtitle={
                    activityRows.length > 0
                      ? `${plural(activityRows.length, "planned activity", "planned activities")}${overdueHere > 0 ? ` · ${overdueHere} overdue` : ""}`
                      : "Nothing planned yet."
                  }
                  action={
                    <Link
                      href="/admin/crm/activities"
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.76rem] font-semibold text-abyss-600 transition-colors hover:bg-haze"
                    >
                      Planner
                    </Link>
                  }
                />
                {activityRows.length > 0 ? (
                  <ol className="space-y-2">
                    {activityRows.map((row) => (
                      <ActivityItem key={row.id} activity={row} />
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-[0.78rem] leading-snug text-ink-600">
                    Schedule the next call, email or meeting so this opportunity never goes cold.
                  </p>
                )}
                <div className="mt-4">
                  <ScheduleActivity leadId={lead.id} team={team} meId={me.id} today={toDateInputValue(now)} />
                </div>
              </ActivityActions>
            </Card>
          </section>

          <section id="timeline" aria-label="Timeline" className="min-w-0 scroll-mt-24">
            <Timeline leadId={lead.id} entries={lead.notes} origin={timelineOrigin(lead)} />
          </section>

          <div className="min-w-0">
            <DeleteLeadPanel
              leadId={lead.id}
              leadName={title}
              noteCount={lead.notes.length}
              activityCount={lead._count.activities}
              linkedCount={linkedCount}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page-local pieces ───────────────────────────────────────────────────────

/**
 * The events that record an opportunity's arrival: website intake logs
 * "Enquiry received via the website form." (api/contact), quick create and
 * the demo seed log "Opportunity created in <stage>.".
 */
const ARRIVAL_EVENT = /^(Enquiry received|Opportunity created)\b/;

/**
 * The timeline's synthetic first entry, only for leads that arrived before
 * arrivals were logged; otherwise the real event already says it.
 */
function timelineOrigin(lead: Opportunity): { at: Date; text: string } | null {
  if (lead.notes.some((n) => n.kind === "EVENT" && ARRIVAL_EVENT.test(n.body))) return null;
  if (lead.source === "website") return { at: lead.createdAt, text: "Enquiry received from the website contact form." };
  if (lead.source === "demo") return { at: lead.createdAt, text: "Created from demo data." };
  return null;
}

function detailsValues(lead: Opportunity): DetailsValues {
  return {
    title: lead.title ?? "",
    fullName: lead.fullName,
    clientType: lead.clientType,
    companyName: lead.companyName ?? "",
    role: lead.role ?? "",
    industry: lead.industry ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    city: lead.city ?? "",
    country: lead.country ?? "",
    value: filsToInput(lead.estimatedValueFils),
    probability: lead.probability === null ? "" : String(lead.probability),
    expectedCloseDate: toDateInputValue(lead.expectedCloseDate),
    tags: lead.tags.join(", "),
    ownerId: lead.ownerId ?? "",
  };
}

function smartButtons(lead: Opportunity, activities: { state: string }[], now: Date): SmartButton[] {
  // Declined and expired quotations are dead: they don't count toward the quoted total.
  const quotedFils = lead.quotes
    .filter((q) => q.status !== "DECLINED" && q.status !== "EXPIRED")
    .reduce((sum, q) => sum + documentTotals(q.items, q.vatBps).totalFils, 0);

  const bestAgreement = lead.agreements.reduce<(typeof lead.agreements)[number] | null>(
    (best, a) => (!best || AGREEMENT_PROGRESS[a.status] > AGREEMENT_PROGRESS[best.status] ? a : best),
    null,
  );

  let outstandingFils = 0;
  let overdueInvoices = 0;
  for (const invoice of lead.invoices) {
    const status = effectiveInvoiceStatus(invoice, now);
    if (status === "SENT" || status === "OVERDUE") outstandingFils += documentTotals(invoice.items, invoice.vatBps).totalFils;
    if (status === "OVERDUE") overdueInvoices++;
  }
  const paidInvoices = lead.invoices.filter((i) => i.status === "PAID").length;

  const activeProjects = lead.projects.filter((p) => p.status !== "DONE").length;
  const overdue = activities.filter((a) => a.state === "overdue").length;
  const today = activities.filter((a) => a.state === "today").length;

  return [
    {
      href: "#quotations",
      icon: FileText,
      count: lead.quotes.length,
      label: ["Quotation", "Quotations"],
      detail: quotedFils > 0 ? formatMoneyCompact(quotedFils) : lead.quotes.length > 0 ? "Nothing open" : "None yet",
    },
    {
      href: "#agreements",
      icon: FileSignature,
      count: lead.agreements.length,
      label: ["Agreement", "Agreements"],
      detail: bestAgreement ? AGREEMENT_STATUS[bestAgreement.status].label : "None yet",
      tone: bestAgreement?.status === "SIGNED" ? "mint" : "neutral",
    },
    {
      href: "#invoices",
      icon: Receipt,
      count: lead.invoices.length,
      label: ["Invoice", "Invoices"],
      detail:
        outstandingFils > 0
          ? `${formatMoneyCompact(outstandingFils)} ${overdueInvoices > 0 ? "overdue" : "due"}`
          : lead.invoices.length === 0
            ? "None yet"
            : paidInvoices > 0
              ? "Nothing outstanding"
              : "Not sent yet",
      tone: overdueInvoices > 0 ? "red" : outstandingFils > 0 ? "amber" : "neutral",
    },
    {
      href: "#projects",
      icon: FolderKanban,
      count: lead.projects.length,
      label: ["Project", "Projects"],
      detail:
        lead.projects.length === 0 ? "None yet" : activeProjects > 0 ? `${activeProjects} active` : "All done",
      tone: lead.projects.length > 0 && activeProjects === 0 ? "mint" : "neutral",
    },
    {
      href: "#activities",
      icon: CalendarClock,
      count: activities.length,
      label: ["Activity", "Activities"],
      detail:
        overdue > 0
          ? `${overdue} overdue`
          : today > 0
            ? `${today} due today`
            : activities.length > 0
              ? "On track"
              : "Nothing planned",
      tone: overdue > 0 ? "red" : today > 0 ? "amber" : activities.length > 0 ? "mint" : "neutral",
    },
  ];
}

function DetailsReadView({ lead, whatsapp, now }: { lead: Opportunity; whatsapp: string | null; now: Date }) {
  const decided = lead.status === "WON" || lead.status === "LOST";
  const closePassed = !decided && lead.expectedCloseDate !== null && isPastDay(lead.expectedCloseDate, now);
  const location = [lead.city, lead.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3">
        <Detail label="Expected revenue">
          <span className="font-display text-[1.05rem] font-bold tabular-nums text-ink-900">
            {formatMoney(lead.estimatedValueFils)}
          </span>
        </Detail>
        <Detail label="Probability">
          <span className="tabular-nums">{effectiveProbability(lead)}%</span>
          {!decided && lead.probability === null && <span className="text-ink-550"> · stage default</span>}
        </Detail>
        <Detail label="Weighted revenue">
          {lead.estimatedValueFils !== null ? (
            <span className="tabular-nums">{formatMoney(weightedRevenueFils(lead))}</span>
          ) : null}
        </Detail>
        <Detail label="Expected close">
          {lead.expectedCloseDate ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {formatBusinessDate(lead.expectedCloseDate)}
              {closePassed && <Badge tone="amber">Date passed</Badge>}
            </span>
          ) : null}
        </Detail>
        <Detail label="Salesperson">
          {lead.owner ? (
            <>
              {lead.owner.name}
              {!lead.owner.active && <span className="text-ink-550"> (deactivated)</span>}
            </>
          ) : (
            <span className="text-ink-550">Unassigned</span>
          )}
        </Detail>
        <Detail label="Created">
          <time dateTime={lead.createdAt.toISOString()} title={formatDateTime(lead.createdAt)}>
            {formatDate(lead.createdAt)}
          </time>
          <span className="text-ink-550"> · {sourceLabel(lead.source)}</span>
        </Detail>
        <Detail label="Priority" className="col-span-2 lg:col-span-1">
          <PriorityStars leadId={lead.id} priority={lead.priority} />
        </Detail>
        <Detail label="Tags" className="col-span-2">
          {lead.tags.length > 0 ? (
            <span className="mt-0.5 flex flex-wrap gap-1.5">
              {lead.tags.map((tag) => (
                <Badge key={tag} tone={tagTone(tag)}>
                  {tag}
                </Badge>
              ))}
            </span>
          ) : null}
        </Detail>
      </dl>

      <div className="border-t border-ink-100 pt-5">
        <h3 className="mb-3 font-mono text-[0.64rem] font-medium uppercase tracking-[0.14em] text-ink-550">Contact</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Detail label="Name">
            {lead.fullName}
            {lead.role && <span className="text-ink-550"> · {lead.role}</span>}
          </Detail>
          <Detail label={lead.clientType === "INDIVIDUAL" ? "Client" : "Company"}>
            {lead.clientType === "INDIVIDUAL" && !lead.companyName ? "Individual client" : companyLabel(lead)}
            {lead.industry && <span className="text-ink-550"> · {lead.industry}</span>}
          </Detail>
          <Detail label="Email">
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="text-abyss-600 [overflow-wrap:anywhere] hover:underline">
                {lead.email}
              </a>
            ) : null}
          </Detail>
          <Detail label="Phone">
            {lead.phone ? (
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                <a href={telHref(lead.phone)} className="text-abyss-600 hover:underline">
                  {lead.phone}
                </a>
                {whatsapp && (
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-mint-ink hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    WhatsApp
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </span>
            ) : null}
          </Detail>
          <Detail label="Location">{location || null}</Detail>
        </dl>
      </div>
    </div>
  );
}

function hasEnquiry(lead: Opportunity): boolean {
  return Boolean(
    lead.message || lead.services.length > 0 || lead.systems || lead.timeline || lead.budget || lead.companySize,
  );
}

function EnquiryCard({ lead }: { lead: Opportunity }) {
  return (
    <Card>
      <CardHeader
        title="Original enquiry"
        subtitle={
          lead.source === "website"
            ? `Submitted through the website form on ${formatDateTime(lead.createdAt)}`
            : `Captured on ${formatDateTime(lead.createdAt)}`
        }
      />
      {lead.message && (
        <blockquote className="mb-5 whitespace-pre-wrap break-words rounded-xl border-l-[3px] border-azure-400 bg-haze/70 px-4 py-3.5 text-[0.92rem] leading-relaxed text-ink-800">
          {lead.message}
        </blockquote>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
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
        <Detail label="Company size">{lead.companySize}</Detail>
        <Detail label="Preferred contact">{lead.contactPreference}</Detail>
      </dl>
    </Card>
  );
}

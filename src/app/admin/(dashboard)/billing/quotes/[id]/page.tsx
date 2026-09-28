import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarX,
  CircleCheck,
  CircleX,
  FileSignature,
  FolderKanban,
  Pencil,
  Receipt,
  Send,
  Target,
  Trash2,
  Undo2,
} from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import { Card, CardHeader, Detail, LinkButton, PageHeader, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { AGREEMENT_STATUS } from "@/lib/admin/agreement-terms";
import { isQuoteLapsed } from "@/lib/admin/invoices";
import { documentTotals, formatMoney, formatVat } from "@/lib/admin/money";
import { LEAD_STATUS, QUOTE_STATUS, timeAgo } from "@/lib/admin/labels";
import { leadTitle } from "@/lib/admin/pipeline";
import { calendarDaysBetween, formatBusinessDate, formatBusinessDateTime } from "@/lib/admin/time";
import { convertQuoteToInvoice, deleteDraftQuote, setQuoteStatus } from "../../actions";
import { generateAgreement } from "../../agreements/actions";
import { ActionButton, ActionNotices } from "../../_components/action-button";
import { BillingDocument } from "../../_components/billing-document";
import { BackLink, LinkedRecord, StatusNote } from "../../_components/detail-parts";
import { PrintButton } from "../../_components/print-button";
import { getQuote } from "../../_lib/queries";
import { QUOTE_TRANSITIONS } from "../../_lib/status";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quote = await getQuote((await params).id);
  // The title doubles as the file name when the quote is saved as a PDF, so
  // it skips the admin title template: no "SULOAI Admin" on the client's copy.
  return { title: quote ? { absolute: `${quote.number} · ${quote.clientName}` } : "Quote not found" };
}

const ICON = "h-4 w-4";

export default async function QuotePage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const now = new Date();
  const totals = documentTotals(quote.items, quote.vatBps);
  const invoice = quote.invoice;
  const agreement = quote.agreement;
  // Billed in stages through the agreement: the quote can't also be billed in full.
  const stagedInvoices = agreement?.invoices ?? [];
  const staged = stagedInvoices.length > 0;
  const signed = agreement?.status === "SIGNED";
  // An agreement that went out fixes the price, so a quote still in draft
  // can't be edited under it (the server enforces the same).
  const priceLocked = agreement?.status === "SENT" || signed;
  const editable = quote.status === "DRAFT" && !priceLocked;
  // Once billed in full the status is locked. Billed in stages or signed, it
  // can still move towards acceptance, but never back out of the deal:
  // un-accepted, declined or expired (the server enforces the same).
  const allowed: readonly QuoteStatus[] = invoice
    ? []
    : QUOTE_TRANSITIONS[quote.status].filter(
        (next) => !(staged || signed) || (quote.status !== "ACCEPTED" && next !== "DECLINED" && next !== "EXPIRED"),
      );
  const can = (s: QuoteStatus) => allowed.includes(s);
  // Calendar days on the business clock: the valid-until day itself still counts.
  const daysLeft = calendarDaysBetween(now, quote.validUntil);
  const lapsed = isQuoteLapsed(quote, now);
  const statusFields = (status: QuoteStatus) => ({ id: quote.id, status });

  let note: { tone: "neutral" | "red" | "amber" | "mint"; text: string };
  switch (quote.status) {
    case "DRAFT":
      note =
        agreement && priceLocked
          ? {
              tone: "amber",
              text: `Service agreement ${agreement.number} was ${signed ? "signed" : "sent"} at this price, so the quote is locked. Mark it as sent to record that the client has it.`,
            }
          : agreement && agreement.status === "DRAFT"
            ? {
                tone: "neutral",
                text: `Not sent yet. Send it together with service agreement ${agreement.number}: marking the agreement as sent marks this quote as sent too.`,
              }
            : { tone: "neutral", text: "Not sent yet. Print or save it as a PDF, send it to the client, then mark it as sent." };
      break;
    case "SENT":
      note = lapsed
        ? {
            tone: "amber",
            text: `Validity ended on ${formatBusinessDate(quote.validUntil)}. Mark it as expired or record the client's answer.`,
          }
        : {
            tone: "neutral",
            text: `Waiting for the client. Valid until ${formatBusinessDate(quote.validUntil)}${daysLeft <= 0 ? " (last day today)" : ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)`}.`,
          };
      break;
    case "ACCEPTED":
      note = invoice
        ? { tone: "mint", text: `Accepted and invoiced as ${invoice.number}.` }
        : staged && agreement
          ? { tone: "mint", text: `Accepted and billed in stages through service agreement ${agreement.number}.` }
          : agreement
            ? {
                tone: "mint",
                text: signed
                  ? `Accepted and signed as service agreement ${agreement.number}. Bill it in stages from its payment schedule, or convert it to one invoice.`
                  : `Accepted. Bill it in stages from service agreement ${agreement.number}'s payment schedule, or convert it to one invoice.`,
              }
            : { tone: "mint", text: "Accepted. Convert it to an invoice to bill the client — every line carries over." };
      break;
    case "DECLINED":
      note = { tone: "neutral", text: "The client declined this quote." };
      break;
    case "EXPIRED":
      note = { tone: "neutral", text: `This quote expired. It was valid until ${formatBusinessDate(quote.validUntil)}.` };
      break;
  }

  return (
    <>
      <div className="print:hidden">
        <BackLink href="/admin/billing?tab=quotes">All quotes</BackLink>
        <PageHeader
          eyebrow="Quotation"
          title={quote.number}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge status={quote.status} map={QUOTE_STATUS} />
              <span>
                {quote.clientName}
                {quote.clientCompany ? ` · ${quote.clientCompany}` : ""}
              </span>
            </span>
          }
          actions={
            <>
              {editable && (
                <LinkButton href={`/admin/billing/quotes/${quote.id}/edit`} variant="secondary">
                  <Pencil className={ICON} aria-hidden="true" />
                  Edit
                </LinkButton>
              )}
              <PrintButton />
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr]">
        {/* Status & actions — first on small screens, right column on wide ones. */}
        <section aria-label="Status and actions" className="min-w-0 print:hidden xl:col-start-2 xl:row-start-1">
          <Card>
            <CardHeader title="Status" action={<StatusBadge status={quote.status} map={QUOTE_STATUS} />} />
            <p className="font-display text-[1.5rem] font-bold leading-none tabular-nums text-ink-900">
              {formatMoney(totals.totalFils, quote.currency)}
            </p>
            <p className="mt-1 text-[0.75rem] text-ink-500">Quote total incl. {formatVat(quote.vatBps)} VAT</p>
            <StatusNote tone={note.tone}>{note.text}</StatusNote>

            {/* Keeps the outcome ("Service agreement … generated · opportunity
                marked Won") on screen after the button that caused it is gone. */}
            <ActionNotices className="mt-4">
              <div className="grid gap-2">
                {quote.status === "ACCEPTED" &&
                  (invoice ? (
                    <LinkButton href={`/admin/billing/invoices/${invoice.id}`} className="w-full">
                      <Receipt className={ICON} aria-hidden="true" />
                      View invoice {invoice.number}
                    </LinkButton>
                  ) : agreement ? (
                    <>
                      <LinkButton
                        href={`/admin/billing/agreements/${agreement.id}#payment-schedule`}
                        variant={staged ? "secondary" : "primary"}
                        className="w-full"
                      >
                        <FileSignature className={ICON} aria-hidden="true" />
                        {staged ? "Payment schedule" : "Bill in stages"}
                      </LinkButton>
                      {/* Hidden once a stage is invoiced: the server refuses a full conversion then. */}
                      {!staged && (
                        <ActionButton
                          action={convertQuoteToInvoice}
                          fields={{ id: quote.id }}
                          pendingLabel="Creating invoice"
                          confirm={{
                            title: "Bill the whole quote at once?",
                            description: `One invoice for the full amount, instead of the stages in ${agreement.number}. Stage invoices can't be created afterwards.`,
                            confirmLabel: "Convert to one invoice",
                            tone: "primary",
                          }}
                        >
                          <Receipt className={ICON} aria-hidden="true" />
                          Convert to one invoice
                        </ActionButton>
                      )}
                    </>
                  ) : (
                    <ActionButton
                      action={convertQuoteToInvoice}
                      fields={{ id: quote.id }}
                      variant="primary"
                      pendingLabel="Creating invoice"
                    >
                      <Receipt className={ICON} aria-hidden="true" />
                      Convert to invoice
                    </ActionButton>
                  ))}

                {can("SENT") && quote.status === "DRAFT" && (
                  <ActionButton
                    action={setQuoteStatus}
                    fields={statusFields("SENT")}
                    variant="primary"
                    pendingLabel="Updating"
                    confirm={{
                      title: `Mark ${quote.number} as sent?`,
                      description:
                        "The quote is locked for editing from now on, as a record of what the client received. Drafts can't be restored.",
                      confirmLabel: "Mark as sent",
                      tone: "primary",
                    }}
                  >
                    <Send className={ICON} aria-hidden="true" />
                    Mark as sent
                  </ActionButton>
                )}
                {can("ACCEPTED") && (
                  <ActionButton
                    action={setQuoteStatus}
                    fields={statusFields("ACCEPTED")}
                    variant="primary"
                    pendingLabel="Accepting"
                    confirm={{
                      title: `Mark ${quote.number} as accepted?`,
                      description: [
                        agreement
                          ? `Service agreement ${agreement.number} is kept${agreement.status === "DRAFT" ? " and refreshed to this price" : ""}.`
                          : "A draft service agreement is generated from this quote.",
                        quote.lead && quote.lead.status !== "WON" ? "The opportunity is marked Won." : "",
                      ]
                        .filter(Boolean)
                        .join(" "),
                      confirmLabel: "Mark accepted",
                      tone: "primary",
                    }}
                  >
                    <CircleCheck className={ICON} aria-hidden="true" />
                    Mark accepted
                  </ActionButton>
                )}
                {can("DECLINED") && (
                  <ActionButton action={setQuoteStatus} fields={statusFields("DECLINED")} pendingLabel="Updating">
                    <CircleX className={ICON} aria-hidden="true" />
                    Mark declined
                  </ActionButton>
                )}
                {can("EXPIRED") && (
                  <ActionButton action={setQuoteStatus} fields={statusFields("EXPIRED")} pendingLabel="Updating">
                    <CalendarX className={ICON} aria-hidden="true" />
                    Mark expired
                  </ActionButton>
                )}
                {/* With an agreement, the project starts from its SOW (tasks and dates filled in). */}
                {quote.status === "ACCEPTED" && quote.lead && !agreement && (
                  <LinkButton href={`/admin/projects/new?leadId=${quote.lead.id}`} variant="secondary" className="w-full">
                    <FolderKanban className={ICON} aria-hidden="true" />
                    Start a project
                  </LinkButton>
                )}

                {can("SENT") && quote.status !== "DRAFT" && (
                  <ActionButton action={setQuoteStatus} fields={statusFields("SENT")} variant="ghost" pendingLabel="Updating">
                    <Undo2 className={ICON} aria-hidden="true" />
                    {quote.status === "ACCEPTED" ? "Undo acceptance" : "Reopen as sent"}
                  </ActionButton>
                )}

                {quote.status === "DRAFT" && (
                  <>
                    {editable && (
                      <LinkButton href={`/admin/billing/quotes/${quote.id}/edit`} variant="secondary" className="w-full">
                        <Pencil className={ICON} aria-hidden="true" />
                        Edit draft
                      </LinkButton>
                    )}
                    {agreement ? (
                      <p className="rounded-xl bg-haze px-3 py-2.5 text-[0.76rem] text-ink-600">
                        {agreement.status === "DRAFT"
                          ? `To delete this draft, delete its draft agreement ${agreement.number} first.`
                          : `Service agreement ${agreement.number} was generated from this quote, so it stays on record.`}
                      </p>
                    ) : (
                      <ActionButton
                        action={deleteDraftQuote}
                        fields={{ id: quote.id }}
                        variant="danger"
                        pendingLabel="Deleting"
                        confirm={{
                          title: `Delete ${quote.number}?`,
                          description: "This draft and its line items will be permanently removed. This can't be undone.",
                          confirmLabel: "Delete draft",
                        }}
                      >
                        <Trash2 className={ICON} aria-hidden="true" />
                        Delete draft
                      </ActionButton>
                    )}
                  </>
                )}
              </div>
            </ActionNotices>
          </Card>

          <Card className="mt-6">
            <CardHeader
              title="Service agreement"
              action={agreement ? <StatusBadge status={agreement.status} map={AGREEMENT_STATUS} /> : undefined}
            />
            {agreement ? (
              <>
                <ul>
                  <LinkedRecord
                    href={`/admin/billing/agreements/${agreement.id}`}
                    icon={FileSignature}
                    label="Agreement + SOW"
                    title={agreement.number}
                    subtitle={`${formatMoney(agreement.totalFils, agreement.currency)} incl. VAT`}
                  />
                </ul>
                {agreement.status !== "CANCELLED" &&
                  (agreement.subtotalFils !== totals.subtotalFils || agreement.vatBps !== quote.vatBps) && (
                    <StatusNote tone="amber">
                      {agreement.status === "DRAFT"
                        ? "The draft agreement still has the earlier price. Refresh it from this quotation on the agreement page."
                        : `The agreement was ${agreement.status === "SIGNED" ? "signed" : "sent"} at a different price (${formatMoney(agreement.totalFils, agreement.currency)} incl. VAT). Its payment schedule is what gets billed in stages.`}
                    </StatusNote>
                  )}
                {staged && (
                  <StatusNote tone="neutral">
                    Billed in stages: {stagedInvoices.map((i) => i.number).join(", ")}.
                  </StatusNote>
                )}
              </>
            ) : quote.status === "DECLINED" || quote.status === "EXPIRED" ? (
              <p className="text-[0.82rem] text-ink-500">
                No agreement — this quote was {QUOTE_STATUS[quote.status].label.toLowerCase()}. Reopen it as sent to
                generate one.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[0.8rem] leading-relaxed text-ink-600">
                  {quote.status === "ACCEPTED"
                    ? "This quote has no service agreement yet."
                    : "Generated automatically when the quote is accepted. Need it for the proposal? Generate the draft now."}
                </p>
                <ActionButton
                  action={generateAgreement}
                  fields={{ quoteId: quote.id }}
                  variant={quote.status === "ACCEPTED" ? "primary" : "secondary"}
                  pendingLabel="Generating"
                >
                  <FileSignature className={ICON} aria-hidden="true" />
                  Generate service agreement
                </ActionButton>
              </>
            )}
          </Card>
        </section>

        {/* The document itself — the only thing that prints. */}
        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <BillingDocument
            kind="quote"
            number={quote.number}
            issueDate={quote.issueDate}
            secondDate={quote.validUntil}
            client={{ name: quote.clientName, email: quote.clientEmail, company: quote.clientCompany }}
            items={quote.items}
            vatBps={quote.vatBps}
            currency={quote.currency}
            notes={quote.notes}
          />
        </div>

        <aside className="min-w-0 space-y-6 print:hidden xl:col-start-2 xl:row-start-2 xl:self-start">
          <Card>
            <CardHeader title="Linked records" />
            {quote.lead || invoice || agreement ? (
              <ul className="space-y-2">
                {quote.lead && (
                  <LinkedRecord
                    href={`/admin/crm/${quote.lead.id}`}
                    icon={Target}
                    label={`Opportunity · ${LEAD_STATUS[quote.lead.status]?.label ?? quote.lead.status}`}
                    title={leadTitle(quote.lead)}
                    subtitle={quote.lead.companyName ? `${quote.lead.fullName} · ${quote.lead.companyName}` : quote.lead.fullName}
                  />
                )}
                {agreement && (
                  <LinkedRecord
                    href={`/admin/billing/agreements/${agreement.id}`}
                    icon={FileSignature}
                    label={`Service agreement · ${AGREEMENT_STATUS[agreement.status].label}`}
                    title={agreement.number}
                  />
                )}
                {agreement?.project && (
                  <LinkedRecord
                    href={`/admin/projects/${agreement.project.id}`}
                    icon={FolderKanban}
                    label="Project"
                    title={agreement.project.name}
                  />
                )}
                {invoice && (
                  <LinkedRecord
                    href={`/admin/billing/invoices/${invoice.id}`}
                    icon={Receipt}
                    label="Invoice"
                    title={invoice.number}
                  />
                )}
                {stagedInvoices.map((stage) => (
                  <LinkedRecord
                    key={stage.id}
                    href={`/admin/billing/invoices/${stage.id}`}
                    icon={Receipt}
                    label="Stage invoice"
                    title={stage.number}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-[0.82rem] text-ink-500">
                Not linked to a CRM opportunity.
                {quote.status === "DRAFT" && " Edit the draft to link one."}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Issued">{formatBusinessDate(quote.issueDate)}</Detail>
              <Detail label="Valid until">{formatBusinessDate(quote.validUntil)}</Detail>
              <Detail label="Subtotal">{formatMoney(totals.subtotalFils, quote.currency)}</Detail>
              <Detail label={`VAT ${formatVat(quote.vatBps)}`}>{formatMoney(totals.vatFils, quote.currency)}</Detail>
              <Detail label="Created">{formatBusinessDateTime(quote.createdAt)}</Detail>
              <Detail label="Updated">{timeAgo(quote.updatedAt)}</Detail>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}

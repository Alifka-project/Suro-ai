import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarX,
  CircleCheck,
  CircleX,
  FolderKanban,
  Pencil,
  Receipt,
  Send,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import { Card, CardHeader, Detail, LinkButton, PageHeader, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { isQuoteLapsed } from "@/lib/admin/invoices";
import { documentTotals, formatMoney, formatVat } from "@/lib/admin/money";
import { QUOTE_STATUS, timeAgo } from "@/lib/admin/labels";
import { calendarDaysBetween, formatBusinessDate, formatBusinessDateTime } from "@/lib/admin/time";
import { convertQuoteToInvoice, deleteDraftQuote, setQuoteStatus } from "../../actions";
import { ActionButton } from "../../_components/action-button";
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
  const allowed: readonly QuoteStatus[] = invoice ? [] : QUOTE_TRANSITIONS[quote.status];
  const can = (s: QuoteStatus) => allowed.includes(s);
  // Calendar days on the business clock: the valid-until day itself still counts.
  const daysLeft = calendarDaysBetween(now, quote.validUntil);
  const lapsed = isQuoteLapsed(quote, now);
  const statusFields = (status: QuoteStatus) => ({ id: quote.id, status });

  let note: { tone: "neutral" | "red" | "amber" | "mint"; text: string };
  switch (quote.status) {
    case "DRAFT":
      note = { tone: "neutral", text: "Not sent yet. Print or save it as a PDF, send it to the client, then mark it as sent." };
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
              {quote.status === "DRAFT" && (
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

            <div className="mt-4 grid gap-2">
              {quote.status === "ACCEPTED" &&
                (invoice ? (
                  <LinkButton href={`/admin/billing/invoices/${invoice.id}`} className="w-full">
                    <Receipt className={ICON} aria-hidden="true" />
                    View invoice {invoice.number}
                  </LinkButton>
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
                <ActionButton action={setQuoteStatus} fields={statusFields("ACCEPTED")} variant="primary" pendingLabel="Updating">
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
              {quote.status === "ACCEPTED" && quote.lead && (
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
                  <LinkButton href={`/admin/billing/quotes/${quote.id}/edit`} variant="secondary" className="w-full">
                    <Pencil className={ICON} aria-hidden="true" />
                    Edit draft
                  </LinkButton>
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
                </>
              )}
            </div>
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
            {quote.lead || invoice ? (
              <ul className="space-y-2">
                {quote.lead && (
                  <LinkedRecord
                    href={`/admin/crm/${quote.lead.id}`}
                    icon={UserRound}
                    label="Lead"
                    title={quote.lead.fullName}
                    subtitle={quote.lead.companyName}
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
              </ul>
            ) : (
              <p className="text-[0.82rem] text-ink-500">
                Not linked to a CRM lead.
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

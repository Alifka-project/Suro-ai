import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  Banknote,
  FileSignature,
  FileText,
  FolderKanban,
  Pencil,
  Send,
  Target,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Installment, InvoiceStatus } from "@prisma/client";
import { Card, CardHeader, Detail, LinkButton, PageHeader, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { AGREEMENT_STATUS, INSTALLMENT_LABEL } from "@/lib/admin/agreement-terms";
import { leadTitle } from "@/lib/admin/pipeline";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import { documentTotals, formatMoney, formatVat } from "@/lib/admin/money";
import { INVOICE_STATUS, timeAgo } from "@/lib/admin/labels";
import { billingBackHref, clientHref, moduleEnabled } from "@/lib/admin/modules";
import { calendarDaysBetween, formatBusinessDate, formatBusinessDateTime } from "@/lib/admin/time";
import { deleteDraftInvoice, setInvoiceStatus } from "../../actions";
import { ActionButton, ActionNotices } from "../../_components/action-button";
import { BillingDocument } from "../../_components/billing-document";
import { BackLink, LinkedRecord, StatusNote } from "../../_components/detail-parts";
import { PrintButton } from "../../_components/print-button";
import { getInvoice } from "../../_lib/queries";
import { INVOICE_TRANSITIONS, isSentMoveUseless } from "../../_lib/status";
import { INVOICE_TITLE } from "@/lib/admin/business";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const invoice = await getInvoice((await params).id);
  // The title doubles as the file name when the invoice is saved as a PDF, so
  // it skips the admin title template: no "SULOAI Admin" on the client's copy.
  return {
    title: invoice ? { absolute: `${invoice.number} · ${invoice.clientName}` } : "Invoice not found",
  };
}

const ICON = "h-4 w-4";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function InvoicePage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const now = new Date();
  const status = effectiveInvoiceStatus(invoice, now);
  const totals = documentTotals(invoice.items, invoice.vatBps);
  // Buttons follow the STORED status — that is what the server validates against.
  const allowed = INVOICE_TRANSITIONS[invoice.status];
  const can = (s: InvoiceStatus) => allowed.includes(s);
  const statusFields = (next: InvoiceStatus) => ({ id: invoice.id, status: next });

  // Switched-off modules (src/lib/admin/modules.ts) keep their data, but their
  // pages are never linked from here.
  const agreementsOn = moduleEnabled("agreements");
  const projectsOn = moduleEnabled("projects");
  const crmOn = moduleEnabled("crm");
  const back = billingBackHref("invoices");
  const shownProject = projectsOn ? invoice.project : null;

  // A stage of a service agreement's payment schedule: "Deposit (50%) of SA-2026-0001".
  const agreement = invoice.agreement;
  const stagePct: Record<Installment, number> | null = agreement
    ? { DEPOSIT: agreement.depositPct, MILESTONE: agreement.midpointPct, FINAL: agreement.finalPct }
    : null;
  const stage =
    agreement && stagePct && invoice.installment
      ? `${INSTALLMENT_LABEL[invoice.installment]} (${stagePct[invoice.installment]}%)`
      : null;

  let note: { tone: "neutral" | "red" | "amber" | "mint"; text: string };
  switch (status) {
    case "DRAFT":
      note = { tone: "neutral", text: "Not sent yet. Send it to the client, then mark it as sent to start tracking payment." };
      break;
    case "SENT": {
      // Calendar days on the business clock; a SENT invoice is never past due here.
      const left = calendarDaysBetween(now, invoice.dueDate);
      note = {
        tone: "neutral",
        text: `Awaiting payment. Due ${formatBusinessDate(invoice.dueDate)}${left <= 0 ? " (today)" : ` (in ${plural(left, "day")})`}.`,
      };
      break;
    }
    case "OVERDUE": {
      const late = calendarDaysBetween(invoice.dueDate, now);
      const due = formatBusinessDate(invoice.dueDate);
      note =
        late > 0
          ? { tone: "red", text: `Overdue by ${plural(late, "day")} — it was due ${due}. Follow up with the client.` }
          : late === 0
            ? { tone: "red", text: `Marked overdue, and due today (${due}). Follow up with the client.` }
            : {
                tone: "amber",
                text: `Marked overdue, but not due until ${due}. If that was a mistake, mark it as sent again.`,
              };
      break;
    }
    case "PAID":
      note = { tone: "mint", text: `Paid on ${formatBusinessDate(invoice.paidAt)}. Nothing outstanding.` };
      break;
    case "VOID":
      note = { tone: "neutral", text: "Voided. It stays on record for your books but no longer counts as outstanding." };
      break;
  }

  const stamp =
    status === "PAID"
      ? ({ label: "Paid", tone: "mint" } as const)
      : status === "VOID"
        ? ({ label: "Void", tone: "neutral" } as const)
        : null;

  const standing = status === "PAID" ? "paid" : status === "VOID" ? "void" : "open";

  const amountLabel =
    status === "PAID" ? "Amount paid" : status === "VOID" ? "Voided amount" : status === "DRAFT" ? "Invoice total" : "Amount due";

  return (
    <>
      <div className="print:hidden">
        <BackLink href={back.href}>{back.label}</BackLink>
        <PageHeader
          eyebrow={INVOICE_TITLE}
          title={invoice.number}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge status={status} map={INVOICE_STATUS} />
              <span>
                {invoice.clientName}
                {invoice.clientCompany ? ` · ${invoice.clientCompany}` : ""}
              </span>
              {agreement && (
                <span>
                  ·{" "}
                  {agreementsOn ? (
                    <Link
                      href={`/admin/billing/agreements/${agreement.id}#payment-schedule`}
                      className="font-medium text-abyss-600 hover:underline"
                    >
                      {stage ? `${stage} of ${agreement.number}` : agreement.number}
                    </Link>
                  ) : stage ? (
                    `${stage} of ${agreement.number}`
                  ) : (
                    agreement.number
                  )}
                </span>
              )}
            </span>
          }
          actions={
            <>
              {invoice.status === "DRAFT" && (
                <LinkButton href={`/admin/billing/invoices/${invoice.id}/edit`} variant="secondary">
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
            <CardHeader title="Status" action={<StatusBadge status={status} map={INVOICE_STATUS} />} />
            <p className="text-[0.75rem] text-ink-500">{amountLabel}</p>
            <p
              className={
                status === "VOID"
                  ? "mt-1 font-display text-[1.5rem] font-bold leading-none tabular-nums text-ink-500 line-through"
                  : "mt-1 font-display text-[1.5rem] font-bold leading-none tabular-nums text-ink-900"
              }
            >
              {formatMoney(totals.totalFils, invoice.currency)}
            </p>
            <StatusNote tone={note.tone}>{note.text}</StatusNote>

            {/* Keeps the outcome ("Invoice … paid. Client marked Goal.") on
                screen after the button that caused it is gone. */}
            <ActionNotices className="mt-4">
              <div className="grid gap-2">
                {can("SENT") && invoice.status === "DRAFT" && (
                  <ActionButton
                    action={setInvoiceStatus}
                    fields={statusFields("SENT")}
                    variant="primary"
                    pendingLabel="Updating"
                    confirm={{
                      title: `Mark ${invoice.number} as sent?`,
                      description:
                        "The invoice is locked for editing and starts counting towards outstanding. A sent invoice can only be voided and reissued, not edited.",
                      confirmLabel: "Mark as sent",
                      tone: "primary",
                    }}
                  >
                    <Send className={ICON} aria-hidden="true" />
                    Mark as sent
                  </ActionButton>
                )}

                {can("PAID") && (
                  <ActionButton action={setInvoiceStatus} fields={statusFields("PAID")} variant="primary" pendingLabel="Recording payment">
                    <Banknote className={ICON} aria-hidden="true" />
                    Mark as paid
                  </ActionButton>
                )}

                {/* Only while not yet past due: otherwise it would still show as overdue. */}
                {can("SENT") && invoice.status === "OVERDUE" && !isSentMoveUseless(invoice, now) && (
                  <ActionButton action={setInvoiceStatus} fields={statusFields("SENT")} pendingLabel="Updating">
                    <Undo2 className={ICON} aria-hidden="true" />
                    Mark as sent (not yet due)
                  </ActionButton>
                )}

                {can("SENT") && invoice.status === "PAID" && (
                  <ActionButton
                    action={setInvoiceStatus}
                    fields={statusFields("SENT")}
                    pendingLabel="Updating"
                    confirm={{
                      title: "Mark as unpaid?",
                      description: "The payment date is cleared and the invoice counts as outstanding again.",
                      confirmLabel: "Mark as unpaid",
                      tone: "primary",
                    }}
                  >
                    <Undo2 className={ICON} aria-hidden="true" />
                    Mark as unpaid
                  </ActionButton>
                )}

                {invoice.status === "DRAFT" && (
                  <LinkButton href={`/admin/billing/invoices/${invoice.id}/edit`} variant="secondary" className="w-full">
                    <Pencil className={ICON} aria-hidden="true" />
                    Edit draft
                  </LinkButton>
                )}

                {can("VOID") && (
                  <ActionButton
                    action={setInvoiceStatus}
                    fields={statusFields("VOID")}
                    variant="danger"
                    pendingLabel="Voiding"
                    confirm={{
                      title: `Void ${invoice.number}?`,
                      description:
                        "The invoice stays on record but no longer counts as outstanding. Void invoices can't be reopened — issue a new invoice if needed.",
                      confirmLabel: "Void invoice",
                    }}
                  >
                    <Ban className={ICON} aria-hidden="true" />
                    Void invoice
                  </ActionButton>
                )}

                {invoice.status === "DRAFT" && (
                  <ActionButton
                    action={deleteDraftInvoice}
                    fields={{ id: invoice.id }}
                    variant="danger"
                    pendingLabel="Deleting"
                    confirm={{
                      title: `Delete ${invoice.number}?`,
                      description: "This draft and its line items will be permanently removed. This can't be undone.",
                      confirmLabel: "Delete draft",
                    }}
                  >
                    <Trash2 className={ICON} aria-hidden="true" />
                    Delete draft
                  </ActionButton>
                )}
              </div>
            </ActionNotices>
          </Card>
        </section>

        {/* The document itself — the only thing that prints. */}
        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <BillingDocument
            kind="invoice"
            number={invoice.number}
            issueDate={invoice.issueDate}
            secondDate={invoice.dueDate}
            paidAt={status === "PAID" ? invoice.paidAt : null}
            standing={standing}
            client={{ name: invoice.clientName, email: invoice.clientEmail, company: invoice.clientCompany }}
            items={invoice.items}
            vatBps={invoice.vatBps}
            currency={invoice.currency}
            notes={invoice.notes}
            reference={
              agreement && stage
                ? `${stage} · Service Agreement ${agreement.number}`
                : invoice.quote
                  ? `Quotation ${invoice.quote.number}`
                  : null
            }
            paymentTerms={
              agreement && stage
                ? `Payment due within ${agreement.invoiceDueDays} ${agreement.invoiceDueDays === 1 ? "day" : "days"} of the invoice date, as per Section 2 of Service Agreement ${agreement.number}.`
                : null
            }
            stamp={stamp}
          />
        </div>

        <aside className="min-w-0 space-y-6 print:hidden xl:col-start-2 xl:row-start-2 xl:self-start">
          <Card>
            <CardHeader title="Linked records" />
            {invoice.lead || shownProject || invoice.quote || (agreementsOn && agreement) ? (
              <ul className="space-y-2">
                {invoice.lead && (
                  <LinkedRecord
                    href={clientHref(invoice.lead.id)}
                    icon={Target}
                    label={crmOn ? "Opportunity" : "Client"}
                    title={leadTitle(invoice.lead)}
                    subtitle={
                      invoice.lead.companyName ? `${invoice.lead.fullName} · ${invoice.lead.companyName}` : invoice.lead.fullName
                    }
                  />
                )}
                {agreementsOn && agreement && (
                  <LinkedRecord
                    href={`/admin/billing/agreements/${agreement.id}#payment-schedule`}
                    icon={FileSignature}
                    label={`Service agreement · ${AGREEMENT_STATUS[agreement.status].label}`}
                    title={agreement.number}
                    subtitle={stage ? `${stage} of the payment schedule` : "Voided stage invoice, since reissued"}
                  />
                )}
                {shownProject && (
                  <LinkedRecord
                    href={`/admin/projects/${shownProject.id}`}
                    icon={FolderKanban}
                    label="Project"
                    title={shownProject.name}
                  />
                )}
                {invoice.quote && (
                  <LinkedRecord
                    href={`/admin/billing/quotes/${invoice.quote.id}`}
                    icon={FileText}
                    label="From quote"
                    title={invoice.quote.number}
                  />
                )}
              </ul>
            ) : (
              <p className="text-[0.82rem] text-ink-500">
                Not linked to {crmOn ? "an opportunity" : "a client"}
                {projectsOn ? " or project" : ""}.
                {invoice.status === "DRAFT" && " Edit the draft to link one."}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Issued">{formatBusinessDate(invoice.issueDate)}</Detail>
              <Detail label="Due">{formatBusinessDate(invoice.dueDate)}</Detail>
              <Detail label="Subtotal">{formatMoney(totals.subtotalFils, invoice.currency)}</Detail>
              <Detail label={`VAT ${formatVat(invoice.vatBps)}`}>{formatMoney(totals.vatFils, invoice.currency)}</Detail>
              {invoice.paidAt && <Detail label="Paid">{formatBusinessDateTime(invoice.paidAt)}</Detail>}
              <Detail label="Created">{formatBusinessDateTime(invoice.createdAt)}</Detail>
              <Detail label="Updated">{timeAgo(invoice.updatedAt)}</Detail>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}

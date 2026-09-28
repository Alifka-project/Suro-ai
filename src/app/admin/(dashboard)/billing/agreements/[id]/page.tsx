import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  FileDown,
  FileSignature,
  FileText,
  FolderKanban,
  FolderPlus,
  Pencil,
  Receipt,
  RefreshCw,
  Send,
  Target,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { AgreementStatus, Installment, QuoteStatus } from "@prisma/client";
import { Card, CardHeader, LinkButton, PageHeader, StatusBadge, buttonClass, cn } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { buildAgreementDocument, type AgreementDocument } from "@/lib/admin/agreement-document";
import {
  AGREEMENT_STATUS,
  AGREEMENT_TRANSITIONS,
  INSTALLMENT_LABEL,
  bpsToPercentText,
  installmentPlan,
  percentagesProblem,
} from "@/lib/admin/agreement-terms";
import { effectiveInvoiceStatus } from "@/lib/admin/invoices";
import { INVOICE_STATUS, LEAD_STATUS, PROJECT_STATUS, QUOTE_STATUS, timeAgo } from "@/lib/admin/labels";
import { documentTotals, formatMoney, formatVat } from "@/lib/admin/money";
import { leadTitle } from "@/lib/admin/pipeline";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/admin/time";
import { ActionButton, ActionNotices } from "../../_components/action-button";
import { BackLink, LinkedRecord, StatusNote } from "../../_components/detail-parts";
import { PrintButton } from "../../_components/print-button";
import {
  createInstallmentInvoice,
  createProjectFromAgreement,
  deleteDraftAgreement,
  setAgreementStatus,
  syncAgreementFromQuote,
} from "../actions";
import { AgreementPaper } from "../_components/agreement-paper";
import { getAgreement } from "../_lib/queries";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agreement = await getAgreement((await params).id);
  // The title doubles as the file name when the agreement is saved as a PDF,
  // so it skips the admin title template: no "SULOAI Admin" on the client's copy.
  return {
    title: agreement
      ? { absolute: `${agreement.number} · Service Agreement · ${agreement.clientCompany || agreement.clientName}` }
      : "Agreement not found",
  };
}

const ICON = "h-4 w-4";

/** Gaps the draft still asks for (the amber placeholders), across both parts. */
function countPlaceholders(doc: AgreementDocument): number {
  let count = 0;
  for (const part of [doc.agreement, doc.sow]) {
    for (const section of part.sections) {
      for (const block of section.blocks) {
        const paragraphs =
          block.kind === "paragraph"
            ? [block.runs]
            : block.kind === "bullets"
              ? block.items.map((i) => i.runs)
              : block.kind === "details"
                ? block.rows.map((r) => r.value)
                : [];
        for (const runs of paragraphs) count += runs.filter((r) => r.placeholder).length;
      }
    }
  }
  return count;
}

export default async function AgreementPage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const agreement = await getAgreement(id);
  if (!agreement) notFound();

  const now = new Date();
  const status = agreement.status;
  const isDraft = status === "DRAFT";
  const money = (fils: number) => formatMoney(fils, agreement.currency);

  const doc = buildAgreementDocument({ ...agreement, quoteNumber: agreement.quote?.number ?? null });
  const gaps = countPlaceholders(doc);
  const plan = installmentPlan(agreement);
  const scheduleProblem = percentagesProblem(agreement.depositPct, agreement.midpointPct, agreement.finalPct);

  const quote = agreement.quote;
  const quoteTotals = quote ? documentTotals(quote.items, quote.vatBps) : null;
  // Only a draft follows its quote; sent and signed agreements are frozen on purpose.
  const drift =
    isDraft && quoteTotals && quote
      ? quoteTotals.subtotalFils !== agreement.subtotalFils || quote.vatBps !== agreement.vatBps
      : false;
  const fullInvoice = quote?.invoice && quote.invoice.status !== "VOID" ? quote.invoice : null;
  const canInvoice = (status === "SENT" || status === "SIGNED") && !fullInvoice && !scheduleProblem;
  const stageInvoice = (installment: Installment) => agreement.invoices.find((inv) => inv.installment === installment) ?? null;
  const openStageInvoices = agreement.invoices.filter((inv) => inv.installment && inv.status !== "VOID").length;

  const allowed = AGREEMENT_TRANSITIONS[status];
  const can = (s: AgreementStatus) => allowed.includes(s);
  const statusFields = (next: AgreementStatus) => ({ id: agreement.id, status: next });

  // Sending carries the quotation along: a draft one is sent with it, a
  // declined or expired one must be reopened first, and the price must match
  // (see setAgreementStatus). Signing accepts the quotation in any state.
  const quoteOff = quote && (quote.status === "DECLINED" || quote.status === "EXPIRED") ? quote : null;
  const leadOpen = agreement.lead !== null && agreement.lead.status !== "WON";
  const signedAccepts: Partial<Record<QuoteStatus, string>> = {
    DRAFT: "is still a draft",
    SENT: "is still awaiting an answer",
    DECLINED: "is marked declined",
    EXPIRED: "is marked expired",
  };
  const quoteOnSigning = quote && signedAccepts[quote.status];

  // Every invoice raised for this deal: stage invoices (voided ones too) and a full conversion of the quote.
  const invoices = [
    ...agreement.invoices.map((inv) => ({
      ...inv,
      what: inv.installment ? INSTALLMENT_LABEL[inv.installment] : "Earlier stage invoice",
    })),
    ...(quote?.invoice ? [{ ...quote.invoice, what: "Full invoice of the quotation" }] : []),
  ].map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: effectiveInvoiceStatus(inv, now),
    subtitle: `${inv.what} · ${formatMoney(documentTotals(inv.items, inv.vatBps).totalFils, inv.currency)}`,
  }));

  let note: { tone: "neutral" | "red" | "amber" | "mint"; text: string };
  switch (status) {
    case "DRAFT":
      note = gaps
        ? {
            tone: "amber",
            text: `Draft with ${gaps} highlighted ${gaps === 1 ? "gap" : "gaps"} to fill. Edit the draft, then print or download it and mark it as sent for signature.`,
          }
        : {
            tone: "neutral",
            text: "Draft. Review the wording, print or download it for the client, then mark it as sent for signature.",
          };
      break;
    case "SENT":
      note = {
        tone: "neutral",
        text: `Sent for signature ${formatBusinessDate(agreement.sentAt)}. Terms are locked; mark it as signed when the client returns it.`,
      };
      break;
    case "SIGNED":
      note = {
        tone: "mint",
        text: `Signed ${formatBusinessDate(agreement.signedAt)}. Bill each stage from the payment schedule as it falls due.`,
      };
      break;
    case "CANCELLED":
      note = { tone: "neutral", text: "Cancelled. It stays on record; reopen it as a draft if the deal comes back." };
      break;
  }

  const clientLine = agreement.clientCompany ? `${agreement.clientCompany} · ${agreement.clientName}` : agreement.clientName;

  return (
    <>
      <div className="print:hidden">
        <BackLink href="/admin/billing?tab=agreements">All agreements</BackLink>
        <PageHeader
          eyebrow="Service agreement"
          title={agreement.number}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge status={status} map={AGREEMENT_STATUS} />
              <span className="break-words">
                {clientLine} · {agreement.projectName}
              </span>
            </span>
          }
          actions={
            <>
              {isDraft && (
                <LinkButton href={`/admin/billing/agreements/${agreement.id}/edit`} variant="secondary">
                  <Pencil className={ICON} aria-hidden="true" />
                  Edit
                </LinkButton>
              )}
              {/* A plain link: the route streams a file, there is nothing to navigate to. */}
              <a href={`/admin/billing/agreements/${agreement.id}/docx`} download className={buttonClass("secondary")}>
                <FileDown className={ICON} aria-hidden="true" />
                Download Word (.docx)
              </a>
              <PrintButton label="Print / Save as PDF" />
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_1fr]">
        {/* Status, actions and the payment schedule — first on small screens, right column on wide ones. */}
        <section aria-label="Status and payment schedule" className="min-w-0 space-y-6 print:hidden xl:col-start-2 xl:row-start-1">
          <Card>
            <CardHeader title="Status" action={<StatusBadge status={status} map={AGREEMENT_STATUS} />} />
            <p className="font-display text-[1.5rem] font-bold leading-none tabular-nums text-ink-900">
              {money(agreement.totalFils)}
            </p>
            <p className="mt-1 text-[0.75rem] text-ink-500">
              {agreement.vatBps > 0
                ? `Agreement total incl. ${formatVat(agreement.vatBps)} VAT · ${money(agreement.subtotalFils)} excl.`
                : "Agreement total"}
            </p>
            <StatusNote tone={note.tone}>{note.text}</StatusNote>

            {drift && quote && quoteTotals && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[0.78rem] text-amber-800">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Quotation {quote.number} now totals{" "}
                  <strong className="font-semibold tabular-nums">{formatMoney(quoteTotals.totalFils, quote.currency)}</strong>
                  {quote.vatBps !== agreement.vatBps && ` (VAT ${formatVat(quote.vatBps)})`}, but this draft still says{" "}
                  <strong className="font-semibold tabular-nums">{money(agreement.totalFils)}</strong>. Refresh it from the
                  quotation before sending.
                </span>
              </p>
            )}

            <ActionNotices className="mt-4">
              <div className="grid gap-2">
                {can("SENT") &&
                  (quoteOff ? (
                    <p className="rounded-xl bg-haze px-3 py-2.5 text-[0.76rem] text-ink-600">
                      Quotation{" "}
                      <Link
                        href={`/admin/billing/quotes/${quoteOff.id}`}
                        className="rounded font-semibold text-abyss-600 underline-offset-2 hover:underline"
                      >
                        {quoteOff.number}
                      </Link>{" "}
                      is marked {quoteOff.status === "DECLINED" ? "declined" : "expired"}. Reopen it as sent before sending
                      this agreement, or cancel the agreement if the deal is off.
                    </p>
                  ) : (
                    // With a price gap, the warning above and "Refresh from quotation" come first.
                    !drift && (
                      <ActionButton
                        action={setAgreementStatus}
                        fields={statusFields("SENT")}
                        variant="primary"
                        pendingLabel="Updating"
                        confirm={{
                          title: `Mark ${agreement.number} as sent for signature?`,
                          description: [
                            quote?.status === "DRAFT"
                              ? `Quotation ${quote.number} goes out with it and is marked as sent too.`
                              : "",
                            "Its terms are locked from now on, as a record of what the client received. “Back to draft” unlocks them while no stage has been invoiced.",
                          ]
                            .filter(Boolean)
                            .join(" "),
                          confirmLabel: "Mark as sent",
                          tone: "primary",
                        }}
                      >
                        <Send className={ICON} aria-hidden="true" />
                        Mark as sent for signature
                      </ActionButton>
                    )
                  ))}
                {can("SIGNED") && (
                  <ActionButton
                    action={setAgreementStatus}
                    fields={statusFields("SIGNED")}
                    variant="primary"
                    pendingLabel="Updating"
                    confirm={{
                      title: `Mark ${agreement.number} as signed?`,
                      description:
                        quote && quoteOnSigning
                          ? `Quotation ${quote.number} ${quoteOnSigning}; it is marked accepted with the signature${leadOpen ? " and the opportunity is marked Won" : ""}.`
                          : "Record that both parties have signed the agreement and its SOW.",
                      confirmLabel: "Mark as signed",
                      tone: "primary",
                    }}
                  >
                    <FileSignature className={ICON} aria-hidden="true" />
                    Mark as signed
                  </ActionButton>
                )}

                {isDraft && (
                  <LinkButton href={`/admin/billing/agreements/${agreement.id}/edit`} variant="secondary" className="w-full">
                    <Pencil className={ICON} aria-hidden="true" />
                    Edit draft
                  </LinkButton>
                )}
                {isDraft && quote && (
                  <ActionButton
                    action={syncAgreementFromQuote}
                    fields={{ id: agreement.id }}
                    variant={drift ? "primary" : "secondary"}
                    pendingLabel="Refreshing"
                    confirm={{
                      title: `Refresh from quotation ${quote.number}?`,
                      description:
                        "Client name, company, email and price are copied from the quotation again. The SOW and the other terms stay as they are.",
                      confirmLabel: "Refresh",
                      tone: "primary",
                    }}
                  >
                    <RefreshCw className={ICON} aria-hidden="true" />
                    Refresh from quotation
                  </ActionButton>
                )}

                {can("DRAFT") &&
                  (openStageInvoices > 0 ? (
                    <p className="rounded-xl bg-haze px-3 py-2.5 text-[0.76rem] text-ink-600">
                      Stage invoices have been issued, so the terms stay locked. Void them to move the agreement back to
                      draft.
                    </p>
                  ) : (
                    <ActionButton
                      action={setAgreementStatus}
                      fields={statusFields("DRAFT")}
                      variant={status === "CANCELLED" ? "secondary" : "ghost"}
                      pendingLabel="Updating"
                    >
                      <Undo2 className={ICON} aria-hidden="true" />
                      {status === "CANCELLED" ? "Reopen as draft" : "Back to draft"}
                    </ActionButton>
                  ))}

                {can("CANCELLED") && (
                  <ActionButton
                    action={setAgreementStatus}
                    fields={statusFields("CANCELLED")}
                    variant="danger"
                    pendingLabel="Cancelling"
                    confirm={{
                      title: `Cancel ${agreement.number}?`,
                      description:
                        openStageInvoices > 0
                          ? `It stays on record. Its ${openStageInvoices} stage invoice${openStageInvoices === 1 ? " is" : "s are"} not voided automatically.`
                          : "It stays on record, marked as cancelled. You can reopen it as a draft later.",
                      confirmLabel: "Cancel agreement",
                    }}
                  >
                    <Ban className={ICON} aria-hidden="true" />
                    Cancel agreement
                  </ActionButton>
                )}

                {isDraft && agreement.invoices.length === 0 && (
                  <ActionButton
                    action={deleteDraftAgreement}
                    fields={{ id: agreement.id }}
                    variant="danger"
                    pendingLabel="Deleting"
                    confirm={{
                      title: `Delete ${agreement.number}?`,
                      description: quote
                        ? `The draft is permanently removed. Quotation ${quote.number} is kept, and a new agreement can be generated from it.`
                        : "The draft is permanently removed. This can't be undone.",
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

          <Card>
            <div id="payment-schedule" className="scroll-mt-6">
              <CardHeader
                title="Payment schedule"
                subtitle={`Section 2 · invoices due within ${agreement.invoiceDueDays} ${agreement.invoiceDueDays === 1 ? "day" : "days"}${agreement.lateFeeBps > 0 ? ` · ${bpsToPercentText(agreement.lateFeeBps)}% monthly late fee` : ""}`}
              />
            </div>
            {scheduleProblem ? (
              <p className="rounded-xl bg-red-50/70 px-3 py-2.5 text-[0.78rem] text-red-700">
                {scheduleProblem} {isDraft ? "Edit the draft to fix it." : "Move it back to draft to fix it."}
              </p>
            ) : (
              <table className="w-full text-[0.82rem]">
                <caption className="sr-only">Payment schedule and stage invoices</caption>
                <thead>
                  <tr className="border-b border-ink-100 text-left font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-500">
                    <th scope="col" className="pb-2 font-medium">
                      Stage
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Incl. VAT
                    </th>
                  </tr>
                </thead>
                {plan.map((line) => {
                  const invoice = stageInvoice(line.installment);
                  const invoiceStatus = invoice ? effectiveInvoiceStatus(invoice, now) : null;
                  const live = invoice && invoiceStatus !== "VOID";
                  return (
                    <tbody key={line.installment} className="border-b border-ink-100/70">
                      <tr className="align-top">
                        <th scope="row" className="pr-2 pt-3 text-left font-normal">
                          <span className="block font-semibold text-ink-800">
                            {line.label} · <span className="tabular-nums">{line.pct}%</span>
                          </span>
                          <span className="block text-[0.72rem] leading-snug text-ink-500">{line.due}</span>
                        </th>
                        <td className="whitespace-nowrap pt-3 text-right">
                          <span className="block font-medium tabular-nums text-ink-900">{money(line.totalFils)}</span>
                          {agreement.vatBps > 0 && (
                            <span className="block text-[0.7rem] tabular-nums text-ink-500">{money(line.subtotalFils)} excl.</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="pb-3 pt-2">
                          {live && invoice && invoiceStatus ? (
                            <Link
                              href={`/admin/billing/invoices/${invoice.id}`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5 transition-colors hover:border-ink-200 hover:bg-haze/60"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Receipt className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                                <span className="truncate font-mono text-[0.76rem] font-medium text-abyss-600">{invoice.number}</span>
                              </span>
                              <StatusBadge status={invoiceStatus} map={INVOICE_STATUS} />
                            </Link>
                          ) : canInvoice ? (
                            <>
                              {invoice && (
                                <p className="mb-1.5 text-[0.72rem] text-ink-500">
                                  {invoice.number} was voided; issue a new one for this stage.
                                </p>
                              )}
                              <ActionButton
                                action={createInstallmentInvoice}
                                fields={{ id: agreement.id, installment: line.installment }}
                                size="sm"
                                variant={line.installment === "DEPOSIT" && !invoice ? "primary" : "secondary"}
                                pendingLabel="Creating invoice"
                              >
                                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                {invoice ? "Reissue" : "Create"} {INSTALLMENT_LABEL[line.installment].toLowerCase()} invoice
                              </ActionButton>
                            </>
                          ) : (
                            <p className="text-[0.72rem] text-ink-500">
                              {fullInvoice
                                ? `Billed in full as ${fullInvoice.number}.`
                                : status === "CANCELLED"
                                  ? "Not invoiced — the agreement is cancelled."
                                  : "Invoice once the agreement is sent for signature."}
                            </p>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  );
                })}
                <tfoot>
                  <tr>
                    <th scope="row" className="pt-3 text-left font-semibold text-ink-900">
                      Total
                    </th>
                    <td className="whitespace-nowrap pt-3 text-right font-display text-[1.05rem] font-bold tabular-nums text-ink-900">
                      {money(plan.reduce((sum, l) => sum + l.totalFils, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>
        </section>

        {/* The document itself — the only thing that prints. */}
        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <AgreementPaper doc={doc} stamp={status === "CANCELLED" ? "Cancelled" : null} />
        </div>

        <aside className="min-w-0 space-y-6 print:hidden xl:col-start-2 xl:row-start-2 xl:self-start">
          <Card>
            <CardHeader title="Linked records" />
            <ul className="space-y-2">
              {agreement.lead ? (
                <LinkedRecord
                  href={`/admin/crm/${agreement.lead.id}`}
                  icon={Target}
                  label={`Opportunity · ${LEAD_STATUS[agreement.lead.status]?.label ?? agreement.lead.status}`}
                  title={leadTitle(agreement.lead)}
                  subtitle={agreement.lead.companyName ? `${agreement.lead.fullName} · ${agreement.lead.companyName}` : agreement.lead.fullName}
                />
              ) : (
                <li className="rounded-xl border border-dashed border-ink-200 px-3 py-2.5 text-[0.78rem] text-ink-500">
                  No CRM opportunity linked.
                </li>
              )}
              {quote ? (
                <LinkedRecord
                  href={`/admin/billing/quotes/${quote.id}`}
                  icon={FileText}
                  label={`Quotation · ${QUOTE_STATUS[quote.status]?.label ?? quote.status}`}
                  title={quote.number}
                  subtitle={quoteTotals ? `${formatMoney(quoteTotals.totalFils, quote.currency)} incl. VAT` : null}
                />
              ) : (
                <li className="rounded-xl border border-dashed border-ink-200 px-3 py-2.5 text-[0.78rem] text-ink-500">
                  The quotation this was generated from has been deleted.
                </li>
              )}
              {agreement.project && (
                <LinkedRecord
                  href={`/admin/projects/${agreement.project.id}`}
                  icon={FolderKanban}
                  label={`Project · ${PROJECT_STATUS[agreement.project.status]?.label ?? agreement.project.status}`}
                  title={agreement.project.name}
                />
              )}
              {invoices.map((inv) => (
                <LinkedRecord
                  key={inv.id}
                  href={`/admin/billing/invoices/${inv.id}`}
                  icon={Receipt}
                  label={`Invoice · ${INVOICE_STATUS[inv.status]?.label ?? inv.status}`}
                  title={inv.number}
                  subtitle={inv.subtitle}
                />
              ))}
            </ul>

            {!agreement.project && status !== "CANCELLED" && (
              <div className="mt-4 border-t border-ink-100 pt-4">
                <p className="mb-2 text-[0.78rem] text-ink-600">
                  {agreement.scope.length
                    ? `Start delivery: a project with ${agreement.scope.length} ${agreement.scope.length === 1 ? "task" : "tasks"} from the scope, dated from the timeline.`
                    : "Start delivery: a project dated from the SOW timeline. Add scope items first to get tasks."}
                </p>
                <ActionButton action={createProjectFromAgreement} fields={{ id: agreement.id }} pendingLabel="Creating project">
                  <FolderPlus className={ICON} aria-hidden="true" />
                  Create project from SOW
                </ActionButton>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="History" />
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-ink-100">
              {[
                { label: "Generated", at: agreement.createdAt, done: true },
                { label: "Effective date", at: agreement.effectiveDate, done: true, dateOnly: true },
                { label: "Sent for signature", at: agreement.sentAt, done: Boolean(agreement.sentAt) },
                { label: "Signed", at: agreement.signedAt, done: Boolean(agreement.signedAt) },
              ].map((step) => (
                <li key={step.label} className="relative flex items-start gap-3 pl-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white",
                      step.done ? "bg-mint-600" : "bg-ink-200",
                    )}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-[0.82rem] font-semibold", step.done ? "text-ink-800" : "text-ink-500")}>
                      {step.label}
                    </p>
                    <p className="text-[0.74rem] tabular-nums text-ink-500">
                      {step.at
                        ? step.dateOnly
                          ? formatBusinessDate(step.at)
                          : formatBusinessDateTime(step.at)
                        : "Not yet"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-ink-100 pt-3 text-[0.74rem] text-ink-500">
              {status === "CANCELLED" ? "Cancelled" : "Last updated"} {timeAgo(agreement.updatedAt)}
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

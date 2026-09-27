import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { filsToInput } from "@/lib/admin/money";
import { toDateInputValue } from "@/lib/admin/time";
import { DocumentEditor } from "../../../_components/document-editor";
import { BackLink } from "../../../_components/detail-parts";
import { bpsToPercentInput } from "../../../_lib/parse";
import { getEditorOptions, getInvoice } from "../../../_lib/queries";
import type { EditorInitial } from "../../../_lib/types";
import { INVOICE_TITLE } from "@/lib/admin/business";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const invoice = await getInvoice((await params).id);
  return { title: invoice ? `Edit ${invoice.number}` : "Invoice not found" };
}

export default async function EditInvoicePage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  // Sent invoices are a record of what the client received; only drafts change.
  if (invoice.status !== "DRAFT") redirect(`/admin/billing/invoices/${invoice.id}`);

  const { leads, projects } = await getEditorOptions({
    includeProjects: true,
    ensureLeadIds: [invoice.leadId],
    ensureProjectIds: [invoice.projectId],
  });

  const initial: EditorInitial = {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientCompany: invoice.clientCompany ?? "",
    issueDate: toDateInputValue(invoice.issueDate),
    secondDate: toDateInputValue(invoice.dueDate),
    vatPercent: bpsToPercentInput(invoice.vatBps),
    notes: invoice.notes ?? "",
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: filsToInput(item.unitPriceFils),
    })),
    leadId: invoice.leadId ?? "",
    projectId: invoice.projectId ?? "",
  };

  return (
    <>
      <BackLink href={`/admin/billing/invoices/${invoice.id}`}>Back to {invoice.number}</BackLink>
      <PageHeader
        eyebrow={`Billing · ${INVOICE_TITLE}`}
        title={`Edit ${invoice.number}`}
        description={
          invoice.quote
            ? `Converted from ${invoice.quote.number}. Drafts can be changed freely until you mark them as sent.`
            : "Drafts can be changed freely until you mark them as sent."
        }
      />
      <DocumentEditor
        kind="invoice"
        documentId={invoice.id}
        initial={initial}
        leads={leads}
        projects={projects}
        cancelHref={`/admin/billing/invoices/${invoice.id}`}
        submitLabel="Save changes"
      />
    </>
  );
}

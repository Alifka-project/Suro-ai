import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { filsToInput } from "@/lib/admin/money";
import { toDateInputValue } from "@/lib/admin/time";
import { DocumentEditor } from "../../../_components/document-editor";
import { BackLink } from "../../../_components/detail-parts";
import { bpsToPercentInput } from "../../../_lib/parse";
import { getEditorOptions, getQuote } from "../../../_lib/queries";
import type { EditorInitial } from "../../../_lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quote = await getQuote((await params).id);
  return { title: quote ? `Edit ${quote.number}` : "Quote not found" };
}

export default async function EditQuotePage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();
  // Sent documents are a record of what the client received; only drafts change.
  if (quote.status !== "DRAFT") redirect(`/admin/billing/quotes/${quote.id}`);

  const { leads } = await getEditorOptions({ includeProjects: false, ensureLeadIds: [quote.leadId] });

  const initial: EditorInitial = {
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientCompany: quote.clientCompany ?? "",
    issueDate: toDateInputValue(quote.issueDate),
    secondDate: toDateInputValue(quote.validUntil),
    vatPercent: bpsToPercentInput(quote.vatBps),
    notes: quote.notes ?? "",
    items: quote.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: filsToInput(item.unitPriceFils),
    })),
    leadId: quote.leadId ?? "",
    projectId: "",
  };

  return (
    <>
      <BackLink href={`/admin/billing/quotes/${quote.id}`}>Back to {quote.number}</BackLink>
      <PageHeader
        eyebrow="Billing · Quotation"
        title={`Edit ${quote.number}`}
        description="Drafts can be changed freely until you mark them as sent."
      />
      <DocumentEditor
        kind="quote"
        documentId={quote.id}
        initial={initial}
        leads={leads}
        cancelHref={`/admin/billing/quotes/${quote.id}`}
        submitLabel="Save changes"
      />
    </>
  );
}

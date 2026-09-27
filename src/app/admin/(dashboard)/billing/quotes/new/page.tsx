import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { DEFAULT_VAT_BPS, filsToInput } from "@/lib/admin/money";
import { addDaysToDateInput, toDateInputValue } from "@/lib/admin/time";
import { DocumentEditor } from "../../_components/document-editor";
import { BackLink, Notice } from "../../_components/detail-parts";
import { bpsToPercentInput } from "../../_lib/parse";
import { findLeadForPrefill, getEditorOptions } from "../../_lib/queries";
import type { EditorInitial } from "../../_lib/types";

export const metadata: Metadata = { title: "New quote" };

type Param = string | string[] | undefined;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v);

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ leadId?: Param }> }) {
  await requireAdmin();

  const leadParam = one((await searchParams).leadId);
  const lead = await findLeadForPrefill(leadParam);
  const { leads } = await getEditorOptions({ includeProjects: false, ensureLeadIds: [lead?.id] });

  // One line per service the lead asked for. With a single service and a CRM
  // estimate, that estimate is a sensible starting price.
  const services = lead?.services ?? [];
  const items = services.length
    ? services.map((service) => ({
        description: service,
        quantity: "1",
        unitPrice: services.length === 1 && lead?.estimatedValueFils ? filsToInput(lead.estimatedValueFils) : "",
      }))
    : [{ description: "", quantity: "1", unitPrice: "" }];

  const today = toDateInputValue(new Date());
  const initial: EditorInitial = {
    clientName: lead?.fullName ?? "",
    clientEmail: lead?.email ?? "",
    clientCompany: lead?.companyName ?? "",
    issueDate: today,
    secondDate: addDaysToDateInput(today, 30),
    vatPercent: bpsToPercentInput(DEFAULT_VAT_BPS),
    notes: "",
    items,
    leadId: lead?.id ?? "",
    projectId: "",
  };

  return (
    <>
      <BackLink href={lead ? `/admin/crm/${lead.id}` : "/admin/billing?tab=quotes"}>
        {lead ? `Back to ${lead.fullName}` : "All quotes"}
      </BackLink>
      <PageHeader
        eyebrow="Billing · Quotation"
        title="New quote"
        description={
          lead
            ? `Prefilled from ${lead.fullName}${lead.companyName ? ` at ${lead.companyName}` : ""}. Review the lines and set your prices.`
            : "Build a quotation. It is saved as a draft with the next quote number."
        }
      />
      {leadParam && !lead && (
        <Notice>The lead in this link could not be found, so nothing was prefilled. You can pick a lead below.</Notice>
      )}
      <DocumentEditor
        kind="quote"
        initial={initial}
        leads={leads}
        cancelHref={lead ? `/admin/crm/${lead.id}` : "/admin/billing?tab=quotes"}
        submitLabel="Create quote"
      />
    </>
  );
}

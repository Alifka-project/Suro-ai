import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { DEFAULT_VAT_BPS, filsToInput } from "@/lib/admin/money";
import { addDaysToDateInput, toDateInputValue } from "@/lib/admin/time";
import { DocumentEditor } from "../../_components/document-editor";
import { BackLink, Notice } from "../../_components/detail-parts";
import { bpsToPercentInput } from "../../_lib/parse";
import { findLeadForPrefill, findProjectForPrefill, getEditorOptions } from "../../_lib/queries";
import type { EditorInitial } from "../../_lib/types";
import { INVOICE_TITLE } from "@/lib/admin/business";

export const metadata: Metadata = { title: "New invoice" };

type Param = string | string[] | undefined;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v);

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: Param; projectId?: Param }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const leadParam = one(sp.leadId);
  const projectParam = one(sp.projectId);

  const [leadFromParam, project] = await Promise.all([
    findLeadForPrefill(leadParam),
    findProjectForPrefill(projectParam),
  ]);
  // An invoice for a project always bills that project's client (saveInvoice
  // enforces the same rule), so the project's lead wins over the link's.
  const projectLead = project?.leadId
    ? leadFromParam?.id === project.leadId
      ? leadFromParam
      : await findLeadForPrefill(project.leadId)
    : null;
  const lead = projectLead ?? leadFromParam;

  const { leads, projects } = await getEditorOptions({
    includeProjects: true,
    ensureLeadIds: [lead?.id],
    ensureProjectIds: [project?.id],
  });

  const today = toDateInputValue(new Date());
  const initial: EditorInitial = {
    clientName: lead?.fullName ?? "",
    clientEmail: lead?.email ?? "",
    clientCompany: lead?.companyName ?? "",
    issueDate: today,
    secondDate: addDaysToDateInput(today, 30),
    vatPercent: bpsToPercentInput(DEFAULT_VAT_BPS),
    notes: "",
    items: [
      project
        ? {
            description: project.name,
            quantity: "1",
            unitPrice: project.valueFils ? filsToInput(project.valueFils) : "",
          }
        : { description: "", quantity: "1", unitPrice: "" },
    ],
    leadId: lead?.id ?? "",
    projectId: project?.id ?? "",
  };

  const backHref = project
    ? `/admin/projects/${project.id}`
    : lead
      ? `/admin/crm/${lead.id}`
      : "/admin/billing?tab=invoices";
  const backLabel = project ? `Back to ${project.name}` : lead ? `Back to ${lead.fullName}` : "All invoices";

  const notices: string[] = [];
  if (projectParam && !project) {
    notices.push("The project in this link could not be found, so it was not linked.");
  }
  if (leadParam && !leadFromParam) {
    notices.push(
      projectLead
        ? "The lead in this link could not be found, so the project's client was used instead."
        : "The lead in this link could not be found, so it was not linked.",
    );
  } else if (leadFromParam && projectLead && leadFromParam.id !== projectLead.id) {
    notices.push(
      `The lead in this link is not the client of ${project?.name ?? "this project"}, so the project's client was used instead.`,
    );
  }

  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>
      <PageHeader
        eyebrow={`Billing · ${INVOICE_TITLE}`}
        title="New invoice"
        description={
          project
            ? `Billing ${project.name}${lead ? ` for ${lead.fullName}` : ""}. Adjust the lines to match this milestone.`
            : lead
              ? `Prefilled from ${lead.fullName}${lead.companyName ? ` at ${lead.companyName}` : ""}.`
              : "Create a tax invoice. It is saved as a draft with the next invoice number."
        }
      />
      {notices.length > 0 && (
        <Notice>
          {notices.join(" ")} You can change the lead and project below.
        </Notice>
      )}
      <DocumentEditor
        kind="invoice"
        initial={initial}
        leads={leads}
        projects={projects}
        cancelHref={backHref}
        submitLabel="Create invoice"
      />
    </>
  );
}

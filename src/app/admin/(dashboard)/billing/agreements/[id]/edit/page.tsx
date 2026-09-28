import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { EmptyState, LinkButton, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/dal";
import { AGREEMENT_STATUS, parseMilestones } from "@/lib/admin/agreement-terms";
import { toDateInputValue } from "@/lib/admin/time";
import { BackLink } from "../../../_components/detail-parts";
import { bpsToPercentInput } from "../../../_lib/parse";
import { AgreementEditor } from "../../_components/agreement-editor";
import { getAgreement } from "../../_lib/queries";
import type { AgreementFormValues } from "../../_lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agreement = await getAgreement((await params).id);
  return { title: agreement ? `Edit ${agreement.number}` : "Agreement not found" };
}

export default async function EditAgreementPage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const agreement = await getAgreement(id);
  if (!agreement) notFound();

  const backHref = `/admin/billing/agreements/${agreement.id}`;

  // Sent, signed and cancelled agreements are a record of what the client
  // received; only a draft changes. Say so rather than bouncing silently.
  if (agreement.status !== "DRAFT") {
    const status = AGREEMENT_STATUS[agreement.status].label.toLowerCase();
    return (
      <>
        <BackLink href={backHref}>Back to {agreement.number}</BackLink>
        <PageHeader eyebrow="Billing · Service agreement" title={`Edit ${agreement.number}`} />
        <EmptyState
          icon={Lock}
          title={`This agreement is ${status}, so its terms are locked`}
          description={
            agreement.status === "SIGNED"
              ? "A signed agreement can't be edited. Agree any change with the client as a change request or a new agreement."
              : `Use “${agreement.status === "CANCELLED" ? "Reopen as draft" : "Back to draft"}” on the agreement page to edit it again.`
          }
          action={
            <LinkButton href={backHref} variant="secondary" size="sm">
              Open {agreement.number}
            </LinkButton>
          }
        />
      </>
    );
  }

  const initial: AgreementFormValues = {
    effectiveDate: toDateInputValue(agreement.effectiveDate),
    clientName: agreement.clientName,
    clientCompany: agreement.clientCompany ?? "",
    clientEmail: agreement.clientEmail ?? "",
    depositPct: String(agreement.depositPct),
    midpointPct: String(agreement.midpointPct),
    finalPct: String(agreement.finalPct),
    midpointMilestone: agreement.midpointMilestone,
    invoiceDueDays: String(agreement.invoiceDueDays),
    lateFee: bpsToPercentInput(agreement.lateFeeBps),
    feedbackDays: String(agreement.feedbackDays),
    warrantyDays: String(agreement.warrantyDays),
    terminationNoticeDays: String(agreement.terminationNoticeDays),
    projectName: agreement.projectName,
    packageRef: agreement.packageRef ?? "",
    background: agreement.background,
    scope: agreement.scope.join("\n"),
    deliverables: agreement.deliverables.join("\n"),
    outOfScope: agreement.outOfScope.join("\n"),
    assumptions: agreement.assumptions.join("\n"),
    milestones: parseMilestones(agreement.milestones).map((m) => ({ label: m.label, date: m.date ?? "" })),
  };

  return (
    <>
      <BackLink href={backHref}>Back to {agreement.number}</BackLink>
      <PageHeader
        eyebrow="Billing · Service agreement"
        title={`Edit ${agreement.number}`}
        description="Drafts can be changed freely until you mark them as sent for signature."
      />
      <AgreementEditor
        agreementId={agreement.id}
        version={agreement.updatedAt.toISOString()}
        initial={initial}
        subtotalFils={agreement.subtotalFils}
        vatBps={agreement.vatBps}
        currency={agreement.currency}
        quoteNumber={agreement.quote?.number ?? null}
        cancelHref={backHref}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/admin/dal";
import { db } from "@/lib/db";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { filsToInput } from "@/lib/admin/money";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { ProjectForm } from "../_components/ProjectForm";
import { getLeadOptions } from "../_lib/queries";
import type { ProjectFormValues } from "../_lib/types";

export const metadata: Metadata = { title: "New project" };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string | string[] }>;
}) {
  await requireAdmin();
  const { leadId: rawLeadId } = await searchParams;
  const requestedLeadId = typeof rawLeadId === "string" && ID_PATTERN.test(rawLeadId) ? rawLeadId : null;

  // An unknown or malformed ?leadId= is ignored rather than trusted.
  const lead = requestedLeadId
    ? await db.lead.findUnique({
        where: { id: requestedLeadId },
        select: { id: true, fullName: true, companyName: true, status: true, estimatedValueFils: true, services: true },
      })
    : null;
  const leads = await getLeadOptions(lead?.id);

  const initialValues: ProjectFormValues = {
    name: "",
    description: "",
    leadId: lead?.id ?? "",
    status: "PLANNING",
    startDate: "",
    dueDate: "",
    value: filsToInput(lead?.estimatedValueFils),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={lead ? `/admin/crm/${lead.id}` : "/admin/projects"}
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {lead ? `Back to ${lead.fullName}` : "All projects"}
      </Link>

      <PageHeader
        eyebrow="Projects"
        title="New project"
        description="Set up a client project to track its tasks, deadlines and invoicing."
      />

      {lead && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-azure-500/20 bg-azure-500/[0.05] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-abyss-600 ring-1 ring-azure-500/20">
              {lead.companyName ? (
                <Building2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <UserRound className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.86rem] font-semibold text-ink-900">
                For {lead.fullName}
                {lead.companyName && <span className="font-normal text-ink-500"> · {lead.companyName}</span>}
              </p>
              {lead.services.length > 0 && (
                <p className="truncate text-[0.76rem] text-ink-500">Interested in {lead.services.join(", ")}</p>
              )}
            </div>
          </div>
          {/* A block wrapper keeps the badge a pill: as a direct flex item of the
              stacked mobile layout it would stretch to the full banner width. */}
          <div className="shrink-0">
            <StatusBadge status={lead.status} map={LEAD_STATUS} />
          </div>
        </div>
      )}

      <Card className="sm:p-6">
        <ProjectForm
          mode="create"
          initialValues={initialValues}
          leads={leads}
          cancelHref={lead ? `/admin/crm/${lead.id}` : "/admin/projects"}
        />
      </Card>
    </div>
  );
}

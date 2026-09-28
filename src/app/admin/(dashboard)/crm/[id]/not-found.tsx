import { SearchX } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/admin/ui";

export default function OpportunityNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Opportunity not found"
      description="It may have been deleted, or the link is incomplete."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <LinkButton href="/admin/crm/pipeline" variant="secondary" size="sm">
            Back to the pipeline
          </LinkButton>
          <LinkButton href="/admin/crm" variant="ghost" size="sm">
            All leads
          </LinkButton>
        </div>
      }
    />
  );
}

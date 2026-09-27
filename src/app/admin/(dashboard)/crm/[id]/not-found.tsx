import { UserRound } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/admin/ui";

export default function LeadNotFound() {
  return (
    <EmptyState
      icon={UserRound}
      title="Lead not found"
      description="It may have been deleted, or the link is incomplete."
      action={
        <LinkButton href="/admin/crm" variant="secondary" size="sm">
          Back to CRM
        </LinkButton>
      }
    />
  );
}

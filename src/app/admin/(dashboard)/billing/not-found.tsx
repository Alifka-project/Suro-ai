import { FileX } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/admin/ui";

/** Shown when a quote, invoice or agreement id doesn't exist (deleted draft, stale link). */
export default function BillingNotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={FileX}
        title="Document not found"
        description="This quote, invoice or service agreement doesn't exist. It may have been a draft that was deleted."
        action={
          <LinkButton href="/admin/billing" variant="secondary" size="sm">
            Back to billing
          </LinkButton>
        }
      />
    </div>
  );
}

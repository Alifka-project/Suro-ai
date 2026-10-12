import { FileX } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/admin/ui";
import { billingBackHref, moduleEnabled } from "@/lib/admin/modules";

/** The billing overview while billing is switched on, otherwise the dashboard. */
const BACK = moduleEnabled("billing")
  ? { href: "/admin/billing", label: "Back to billing" }
  : billingBackHref("invoices");

/** Shown when a quote, invoice or agreement id doesn't exist (deleted draft, stale link). */
export default function BillingNotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={FileX}
        title="Document not found"
        description={`This ${moduleEnabled("agreements") ? "quote, invoice or service agreement" : "quote or invoice"} doesn't exist. It may have been a draft that was deleted.`}
        action={
          <LinkButton href={BACK.href} variant="secondary" size="sm">
            {BACK.label}
          </LinkButton>
        }
      />
    </div>
  );
}

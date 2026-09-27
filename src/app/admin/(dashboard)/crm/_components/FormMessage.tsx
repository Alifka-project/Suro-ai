import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/components/admin/ui";
import type { CrmActionState } from "../actions";

/**
 * Inline result line under a CRM form. The live region is always mounted so
 * screen readers announce the message when it appears.
 */
export function FormMessage({ state, className }: { state: CrmActionState; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "mt-2 flex items-start gap-1.5 text-[0.76rem] leading-snug",
            state.ok ? "text-[#2f8a78]" : "text-red-600",
          )}
        >
          {state.ok ? (
            <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          {state.message}
        </p>
      )}
    </div>
  );
}

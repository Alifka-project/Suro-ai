import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/components/admin/ui";
import type { AccountActionState } from "../actions";

/**
 * Inline result line under an account form. The live region is always
 * mounted so screen readers announce the message when it appears.
 */
export function ResultMessage({ state, className }: { state: AccountActionState; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "flex items-start gap-1.5 text-[0.78rem] leading-snug",
            state.ok ? "text-mint-ink" : "text-red-600",
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

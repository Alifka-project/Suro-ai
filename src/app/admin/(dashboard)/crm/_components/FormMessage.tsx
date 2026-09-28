import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/components/admin/ui";
import type { CrmActionState } from "../actions";

/**
 * Inline result line under a CRM form. The live region is always mounted so
 * screen readers announce the message when it appears. Follow-up links the
 * action returned (e.g. a generated agreement) are listed after the message.
 */
export function FormMessage({ state, className }: { state: CrmActionState; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "mt-2 flex items-start gap-1.5 text-[0.76rem] leading-snug",
            state.ok ? "text-mint-ink" : "text-red-600",
          )}
        >
          {state.ok ? (
            <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0">
            {state.message}
            {state.links && state.links.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {state.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-0.5 font-semibold text-abyss-600 hover:underline"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ))}
              </span>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { Field, cn, fieldMessageId, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { filsToInput } from "@/lib/admin/money";
import { updateLeadValue, type CrmActionState } from "../actions";
import { FormMessage } from "./FormMessage";

export function ValueForm({ leadId, valueFils }: { leadId: string; valueFils: number | null }) {
  const [state, formAction] = useActionState<CrmActionState, FormData>(updateLeadValue, null);
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <Field label="Estimated deal value" htmlFor="lead-value" hint="In AED. Leave empty to clear the estimate.">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.68rem] font-medium tracking-[0.08em] text-ink-550"
            >
              AED
            </span>
            {/* After a failed save the typed text is kept; after a good one the
                input re-seeds from the normalised server value. */}
            <input
              key={`${valueFils ?? "none"}-${state?.at ?? 0}`}
              id="lead-value"
              name="value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={32}
              placeholder="45,000"
              defaultValue={failed ? (state.value ?? "") : filsToInput(valueFils)}
              aria-invalid={failed || undefined}
              aria-describedby={fieldMessageId("lead-value")}
              className={cn(inputClass, "pl-12 tabular-nums")}
            />
          </div>
          <SubmitButton variant="secondary" pendingLabel="Saving">
            Save
          </SubmitButton>
        </div>
      </Field>
      <FormMessage state={state} />
    </form>
  );
}

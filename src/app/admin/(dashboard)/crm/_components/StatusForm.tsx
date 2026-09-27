"use client";

import { useActionState } from "react";
import { LEAD_PIPELINE, LEAD_STATUS } from "@/lib/admin/labels";
import { Field, cn, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { updateLeadStatus, type CrmActionState } from "../actions";
import { FormMessage } from "./FormMessage";

export function StatusForm({ leadId, status }: { leadId: string; status: string }) {
  const [state, formAction] = useActionState<CrmActionState, FormData>(updateLeadStatus, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <Field label="Pipeline stage" htmlFor="lead-status">
        <div className="flex gap-2">
          {/* Keyed on the saved status (and each attempt) so React's post-action
              form reset re-seeds the select from the server, not a stale default. */}
          <select
            key={`${status}-${state?.at ?? 0}`}
            id="lead-status"
            name="status"
            defaultValue={status}
            className={cn(inputClass, "min-w-0 flex-1 cursor-pointer")}
          >
            {LEAD_PIPELINE.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS[s].label}
              </option>
            ))}
          </select>
          <SubmitButton variant="secondary" pendingLabel="Saving">
            Update
          </SubmitButton>
        </div>
      </Field>
      <FormMessage state={state} />
    </form>
  );
}

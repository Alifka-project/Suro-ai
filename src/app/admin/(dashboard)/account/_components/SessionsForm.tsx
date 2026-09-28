"use client";

import { useActionState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { SubmitButton } from "@/components/admin/ui-client";
import { signOutOtherDevices, type AccountActionState } from "../actions";
import { ResultMessage } from "./ResultMessage";

/** "Sign out all other devices": revokes every session but this one. */
export function SessionsForm() {
  const [state, formAction] = useActionState<AccountActionState, FormData>(signOutOtherDevices, null);

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton variant="secondary" pendingLabel="Signing out" className="w-full sm:w-auto">
        <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
        Sign out all other devices
      </SubmitButton>
      <ResultMessage state={state} />
    </form>
  );
}

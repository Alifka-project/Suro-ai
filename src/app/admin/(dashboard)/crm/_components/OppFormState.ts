import type { CrmActionState } from "../actions";

/**
 * A CRM form action's result plus the values that were submitted. React resets
 * a form once its action settles, so a form that failed validation would lose
 * everything typed; forms keyed on `at` re-seed their fields from `submitted`
 * instead. Client-side only: nothing extra is sent to the server.
 */
export type EchoState = (NonNullable<CrmActionState> & { submitted: Record<string, string> }) | null;

export function withEcho(action: (prev: CrmActionState, formData: FormData) => Promise<CrmActionState>) {
  return async (_prev: EchoState, formData: FormData): Promise<EchoState> => {
    // The CRM actions ignore the previous state, so none is sent over the wire.
    const result = await action(null, formData);
    if (!result) return null;
    const submitted: Record<string, string> = {};
    for (const [key, value] of formData) if (typeof value === "string") submitted[key] = value;
    return { ...result, submitted };
  };
}

/** The submitted value after a failed attempt, else the saved one. */
export function seed(state: EchoState, name: string, saved: string): string {
  return state && !state.ok ? (state.submitted[name] ?? saved) : saved;
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { Field, LinkButton, fieldMessageId, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { changePassword, type AccountActionState, type PasswordField } from "../actions";
import { ResultMessage } from "./ResultMessage";

const FIELDS: { name: PasswordField; label: string; autoComplete: string }[] = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Repeat new password", autoComplete: "new-password" },
];

/**
 * Change-password form. The inputs are uncontrolled on purpose: React clears
 * them after every submission, so no password lingers in component state or
 * comes back from the server. After a failure the cursor goes to the first
 * field that needs fixing — or, once too many wrong current passwords have
 * signed the account out everywhere, to the way back in.
 */
export function PasswordForm({
  username,
  minLength,
  maxLength,
}: {
  /** For password managers: they file the new password under this sign-in ID. */
  username: string;
  minLength: number;
  maxLength: number;
}) {
  const [state, formAction] = useActionState<AccountActionState, FormData>(changePassword, null);
  const [reveal, setReveal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const errors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (!state || state.ok) return;
    if (state.signedOut) {
      signInRef.current?.focus();
      return;
    }
    const first = FIELDS.find((f) => state.fieldErrors?.[f.name]);
    if (first) formRef.current?.querySelector<HTMLInputElement>(`[name="${first.name}"]`)?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Hidden, never submitted: lets a password manager match the account. */}
      <input type="text" autoComplete="username" value={username} readOnly hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const id = `account-${f.name}`;
          const error = errors[f.name];
          return (
            <Field
              key={f.name}
              label={f.label}
              htmlFor={id}
              error={error}
              hint={f.name === "newPassword" ? `At least ${minLength} characters. A few unrelated words work well.` : undefined}
              // The current password gets a row of its own; the two new ones pair up.
              className={f.name === "currentPassword" ? "sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]" : undefined}
            >
              <input
                id={id}
                name={f.name}
                type={reveal ? "text" : "password"}
                required
                minLength={f.name === "currentPassword" ? undefined : minLength}
                maxLength={maxLength}
                autoComplete={f.autoComplete}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={error || f.name === "newPassword" ? fieldMessageId(id) : undefined}
                className={inputClass}
              />
            </Field>
          );
        })}
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-[0.8rem] text-ink-600">
        <input
          type="checkbox"
          checked={reveal}
          onChange={(e) => setReveal(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 accent-abyss-600"
        />
        Show passwords
      </label>

      <div className="flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.76rem] text-ink-550">
          Saving signs you out on every other device. You stay signed in here.
        </p>
        <SubmitButton pendingLabel="Changing" className="shrink-0">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Change password
        </SubmitButton>
      </div>
      <ResultMessage state={state} />
      {state?.signedOut && (
        <LinkButton ref={signInRef} href="/admin/login?next=/admin/account" variant="secondary" size="sm">
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          Sign in again
        </LinkButton>
      )}
    </form>
  );
}

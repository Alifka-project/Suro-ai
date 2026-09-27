"use client";

import { useActionState } from "react";
import { Lock, Loader2, ArrowRight } from "lucide-react";
import { login, type LoginState } from "../actions";
import { inputClass, buttonClass, cn } from "@/components/admin/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[0.78rem] font-semibold text-ink-700">
          Admin password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className={cn(inputClass, "h-11 pl-9")}
            aria-invalid={!!state?.error}
            aria-describedby={state?.error ? "login-error" : undefined}
          />
        </div>
        {state?.error && (
          <p id="login-error" role="alert" className="mt-2 text-[0.8rem] text-red-600">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className={cn(buttonClass("primary"), "h-11 w-full")}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in
          </>
        ) : (
          <>
            Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button, cn, type ButtonVariant } from "@/components/admin/ui";
import type { ActionState } from "../_lib/types";

type Confirm = {
  title: string;
  description?: string;
  confirmLabel: string;
  /** "danger" for destructive moves (void, delete); "primary" for weighty but safe ones. */
  tone?: "danger" | "primary";
};

/**
 * One Server Action behind one button. Shows its own pending state (which
 * also blocks double submits) and any error the action returns. With
 * `confirm`, the first click opens an inline confirmation step instead.
 */
export function ActionButton({
  action,
  fields,
  children,
  pendingLabel = "Working",
  variant = "secondary",
  size = "md",
  confirm,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  confirm?: Confirm;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const hidden = Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));

  const spinner = (
    <>
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      {pendingLabel}
    </>
  );

  const error = state?.error ? (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-[0.76rem] text-red-600">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {state.error}
    </p>
  ) : null;

  if (confirm && confirming) {
    const danger = (confirm.tone ?? "danger") === "danger";
    return (
      <div
        role="group"
        aria-label={confirm.title}
        className={cn(
          "rounded-xl border p-3",
          danger ? "border-red-200 bg-red-50/70" : "border-azure-400/30 bg-haze",
          className,
        )}
      >
        <p className={cn("text-[0.85rem] font-semibold", danger ? "text-red-700" : "text-ink-900")}>
          {confirm.title}
        </p>
        {confirm.description && <p className="mt-1 text-[0.78rem] text-ink-600">{confirm.description}</p>}
        <form action={formAction} className="mt-3 flex flex-wrap gap-2">
          {hidden}
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} size="sm" disabled={pending}>
            {pending ? spinner : confirm.confirmLabel}
          </Button>
        </form>
        {error}
      </div>
    );
  }

  if (confirm) {
    return (
      <div className={className}>
        <Button type="button" variant={variant} size={size} className="w-full" onClick={() => setConfirming(true)}>
          {children}
        </Button>
        {error}
      </div>
    );
  }

  return (
    <form action={formAction} className={className}>
      {hidden}
      <Button type="submit" variant={variant} size={size} className="w-full" disabled={pending}>
        {pending ? spinner : children}
      </Button>
      {error}
    </form>
  );
}

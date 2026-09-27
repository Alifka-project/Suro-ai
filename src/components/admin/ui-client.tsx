"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonVariant } from "./ui";
import type { ComponentProps } from "react";

/** Submit button that disables itself and shows a spinner while its form's Server Action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  disabled,
  ...props
}: ComponentProps<"button"> & { pendingLabel?: string; variant?: ButtonVariant; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  // `disabled` is pulled out of the spread and applied last. Spreading it after
  // the pending check let any caller passing disabled={false} re-enable the
  // button mid-submit — a double-submit hole.
  return (
    <Button type="submit" variant={variant} size={size} {...props} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {pendingLabel ?? "Saving"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

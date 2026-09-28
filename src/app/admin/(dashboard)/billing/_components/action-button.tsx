"use client";

import Link from "next/link";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { Button, cn, type ButtonVariant } from "@/components/admin/ui";
import type { ActionState, NoticeLink } from "../_lib/types";

type Confirm = {
  title: string;
  description?: string;
  confirmLabel: string;
  /** "danger" for destructive moves (void, delete); "primary" for weighty but safe ones. */
  tone?: "danger" | "primary";
};

type Notice = { text: string; links: NoticeLink[]; at: number };

/**
 * Where an ActionButton hands its success notice. A button usually disappears
 * once its action succeeds ("Mark accepted" is gone once the quote is
 * accepted), and its own state goes with it — so a panel that must show what
 * happened wraps its buttons in <ActionNotices>, which stays mounted.
 */
const NoticeContext = createContext<((notice: Notice) => void) | null>(null);

function NoticeMessage({ notice, onDismiss }: { notice: Notice; onDismiss?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-mint-600/30 bg-mint-500/10 px-3 py-2.5 text-[0.8rem] text-[#23695c]">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-snug">{notice.text}</p>
        {notice.links.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {notice.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex items-center gap-1 rounded font-semibold text-abyss-600 underline-offset-2 hover:underline"
                >
                  {link.label}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#23695c]/70 transition-colors hover:bg-mint-500/15 hover:text-[#23695c]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Keeps the latest success notice of any ActionButton inside it on screen,
 * in a polite live region, after the button itself has re-rendered away.
 */
export function ActionNotices({ children, className }: { children: ReactNode; className?: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  return (
    <NoticeContext value={setNotice}>
      <div role="status" aria-live="polite" className={cn(notice && "mb-3", className)}>
        {notice && <NoticeMessage key={notice.at} notice={notice} onDismiss={() => setNotice(null)} />}
      </div>
      {children}
    </NoticeContext>
  );
}

/**
 * One Server Action behind one button. Shows its own pending state (which
 * also blocks double submits) and any error the action returns. With
 * `confirm`, the first click opens an inline confirmation step instead.
 * A success notice goes to the surrounding <ActionNotices>, or is shown
 * under the button when there is none.
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
  const report = useContext(NoticeContext);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next?.notice && report) report({ text: next.notice, links: next.links ?? [], at: Date.now() });
    return next;
  }, undefined);
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // A button that is still here after its action succeeded (e.g. "Refresh
  // from quotation") closes its confirmation step; an error keeps it open,
  // next to the message. Adjusted during render, not in an effect.
  const [settled, setSettled] = useState(state);
  if (state !== settled) {
    setSettled(state);
    if (!state?.error) setConfirming(false);
  }

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

  // Only when no <ActionNotices> is listening; otherwise it would show twice.
  const notice =
    !report && state?.notice ? (
      <div role="status" className="mt-2">
        <NoticeMessage notice={{ text: state.notice, links: state.links ?? [], at: 0 }} />
      </div>
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
        {notice}
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
      {notice}
    </form>
  );
}

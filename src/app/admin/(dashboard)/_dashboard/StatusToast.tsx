"use client";

import { useEffect, useState } from "react";
import type { LeadStatus } from "@prisma/client";
import { Ban, CircleAlert, CircleCheck, RotateCcw, Trophy, X } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { LEAD_STATUS } from "@/lib/admin/labels";
import type { StatusChange } from "./StatusProvider";

export type StatusNotice = {
  /** Distinguishes two identical messages in a row, so each one is announced. */
  id: number;
  leadId: string;
  ok: boolean;
  title: string;
  message: string;
  /** The status the client moved to (successful changes only). */
  to?: LeadStatus;
  /** The change that puts it back, offered as "Undo". */
  undo?: StatusChange | null;
};

/** Confirmations fade on their own (paused while hovered or focused); errors stay until dismissed. */
const AUTO_DISMISS_MS = 7000;

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500";

/**
 * The result of a status change. Two parts: a visually hidden live region that
 * is always mounted (so every new message is announced politely), and the
 * visible toast pinned to the bottom of the screen with Undo and Dismiss.
 */
export function StatusToast({
  notice,
  onDismiss,
  onUndo,
}: {
  notice: StatusNotice | null;
  onDismiss: () => void;
  onUndo: (change: StatusChange) => void;
}) {
  const [held, setHeld] = useState(false);
  // A new message starts its own timer (render-time reset, not an effect).
  const [seen, setSeen] = useState(notice);
  if (notice !== seen) {
    setSeen(notice);
    setHeld(false);
  }

  useEffect(() => {
    if (!notice?.ok || held) return;
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, onDismiss]);

  const won = notice?.ok && notice.to === "WON";
  const lost = notice?.ok && notice.to === "LOST";

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {notice && (
          <p key={notice.id}>
            {notice.title}. {notice.message}
          </p>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6 print:hidden">
        {notice && (
          <div
            key={notice.id}
            data-status-toast=""
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
            }}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-2xl border bg-white p-4 shadow-[0_24px_48px_-24px_rgb(7_38_60/0.55)] motion-safe:animate-rise sm:w-96",
              !notice.ok ? "border-red-200" : won ? "border-mint-600/45" : lost ? "border-ink-300" : "border-ink-100",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  !notice.ok
                    ? "bg-red-500/10 text-red-600"
                    : won
                      ? "bg-linear-to-br from-mint-600 to-aqua-500 text-white"
                      : lost
                        ? "bg-ink-100 text-ink-700"
                        : "bg-mint-500/15 text-mint-ink",
                )}
              >
                {!notice.ok ? (
                  <CircleAlert className="h-4 w-4" />
                ) : won ? (
                  <Trophy className="h-4 w-4" />
                ) : lost ? (
                  <Ban className="h-4 w-4" />
                ) : (
                  <CircleCheck className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={cn("font-display text-[0.92rem] font-bold", notice.ok ? "text-ink-900" : "text-red-700")}>
                  {notice.title}
                </p>
                <p className="mt-0.5 text-[0.84rem] leading-snug text-ink-700 [overflow-wrap:anywhere]">
                  {notice.message}
                </p>
                {notice.undo && (
                  <button
                    type="button"
                    onClick={() => notice.undo && onUndo(notice.undo)}
                    className={cn(
                      "mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-[0.78rem] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-haze",
                      FOCUS_RING,
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Undo
                    <span className="sr-only">
                      : set {notice.undo.name} back to {LEAD_STATUS[notice.undo.to].label}
                    </span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss message"
                className={cn(
                  "-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-550 transition-colors hover:bg-ink-100 hover:text-ink-800",
                  FOCUS_RING,
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

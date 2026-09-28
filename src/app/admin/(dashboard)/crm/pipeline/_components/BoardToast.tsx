"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowUpRight, CircleAlert, CircleCheck, FileSignature, FileText, PartyPopper, X } from "lucide-react";
import { buttonClass, cn } from "@/components/admin/ui";

export type BoardNotice = {
  /** Distinguishes two identical messages in a row, so each is announced. */
  id: number;
  ok: boolean;
  message: string;
  links?: { label: string; href: string }[];
  /** A deal was just won: the links are its new agreement and quotation. */
  won?: boolean;
};

/** Plain confirmations fade on their own; errors and anything with links stay until dismissed. */
const AUTO_DISMISS_MS = 5000;

/**
 * Result of a move, pinned to the bottom of the screen. The live region is
 * always mounted so screen readers announce each new message. Winning a deal
 * gets a larger panel with the generated agreement and quotation up front.
 */
export function BoardToast({ notice, onDismiss }: { notice: BoardNotice | null; onDismiss: () => void }) {
  const sticky = !notice || !notice.ok || (notice.links?.length ?? 0) > 0;

  useEffect(() => {
    if (sticky) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, sticky, onDismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6 print:hidden"
    >
      {notice && (
        <div
          key={notice.id}
          role={notice.ok ? "status" : "alert"}
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-2xl border bg-white p-4 shadow-[0_24px_48px_-24px_rgb(7_38_60/0.55)] motion-safe:animate-rise sm:w-96",
            notice.won ? "border-mint-600/40" : notice.ok ? "border-ink-100" : "border-red-200",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                notice.won
                  ? "bg-linear-to-br from-mint-600 to-aqua-500 text-white"
                  : notice.ok
                    ? "bg-mint-500/15 text-mint-ink"
                    : "bg-red-500/10 text-red-600",
              )}
            >
              {notice.won ? (
                <PartyPopper className="h-4 w-4" aria-hidden="true" />
              ) : notice.ok ? (
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CircleAlert className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              {notice.won && <p className="font-display text-[0.95rem] font-bold text-ink-900">Deal won</p>}
              <p className={cn("text-[0.84rem] leading-snug", notice.ok ? "text-ink-700" : "text-red-700")}>
                {notice.message}
              </p>
              {notice.links && notice.links.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {notice.links.map((link, i) => {
                    const Icon = link.href.includes("/agreements/")
                      ? FileSignature
                      : link.href.includes("/billing/")
                        ? FileText
                        : ArrowUpRight;
                    return (
                      <li key={link.href}>
                        <Link href={link.href} className={buttonClass(i === 0 ? "primary" : "secondary", "sm")}>
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { createContext, use, useActionState, useEffect, useState, type ReactNode } from "react";
import type { ActivityType } from "@prisma/client";
import { Check, CircleAlert, CircleCheck, UserRound, X } from "lucide-react";
import { Button, cn, textareaClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { ACTIVITY_STATE, ACTIVITY_TYPE, type ActivityState } from "@/lib/admin/pipeline";
import { cancelActivity, completeActivity } from "../actions";
import { ActivityTypeIcon } from "./ActivityTypeIcon";
import { seed, withEcho, type EchoState } from "./OppFormState";

/*
 * Planned activities with inline "Done" (optional feedback) and "Cancel".
 * Shared by the opportunity page and the Activities planner.
 *
 * The two actions live in <ActivityActions>, above the rows, not in each row:
 * a completed or cancelled activity disappears from the list as soon as the
 * action revalidates, so a row can't announce its own result. The provider
 * outlives the row and reports success in one live region (a toast), while a
 * failure is shown on the row it belongs to.
 */

/** One planned activity, with its dates already formatted on the business clock by the server. */
export type ActivityRow = {
  id: string;
  type: ActivityType;
  summary: string;
  note: string | null;
  state: ActivityState;
  /** "Due today", "2 days overdue". */
  hint: string;
  dueLabel: string;
  dueIso: string;
  assignee: string | null;
  /** Set on the planner, where rows from many opportunities are mixed. */
  lead?: { id: string; title: string; company: string | null };
};

const completeWithEcho = withEcho(completeActivity);
const cancelWithEcho = withEcho(cancelActivity);

type ActionsContext = {
  complete: (formData: FormData) => void;
  cancel: (formData: FormData) => void;
  completeState: EchoState;
  cancelState: EchoState;
};

const ActivityActionsContext = createContext<ActionsContext | null>(null);

export function ActivityActions({ children }: { children: ReactNode }) {
  const [completeState, complete] = useActionState(completeWithEcho, null);
  const [cancelState, cancel] = useActionState(cancelWithEcho, null);

  // The most recent result of either action; only successes are toasted.
  const latest = completeState && (!cancelState || completeState.at >= cancelState.at) ? completeState : cancelState;
  const toast = latest?.ok ? latest : null;
  const [hiddenAt, setHiddenAt] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setHiddenAt(toast.at), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <ActivityActionsContext value={{ complete, cancel, completeState, cancelState }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6 print:hidden"
      >
        {toast && toast.at > hiddenAt && (
          <div className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl bg-ink-900 py-3 pl-4 pr-2 text-[0.84rem] text-white shadow-[0_18px_40px_-18px_rgb(7_38_60/0.8)]">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-400" aria-hidden="true" />
            <p className="min-w-0 flex-1 py-px">{toast.message}</p>
            <button
              type="button"
              onClick={() => setHiddenAt(toast.at)}
              aria-label="Dismiss message"
              className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-aqua-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ActivityActionsContext>
  );
}

const STATE_CHIP: Record<ActivityState, string> = {
  overdue: "bg-red-50 text-red-600 ring-red-200/70",
  today: "bg-amber-50 text-amber-700 ring-amber-200/80",
  planned: "bg-mint-200/45 text-mint-ink ring-mint-300/70",
};

function useActivityActions(): ActionsContext {
  const ctx = use(ActivityActionsContext);
  if (!ctx) throw new Error("ActivityItem must be rendered inside <ActivityActions>.");
  return ctx;
}

export function ActivityItem({ activity }: { activity: ActivityRow }) {
  const ctx = useActivityActions();
  const [mode, setMode] = useState<"idle" | "done" | "cancel">("idle");
  // Results already on screen when Done / Cancel was last opened: an earlier
  // failure isn't shown in a fresh attempt (compared by identity).
  const [stale, setStale] = useState<{ complete: EchoState; cancel: EchoState }>({ complete: null, cancel: null });

  // After Back / Keep it, the button that opened the step takes focus again (autoFocus on remount).
  const [refocus, setRefocus] = useState<"done" | "cancel" | null>(null);

  function open(next: "done" | "cancel") {
    setStale({ complete: ctx.completeState, cancel: ctx.cancelState });
    setMode(next);
  }

  function back() {
    setRefocus(mode === "idle" ? null : mode);
    setMode("idle");
  }

  const mine = (s: EchoState, seen: EchoState) =>
    s && !s.ok && s !== seen && s.submitted.activityId === activity.id ? s : null;
  const completeFailed = mine(ctx.completeState, stale.complete);
  const cancelFailed = mine(ctx.cancelState, stale.cancel);
  const error = completeFailed && cancelFailed
    ? completeFailed.at > cancelFailed.at ? completeFailed : cancelFailed
    : (completeFailed ?? cancelFailed);

  const state = ACTIVITY_STATE[activity.state];
  const typeLabel = ACTIVITY_TYPE[activity.type].label;
  const feedbackId = `activity-${activity.id}-feedback`;

  return (
    <li className="rounded-xl border border-ink-100 bg-white p-3 transition-colors sm:p-3.5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            STATE_CHIP[activity.state],
          )}
        >
          <ActivityTypeIcon type={activity.type} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1 basis-48">
              <p className="break-words text-[0.86rem] font-semibold leading-snug text-ink-900">{activity.summary}</p>
              {activity.lead && (
                <p className="mt-0.5 truncate text-[0.78rem] text-ink-550">
                  <Link
                    href={`/admin/crm/${activity.lead.id}`}
                    className="rounded font-semibold text-abyss-600 hover:underline"
                  >
                    {activity.lead.title}
                  </Link>
                  {activity.lead.company && activity.lead.company !== activity.lead.title && (
                    <span> · {activity.lead.company}</span>
                  )}
                </p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.74rem] text-ink-550">
                <span className="font-medium text-ink-700">{typeLabel}</span>
                <span aria-hidden="true">·</span>
                <span className={cn("inline-flex items-center gap-1 font-semibold", state.text)}>
                  <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", state.dot)} />
                  {activity.hint}
                </span>
                <span aria-hidden="true">·</span>
                <time dateTime={activity.dueIso}>{activity.dueLabel}</time>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Assigned to </span>
                  {activity.assignee ?? "Unassigned"}
                </span>
              </p>
            </div>

            {mode === "idle" && (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  autoFocus={refocus === "done"}
                  onClick={() => open("done")}
                  aria-label={`Done: ${activity.summary}`}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Done
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  autoFocus={refocus === "cancel"}
                  onClick={() => open("cancel")}
                  aria-label={`Cancel: ${activity.summary}`}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {activity.note && (
            <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-canvas px-3 py-2 text-[0.8rem] leading-relaxed text-ink-700">
              {activity.note}
            </p>
          )}

          {mode === "done" && (
            <form
              key={completeFailed?.at ?? 0}
              action={ctx.complete}
              onKeyDown={(e) => {
                if (e.key === "Escape") back();
              }}
              className="mt-3 space-y-2.5 rounded-xl border border-mint-300/70 bg-mint-200/20 p-3"
            >
              <input type="hidden" name="activityId" value={activity.id} />
              <label htmlFor={feedbackId} className="block text-[0.78rem] font-semibold text-ink-700">
                Feedback <span className="font-normal text-ink-550">(optional)</span>
              </label>
              <textarea
                id={feedbackId}
                name="feedback"
                rows={2}
                maxLength={2000}
                autoFocus
                defaultValue={seed(completeFailed, "feedback", "")}
                placeholder="What happened? What's next?"
                className={cn(textareaClass, "min-h-[4.25rem] resize-y")}
              />
              <p className="text-[0.72rem] text-ink-550">Posted to the opportunity&apos;s timeline with the activity.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={back}>
                  Back
                </Button>
                <SubmitButton size="sm" pendingLabel="Saving">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark done
                </SubmitButton>
              </div>
            </form>
          )}

          {mode === "cancel" && (
            <form
              action={ctx.cancel}
              onKeyDown={(e) => {
                if (e.key === "Escape") back();
              }}
              className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-red-200 bg-red-50/50 p-2.5"
            >
              <input type="hidden" name="activityId" value={activity.id} />
              <p className="mr-auto px-1 text-[0.78rem] font-medium text-ink-700">Cancel this activity?</p>
              <Button type="button" variant="ghost" size="sm" autoFocus onClick={back}>
                Keep it
              </Button>
              <SubmitButton variant="danger" size="sm" pendingLabel="Cancelling">
                Cancel activity
              </SubmitButton>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-[0.76rem] text-red-600">
              <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error.message}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

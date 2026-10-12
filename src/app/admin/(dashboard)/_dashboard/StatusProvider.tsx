"use client";

import {
  createContext,
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LeadStatus } from "@prisma/client";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { setClientStatus, type StatusChangeResult } from "./actions";
import { StatusToast, type StatusNotice } from "./StatusToast";

/*
 * Status changes for the whole clients table: the optimistic value each
 * select shows while its change is on the way, and the one result message
 * (toast + screen-reader announcement).
 *
 * It wraps the entire table section, empty states included, so the message
 * survives when the change moves the client out of the current filter and
 * the row (or the whole list) disappears.
 */

export type StatusChange = {
  leadId: string;
  name: string;
  /** The status the table was showing; the server refuses the change if it has moved on. */
  from: LeadStatus;
  to: LeadStatus;
  /** Set on the change an "Undo" button makes, so it doesn't offer another undo. */
  isUndo?: boolean;
};

type StatusContextValue = {
  /** The status to show for a client: the optimistic one while a change is pending. */
  shownStatus: (leadId: string, serverStatus: LeadStatus) => LeadStatus;
  isPending: (leadId: string) => boolean;
  changeStatus: (change: StatusChange) => void;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function useClientStatus(): StatusContextValue {
  const ctx = use(StatusContext);
  if (!ctx) throw new Error("useClientStatus must be used inside <StatusProvider>");
  return ctx;
}

const NO_PENDING: Readonly<Record<string, LeadStatus>> = {};

const UNREACHABLE: StatusChangeResult = {
  ok: false,
  message: "Could not reach the server. Check your connection and try again.",
};

function noticeFor(change: StatusChange, result: StatusChangeResult, id: number): StatusNotice {
  if (!result.ok) {
    return { id, leadId: change.leadId, ok: false, title: `${change.name}: status not changed`, message: result.message };
  }
  const label = LEAD_STATUS[change.to].label;
  const title =
    change.to === "WON" ? "Goal — deal closed" : change.to === "LOST" ? "Client cancelled" : "Status updated";
  return {
    id,
    leadId: change.leadId,
    ok: true,
    to: change.to,
    title,
    message: change.isUndo
      ? `${change.name} is back to “${label}”.`
      : `${change.name} is now “${label}”.`,
    undo: change.isUndo
      ? null
      : { leadId: change.leadId, name: change.name, from: change.to, to: change.from, isUndo: true },
  };
}

/** The first matching element that is actually laid out (the table and the cards both render every row). */
function visibleElement(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

export function StatusProvider({ headingId, children }: { headingId: string; children: ReactNode }) {
  // A client is in this map only while its change is in flight; once the
  // action settles, the table shows the status the server re-rendered (the
  // new one, or the current one when the change was refused).
  const [pending, addPending] = useOptimistic(
    NO_PENDING,
    (state: Readonly<Record<string, LeadStatus>>, change: { leadId: string; to: LeadStatus }) => ({
      ...state,
      [change.leadId]: change.to,
    }),
  );
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const noticeCount = useRef(0);

  const changeStatus = useCallback(
    (change: StatusChange) => {
      if (change.from === change.to) return;
      startTransition(async () => {
        addPending({ leadId: change.leadId, to: change.to });
        let result: StatusChangeResult;
        try {
          result = await setClientStatus({ leadId: change.leadId, from: change.from, to: change.to });
        } catch {
          result = UNREACHABLE;
        }
        noticeCount.current += 1;
        const next = noticeFor(change, result, noticeCount.current);
        // In a transition, so the message lands together with the refreshed rows.
        startTransition(() => setNotice(next));
      });
    },
    [addPending],
  );

  /** The status select for a client if it is still on screen, else the section heading. */
  const focusTarget = useCallback(
    (leadId: string | undefined) =>
      (leadId ? visibleElement(`[data-status-select="${CSS.escape(leadId)}"]`) : null) ??
      document.getElementById(headingId),
    [headingId],
  );

  // When a change takes the client out of the current filter, its row (and
  // the select that had focus) is gone. Keyboard users continue from the
  // section heading instead of being dropped at the top of the page.
  useEffect(() => {
    if (!notice) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    focusTarget(notice.leadId)?.focus({ preventScroll: true });
  }, [notice, focusTarget]);

  const dismiss = useCallback(() => {
    const hadFocus = document.activeElement?.closest("[data-status-toast]") != null;
    const leadId = notice?.leadId;
    setNotice(null);
    // The toast's buttons go with it: put focus back where the change was made.
    if (hadFocus) requestAnimationFrame(() => focusTarget(leadId)?.focus({ preventScroll: true }));
  }, [notice, focusTarget]);

  const undo = useCallback(
    (change: StatusChange) => {
      dismiss();
      changeStatus(change);
    },
    [dismiss, changeStatus],
  );

  const value = useMemo<StatusContextValue>(
    () => ({
      shownStatus: (leadId, serverStatus) => pending[leadId] ?? serverStatus,
      isPending: (leadId) => leadId in pending,
      changeStatus,
    }),
    [pending, changeStatus],
  );

  return (
    <StatusContext value={value}>
      {children}
      <StatusToast notice={notice} onDismiss={dismiss} onUndo={undo} />
    </StatusContext>
  );
}

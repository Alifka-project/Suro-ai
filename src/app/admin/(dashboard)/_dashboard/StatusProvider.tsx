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
import { LEAD_STATUS, isClientStatus, type ClientStatus } from "@/lib/admin/labels";
import {
  removeClient,
  restoreClient,
  setClientStatus,
  type RemoveClientResult,
  type StatusChangeResult,
} from "./actions";
import { RemoveClientDialog, type RemoveTarget } from "./RemoveClientDialog";
import { StatusToast, type StatusNotice, type UndoAction } from "./StatusToast";

/*
 * Row actions for the whole clients table: status changes (the optimistic
 * value each select shows while its change is on the way) and "Remove" (the
 * confirmation, and hiding the row while it is being removed), with one result
 * message (toast + screen-reader announcement) for both.
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
  to: ClientStatus;
  /** Set on the change an "Undo" button makes, so it doesn't offer another undo. */
  isUndo?: boolean;
};

type StatusContextValue = {
  /** The status to show for a client: the optimistic one while a change is pending. */
  shownStatus: (leadId: string, serverStatus: LeadStatus) => LeadStatus;
  /** A status change or a removal of this client is on the way. */
  isPending: (leadId: string) => boolean;
  changeStatus: (change: StatusChange) => void;
  /** Asks to confirm, then removes the client from the list. */
  requestRemove: (target: RemoveTarget) => void;
  /** The client is being removed: its row is hidden until the table refreshes. */
  isRemoving: (leadId: string) => boolean;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function useClientStatus(): StatusContextValue {
  const ctx = use(StatusContext);
  if (!ctx) throw new Error("useClientStatus must be used inside <StatusProvider>");
  return ctx;
}

const NO_PENDING: Readonly<Record<string, LeadStatus>> = {};
const NO_REMOVALS: Readonly<Record<string, true>> = {};

const UNREACHABLE = {
  ok: false,
  message: "Could not reach the server. Check your connection and try again.",
} as const satisfies StatusChangeResult & RemoveClientResult;

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
    // Undo is offered back to any dashboard status (a CRM-only stage can't be set from here).
    undo:
      change.isUndo || !isClientStatus(change.from)
        ? null
        : {
            kind: "status",
            label: `set ${change.name} back to ${LEAD_STATUS[change.from].label}`,
            change: { leadId: change.leadId, name: change.name, from: change.to, to: change.from, isUndo: true },
          },
  };
}

function removalNotice(
  target: { leadId: string; name: string },
  restore: boolean,
  result: RemoveClientResult,
  id: number,
): StatusNotice {
  if (!result.ok) {
    return {
      id,
      leadId: target.leadId,
      ok: false,
      title: restore ? `${target.name}: not restored` : `${target.name}: not removed`,
      message: result.message,
    };
  }
  return {
    id,
    leadId: target.leadId,
    ok: true,
    kind: restore ? "restored" : "removed",
    title: restore ? "Client restored" : "Client removed",
    message: result.message,
    undo: restore
      ? null
      : { kind: "restore", label: `put ${target.name} back on the list`, leadId: target.leadId, name: target.name },
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
  // Clients being removed: hidden at once, until the refreshed table no longer has them.
  const [removing, addRemoving] = useOptimistic(
    NO_REMOVALS,
    (state: Readonly<Record<string, true>>, leadId: string) => ({ ...state, [leadId]: true as const }),
  );
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const [confirming, setConfirming] = useState<RemoveTarget | null>(null);
  const noticeCount = useRef(0);

  const show = useCallback((next: (id: number) => StatusNotice) => {
    noticeCount.current += 1;
    const n = next(noticeCount.current);
    // In a transition, so the message lands together with the refreshed rows.
    startTransition(() => setNotice(n));
  }, []);

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
        show((id) => noticeFor(change, result, id));
      });
    },
    [addPending, show],
  );

  const setRemoved = useCallback(
    (target: { leadId: string; name: string }, restore: boolean) => {
      startTransition(async () => {
        if (!restore) addRemoving(target.leadId);
        let result: RemoveClientResult;
        try {
          result = await (restore ? restoreClient : removeClient)({ leadId: target.leadId });
        } catch {
          result = UNREACHABLE;
        }
        show((id) => removalNotice(target, restore, result, id));
      });
    },
    [addRemoving, show],
  );

  const confirmRemove = useCallback(() => {
    if (!confirming) return;
    setConfirming(null);
    setRemoved(confirming, false);
    // The row, and the Remove button the dialog would hand focus back to, are
    // hidden at once. A frame later the dialog has closed (until then the rest
    // of the page is inert), so keyboard users continue from the heading.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.closest("dialog")) {
        document.getElementById(headingId)?.focus({ preventScroll: true });
      }
    });
  }, [confirming, setRemoved, headingId]);

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
    (action: UndoAction) => {
      dismiss();
      if (action.kind === "status") changeStatus(action.change);
      else setRemoved({ leadId: action.leadId, name: action.name }, true);
    },
    [dismiss, changeStatus, setRemoved],
  );

  const value = useMemo<StatusContextValue>(
    () => ({
      shownStatus: (leadId, serverStatus) => pending[leadId] ?? serverStatus,
      isPending: (leadId) => leadId in pending || leadId in removing,
      changeStatus,
      requestRemove: setConfirming,
      isRemoving: (leadId) => leadId in removing,
    }),
    [pending, removing, changeStatus],
  );

  return (
    <StatusContext value={value}>
      {children}
      <RemoveClientDialog target={confirming} onCancel={() => setConfirming(null)} onConfirm={confirmRemove} />
      <StatusToast notice={notice} onDismiss={dismiss} onUndo={undo} />
    </StatusContext>
  );
}

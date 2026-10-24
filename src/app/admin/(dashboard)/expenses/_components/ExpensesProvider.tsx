"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleCheck, X } from "lucide-react";
import { LIST_HEADING_ID } from "../_lib/filters";
import { DeleteExpenseDialog } from "./DeleteExpenseDialog";
import { ExpenseDialog, type ExpenseDialogHandle } from "./ExpenseDialog";
import type { ExpenseRow, ProjectOption } from "../_lib/types";

/*
 * Owns the page's one add/edit dialog, the delete confirmation and the
 * confirmation toast, so every "Add expense", "Edit" and "Delete" button on
 * the page (header, empty states, table rows, phone cards) opens the same
 * dialog. Wraps the whole page; the page content itself stays server-rendered.
 */

type ExpensesActions = {
  openAdd: () => void;
  openEdit: (expense: ExpenseRow) => void;
  askDelete: (expense: ExpenseRow) => void;
};

const ExpensesContext = createContext<ExpensesActions | null>(null);

export function useExpenseActions(): ExpensesActions {
  const ctx = use(ExpensesContext);
  if (!ctx) throw new Error("useExpenseActions must be used inside <ExpensesProvider>.");
  return ctx;
}

/** Confirmations disappear after this long (paused while hovered or focused); they are announced as they appear. */
const TOAST_MS = 6000;

type Notice = { text: string; at: number };

export function ExpensesProvider({
  projects,
  today,
  presetLeadId,
  openOnLoad,
  children,
}: {
  projects: ProjectOption[];
  /** Today on the business clock ("YYYY-MM-DD"), from the server. */
  today: string;
  /** The client the list is filtered to, when it can take new expenses: new expenses default to it. */
  presetLeadId: string;
  /** ?add=1 */
  openOnLoad: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<ExpenseDialogHandle>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);

  const actions = useMemo<ExpensesActions>(
    () => ({
      openAdd: () => dialog.current?.openAdd(presetLeadId),
      openEdit: (expense) => dialog.current?.openEdit(expense),
      askDelete: (expense) => setDeleting(expense),
    }),
    [presetLeadId],
  );

  const onSaved = useCallback((text: string, at: number) => setNotice({ text, at }), []);

  const onDeleted = useCallback((text: string, at: number) => {
    setNotice({ text, at });
    // The row (and the Delete button focus went back to) is about to vanish:
    // land on the list heading instead of the top of the page.
    document.getElementById(LIST_HEADING_ID)?.focus();
  }, []);

  return (
    <ExpensesContext value={actions}>
      {children}

      <ExpenseDialog
        ref={dialog}
        projects={projects}
        today={today}
        initialLeadId={presetLeadId}
        openOnLoad={openOnLoad}
        onSaved={onSaved}
      />
      {deleting && (
        <DeleteExpenseDialog
          key={deleting.id}
          expense={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={onDeleted}
        />
      )}

      <Toast notice={notice} onDismiss={dismiss} />
    </ExpensesContext>
  );
}

/**
 * The confirmation after a save or a delete, like the dashboard's StatusToast:
 * a visually hidden live region that is always mounted (so every message is
 * announced, without the Dismiss button read as part of it), and the visible
 * toast, which fades after TOAST_MS unless the pointer or focus is on it.
 */
function Toast({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const [held, setHeld] = useState(false);
  // A new message starts its own timer (render-time reset, not an effect).
  const [seen, setSeen] = useState(notice);
  if (notice !== seen) {
    setSeen(notice);
    setHeld(false);
  }

  useEffect(() => {
    if (!notice || held) return;
    const timer = window.setTimeout(onDismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, onDismiss]);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {notice && <p key={notice.at}>{notice.text}</p>}
      </div>

      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end print:hidden">
        {notice && (
          <div
            key={notice.at}
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
            }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl bg-ink-900 px-3.5 py-3 text-[0.84rem] text-white shadow-[0_18px_40px_-18px_rgb(7_38_60/0.7)]"
          >
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-400" aria-hidden="true" />
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{notice.text}</p>
            {/* 36px on phones, 32px from sm, like the dashboard's toast. */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss message"
              className="-my-2 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white sm:-my-1.5 sm:-mr-1.5 sm:h-8 sm:w-8"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

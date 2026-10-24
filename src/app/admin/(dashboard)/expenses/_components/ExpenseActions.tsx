"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { buttonClass, cn } from "@/components/admin/ui";
import { TableTip } from "../../_dashboard/TableTip";
import type { ExpenseRow } from "../_lib/types";
import { useExpenseActions } from "./ExpensesProvider";

/* The buttons that open the page's shared dialogs (see ExpensesProvider). */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500";

export function AddExpenseButton({
  id,
}: {
  /** ADD_BUTTON_ID on the page header's button, which takes focus when the ?add=1 dialog closes. */
  id?: string;
}) {
  const { openAdd } = useExpenseActions();
  return (
    <button id={id} type="button" onClick={openAdd} className={cn(buttonClass("primary"), FOCUS_RING)}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add expense
    </button>
  );
}

/** "Fuel for the site visit, AED 250.00, 24 Oct 2026": names the expense for screen readers. */
function nameOf(row: ExpenseRow): string {
  return `${row.description}, ${row.amountLabel}, ${row.dateLabel}`;
}

const ICON =
  "flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset transition-colors";

/**
 * Edit and Delete for one expense: compact icon buttons with tooltips in the
 * desktop table, full-width labelled buttons on the phone cards.
 */
export function ExpenseRowActions({ row, layout }: { row: ExpenseRow; layout: "icons" | "buttons" }) {
  const { openEdit, askDelete } = useExpenseActions();
  const name = nameOf(row);

  if (layout === "icons") {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <TableTip text="Edit">
          <button
            type="button"
            onClick={() => openEdit(row)}
            aria-label={`Edit expense: ${name}`}
            className={cn(ICON, FOCUS_RING, "bg-white text-ink-700 ring-ink-200 hover:bg-haze hover:text-ink-900")}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TableTip>
        <TableTip text="Delete">
          <button
            type="button"
            onClick={() => askDelete(row)}
            aria-label={`Delete expense: ${name}`}
            className={cn(ICON, FOCUS_RING, "bg-white text-red-600 ring-red-200 hover:bg-red-50")}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TableTip>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <button type="button" onClick={() => openEdit(row)} className={cn(buttonClass("secondary"), FOCUS_RING)}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit
        <span className="sr-only"> expense: {name}</span>
      </button>
      <button type="button" onClick={() => askDelete(row)} className={cn(buttonClass("danger"), FOCUS_RING)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
        <span className="sr-only"> expense: {name}</span>
      </button>
    </div>
  );
}

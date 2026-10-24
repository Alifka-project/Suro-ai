"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { useClientStatus } from "./StatusProvider";
import { TableTip } from "./TableTip";
import type { ClientRow } from "./types";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500";

/**
 * "Remove" for one client: opens the table's confirmation dialog. An icon in
 * the table's last column, a text button on the phone cards. Marked
 * aria-disabled (not disabled, which would drop keyboard focus) while a status
 * change for the same client is on the way.
 */
export function RemoveButton({ row, variant }: { row: ClientRow; variant: "icon" | "card" }) {
  const { requestRemove, isPending } = useClientStatus();
  const pending = isPending(row.id);
  const onClick = () => {
    if (pending) return;
    requestRemove({
      leadId: row.id,
      name: row.fullName,
      quoteCount: row.quoteCount,
      invoiceCount: row.invoiceCount,
      costCount: row.costCount,
    });
  };

  if (variant === "icon") {
    return (
      <TableTip text="Remove">
        <button
          type="button"
          onClick={onClick}
          aria-disabled={pending || undefined}
          aria-label={`Remove ${row.fullName} from the client list`}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-ink-550 ring-1 ring-inset ring-ink-200 transition-colors",
            "hover:bg-red-500/10 hover:text-red-600 hover:ring-red-500/30",
            pending && "cursor-progress opacity-60",
            FOCUS_RING,
          )}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TableTip>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={pending || undefined}
      className={cn(
        "-mr-2 mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[0.82rem] font-semibold text-ink-600 transition-colors",
        "hover:bg-red-500/10 hover:text-red-700",
        pending && "cursor-progress opacity-60",
        FOCUS_RING,
      )}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      Remove
      <span className="sr-only"> {row.fullName} from the client list</span>
    </button>
  );
}

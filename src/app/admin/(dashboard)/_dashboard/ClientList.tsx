"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientCard } from "./ClientCard";
import { TableDesktop } from "./TableDesktop";
import type { ClientRow } from "./types";

/**
 * The rows of the clients table: a real table from xl up, a card list below.
 * Owns which clients have their details open (shared by both layouts).
 *
 * A client linked from elsewhere (?client=<id>, e.g. the new-enquiry email)
 * is highlighted, opened and scrolled into view.
 */
export function ClientList({ rows, now, focus }: { rows: ClientRow[]; now: string; focus: string | null }) {
  const focusId = focus && rows.some((r) => r.id === focus) ? focus : null;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(focusId ? [focusId] : []));
  // A new ?client= arriving by navigation opens that client too (render-time sync, not an effect).
  const [seenFocus, setSeenFocus] = useState(focusId);
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);
    if (focusId) setExpanded((prev) => (prev.has(focusId) ? prev : new Set(prev).add(focusId)));
  }

  useEffect(() => {
    if (!focusId) return;
    // A frame later, so this wins over the browser's own jump to #clients.
    const frame = requestAnimationFrame(() => {
      const target = [
        document.getElementById(`client-row-${focusId}`),
        document.getElementById(`client-card-${focusId}`),
      ].find((el) => el && el.getClientRects().length > 0);
      target?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <>
      <div className="hidden xl:block">
        <TableDesktop rows={rows} now={now} focusId={focusId} expanded={expanded} onToggle={toggle} />
      </div>
      <ul className="divide-y divide-ink-100 xl:hidden" aria-label="Clients">
        {rows.map((row) => (
          <ClientCard
            key={row.id}
            row={row}
            now={now}
            focused={row.id === focusId}
            open={expanded.has(row.id)}
            onToggle={toggle}
          />
        ))}
      </ul>
    </>
  );
}

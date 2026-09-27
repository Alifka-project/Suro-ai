import type { ReactNode } from "react";
import { cn } from "@/components/admin/ui";

/**
 * Compact two-column table — the table view behind each chart. Narrow enough
 * to sit in a phone-width card without the horizontal scroll the full <Table>
 * needs. Header styling mirrors the kit's <Th>.
 */
export function MiniTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [string, string];
  rows: { key: string; label: ReactNode; value: ReactNode; muted?: boolean }[];
}) {
  const head = "border-b border-ink-100 py-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-550";
  return (
    <table className="w-full border-collapse text-left text-[0.82rem]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={head}>
            {columns[0]}
          </th>
          <th scope="col" className={cn(head, "text-right")}>
            {columns[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="border-b border-ink-100/70 py-2 pr-3 font-normal text-ink-700">
              {row.label}
            </th>
            <td
              className={cn(
                "border-b border-ink-100/70 py-2 text-right tabular-nums",
                // Zero rows step back by weight, not by contrast, so they stay readable.
                row.muted ? "font-normal text-ink-600" : "font-semibold text-ink-900",
              )}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

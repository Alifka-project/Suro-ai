import { CalendarDays } from "lucide-react";
import { TONE_DOT, formatDate, type Tone } from "@/lib/admin/labels";
import { Badge, cn } from "@/components/admin/ui";
import { progressPercent } from "../_lib/format";

/* Small presentational pieces shared by the board, list and detail views.
   Server-safe: no hooks, no event handlers. */

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone], className)} />;
}

export function ProgressBar({
  value,
  label,
  size = "sm",
  tone = "brand",
}: {
  value: number;
  label: string;
  size?: "sm" | "lg";
  tone?: "brand" | "mint";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const mint = tone === "mint" || pct === 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("w-full overflow-hidden rounded-full bg-ink-100", size === "lg" ? "h-3" : "h-1.5")}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          mint ? "bg-linear-to-r from-mint-600 to-mint-400" : "bg-linear-to-r from-abyss-600 via-azure-500 to-aqua-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** "3 of 5 tasks · 60%" with a bar; reads "No tasks yet" for an empty project. */
export function TaskProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = progressPercent(done, total);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.72rem]">
        <span className="text-ink-500">{total === 0 ? "No tasks yet" : `${done} of ${total} tasks`}</span>
        {total > 0 && <span className="font-semibold tabular-nums text-ink-700">{pct}%</span>}
      </div>
      <ProgressBar value={pct} label={label} />
    </div>
  );
}

export function DueDate({ date, overdue }: { date: Date | null; overdue: boolean }) {
  if (!date) {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-500">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        No due date
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1.5", overdue ? "font-medium text-red-600" : "text-ink-600")}>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {formatDate(date)}
      </span>
      {overdue && <Badge tone="red">Overdue</Badge>}
    </span>
  );
}

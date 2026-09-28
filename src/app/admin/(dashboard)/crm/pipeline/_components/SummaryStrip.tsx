import Link from "next/link";
import type { ReactNode } from "react";
import { AlarmClock, Scale, Target, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { plural } from "../../_lib/helpers";
import type { PipelineSummary } from "../_lib/data";

/** Compact figure, with the exact amount on hover and for screen readers. */
function Money({ fils }: { fils: number }) {
  const full = formatMoney(fils);
  return (
    <span title={full}>
      <span aria-hidden="true">{formatMoneyCompact(fils)}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

function Figure({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <li className="flex min-w-0 items-start gap-3 bg-white p-4">
      <span
        className={cn(
          "hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-[0_8px_18px_-10px_rgb(7_38_60/0.7)] sm:flex",
          accent,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.76rem] font-medium text-ink-550">{label}</p>
        <p className="mt-1 truncate font-display text-[1.3rem] font-bold leading-none tabular-nums text-ink-900">{value}</p>
        <p className="mt-1.5 text-[0.72rem] leading-snug text-ink-550">{hint}</p>
      </div>
    </li>
  );
}

/**
 * Headline numbers above the board. They follow the same filters as the
 * cards, so "Mine" shows your own pipeline.
 */
export function SummaryStrip({
  summary,
  overdueHref,
  filtered,
}: {
  summary: PipelineSummary;
  /** The board filtered to overdue activities, keeping the other filters. */
  overdueHref: string;
  filtered: boolean;
}) {
  const { wonThisMonth } = summary;
  return (
    <section aria-label={filtered ? "Pipeline summary for the current filters" : "Pipeline summary"} className="mb-5">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-[0_1px_2px_rgb(7_38_60/0.04),0_8px_24px_-14px_rgb(7_38_60/0.10)] lg:grid-cols-4">
        <Figure
          label="Open pipeline"
          value={<Money fils={summary.openExpectedFils} />}
          hint={`Expected revenue · ${plural(summary.openCount, "open opportunity", "open opportunities")}`}
          icon={Target}
          accent="from-abyss-600 to-azure-500"
        />
        <Figure
          label="Weighted revenue"
          value={<Money fils={summary.weightedFils} />}
          hint="Open pipeline × win probability"
          icon={Scale}
          accent="from-azure-500 to-aqua-500"
        />
        <Figure
          label="Overdue activities"
          value={
            <span className={summary.overdueActivities > 0 ? "text-red-600" : undefined}>
              {summary.overdueActivities.toLocaleString("en-GB")}
            </span>
          }
          hint={
            summary.overdueActivities > 0 ? (
              <Link href={overdueHref} className="font-semibold text-abyss-600 hover:underline">
                Show overdue
              </Link>
            ) : (
              "Nothing overdue"
            )
          }
          icon={AlarmClock}
          accent={summary.overdueActivities > 0 ? "from-red-500 to-blush-500" : "from-aqua-500 to-mint-600"}
        />
        <Figure
          label="Won this month"
          value={<Money fils={wonThisMonth.valueFils} />}
          hint={`${plural(wonThisMonth.count, "deal")} won in ${wonThisMonth.monthLabel}`}
          icon={Trophy}
          accent="from-mint-600 to-aqua-500"
        />
      </ul>
      {filtered && (
        <p className="mt-2 text-[0.72rem] text-ink-550">These figures follow the filters below.</p>
      )}
    </section>
  );
}

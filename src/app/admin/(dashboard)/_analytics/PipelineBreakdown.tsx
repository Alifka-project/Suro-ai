"use client";

import { useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { Card, CardHeader, EmptyState, cn } from "@/components/admin/ui";
import { CHART } from "./palette";
import { Segmented } from "./Segmented";

type Metric = "count" | "value";

export type PipelineRow = {
  status: string;
  label: string;
  /** Tailwind class for the stage dot: the LEAD_STATUS tone the CRM uses. */
  dotClass: string;
  count: number;
  valueFils: number;
  /** Pre-formatted on the server so hydration can't disagree. */
  valueCompact: string;
  valueFull: string;
};

/**
 * Funnel-style bar list: one row per board stage (New … Won; lost
 * opportunities are out of the pipeline), bar length by count or by expected
 * revenue. Every number is printed beside its bar, so the
 * list is its own table view and nothing hides behind a hover. The dot beside
 * each stage is that stage's CRM colour; the bars share one hue because they
 * encode a single measure.
 */
export function PipelineBreakdown({
  stages,
  totalLeads,
  footnote,
  className,
}: {
  stages: PipelineRow[];
  totalLeads: number;
  footnote?: string;
  className?: string;
}) {
  const [metric, setMetric] = useState<Metric>("count");
  const measure = (s: PipelineRow) => (metric === "count" ? s.count : s.valueFils);
  const max = Math.max(0, ...stages.map(measure));
  const hasValues = stages.some((s) => s.valueFils > 0);

  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader
        title="Pipeline by stage"
        subtitle={`${totalLeads} ${totalLeads === 1 ? "opportunity" : "opportunities"} on the board · lost excluded`}
        action={
          totalLeads > 0 ? (
            <Segmented<Metric>
              label="Size bars by"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "count", label: "Leads" },
                { value: "value", label: "Value" },
              ]}
            />
          ) : undefined
        }
      />

      {totalLeads === 0 ? (
        <EmptyState
          icon={Target}
          title="Nothing in the pipeline"
          description="Website enquiries and the cards you add on the pipeline board land here, stage by stage."
        />
      ) : (
        <>
          {metric === "value" && !hasValues && (
            <p className="mb-3 rounded-xl bg-haze px-3 py-2 text-[0.78rem] text-ink-500">
              No opportunity has an expected revenue yet. Add one on the lead page to size the pipeline.
            </p>
          )}
          <ul className="space-y-3.5" aria-label="Leads per pipeline stage">
            {stages.map((s) => {
              const v = measure(s);
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <li key={s.status}>
                  <Link
                    href={`/admin/crm?status=${s.status}`}
                    className="group -mx-2 block rounded-xl px-2 py-1 transition-colors hover:bg-haze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400/60"
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[0.8rem]">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-ink-700">
                        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", s.dotClass)} />
                        <span className="truncate">{s.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {metric === "count" ? (
                          <>
                            <span className="font-semibold text-ink-900">{s.count}</span>
                            <span className="ml-1.5 text-ink-600" title={s.valueFull}>
                              {s.valueFils > 0 ? s.valueCompact : "—"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-ink-900" title={s.valueFull}>
                              {s.valueFils > 0 ? s.valueCompact : "—"}
                            </span>
                            <span className="ml-1.5 text-ink-600">
                              {s.count} {s.count === 1 ? "lead" : "leads"}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[3px] bg-ink-100/60">
                      <div
                        className="h-full rounded-[3px] transition-[width] duration-500 ease-out"
                        style={{
                          width: v > 0 ? `max(${pct}%, 4px)` : "0%",
                          backgroundColor: CHART.abyss,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {footnote && <p className="mt-4 border-t border-ink-100 pt-3 text-[0.75rem] text-ink-500">{footnote}</p>}
        </>
      )}
    </Card>
  );
}

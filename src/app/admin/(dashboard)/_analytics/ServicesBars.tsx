import { Layers } from "lucide-react";
import { Card, CardHeader, EmptyState, cn } from "@/components/admin/ui";
import { CHART } from "./palette";

/**
 * How often each service is ticked on the enquiry form. A horizontal bar list
 * rather than a chart: the service names are long, and printing each count
 * beside its bar makes the list its own table view. One series, one hue.
 */
export function ServicesBars({
  items,
  totalLeads,
  className,
}: {
  items: { service: string; count: number }[];
  totalLeads: number;
  className?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.count));

  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader title="Services requested" subtitle="Share of all leads asking for each service" />
      {items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No requests yet"
          description="Services ticked on the enquiry form will be tallied here."
        />
      ) : (
        <ul className="space-y-3" aria-label="Leads per requested service">
          {items.map(({ service, count }) => {
            const share = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            const pct = max > 0 ? (count / max) * 100 : 0;
            return (
              <li key={service}>
                <div className="flex items-baseline justify-between gap-3 text-[0.8rem]">
                  <span className="min-w-0 truncate font-medium text-ink-700" title={service}>
                    {service}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-ink-900">{count}</span>
                    <span className="ml-1.5 text-ink-600">{share}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[3px] bg-ink-100/60">
                  <div
                    className="h-full rounded-[3px]"
                    style={{ width: `max(${pct}%, 4px)`, backgroundColor: CHART.aqua }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

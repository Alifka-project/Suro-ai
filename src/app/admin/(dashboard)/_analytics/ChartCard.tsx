"use client";

import { useState, type ReactNode } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { Card, CardHeader, cn } from "@/components/admin/ui";
import { Segmented } from "./Segmented";

type View = "chart" | "table";

/**
 * Card that holds one chart plus its table twin. The table is the accessible
 * equivalent of the plot — every value the tooltip shows is reachable there
 * without hovering. When there is nothing to plot, pass `table={undefined}`
 * and the toggle disappears.
 */
export function ChartCard({
  title,
  subtitle,
  table,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");
  const showTable = view === "table" && table !== undefined;

  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          table !== undefined ? (
            <Segmented<View>
              label="Display as"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Show chart", icon: ChartColumn, iconOnly: true },
                { value: "table", label: "Show table", icon: Table2, iconOnly: true },
              ]}
            />
          ) : undefined
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">{showTable ? table : children}</div>
    </Card>
  );
}

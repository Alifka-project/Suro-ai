"use client";

import { useId, useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { CHART } from "./palette";

/* Chart specs shared by both plots: hairline solid gridlines on one axis only,
   no axis rules, muted tick text, thin marks. The plot box has a 240px floor
   that already includes the x-axis band (so the card never scrolls) and grows
   to fill the card when a taller neighbour in the same grid row stretches it.

   Accessibility: the plot is a visual duplicate. Its words live in the sr-only
   figcaption and its numbers in the card's table view (the chart/table
   toggle), so recharts' keyboard layer is turned off (it would add an unnamed
   role="application" tab stop) and the SVG is hidden from assistive tech. */

const PLOT_CLASS = "min-h-[240px] w-full flex-1";
const TICK = { fill: CHART.muted, fontSize: 11 };
const axisNumber = new Intl.NumberFormat("en-AE", { notation: "compact", maximumFractionDigits: 1 });

/* Serializable point shapes (mirrors of the server types, kept local so this
   client module never imports from the server-only data loader). */
type WeeklyPoint = { key: string; label: string; range: string; count: number };
type MonthlyPoint = { key: string; label: string; fullLabel: string; fils: number };

/** Tooltip card: value first and strong, the label under it, keyed by a short line of the series colour. */
function TooltipCard({ color, value, label }: { color: string; value: ReactNode; label: ReactNode }) {
  return (
    <div className="pointer-events-none rounded-xl border border-ink-100 bg-white px-3 py-2 shadow-[0_10px_30px_-12px_rgb(7_38_60_/_0.35)]">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[0.85rem] font-bold text-ink-900 tabular-nums">{value}</span>
      </div>
      <p className="mt-0.5 pl-5 text-[0.72rem] text-ink-500">{label}</p>
    </div>
  );
}

function pointOf<T>(props: TooltipContentProps): T | undefined {
  if (!props.active) return undefined;
  return props.payload?.[0]?.payload as T | undefined;
}

// ─── Leads per week ─────────────────────────────────────────────────────────

function renderLeadsTooltip(props: TooltipContentProps) {
  const point = pointOf<WeeklyPoint>(props);
  if (!point) return null;
  return (
    <TooltipCard
      color={CHART.azure}
      value={`${point.count} ${point.count === 1 ? "lead" : "leads"}`}
      label={`Week of ${point.range}`}
    />
  );
}

export function LeadsTrendChart({ data, summary }: { data: WeeklyPoint[]; summary: string }) {
  // SVG ids must be unique per page and safe inside url(#…).
  const fillId = `leads-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <figure className="m-0 flex flex-1 flex-col">
      <div className={PLOT_CLASS} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.azure} stopOpacity={0.16} />
                <stop offset="100%" stopColor={CHART.azure} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={30}
              tickMargin={4}
            />
            <Tooltip
              content={renderLeadsTooltip}
              cursor={{ stroke: CHART.cursor, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Leads"
              stroke={CHART.azure}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${fillId})`}
              dot={false}
              activeDot={{ r: 4, fill: CHART.azure, stroke: CHART.surface, strokeWidth: 2 }}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

// ─── Revenue per month ──────────────────────────────────────────────────────

export function RevenueChart({
  data,
  currency,
  summary,
}: {
  data: MonthlyPoint[];
  currency: string;
  summary: string;
}) {
  // Direct-label only the best month; the axis, tooltip and table carry the rest.
  const plotted = useMemo(() => {
    const peak = data.reduce((best, p, i) => (p.fils > data[best].fils ? i : best), 0);
    return data.map((p, i) => ({
      ...p,
      peakLabel: i === peak && p.fils > 0 ? formatMoneyCompact(p.fils, currency) : null,
    }));
  }, [data, currency]);

  const renderTooltip = (props: TooltipContentProps) => {
    const point = pointOf<MonthlyPoint>(props);
    if (!point) return null;
    return <TooltipCard color={CHART.abyss} value={formatMoney(point.fils, currency)} label={point.fullLabel} />;
  };

  return (
    <figure className="m-0 flex flex-1 flex-col">
      <div className={PLOT_CLASS} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={plotted} margin={{ top: 24, right: 20, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              tickMargin={4}
              tickFormatter={(fils: number) => axisNumber.format(fils / 100)}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ fill: CHART.haze, opacity: 0.8 }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="fils"
              name="Collected"
              fill={CHART.abyss}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              activeBar={{ fill: CHART.abyssHover }}
              animationDuration={600}
            >
              <LabelList
                dataKey="peakLabel"
                position="top"
                offset={8}
                fill={CHART.ink}
                fontSize={11}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

"use client";

import { useMemo, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Banknote, MessagesSquare } from "lucide-react";
import { EmptyState, cn } from "@/components/admin/ui";
import { formatMoney } from "@/lib/admin/money";
import { ChartCard } from "../_analytics/ChartCard";
import { CHART } from "../_analytics/palette";
import type { EngagementPoint, RevenuePoint } from "./types";

/*
 * The dashboard's two monthly charts: columns for the main measure, a line for
 * the second one, on ONE shared y-axis (both series in a chart use the same
 * unit, so no second scale is needed).
 *
 * Series colours are SULOAI brand steps, checked as pairs for colour-blind
 * separation and 3:1 contrast on white:
 *   Revenue     — Collected columns abyss-600, Invoiced line aqua-600.
 *   Engagement  — Clients added columns azure-500, Clients engaged line blush-ink.
 * Text never takes a series colour; identity comes from the key beside it.
 *
 * Accessibility: the SVG is a visual duplicate and is hidden from assistive
 * tech (recharts' keyboard layer would add an unnamed tab stop). Its words are
 * in the sr-only figcaption and its numbers in the card's table view.
 *
 * Hydration: the subtitle and summary arrive as strings formatted on the
 * server. Everything formatted here (ticks, tooltip, table view) renders only
 * in the browser, after measuring or after a click.
 */

const COLOR = {
  collected: CHART.abyss,
  invoiced: CHART.aqua,
  enquiries: CHART.azure,
  /** azure-600: the hovered "clients added" column, one step darker. */
  enquiriesHover: "#2673c4",
  /** blush-ink. */
  engaged: "#b02e63",
} as const;

/** Plot box with a 240px floor that already includes the x-axis band; grows when the neighbouring card is taller. */
const PLOT_CLASS = "min-h-[240px] w-full flex-1";
const TICK = { fill: CHART.muted, fontSize: 11 };
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const axisCompact = new Intl.NumberFormat("en-AE", { notation: "compact", maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat("en-AE");

type SeriesKind = "bar" | "line";
type Series = { label: string; color: string; kind: SeriesKind };

// ─── Shared pieces ──────────────────────────────────────────────────────────

/** Legend key that mirrors the mark: a block for columns, a line with a dot for lines. */
function Key({ color, kind }: { color: string; kind: SeriesKind }) {
  if (kind === "bar") {
    return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />;
  }
  return (
    <span aria-hidden="true" className="relative flex h-2.5 w-4 shrink-0 items-center">
      <span className="h-0.5 w-full rounded-full" style={{ backgroundColor: color }} />
      <span
        className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/** Legend row above the plot, with the unit on the right. Part of the visual; the figcaption carries the words. */
function Legend({ series, unit }: { series: Series[]; unit?: string }) {
  return (
    <div aria-hidden="true" className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-700">
            <Key color={s.color} kind={s.kind} />
            {s.label}
          </li>
        ))}
      </ul>
      {unit && <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-550">{unit}</span>}
    </div>
  );
}

/** One tooltip for the month: every series, value first and strong, keyed by a short line of the series colour. */
function TooltipCard({ title, rows }: { title: string; rows: { label: string; color: string; value: string }[] }) {
  return (
    <div className="pointer-events-none min-w-[11rem] rounded-xl border border-ink-100 bg-white px-3 py-2 shadow-[0_10px_30px_-12px_rgb(7_38_60_/_0.35)]">
      <p className="text-[0.72rem] font-medium text-ink-550">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="text-[0.85rem] font-bold text-ink-900 tabular-nums">{r.value}</span>
            <span className="text-[0.72rem] text-ink-550">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function pointOf<T>(props: TooltipContentProps): T | undefined {
  if (!props.active) return undefined;
  return props.payload?.[0]?.payload as T | undefined;
}

type MonthRow = { key: string; label: string; values: [string, string]; zero: [boolean, boolean] };

/**
 * The table twin of a chart: newest month first, two value columns, a total
 * row. Narrow enough for a phone-width card; the wrapper only scrolls if a
 * very long amount ever needs it.
 */
function MonthTable({
  caption,
  columns,
  rows,
  totals,
}: {
  caption: string;
  columns: [string, string, string];
  rows: MonthRow[];
  totals: [string, string];
}) {
  const head = "border-b border-ink-100 py-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-550";
  const value = "border-b border-ink-100/70 py-2 pl-3 text-right whitespace-nowrap tabular-nums";
  return (
    <div className="relative min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.8rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(head, "pr-2")}>
              {columns[0]}
            </th>
            <th scope="col" className={cn(head, "pl-3 text-right")}>
              {columns[1]}
            </th>
            <th scope="col" className={cn(head, "pl-3 text-right")}>
              {columns[2]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="border-b border-ink-100/70 py-2 pr-2 font-normal text-ink-700">
                {row.label}
              </th>
              {row.values.map((v, i) => (
                <td
                  key={columns[i + 1]}
                  // Zero months step back by weight, not by contrast, so they stay readable.
                  className={cn(value, row.zero[i] ? "font-normal text-ink-600" : "font-semibold text-ink-900")}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="pt-2.5 pr-2 text-[0.78rem] font-semibold text-ink-900">
              Last 12 months
            </th>
            {totals.map((t, i) => (
              <td key={columns[i + 1]} className="pt-2.5 pl-3 text-right font-bold whitespace-nowrap text-ink-900 tabular-nums">
                {t}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** The figure: legend, plot (hidden from assistive tech) and the spoken summary. */
function Figure({ legend, summary, children }: { legend: ReactNode; summary: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col">
      {legend}
      <div className={PLOT_CLASS} aria-hidden="true">
        {children}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

/** X-axis ticks from the server's month labels ("Sep"), keyed by "2026-09" so equal labels can never collide. */
function useMonthLabels(points: { key: string; label: string }[]) {
  return useMemo(() => {
    const labels = new Map(points.map((p) => [p.key, p.label]));
    return (key: string) => labels.get(key) ?? key;
  }, [points]);
}

const X_AXIS = {
  dataKey: "key",
  tick: TICK,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 6,
  interval: "preserveStartEnd",
} as const;

const Y_AXIS = { tick: TICK, tickLine: false, axisLine: false, tickMargin: 4 } as const;

/** ComposedChart draws a vertical crosshair (not a band) at the hovered month. */
const CURSOR = { stroke: CHART.cursor, strokeWidth: 1 };

/* Line markers: an 8px dot in the series colour with a white ring outside it
   (paint-order draws the stroke under the fill, so the ring never eats into the dot). */
const lineDot = (color: string) => ({ r: 4, fill: color, stroke: CHART.surface, strokeWidth: 3, paintOrder: "stroke" });
const lineActiveDot = (color: string) => ({ r: 5.5, fill: color, stroke: CHART.surface, strokeWidth: 4, paintOrder: "stroke" });

// ─── Revenue ────────────────────────────────────────────────────────────────

const REVENUE_SERIES: Series[] = [
  { label: "Collected", color: COLOR.collected, kind: "bar" },
  { label: "Invoiced", color: COLOR.invoiced, kind: "line" },
];

export function RevenueChart({
  data,
  currency,
  subtitle,
  summary,
}: {
  data: RevenuePoint[];
  currency: string;
  /** One line with the 12-month total, formatted on the server. */
  subtitle: string;
  /** Spoken description of the chart, formatted on the server. */
  summary: string;
}) {
  const monthLabel = useMonthLabels(data);
  const hasData = data.some((p) => p.collectedFils > 0 || p.invoicedFils > 0);

  const renderTooltip = (props: TooltipContentProps) => {
    const point = pointOf<RevenuePoint>(props);
    if (!point) return null;
    return (
      <TooltipCard
        title={point.fullLabel}
        rows={[
          { label: "Collected", color: COLOR.collected, value: formatMoney(point.collectedFils, currency) },
          { label: "Invoiced", color: COLOR.invoiced, value: formatMoney(point.invoicedFils, currency) },
        ]}
      />
    );
  };

  const table = hasData ? (
    <MonthTable
      caption={`Revenue per month, last 12 months, ${currency}`}
      columns={["Month", "Collected", "Invoiced"]}
      rows={[...data].reverse().map((p) => ({
        key: p.key,
        label: p.fullLabel,
        values: [formatMoney(p.collectedFils, currency), formatMoney(p.invoicedFils, currency)],
        zero: [p.collectedFils === 0, p.invoicedFils === 0],
      }))}
      totals={[
        formatMoney(sum(data, (p) => p.collectedFils), currency),
        formatMoney(sum(data, (p) => p.invoicedFils), currency),
      ]}
    />
  ) : undefined;

  return (
    <ChartCard title="Monthly revenue" subtitle={subtitle} table={table}>
      {hasData ? (
        <Figure legend={<Legend series={REVENUE_SERIES} unit={currency} />} summary={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={MARGIN} barCategoryGap="28%" accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis {...X_AXIS} tickFormatter={monthLabel} />
              <YAxis {...Y_AXIS} width={40} tickFormatter={(fils: number) => axisCompact.format(fils / 100)} />
              <Tooltip content={renderTooltip} cursor={CURSOR} isAnimationActive={false} />
              <Bar
                dataKey="collectedFils"
                name="Collected"
                fill={COLOR.collected}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                activeBar={{ fill: CHART.abyssHover }}
              />
              <Line
                type="linear"
                dataKey="invoicedFils"
                name="Invoiced"
                stroke={COLOR.invoiced}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={lineDot(COLOR.invoiced)}
                activeDot={lineActiveDot(COLOR.invoiced)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Figure>
      ) : (
        <EmptyState
          icon={Banknote}
          title="No invoices in the last 12 months"
          description="Issued and paid invoices will be charted here month by month. Create one from a client's row in the table below."
        />
      )}
    </ChartCard>
  );
}

// ─── Customer engagement ────────────────────────────────────────────────────

/*
 * "Clients added", not "New enquiries": the columns count every client created
 * that month (website form or added by the team), whatever their status now,
 * while the "New enquiries" KPI tile counts clients whose status is still New.
 */
const ENGAGEMENT_SERIES: Series[] = [
  { label: "Clients added", color: COLOR.enquiries, kind: "bar" },
  { label: "Clients engaged", color: COLOR.engaged, kind: "line" },
];

export function EngagementChart({
  data,
  subtitle,
  summary,
}: {
  data: EngagementPoint[];
  /** One line with the 12-month total and what "engaged" means, formatted on the server. */
  subtitle: string;
  /** Spoken description of the chart, formatted on the server. */
  summary: string;
}) {
  const monthLabel = useMonthLabels(data);
  const hasData = data.some((p) => p.enquiries > 0 || p.engaged > 0);

  const renderTooltip = (props: TooltipContentProps) => {
    const point = pointOf<EngagementPoint>(props);
    if (!point) return null;
    return (
      <TooltipCard
        title={point.fullLabel}
        rows={[
          { label: "Clients added", color: COLOR.enquiries, value: countFormat.format(point.enquiries) },
          { label: "Clients engaged", color: COLOR.engaged, value: countFormat.format(point.engaged) },
        ]}
      />
    );
  };

  const table = hasData ? (
    <MonthTable
      caption="Clients added and clients engaged per month, last 12 months"
      columns={["Month", "Added", "Engaged"]}
      rows={[...data].reverse().map((p) => ({
        key: p.key,
        label: p.fullLabel,
        values: [countFormat.format(p.enquiries), countFormat.format(p.engaged)],
        zero: [p.enquiries === 0, p.engaged === 0],
      }))}
      totals={[
        countFormat.format(sum(data, (p) => p.enquiries)),
        // A client engaged in two months counts in both, so this column has no meaningful sum.
        "—",
      ]}
    />
  ) : undefined;

  return (
    <ChartCard title="Monthly engagement" subtitle={subtitle} table={table}>
      {hasData ? (
        <Figure legend={<Legend series={ENGAGEMENT_SERIES} />} summary={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={MARGIN} barCategoryGap="28%" accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis {...X_AXIS} tickFormatter={monthLabel} />
              <YAxis {...Y_AXIS} width={30} allowDecimals={false} />
              <Tooltip content={renderTooltip} cursor={CURSOR} isAnimationActive={false} />
              <Bar
                dataKey="enquiries"
                name="Clients added"
                fill={COLOR.enquiries}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                activeBar={{ fill: COLOR.enquiriesHover }}
              />
              <Line
                type="linear"
                dataKey="engaged"
                name="Clients engaged"
                stroke={COLOR.engaged}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={lineDot(COLOR.engaged)}
                activeDot={lineActiveDot(COLOR.engaged)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Figure>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="No clients or client activity yet"
          description="New clients and the clients your team works with will be charted here month by month."
        />
      )}
    </ChartCard>
  );
}

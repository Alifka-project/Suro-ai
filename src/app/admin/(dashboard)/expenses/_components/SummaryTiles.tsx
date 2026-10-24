import { BriefcaseBusiness, CalendarDays, PiggyBank, ReceiptText, TrendingDown } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { Money, Tile, type TileProps } from "../../_dashboard/Kpis";
import { expensesHref } from "../_lib/filters";
import type { ExpenseSummary } from "../_lib/types";

/*
 * The four figures at the top of the page, built from the dashboard's tiles
 * so both pages read alike. Last 12 business months, AED only, and not
 * affected by the list filters. Formatted on the server.
 *
 * Layout: one tile per row below 380px (at 360px, half a row is too narrow
 * for "Last 12 months" beside its icon); from 380px "This month" and "Last 12
 * months" share a row while Project costs and Profit take a full row each, so
 * the longest label never truncates; two columns from `sm`, including beside
 * the sidebar at `lg`; four across from `xl`. 23.75rem is 380px, written in
 * rem like the theme's breakpoints so Tailwind orders it before `xs`/`sm`.
 * The loading skeleton imports the same classes so nothing jumps.
 */

export const SUMMARY_GRID = "grid grid-cols-1 gap-3 min-[23.75rem]:grid-cols-2 sm:gap-4 xl:grid-cols-4";

/** Grid placement of tiles 1–4, in order. */
export const SUMMARY_SPANS = [
  "",
  "",
  "min-[23.75rem]:col-span-2 sm:col-span-1",
  "min-[23.75rem]:col-span-2 sm:col-span-1",
] as const;

const count = new Intl.NumberFormat("en-AE");

function plural(n: number, one: string, many: string) {
  return `${count.format(n)} ${n === 1 ? one : many}`;
}

/**
 * Money that may be negative. The dashboard's Money shows the compact amount
 * after a smaller currency code; a loss gets a real minus sign in front
 * ("−AED 12.5K") and is read out as "minus".
 */
function SignedMoney({ fils, currency }: { fils: number; currency: string }) {
  if (fils >= 0) return <Money fils={fils} currency={currency} />;
  const exact = formatMoney(-fils, currency);
  const compact = formatMoneyCompact(-fils, currency);
  const amount = compact.startsWith(currency) ? compact.slice(currency.length).trim() : compact;
  return (
    <span title={`−${exact}`}>
      <span aria-hidden="true">
        −<span className="mx-1 text-[0.8rem] font-semibold tracking-wide text-ink-550">{currency}</span>
        {amount}
      </span>
      <span className="sr-only">minus {exact}</span>
    </span>
  );
}

function thisMonthHint(s: ExpenseSummary): string {
  const last = s.lastMonthFils;
  if (s.thisMonthCount === 0) {
    return last > 0 ? `Nothing recorded yet. Last month: ${formatMoneyCompact(last, s.currency)}` : "Nothing recorded yet";
  }
  const recorded = plural(s.thisMonthCount, "expense", "expenses");
  if (last === 0) return `${recorded} · none last month`;
  const change = Math.round(((s.thisMonthFils - last) / last) * 100);
  if (change === 0) return `${recorded} · about the same as last month`;
  return `${recorded} · ${Math.abs(change)}% ${change > 0 ? "more" : "less"} than last month`;
}

export function SummaryTiles({ summary: s }: { summary: ExpenseSummary }) {
  const { currency } = s;
  const projectShare = s.last12Fils > 0 ? Math.round((s.projectCostsFils / s.last12Fils) * 100) : 0;
  const loss = s.profitFils < 0;

  const tiles: TileProps[] = [
    {
      label: "This month",
      value: <Money fils={s.thisMonthFils} currency={currency} />,
      hint: thisMonthHint(s),
      icon: CalendarDays,
      accent: "from-blush-500 to-lilac-600",
      href: expensesHref({ month: s.thisMonthKey }),
      linkHint: "Show this month's expenses in the list",
    },
    {
      label: "Last 12 months",
      value: <Money fils={s.last12Fils} currency={currency} />,
      hint:
        s.last12Count > 0
          ? `${plural(s.last12Count, "expense", "expenses")} · about ${formatMoneyCompact(Math.round(s.last12Fils / 12), currency)} a month`
          : "Nothing recorded yet",
      icon: ReceiptText,
      accent: "from-lilac-600 to-azure-500",
    },
    {
      label: "Project costs",
      value: <Money fils={s.projectCostsFils} currency={currency} />,
      hint:
        s.projectCount > 0
          ? `${plural(s.projectCount, "project", "projects")} · ${projectShare}% of spending, last 12 months`
          : "No costs linked to a project in the last 12 months",
      icon: BriefcaseBusiness,
      accent: "from-abyss-600 to-azure-500",
    },
    {
      label: "Profit, last 12 months",
      value: <SignedMoney fils={s.profitFils} currency={currency} />,
      hint: (
        <>
          Revenue {formatMoneyCompact(s.revenueFils, currency)} − expenses {formatMoneyCompact(s.last12Fils, currency)}
          {loss && <span className="mt-0.5 block font-semibold text-red-600">A loss: spending is above revenue</span>}
        </>
      ),
      icon: loss ? TrendingDown : PiggyBank,
      accent: loss ? "from-blush-500 to-red-500" : "from-aqua-600 to-mint-600",
    },
  ];

  return (
    <section aria-label="Spending summary">
      <ul className={SUMMARY_GRID}>
        {tiles.map((tile, i) => (
          <li key={tile.label} className={cn("min-w-0", SUMMARY_SPANS[i])}>
            <Tile {...tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

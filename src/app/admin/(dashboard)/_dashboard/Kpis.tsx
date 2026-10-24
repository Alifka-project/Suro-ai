import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Banknote, BriefcaseBusiness, Inbox, Trophy, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import type { DashboardKpis } from "./types";

/*
 * The five headline figures above the charts. Server-rendered, so every number
 * is formatted once on the server and never re-formatted during hydration.
 *
 * Layout: two columns up to `lg` (Revenue takes a full row, so a phone
 * shows the five in three short rows), then at `lg` (sidebar showing, ~700–960px
 * of content) a six-track grid with the three count tiles on the first row and
 * the two wider money tiles on the second, and five across from `xl`. The
 * loading skeleton imports the same classes so nothing jumps.
 */

export const KPI_GRID = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6 xl:grid-cols-5";

/** Grid placement of tiles 1–5, in order. */
export const KPI_SPANS = [
  "lg:col-span-2 xl:col-span-1",
  "lg:col-span-2 xl:col-span-1",
  "lg:col-span-2 xl:col-span-1",
  "lg:col-span-3 xl:col-span-1",
  "col-span-2 lg:col-span-3 xl:col-span-1",
] as const;

const count = new Intl.NumberFormat("en-AE");

function plural(n: number, one: string, many: string) {
  return `${count.format(n)} ${n === 1 ? one : many}`;
}

/**
 * Compact amount for the tile ("AED 84.5K"), with the currency code set
 * smaller so five tiles fit beside the sidebar at 1280px. The exact amount is
 * the hover title and what screen readers hear.
 */
export function Money({ fils, currency }: { fils: number; currency: string }) {
  const exact = formatMoney(fils, currency);
  const compact = formatMoneyCompact(fils, currency);
  // trim() also strips the no-break space Intl puts after the currency code.
  const amount = compact.startsWith(currency) ? compact.slice(currency.length).trim() : null;
  return (
    <span title={exact}>
      <span aria-hidden="true">
        {amount === null ? (
          compact
        ) : (
          <>
            <span className="mr-1 text-[0.8rem] font-semibold tracking-wide text-ink-550">{currency}</span>
            {amount}
          </>
        )}
      </span>
      <span className="sr-only">{exact}</span>
    </span>
  );
}

export type TileProps = {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  icon: LucideIcon;
  /** Tailwind gradient stops for the icon chip (decorative). */
  accent: string;
  /** Makes the whole tile a link that filters the clients table. */
  href?: string;
  /** Screen-reader text naming where the link goes. */
  linkHint?: string;
};

const TILE =
  "flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-4 shadow-[0_1px_2px_rgb(7_38_60_/_0.04),0_8px_24px_-14px_rgb(7_38_60_/_0.10)] sm:p-5";

export function Tile({ label, value, hint, icon: Icon, accent, href, linkHint }: TileProps) {
  const body = (
    <>
      <p className="flex min-w-0 items-center gap-2 text-[0.8rem] font-medium text-ink-550">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-[0_6px_14px_-8px_rgb(7_38_60_/_0.7)]",
            accent,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="truncate">{label}</span>
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="whitespace-nowrap font-display text-[1.4rem] font-bold leading-none text-ink-900 tabular-nums sm:text-[1.6rem]">
          {value}
        </p>
        {href && (
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-ink-500 transition-colors group-hover:text-abyss-600"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="mt-2 text-[0.76rem] leading-snug text-ink-550">{hint}</p>
      {linkHint && <span className="sr-only">. {linkHint}</span>}
    </>
  );

  if (!href) return <div className={TILE}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        TILE,
        "group transition-[border-color,box-shadow] hover:border-ink-200 hover:shadow-[0_1px_2px_rgb(7_38_60_/_0.05),0_14px_30px_-16px_rgb(7_38_60_/_0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-600 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
      )}
    >
      {body}
    </Link>
  );
}

export function Kpis({ kpis }: { kpis: DashboardKpis }) {
  const { currency } = kpis;

  const tiles: TileProps[] = [
    {
      label: "Clients",
      value: count.format(kpis.totalClients),
      hint:
        kpis.newThisMonth > 0 ? (
          <>
            <span className="font-semibold text-mint-ink">+{count.format(kpis.newThisMonth)}</span> this month
          </>
        ) : (
          "None new this month"
        ),
      icon: Users,
      accent: "from-abyss-600 to-azure-500",
    },
    {
      // Clients whose status is still New, of any age. Not the same as the
      // engagement chart's "Clients added", which counts arrivals per month.
      label: "New",
      value: count.format(kpis.statusNew),
      hint: "Nothing sent to them yet",
      icon: Inbox,
      accent: "from-azure-500 to-aqua-500",
      href: "/admin?status=NEW#clients",
      linkHint: "Show these clients in the table",
    },
    {
      label: "Goal",
      value: count.format(kpis.goal),
      hint: kpis.totalClients > 0 ? `${kpis.goalRate}% of all clients` : "No clients yet",
      icon: Trophy,
      accent: "from-mint-600 to-aqua-500",
      href: "/admin?status=WON#clients",
      linkHint: "Show these clients in the table",
    },
    {
      // The total of every project still on (cancelled excluded): its latest
      // live quotation, else the expected value entered for it.
      label: "Project value",
      value: <Money fils={kpis.projectValueFils} currency={currency} />,
      hint:
        kpis.openProjects === 0
          ? "No projects yet"
          : kpis.valuedProjects === 0
            ? `${plural(kpis.openProjects, "project", "projects")}, none priced yet`
            : kpis.valuedProjects === kpis.openProjects
              ? `Total of ${plural(kpis.openProjects, "project", "projects")}`
              : `Total of ${plural(kpis.valuedProjects, "project", "projects")} · ${count.format(kpis.openProjects - kpis.valuedProjects)} not priced yet`,
      icon: BriefcaseBusiness,
      accent: "from-lilac-600 to-azure-500",
    },
    {
      label: "Revenue",
      value: <Money fils={kpis.revenue12mFils} currency={currency} />,
      hint: "Collected, last 12 months",
      icon: Banknote,
      accent: "from-aqua-600 to-mint-600",
    },
  ];

  return (
    <section aria-label="Key figures">
      <ul className={KPI_GRID}>
        {tiles.map((tile, i) => (
          <li key={tile.label} className={cn("min-w-0", KPI_SPANS[i])}>
            <Tile {...tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

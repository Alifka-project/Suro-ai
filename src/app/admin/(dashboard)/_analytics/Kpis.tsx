import type { ComponentProps } from "react";
import Link from "next/link";
import {
  Banknote,
  Gauge,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  UserPlus,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/admin/ui";
import { formatMoney } from "@/lib/admin/money";
import type { OverviewData } from "./data";

const tileFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Tile figure capped at 3 significant digits ("AED 576K", "AED 1.23M"), so it
 * never exceeds 9 characters. formatMoneyCompact keeps one decimal, which
 * gives 10 ("AED 575.5K") and can get cut off in a narrow tile beside the
 * sidebar.
 */
function formatTileMoney(fils: number, currency: string): string {
  let f = tileFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency,
      notation: "compact",
      maximumSignificantDigits: 3,
    });
    tileFormatters.set(currency, f);
  }
  return f.format(fils / 100);
}

/** Compact figure for the tile, with the exact amount on hover and for screen readers. */
function Money({ fils, currency }: { fils: number; currency: string }) {
  const full = formatMoney(fils, currency);
  return (
    <span title={full}>
      <span aria-hidden="true">{formatTileMoney(fils, currency)}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

/** Signed change vs the prior period. Direction is carried by icon and sign, not colour alone. */
function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone = diff > 0 ? "text-mint-ink" : diff < 0 ? "text-red-600" : "text-ink-500";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : "No change"}
      </span>
      <span>vs prior 30 days</span>
    </span>
  );
}

/**
 * A KPI tile that opens the page behind its figure, so the overview connects
 * to the pipeline, the lead list and billing. The whole tile is the link; its
 * accessible name is the tile's own text (label, exact figure, hint).
 */
function KpiLink({ href, ...tile }: ComponentProps<typeof StatCard> & { href: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas [&>div]:transition-[border-color,box-shadow] hover:[&>div]:border-ink-200 hover:[&>div]:shadow-[0_1px_2px_rgb(7_38_60_/_0.05),0_14px_30px_-16px_rgb(7_38_60_/_0.22)]"
    >
      <StatCard {...tile} />
    </Link>
  );
}

export function Kpis({
  kpis,
  currency,
  year,
}: {
  kpis: OverviewData["kpis"];
  currency: string;
  /** Calendar year the revenue figure covers. */
  year: number;
}) {
  const openHint =
    kpis.openLeads === 0
      ? "No open opportunities"
      : `${kpis.openLeads} open ${kpis.openLeads === 1 ? "opportunity" : "opportunities"}` +
        (kpis.openLeadsUnvalued > 0 ? ` · ${kpis.openLeadsUnvalued} unvalued` : "");

  const weightedShare =
    kpis.openPipelineFils > 0 ? Math.round((kpis.weightedPipelineFils / kpis.openPipelineFils) * 100) : null;
  const weightedHint =
    weightedShare === null ? "Add expected revenue to open opportunities" : `${weightedShare}% of open value, by win probability`;

  const wonHint =
    kpis.wonMonthCount === 0
      ? `No deals won yet in ${kpis.monthName}`
      : `${kpis.wonMonthCount} ${kpis.wonMonthCount === 1 ? "deal" : "deals"} won in ${kpis.monthName}` +
        (kpis.wonMonthFils === 0 ? " · no expected revenue set" : "");

  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiLink
        href="/admin/crm"
        label="New leads · 30 days"
        value={kpis.newLeads30.toLocaleString("en-AE")}
        hint={<Delta current={kpis.newLeads30} previous={kpis.newLeadsPrior30} />}
        icon={UserPlus}
        accent="from-azure-500 to-aqua-500"
      />
      <KpiLink
        href="/admin/crm/pipeline"
        label="Open pipeline"
        value={<Money fils={kpis.openPipelineFils} currency={currency} />}
        hint={openHint}
        icon={Target}
        accent="from-abyss-600 to-lilac-500"
      />
      <KpiLink
        href="/admin/crm/pipeline"
        label="Weighted pipeline"
        value={<Money fils={kpis.weightedPipelineFils} currency={currency} />}
        hint={weightedHint}
        icon={Gauge}
        accent="from-azure-500 to-lilac-500"
      />
      <KpiLink
        href="/admin/crm?status=WON"
        label="Won this month"
        value={<Money fils={kpis.wonMonthFils} currency={currency} />}
        hint={wonHint}
        icon={Trophy}
        accent="from-mint-600 to-aqua-500"
      />
      <KpiLink
        href="/admin/billing?tab=invoices&status=PAID"
        label={`Collected in ${year}`}
        value={<Money fils={kpis.revenueYtdFils} currency={currency} />}
        hint={
          kpis.revenue30Fils > 0
            ? `${formatMoney(kpis.revenue30Fils, currency)} in the last 30 days`
            : "Nothing collected in the last 30 days"
        }
        icon={Banknote}
        accent="from-aqua-600 to-mint-600"
      />
      <KpiLink
        href="/admin/billing?tab=invoices"
        label="Outstanding"
        value={<Money fils={kpis.outstandingFils} currency={currency} />}
        hint={
          kpis.overdueFils > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-red-600">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {formatMoney(kpis.overdueFils, currency)} overdue
            </span>
          ) : kpis.outstandingCount > 0 ? (
            `${kpis.outstandingCount} sent ${kpis.outstandingCount === 1 ? "invoice" : "invoices"} · none overdue`
          ) : (
            "No unpaid invoices"
          )
        }
        icon={Wallet}
        accent="from-lilac-600 to-blush-500"
      />
    </section>
  );
}

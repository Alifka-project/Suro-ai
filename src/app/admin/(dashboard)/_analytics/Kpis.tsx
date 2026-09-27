import { Banknote, Minus, Target, TrendingDown, TrendingUp, TriangleAlert, UserPlus, Wallet } from "lucide-react";
import { StatCard } from "@/components/admin/ui";
import { formatMoney } from "@/lib/admin/money";
import type { OverviewData } from "./data";

const tileFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Tile figure capped at 3 significant digits ("AED 576K", "AED 1.23M"), so it
 * never exceeds 9 characters. formatMoneyCompact keeps one decimal, which
 * gives 10 ("AED 575.5K") and gets cut off in the narrowest 4-across tile
 * beside the sidebar at 1280px.
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
  const tone = diff > 0 ? "text-[#2f8a78]" : diff < 0 ? "text-red-600" : "text-ink-500";
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
      ? "No open leads"
      : `${kpis.openLeads} open ${kpis.openLeads === 1 ? "lead" : "leads"}` +
        (kpis.openLeadsUnvalued > 0 ? ` · ${kpis.openLeadsUnvalued} unvalued` : "");

  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="New leads · 30 days"
        value={kpis.newLeads30.toLocaleString("en-AE")}
        hint={<Delta current={kpis.newLeads30} previous={kpis.newLeadsPrior30} />}
        icon={UserPlus}
        accent="from-azure-500 to-aqua-500"
      />
      <StatCard
        label="Open pipeline"
        value={<Money fils={kpis.openPipelineFils} currency={currency} />}
        hint={openHint}
        icon={Target}
        accent="from-abyss-600 to-lilac-500"
      />
      <StatCard
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
      <StatCard
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

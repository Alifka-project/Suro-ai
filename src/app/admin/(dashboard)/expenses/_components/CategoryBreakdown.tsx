import Link from "next/link";
import { Tags } from "lucide-react";
import { Card, CardHeader, EmptyState, cn } from "@/components/admin/ui";
import { formatMoney } from "@/lib/admin/money";
import { expensesHref } from "../_lib/filters";
import type { CategoryTotal } from "../_lib/types";

/*
 * Where the money went over the last 12 months: every category with spending,
 * largest first, with its share as a thin bar. Each row filters the list to
 * that category. The bar is decorative; its percentage is in the text.
 */

const count = new Intl.NumberFormat("en-AE");

function shareText(share: number): string {
  if (share > 0 && share < 0.01) return "<1%";
  return `${Math.round(share * 100)}%`;
}

export function CategoryBreakdown({
  categories,
  totalFils,
  currency,
  active,
}: {
  categories: CategoryTotal[];
  totalFils: number;
  currency: string;
  /** The category the list is filtered to, if any. */
  active: string | null;
}) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="By category, last 12 months"
        subtitle={totalFils > 0 ? `${formatMoney(totalFils, currency)} in total` : "Spending by category"}
      />
      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nothing spent yet"
          description="Each category's share of spending will show here once expenses are recorded."
        />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {categories.map((c) => {
            const isActive = c.key === active;
            const body = (
              <>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[0.82rem] font-medium text-ink-800 [overflow-wrap:anywhere]">
                    {c.label}
                  </span>
                  <span className="shrink-0 text-[0.82rem] font-semibold whitespace-nowrap text-ink-900 tabular-nums">
                    {formatMoney(c.amountFils, currency)}
                  </span>
                </span>
                <span className="mt-1.5 flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span
                      className="block h-full rounded-full bg-blush-ink"
                      // At least a sliver, so a tiny share is still visible.
                      style={{ width: `${Math.max(c.share * 100, 1.5)}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-[0.72rem] whitespace-nowrap text-ink-550 tabular-nums">
                    {shareText(c.share)}
                    <span className="sr-only"> of spending</span> · {count.format(c.count)}{" "}
                    {c.count === 1 ? "expense" : "expenses"}
                  </span>
                </span>
              </>
            );
            const row = "block rounded-xl px-2 py-2";
            return (
              <li key={c.key}>
                {c.known ? (
                  <Link
                    href={expensesHref({ category: c.key })}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      row,
                      "transition-colors hover:bg-haze focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-azure-500",
                      isActive && "bg-haze ring-1 ring-inset ring-ink-200",
                    )}
                  >
                    {body}
                    <span className="sr-only">{isActive ? ". The list shows this category" : ". Show these expenses"}</span>
                  </Link>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

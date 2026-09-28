import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/admin/ui";

export type SmartButton = {
  /** In-page anchor of the section the button jumps to, e.g. "#quotations". */
  href: string;
  icon: LucideIcon;
  count: number;
  /** Singular and plural label, chosen by count. */
  label: [one: string, many: string];
  detail: string;
  tone?: "neutral" | "red" | "amber" | "mint";
};

const DETAIL_TONE = {
  neutral: "text-ink-550",
  red: "font-semibold text-red-600",
  amber: "font-semibold text-amber-700",
  mint: "font-semibold text-mint-ink",
} as const;

/**
 * Odoo's smart buttons: a count per related record type, each jumping to its
 * section further down the page.
 */
export function SmartButtons({ items }: { items: SmartButton[] }) {
  return (
    <nav aria-label="Related records" className="mb-5">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {items.map(({ href, icon: Icon, count, label, detail, tone = "neutral" }) => {
          const name = count === 1 ? label[0] : label[1];
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                className="group flex h-full items-center gap-3 rounded-2xl border border-ink-100 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(7_38_60/0.04)] transition-colors hover:border-azure-300 hover:bg-haze/50 sm:px-3.5 sm:py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600 transition-colors group-hover:bg-azure-500/10 group-hover:text-abyss-600">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-display text-[1.05rem] font-bold leading-none tabular-nums text-ink-900">{count}</span>
                    <span className="truncate text-[0.76rem] font-semibold text-ink-700">{name}</span>
                  </span>
                  <span className={cn("mt-1 block truncate text-[0.72rem]", DETAIL_TONE[tone])}>{detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

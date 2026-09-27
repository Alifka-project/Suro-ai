"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/admin/ui";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Render the icon only; the label becomes the accessible name. */
  iconOnly?: boolean;
};

/** Small two-or-more-way toggle used in card headers (chart/table, count/value). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  /** Accessible name for the group. */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-ink-100/70 p-0.5">
      {options.map(({ value: v, label: optionLabel, icon: Icon, iconOnly }) => {
        const selected = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={selected}
            aria-label={iconOnly ? optionLabel : undefined}
            title={iconOnly ? optionLabel : undefined}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-[0.72rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400/60",
              iconOnly && "w-7 px-0",
              selected ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(7_38_60_/_0.10)]" : "text-ink-500 hover:text-ink-800",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {!iconOnly && optionLabel}
          </button>
        );
      })}
    </div>
  );
}

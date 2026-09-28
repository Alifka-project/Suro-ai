"use client";

import { useFormStatus } from "react-dom";
import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { cn } from "@/components/admin/ui";

const OPTIONS = [
  { value: "TODO", label: "To do", icon: Circle, on: "bg-ink-100 text-ink-800" },
  { value: "DOING", label: "Doing", icon: CircleDot, on: "bg-azure-500/10 text-abyss-600" },
  { value: "DONE", label: "Done", icon: CircleCheck, on: "bg-mint-500/20 text-mint-ink" },
] as const;

/**
 * Segmented To do / Doing / Done control. Each option is a submit button that
 * sends its own `status`, so it works without JavaScript. While a change is
 * in flight the requested option is highlighted straight away.
 */
export function TaskStatusButtons({ current, taskTitle }: { current: string; taskTitle: string }) {
  const { pending, data } = useFormStatus();
  const requested = pending ? data?.get("status") : null;
  const shown = typeof requested === "string" ? requested : current;

  return (
    <div
      role="group"
      aria-label={`Status of “${taskTitle}”`}
      className="inline-flex shrink-0 rounded-lg border border-ink-200 bg-white p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon, on }) => {
        const active = shown === value;
        return (
          <button
            key={value}
            type="submit"
            name="status"
            value={value}
            aria-pressed={active}
            disabled={pending || value === current}
            title={label}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[0.72rem] font-semibold transition-colors disabled:cursor-default",
              active ? on : "text-ink-550 hover:bg-ink-100/70 hover:text-ink-700",
              pending && !active && "opacity-50",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { CalendarClock, List, SquareKanban } from "lucide-react";
import { cn } from "@/components/admin/ui";

/**
 * Sub-navigation shared by every CRM page, Odoo-style: the Pipeline board,
 * the Leads list and the Activities planner. Server component — the page says
 * which tab it is and passes the overdue-activity count for the badge.
 */
export type CrmTab = "pipeline" | "leads" | "activities";

const TABS = [
  { key: "pipeline", label: "Pipeline", href: "/admin/crm/pipeline", icon: SquareKanban },
  { key: "leads", label: "Leads", href: "/admin/crm", icon: List },
  { key: "activities", label: "Activities", href: "/admin/crm/activities", icon: CalendarClock },
] as const;

export function CrmTabs({ active, overdueActivities = 0 }: { active: CrmTab; overdueActivities?: number }) {
  return (
    <nav aria-label="CRM" className="relative mb-6 overflow-x-auto">
      <ul className="inline-flex min-w-max gap-1 rounded-2xl border border-ink-100 bg-white/80 p-1 shadow-[0_1px_2px_rgb(7_38_60/0.04)]">
        {TABS.map(({ key, label, href, icon: Icon }) => {
          const current = key === active;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[0.84rem] font-semibold transition-colors sm:gap-2 sm:px-3.5",
                  current ? "bg-ink-900 text-white" : "text-ink-550 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {key === "activities" && overdueActivities > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums",
                      current ? "bg-white/20 text-white" : "bg-red-100 text-red-700",
                    )}
                  >
                    <span className="sr-only">, </span>
                    {overdueActivities}
                    <span className="sr-only"> overdue</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

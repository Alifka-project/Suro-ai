/**
 * Pure helpers specific to the projects module — progress, labels, form values.
 * Dates, money and invoice status come from the shared admin modules
 * (src/lib/admin/time.ts, money.ts, invoices.ts). No server-only imports, so
 * client components can use them too.
 */
import { filsToInput } from "@/lib/admin/money";
import { isPastDay, toDateInputValue } from "@/lib/admin/time";
import type { ProjectFormValues } from "./types";

/**
 * True once the date's whole Dubai calendar day has ended. Something due today
 * is not overdue yet. No date means nothing can be overdue.
 */
export function isPastDue(date: Date | string | null | undefined, now: Date = new Date()): boolean {
  return date ? isPastDay(date, now) : false;
}

export function progressPercent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function leadLabel(lead: { fullName: string; companyName: string | null }): string {
  return lead.companyName ? `${lead.fullName} · ${lead.companyName}` : lead.fullName;
}

export function toProjectFormValues(project: {
  name: string;
  description: string | null;
  leadId: string | null;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  valueFils: number | null;
}): ProjectFormValues {
  return {
    name: project.name,
    description: project.description ?? "",
    leadId: project.leadId ?? "",
    status: project.status,
    startDate: toDateInputValue(project.startDate),
    dueDate: toDateInputValue(project.dueDate),
    value: filsToInput(project.valueFils),
  };
}

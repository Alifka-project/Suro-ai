import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/components/admin/ui";

/** Screen-only back link above billing pages. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-[0.8rem] font-medium text-ink-500 transition-colors hover:text-ink-900 print:hidden"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </Link>
  );
}

/** A row in the "Linked records" panel. */
export function LinkedRecord({
  href,
  icon: Icon,
  label,
  title,
  subtitle,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5 transition-colors hover:border-ink-200 hover:bg-haze/60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 group-hover:text-abyss-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-ink-500">{label}</span>
          <span className="block truncate text-[0.85rem] font-semibold text-ink-900">{title}</span>
          {subtitle && <span className="block truncate text-[0.74rem] text-ink-500">{subtitle}</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-ink-500" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Coloured one-line context under the status badge. */
export function StatusNote({ tone = "neutral", children }: { tone?: "neutral" | "red" | "amber" | "mint"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "mt-2 text-[0.8rem] leading-relaxed",
        tone === "red" && "text-red-600",
        tone === "amber" && "text-amber-700",
        tone === "mint" && "text-[#2f8a78]",
        tone === "neutral" && "text-ink-500",
      )}
    >
      {children}
    </p>
  );
}

/** Quiet inline notice, e.g. when a prefill link points at a missing record. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[0.82rem] text-amber-800">
      {children}
    </p>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/admin/labels";

/* Shared admin primitives. Server-safe: nothing here needs "use client".
   Interactive pieces (submit buttons with pending state) live in ui-client.tsx. */

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-ink-550">{eyebrow}</p>
        )}
        <h1 className="mt-1 truncate font-display text-[1.6rem] font-bold leading-tight text-ink-900">
          {title}
        </h1>
        {description && <p className="mt-1 text-[0.9rem] text-ink-550">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgb(7_38_60_/_0.04),0_8px_24px_-14px_rgb(7_38_60_/_0.10)]",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[0.98rem] font-bold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[0.78rem] text-ink-550">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Data display ────────────────────────────────────────────────────────────

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600 ring-ink-200",
  blue: "bg-azure-500/10 text-abyss-600 ring-azure-500/25",
  aqua: "bg-aqua-500/10 text-aqua-600 ring-aqua-500/25",
  mint: "bg-mint-500/15 text-[#2f8a78] ring-mint-600/30",
  lilac: "bg-lilac-500/15 text-lilac-600 ring-lilac-500/30",
  blush: "bg-blush-500/15 text-blush-600 ring-blush-500/30",
  amber: "bg-amber-400/15 text-amber-700 ring-amber-400/30",
  red: "bg-red-500/10 text-red-600 ring-red-500/25",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ring-1 ring-inset",
        TONES[tone],
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; tone: Tone }>;
}) {
  const meta = map[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "from-abyss-600 to-aqua-500",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Tailwind gradient stops for the icon chip. */
  accent?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.78rem] font-medium text-ink-550">{label}</p>
          <p className="mt-1.5 truncate font-display text-[1.55rem] font-bold leading-none text-ink-900 tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-2 text-[0.75rem] text-ink-550">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-[0_8px_18px_-10px_rgb(7_38_60_/_0.7)]",
              accent,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <p className="max-w-full font-display text-[0.98rem] font-bold text-ink-800 [overflow-wrap:anywhere]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[0.85rem] text-ink-550 [overflow-wrap:anywhere]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[0.85rem]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-ink-100 px-4 py-2.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-550",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-ink-100/70 px-4 py-3 align-middle text-ink-700", className)}>{children}</td>;
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

const BUTTON = {
  primary:
    "bg-linear-to-r from-abyss-600 via-azure-500 to-aqua-500 text-white shadow-[0_8px_18px_-10px_rgb(32_103_165_/_0.8)] hover:brightness-105",
  secondary: "border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-haze",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  dangerSolid: "bg-red-600 text-white shadow-[0_8px_18px_-10px_rgb(220_38_38_/_0.7)] hover:bg-red-700",
} as const;

export type ButtonVariant = keyof typeof BUTTON;

export const buttonClass = (variant: ButtonVariant = "primary", size: "sm" | "md" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-[0.78rem]" : "h-10 px-4 text-[0.85rem]",
    BUTTON[variant],
  );

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}

// ─── Forms ───────────────────────────────────────────────────────────────────

/**
 * 16px text below `sm`: iOS Safari zooms into any field smaller than that on
 * focus. (A Tailwind size class would otherwise beat the base-layer 16px rule
 * in globals.css.)
 */
export const inputClass =
  "h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-base text-ink-900 placeholder:text-ink-400 transition focus:border-azure-400 focus:outline-none focus:ring-4 focus:ring-azure-400/15 aria-[invalid=true]:border-red-400 sm:text-[0.88rem]";

/** Multi-line counterpart of inputClass (auto height, same focus treatment). */
export const textareaClass =
  "w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-base leading-relaxed text-ink-900 placeholder:text-ink-400 transition focus:border-azure-400 focus:outline-none focus:ring-4 focus:ring-azure-400/15 aria-[invalid=true]:border-red-400 sm:text-[0.88rem]";

/**
 * Label + control + message. When `htmlFor` is set, the message gets a stable
 * id — use fieldMessageId(htmlFor) as the control's aria-describedby.
 */
export function fieldMessageId(htmlFor: string) {
  return `${htmlFor}-message`;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const messageId = htmlFor ? fieldMessageId(htmlFor) : undefined;
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[0.78rem] font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="mt-1 text-[0.74rem] text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="mt-1 text-[0.74rem] text-ink-550">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Label / value pair for detail panels. */
export function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-550">{label}</dt>
      <dd className="mt-1 break-words text-[0.88rem] text-ink-800">{children || "—"}</dd>
    </div>
  );
}

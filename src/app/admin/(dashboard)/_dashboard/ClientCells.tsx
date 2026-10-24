import Link from "next/link";
import { TriangleAlert, FilePlus2, Mail, MessageCircle, Phone, Plus, type LucideIcon } from "lucide-react";
import { StatusBadge, buttonClass, cn } from "@/components/admin/ui";
import { INVOICE_STATUS, QUOTE_STATUS } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { calendarDay, calendarDaysBetween } from "@/lib/admin/time";
import { TableTip } from "./TableTip";
import type { ClientRow } from "./types";

/*
 * Small pieces shared by the clients table (desktop) and the client cards
 * (phones): contact buttons, service chips, the quotation / invoice cells.
 * No hooks and no browser APIs, so they render the same on the server and
 * in the browser (the icon buttons' tooltip is its own client component).
 */

// ─── Text helpers ────────────────────────────────────────────────────────────

/** "Package 1: Automate" -> "Automate". Anything else ("Not sure yet") is returned as is. */
export function serviceShortName(service: string): string {
  return service.replace(/^Package\s+\d+\s*:\s*/i, "") || service;
}

/** "Dubai, United Arab Emirates", or "" when neither is known. */
export function locationOf(row: Pick<ClientRow, "city" | "country">): string {
  return [row.city, row.country].filter(Boolean).join(", ");
}

/** "Gulfline Logistics", or "Individual" for a private client. */
export function companyOf(row: Pick<ClientRow, "companyName" | "clientType">): string {
  if (row.companyName) return row.companyName;
  return row.clientType === "INDIVIDUAL" ? "Individual" : "Company not given";
}

/** Where a record came from, for anything that isn't the website form. */
export function sourceMarker(source: string): string | null {
  if (source === "website") return null;
  if (source === "manual") return "Added manually";
  if (source === "demo") return "Demo data";
  return source;
}

function ago(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/**
 * "3 hours ago", "Yesterday", "5 days ago", measured against the `now` the
 * server rendered with, not the browser clock, so the server HTML and the
 * hydrated page always agree.
 *
 * Days, weeks, months and years count business-clock (Dubai) calendar days,
 * like the date printed beside it, and round down: an enquiry from yesterday
 * morning reads "Yesterday" in the evening, never "2 days ago".
 */
export function relativeTime(iso: string, nowIso: string): string {
  const days = calendarDaysBetween(iso, nowIso);
  if (days <= 0) {
    // Today. A record stamped a moment "after" now (clock skew) reads as just now.
    const minutes = Math.floor(Math.max(0, new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return ago(minutes, "minute");
    return ago(Math.floor(minutes / 60), "hour");
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  // Whole calendar months: 12 Sept -> 12 Oct is one; 13 Sept -> 12 Oct is not yet.
  const then = calendarDay(iso);
  const today = calendarDay(nowIso);
  const months = (today.year - then.year) * 12 + (today.month - then.month) - (today.day < then.day ? 1 : 0);
  if (months < 1) return ago(Math.floor(days / 7), "week");
  if (months < 12) return ago(months, "month");
  return ago(Math.floor(months / 12), "year");
}

// ─── Contact buttons ─────────────────────────────────────────────────────────

function whatsappReason(row: ClientRow): string {
  return row.phone ? "No international number — WhatsApp needs the country code" : "No phone number on file";
}

function callReason(row: ClientRow): string {
  return row.phone ? "This number is too short to dial" : "No phone number on file";
}

const ICON_TONE = {
  whatsapp: "bg-mint-500/15 text-mint-ink ring-mint-600/30 hover:bg-mint-500/25",
  call: "bg-azure-500/10 text-abyss-600 ring-azure-500/25 hover:bg-azure-500/20",
  email: "bg-ink-100 text-ink-700 ring-ink-200 hover:bg-ink-200/70",
} as const;

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500";

/** Faint hatching marks an icon button as unavailable without relying on colour alone. */
const UNAVAILABLE_ICON =
  "cursor-not-allowed bg-white text-ink-400 ring-ink-200 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgb(211_224_233/0.55)_4px_5px)]";

function IconAction({
  href,
  external,
  icon: Icon,
  tone,
  label,
  tip,
}: {
  href: string | null;
  external?: boolean;
  icon: LucideIcon;
  tone: keyof typeof ICON_TONE;
  /** Accessible name. */
  label: string;
  /** Visible tooltip. */
  tip: string;
}) {
  const base = "flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset transition-colors";
  if (!href) {
    // Focusable and announced as unavailable, with the reason in its name,
    // instead of a disabled button that keyboard users can't reach.
    return (
      <TableTip text={tip}>
        <button
          type="button"
          aria-disabled="true"
          aria-label={label}
          className={cn(base, FOCUS_RING, UNAVAILABLE_ICON)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TableTip>
    );
  }
  return (
    <TableTip text={tip}>
      <a
        href={href}
        aria-label={label}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={cn(base, FOCUS_RING, ICON_TONE[tone])}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </TableTip>
  );
}

/** The table's compact WhatsApp and Call buttons. */
export function ContactIconButtons({ row }: { row: ClientRow }) {
  const name = row.fullName;
  return (
    <div className="flex items-center gap-1.5">
      <IconAction
        href={row.whatsapp ? `https://wa.me/${row.whatsapp}` : null}
        external
        icon={MessageCircle}
        tone="whatsapp"
        label={
          row.whatsapp
            ? `WhatsApp ${name} (opens in a new tab)`
            : `WhatsApp not available for ${name}: ${whatsappReason(row)}`
        }
        tip={row.whatsapp ? `WhatsApp ${row.phone}` : whatsappReason(row)}
      />
      <IconAction
        href={row.tel}
        icon={Phone}
        tone="call"
        label={row.tel ? `Call ${name}` : `Calling not available for ${name}: ${callReason(row)}`}
        tip={row.tel ? `Call ${row.phone}` : callReason(row)}
      />
    </div>
  );
}

const LABELED = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-[0.84rem] font-semibold ring-1 ring-inset transition-colors";

/**
 * Labelled Email / WhatsApp / Call buttons for the cards and the details
 * panel. An unavailable one says why in plain text.
 */
export function ContactButtons({
  row,
  email = false,
  stretch = false,
  className,
}: {
  row: ClientRow;
  /** Include an Email button (the details panel). */
  email?: boolean;
  /** Share the row's width equally on phones (bigger touch targets). */
  stretch?: boolean;
  className?: string;
}) {
  const item = stretch ? "flex-1 sm:flex-none" : "";
  const unavailable = (label: string, Icon: LucideIcon, reason: string) => (
    <span
      className={cn(LABELED, item, "cursor-not-allowed bg-white text-ink-550 ring-ink-200")}
      title={reason}
    >
      <Icon className="h-4 w-4 text-ink-400" aria-hidden="true" />
      <span>
        {label}
        <span className="sr-only">: not available. {reason}</span>
      </span>
    </span>
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {email &&
        (row.email ? (
          <a href={`mailto:${row.email}`} className={cn(LABELED, item, FOCUS_RING, ICON_TONE.email)}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            Email
          </a>
        ) : (
          unavailable("Email", Mail, "No email address on file")
        ))}
      {row.whatsapp ? (
        <a
          href={`https://wa.me/${row.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(LABELED, item, FOCUS_RING, ICON_TONE.whatsapp)}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        unavailable("WhatsApp", MessageCircle, whatsappReason(row))
      )}
      {row.tel ? (
        <a href={row.tel} className={cn(LABELED, item, FOCUS_RING, ICON_TONE.call)}>
          <Phone className="h-4 w-4" aria-hidden="true" />
          Call
        </a>
      ) : (
        unavailable("Call", Phone, callReason(row))
      )}
    </div>
  );
}

/** Why WhatsApp isn't offered, for the card (where there is no hover). */
export function contactNote(row: ClientRow): string | null {
  if (!row.phone) return "No phone number on file.";
  if (!row.whatsapp) return "WhatsApp needs the number with its country code.";
  return null;
}

// ─── Services ────────────────────────────────────────────────────────────────

const CHIP = "rounded-md bg-haze px-1.5 py-0.5 text-[0.72rem] font-medium leading-snug text-ink-700 ring-1 ring-inset ring-ink-100";

/** Up to `max` short chips, then "+N more". The full option text is in each chip's title. */
export function ServiceChips({
  services,
  max = 2,
  layout = "stack",
}: {
  services: string[];
  max?: number;
  /** "stack" for the narrow table column, "wrap" for a card. */
  layout?: "stack" | "wrap";
}) {
  if (services.length === 0) return <span className="text-[0.78rem] text-ink-550">Not given</span>;
  const shown = services.slice(0, max);
  const rest = services.length - shown.length;
  return (
    <ul
      className={cn(
        "flex min-w-0 gap-1",
        layout === "stack" ? "flex-col items-start" : "flex-row flex-wrap items-center gap-x-1.5",
      )}
    >
      {shown.map((service) => (
        <li key={service} className="min-w-0 max-w-full">
          {/* Wraps onto a second line rather than cutting a package name short. */}
          <span title={service} className={cn(CHIP, "block [overflow-wrap:anywhere]")}>
            {serviceShortName(service)}
          </span>
        </li>
      ))}
      {rest > 0 && (
        <li className="text-[0.7rem] font-medium text-ink-550" title={services.slice(max).join("\n")}>
          +{rest} more
        </li>
      )}
    </ul>
  );
}

/** Every requested service in full, for the details panel. */
export function ServiceList({ services }: { services: string[] }) {
  if (services.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {services.map((service) => (
        <li key={service} className={cn(CHIP, "max-w-full [overflow-wrap:anywhere]")}>
          {service}
        </li>
      ))}
    </ul>
  );
}

// ─── Quotation / invoice ─────────────────────────────────────────────────────

type DocKind = "quote" | "invoice";

const DOC = {
  quote: { noun: "quotation", plural: "quotations", base: "/admin/billing/quotes", map: QUOTE_STATUS },
  invoice: { noun: "invoice", plural: "invoices", base: "/admin/billing/invoices", map: INVOICE_STATUS },
} as const;

export function newDocumentHref(kind: DocKind, leadId: string): string {
  return `${DOC[kind].base}/new?leadId=${encodeURIComponent(leadId)}`;
}

/**
 * The latest quotation or invoice — number (opens it), status, total — with
 * a "New" link for another one, or a "Create" button when the client has
 * none yet. Stacked, so it fits a narrow table column or half a phone card.
 */
export function DocumentCell({ kind, row, size = "table" }: { kind: DocKind; row: ClientRow; size?: "table" | "card" }) {
  const meta = DOC[kind];
  const doc = kind === "quote" ? row.quote : row.invoice;
  const count = kind === "quote" ? row.quoteCount : row.invoiceCount;
  const newHref = newDocumentHref(kind, row.id);
  const noun = meta.noun;

  if (!doc) {
    return (
      <Link
        href={newHref}
        aria-label={`Create ${noun} for ${row.fullName}`}
        className={cn(
          buttonClass("secondary", "sm"),
          FOCUS_RING,
          size === "table" ? "h-8 rounded-lg px-2.5 text-[0.76rem]" : "h-9 px-3",
        )}
      >
        <FilePlus2 className="h-3.5 w-3.5 text-ink-550" aria-hidden="true" />
        Create
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col items-start gap-1">
      <Link
        href={`${meta.base}/${doc.id}`}
        aria-label={`Open ${noun} ${doc.number}`}
        title={doc.number}
        className={cn(
          "inline-flex min-h-6 max-w-full items-center rounded font-mono text-[0.74rem] font-semibold text-abyss-600 underline-offset-2 hover:underline",
          FOCUS_RING,
        )}
      >
        <span className="truncate">{doc.number}</span>
      </Link>
      <StatusBadge status={doc.status} map={meta.map} />
      <span className="text-[0.76rem] font-semibold tabular-nums text-ink-800">
        {formatMoney(doc.totalFils, doc.currency)}
      </span>
      <div className="flex flex-wrap items-center gap-x-1.5">
        {count > 1 && (
          <span
            className="whitespace-nowrap text-[0.7rem] font-medium text-ink-550"
            title={
              kind === "quote"
                ? `${count} ${meta.plural} in total; this is the latest`
                : `${count} ${meta.plural} in total; this is the one that most needs attention`
            }
          >
            +{count - 1} more
          </span>
        )}
        {kind === "invoice" && row.overdueInvoiceCount > 1 && (
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[0.7rem] font-semibold text-red-600">
            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
            {row.overdueInvoiceCount} overdue
          </span>
        )}
        <Link
          href={newHref}
          aria-label={`New ${noun} for ${row.fullName}`}
          title={`New ${noun}`}
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md px-1 text-[0.72rem] font-semibold text-abyss-600 transition-colors hover:bg-azure-500/10",
            FOCUS_RING,
          )}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          New
        </Link>
      </div>
    </div>
  );
}

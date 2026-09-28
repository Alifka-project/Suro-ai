import Image from "next/image";
import type { ReactNode } from "react";
import { BUSINESS, INVOICE_TITLE } from "@/lib/admin/business";
import { documentTotals, formatMoney, formatVat, lineTotalFils } from "@/lib/admin/money";
import { formatBusinessDate } from "@/lib/admin/time";
import { cn } from "@/components/admin/ui";
import type { DocumentKind } from "../_lib/types";

type Stamp = { label: string; tone: "neutral" | "mint" | "red" | "amber" | "blue" };

/** Where an invoice stands for the client: still payable, settled, or cancelled. */
export type InvoiceStanding = "open" | "paid" | "void";

/** Small uppercase section label. ink-500 keeps it legible on paper and on screen. */
const LABEL = "font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-500";
const TH = "py-2 font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-ink-600";

/*
 * Printing: a zero page margin leaves browsers no room for their default
 * header and footer (page title, date, the internal admin URL), so none of
 * that lands on the client's copy. The article supplies the margin instead,
 * and box-decoration-break: clone repeats it on every printed page.
 * Rendered in the body, after the global stylesheet, so it wins the cascade.
 */
const PRINT_PAGE_CSS = "@page { margin: 0; }";

const STAMP_TONES: Record<Stamp["tone"], string> = {
  neutral: "border-ink-300 text-ink-500",
  mint: "border-mint-600 text-mint-ink",
  red: "border-red-400 text-red-600",
  amber: "border-amber-400 text-amber-700",
  blue: "border-azure-400 text-abyss-600",
};

const BRAND_RULE =
  "bg-[linear-gradient(90deg,var(--color-abyss-600),var(--color-azure-500)_30%,var(--color-aqua-500)_55%,var(--color-lilac-400)_80%,var(--color-blush-500))]";

function Meta({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      <dd
        className={cn(
          "mt-1 break-words tabular-nums",
          strong ? "font-display text-[1rem] font-bold text-ink-900" : "text-[0.86rem] font-medium text-ink-800",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * The client-facing quotation / tax invoice. Server-rendered and print-ready:
 * on paper the card chrome falls away and only the document remains (A4, via
 * the @page rule in globals.css). Totals are always derived from line items.
 */
export function BillingDocument({
  kind,
  number,
  issueDate,
  secondDate,
  paidAt,
  standing = "open",
  client,
  items,
  vatBps,
  currency,
  notes,
  reference,
  paymentTerms,
  stamp,
}: {
  kind: DocumentKind;
  number: string;
  issueDate: Date;
  /** Valid-until for quotes, due date for invoices. */
  secondDate: Date;
  paidAt?: Date | null;
  /** Invoices only. Drives the amount-due fact and the payment block. */
  standing?: InvoiceStanding;
  client: { name: string; email: string; company: string | null };
  items: { id: string; description: string; quantity: number; unitPriceFils: number }[];
  vatBps: number;
  currency: string;
  notes: string | null;
  /** e.g. "Quotation Q-2026-0001" on an invoice converted from a quote. */
  reference?: string | null;
  /** Invoices only: replaces the default terms, e.g. an agreement's own payment terms. */
  paymentTerms?: string | null;
  stamp?: Stamp | null;
}) {
  const isInvoice = kind === "invoice";
  const totals = documentTotals(items, vatBps);
  const qty = (n: number) => n.toLocaleString("en-AE", { maximumFractionDigits: 3 });
  const paid = isInvoice && standing === "paid" && paidAt;
  const voided = isInvoice && standing === "void";

  return (
    <article
      aria-label={`${isInvoice ? INVOICE_TITLE : "Quotation"} ${number}`}
      className="relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl border border-ink-100 bg-white text-ink-800 shadow-[0_1px_2px_rgb(7_38_60_/_0.04),0_18px_48px_-24px_rgb(7_38_60_/_0.22)] print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-[14mm] print:shadow-none print:box-decoration-clone"
    >
      <style>{PRINT_PAGE_CSS}</style>
      <div aria-hidden="true" className={cn("h-1.5", BRAND_RULE)} />

      <div className="px-5 py-6 sm:px-10 sm:py-9 print:px-0 print:pt-6 print:pb-0">
        {/* ── Issuer + title ─────────────────────────────── */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Image src="/brand/suloai-mark.png" alt="" width={226} height={240} className="h-9 w-auto" />
              <span className="font-display text-[1.3rem] font-bold tracking-[0.02em] text-ink-900">
                SULO<span className="text-gradient">AI</span>
              </span>
            </div>
            <p className="mt-1 text-[0.78rem] text-ink-500">{BUSINESS.tagline}</p>
            <address className="mt-3 space-y-0.5 text-[0.78rem] not-italic leading-relaxed text-ink-600">
              {BUSINESS.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="block">{BUSINESS.email}</span>
              <span className="block">{BUSINESS.website}</span>
              {BUSINESS.trn && <span className="block font-medium text-ink-800">TRN: {BUSINESS.trn}</span>}
            </address>
          </div>

          <div className="min-w-0 sm:text-right print:text-right">
            <h2 className="font-display text-[1.6rem] font-bold uppercase leading-none tracking-[0.04em] text-ink-900 sm:text-[1.9rem]">
              {isInvoice ? INVOICE_TITLE : "Quotation"}
            </h2>
            <p className="mt-2 font-mono text-[0.8rem] tracking-[0.06em] text-ink-600">{number}</p>
            {stamp && (
              <span
                className={cn(
                  "mt-3 inline-block rounded-md border-2 px-2.5 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.2em]",
                  STAMP_TONES[stamp.tone],
                )}
              >
                {stamp.label}
              </span>
            )}
          </div>
        </header>

        {/* ── Key facts ──────────────────────────────────── */}
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink-100 py-4 sm:grid-cols-4 print:grid-cols-4">
          <Meta label={isInvoice ? "Invoice no." : "Quote no."}>{number}</Meta>
          <Meta label="Issue date">{formatBusinessDate(issueDate)}</Meta>
          <Meta label={isInvoice ? "Due date" : "Valid until"}>{formatBusinessDate(secondDate)}</Meta>
          {paid ? (
            <Meta label="Paid on">{formatBusinessDate(paidAt)}</Meta>
          ) : voided ? (
            <Meta label="Amount due" strong>
              Nil (void)
            </Meta>
          ) : (
            <Meta label={isInvoice ? "Amount due" : "Total"} strong>
              {formatMoney(totals.totalFils, currency)}
            </Meta>
          )}
        </dl>

        {/* ── Parties ────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="min-w-0">
            <p className={LABEL}>{isInvoice ? "Bill to" : "Prepared for"}</p>
            <p className="mt-1.5 break-words font-display text-[1rem] font-bold text-ink-900">{client.name}</p>
            {client.company && <p className="break-words text-[0.85rem] text-ink-700">{client.company}</p>}
            {/* A client approached without an email on file has none to print. */}
            {client.email.trim() && <p className="break-words text-[0.82rem] text-ink-500">{client.email}</p>}
          </div>
          {reference && (
            <div className="min-w-0 sm:text-right print:text-right">
              <p className={LABEL}>Reference</p>
              <p className="mt-1.5 text-[0.85rem] text-ink-700">{reference}</p>
            </div>
          )}
        </div>

        {/* ── Line items ─────────────────────────────────── */}
        <table className="mt-8 w-full border-collapse text-left text-[0.84rem]">
          <thead>
            <tr className="border-b-2 border-ink-800/80">
              <th scope="col" className={cn(TH, "pr-3")}>
                Description
              </th>
              <th scope="col" className={cn(TH, "hidden w-16 pr-3 text-right sm:table-cell print:table-cell")}>
                Qty
              </th>
              <th scope="col" className={cn(TH, "hidden w-32 pr-3 text-right sm:table-cell print:table-cell")}>
                Unit price
              </th>
              <th scope="col" className={cn(TH, "w-32 text-right")}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr className="border-b border-ink-100">
                <td colSpan={4} className="py-6 text-center text-[0.82rem] text-ink-500">
                  No line items on this document.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-ink-100 align-top print:break-inside-avoid">
                <td className="py-3 pr-3">
                  {/* overflow-wrap: anywhere (unlike break-word) also lowers the cell's minimum
                      width, so a long URL or SKU wraps instead of pushing Amount off the page. */}
                  <span className="block whitespace-pre-line wrap-anywhere text-ink-900">{item.description}</span>
                  <span className="mt-0.5 block text-[0.75rem] tabular-nums text-ink-500 sm:hidden print:hidden">
                    {qty(item.quantity)} × {formatMoney(item.unitPriceFils, currency)}
                  </span>
                </td>
                <td className="hidden py-3 pr-3 text-right tabular-nums text-ink-700 sm:table-cell print:table-cell">
                  {qty(item.quantity)}
                </td>
                <td className="hidden whitespace-nowrap py-3 pr-3 text-right tabular-nums text-ink-700 sm:table-cell print:table-cell">
                  {formatMoney(item.unitPriceFils, currency)}
                </td>
                <td className="whitespace-nowrap py-3 text-right font-medium tabular-nums text-ink-900">
                  {formatMoney(lineTotalFils(item), currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ─────────────────────────────────────── */}
        <div className="mt-5 flex justify-end print:break-inside-avoid">
          <dl className="w-full space-y-2 text-[0.85rem] sm:w-80 print:w-80">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Subtotal</dt>
              <dd className="tabular-nums text-ink-800">{formatMoney(totals.subtotalFils, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">VAT ({formatVat(vatBps)})</dt>
              <dd className="tabular-nums text-ink-800">{formatMoney(totals.vatFils, currency)}</dd>
            </div>
            <div className="relative flex items-baseline justify-between gap-4 pt-3">
              <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5 rounded-full", BRAND_RULE)} />
              <dt className="font-semibold text-ink-900">Total ({currency})</dt>
              <dd className="font-display text-[1.25rem] font-bold tabular-nums text-ink-900">
                {formatMoney(totals.totalFils, currency)}
              </dd>
            </div>
          </dl>
        </div>

        {/* ── Notes & terms ──────────────────────────────── */}
        <div className="mt-8 grid gap-6 border-t border-ink-100 pt-6 sm:grid-cols-2 print:grid-cols-2 print:break-inside-avoid">
          {notes && (
            <div className="min-w-0 sm:col-span-2 print:col-span-2">
              <p className={LABEL}>Notes</p>
              <p className="mt-1.5 whitespace-pre-line wrap-anywhere text-[0.82rem] leading-relaxed text-ink-700">{notes}</p>
            </div>
          )}
          {paid ? (
            <div className="min-w-0 sm:col-span-2 print:col-span-2">
              <p className={LABEL}>Payment</p>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-700">
                Paid in full on {formatBusinessDate(paidAt)}. No further payment is due.
              </p>
            </div>
          ) : voided ? (
            <div className="min-w-0 sm:col-span-2 print:col-span-2">
              <p className={LABEL}>Status</p>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-700">
                This invoice has been voided and is not payable. Please disregard any earlier copy.
              </p>
            </div>
          ) : isInvoice ? (
            <>
              <div className="min-w-0">
                <p className={LABEL}>Payment terms</p>
                <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-700">{paymentTerms || BUSINESS.paymentTerms}</p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-700">
                  Please quote <span className="font-mono font-medium text-ink-900">{number}</span> as the payment
                  reference.
                </p>
              </div>
              {BUSINESS.bankDetails && (
                <div className="min-w-0">
                  <p className={LABEL}>Bank details</p>
                  <p className="mt-1.5 whitespace-pre-line break-words text-[0.82rem] leading-relaxed text-ink-700">
                    {BUSINESS.bankDetails}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="min-w-0 sm:col-span-2 print:col-span-2">
              <p className={LABEL}>Validity</p>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-700">
                This quotation is valid until {formatBusinessDate(secondDate)}. All amounts are in {currency}, with VAT
                shown separately above.
              </p>
            </div>
          )}
        </div>

        <footer className="mt-10 flex flex-col items-center gap-1 border-t border-ink-100 pt-5 text-center">
          <p className="text-[0.8rem] font-medium text-ink-700">Thank you for your business.</p>
          <p className={cn(LABEL, "wrap-anywhere")}>
            {BUSINESS.name} · {BUSINESS.website} · {BUSINESS.email}
          </p>
        </footer>
      </div>
    </article>
  );
}

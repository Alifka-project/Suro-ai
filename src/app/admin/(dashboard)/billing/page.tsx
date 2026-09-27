import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import {
  Banknote,
  FilePlus,
  FileText,
  Hourglass,
  Plus,
  Receipt,
  Search,
  SearchX,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import type { InvoiceStatus, Prisma, QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { DEFAULT_CURRENCY, documentTotals, formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { INVOICE_STATUS, QUOTE_STATUS } from "@/lib/admin/labels";
import { BUSINESS_TIME_ZONE, calendarDaysBetween, formatBusinessDate } from "@/lib/admin/time";
import { effectiveInvoiceStatus, invoiceWhereForStatus, isQuoteLapsed } from "@/lib/admin/invoices";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Th,
  cn,
  inputClass,
} from "@/components/admin/ui";
import { currentMonthRange } from "./_lib/dates";
import { INVOICE_STATUS_ORDER, QUOTE_STATUS_ORDER, isInvoiceStatus, isQuoteStatus } from "./_lib/status";

export const metadata: Metadata = { title: "Billing" };

const LIST_LIMIT = 200;

type Tab = "invoices" | "quotes";
type Param = string | string[] | undefined;

const one = (v: Param) => (Array.isArray(v) ? v[0] : v);

function billingHref({ tab, status, q }: { tab: Tab; status?: string | null; q?: string }) {
  const params = new URLSearchParams({ tab });
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  return `/admin/billing?${params.toString()}`;
}

const itemsSelect = { select: { quantity: true, unitPriceFils: true } } as const;

const totalOf = (doc: { vatBps: number; items: { quantity: number; unitPriceFils: number }[] }) =>
  documentTotals(doc.items, doc.vatBps).totalFils;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Param; status?: Param; q?: Param }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const tab: Tab = one(sp.tab) === "quotes" ? "quotes" : "invoices";
  const rawStatus = one(sp.status);
  const invoiceStatus = tab === "invoices" && isInvoiceStatus(rawStatus) ? rawStatus : null;
  const quoteStatus = tab === "quotes" && isQuoteStatus(rawStatus) ? rawStatus : null;
  const activeStatus: string | null = invoiceStatus ?? quoteStatus;
  const q = (one(sp.q) ?? "").trim().slice(0, 100);

  const now = new Date();
  const month = currentMonthRange(now);

  // ── Finance KPIs ───────────────────────────────────────────────────────────
  const [openInvoices, paidThisMonth, sentQuotes, invoiceStatusRows, quoteGroups] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] } },
      select: { status: true, dueDate: true, vatBps: true, items: itemsSelect },
    }),
    db.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: month.start, lt: month.end } },
      select: { vatBps: true, items: itemsSelect },
    }),
    // A converted quote is settled even if its status says otherwise.
    db.quote.findMany({
      where: { status: "SENT", invoice: { is: null } },
      select: { vatBps: true, items: itemsSelect },
    }),
    db.invoice.findMany({ select: { status: true, dueDate: true } }),
    db.quote.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const overdueInvoices = openInvoices.filter((inv) => effectiveInvoiceStatus(inv, now) === "OVERDUE");
  const outstandingFils = openInvoices.reduce((sum, inv) => sum + totalOf(inv), 0);
  const overdueFils = overdueInvoices.reduce((sum, inv) => sum + totalOf(inv), 0);
  const collectedFils = paidThisMonth.reduce((sum, inv) => sum + totalOf(inv), 0);
  const awaitingFils = sentQuotes.reduce((sum, quote) => sum + totalOf(quote), 0);
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: BUSINESS_TIME_ZONE });

  // ── Status counts for the filter chips (invoices by EFFECTIVE status) ─────
  const invoiceCounts = new Map<InvoiceStatus, number>();
  for (const row of invoiceStatusRows) {
    const s = effectiveInvoiceStatus(row, now);
    invoiceCounts.set(s, (invoiceCounts.get(s) ?? 0) + 1);
  }
  const quoteCounts = new Map<QuoteStatus, number>(quoteGroups.map((g) => [g.status, g._count._all]));
  const totalInvoices = invoiceStatusRows.length;
  const totalQuotes = quoteGroups.reduce((sum, g) => sum + g._count._all, 0);

  // ── Active list ────────────────────────────────────────────────────────────
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const searchFields = q
    ? [{ number: contains(q) }, { clientName: contains(q) }, { clientCompany: contains(q) }, { clientEmail: contains(q) }]
    : null;

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    AND: [invoiceStatus ? invoiceWhereForStatus(invoiceStatus, now) : {}, searchFields ? { OR: searchFields } : {}],
  };
  const quoteWhere: Prisma.QuoteWhereInput = {
    AND: [quoteStatus ? { status: quoteStatus } : {}, searchFields ? { OR: searchFields } : {}],
  };

  const listSelect = {
    id: true,
    number: true,
    clientName: true,
    clientCompany: true,
    issueDate: true,
    status: true,
    vatBps: true,
    currency: true,
    items: itemsSelect,
  } as const;

  const [invoices, quotes] = await Promise.all([
    tab === "invoices"
      ? db.invoice.findMany({
          where: invoiceWhere,
          orderBy: [{ issueDate: "desc" }, { number: "desc" }],
          take: LIST_LIMIT,
          select: { ...listSelect, dueDate: true, paidAt: true },
        })
      : Promise.resolve([]),
    tab === "quotes"
      ? db.quote.findMany({
          where: quoteWhere,
          orderBy: [{ issueDate: "desc" }, { number: "desc" }],
          take: LIST_LIMIT,
          select: { ...listSelect, validUntil: true },
        })
      : Promise.resolve([]),
  ]);

  const rowCount = tab === "invoices" ? invoices.length : quotes.length;
  const filtered = Boolean(activeStatus || q);
  const chips =
    tab === "invoices"
      ? INVOICE_STATUS_ORDER.map((s) => ({ value: s, label: INVOICE_STATUS[s].label, count: invoiceCounts.get(s) ?? 0 }))
      : QUOTE_STATUS_ORDER.map((s) => ({ value: s, label: QUOTE_STATUS[s].label, count: quoteCounts.get(s) ?? 0 }));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Billing"
        description="Quotations, tax invoices and cash collected."
        actions={
          <>
            <LinkButton href="/admin/billing/quotes/new" variant="secondary">
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              New quote
            </LinkButton>
            <LinkButton href="/admin/billing/invoices/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New invoice
            </LinkButton>
          </>
        }
      />

      <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatMoneyCompact(outstandingFils)}
          hint={`${plural(openInvoices.length, "open invoice")} · ${formatMoney(outstandingFils)}`}
          icon={Wallet}
        />
        <StatCard
          label="Overdue"
          value={formatMoneyCompact(overdueFils)}
          hint={
            overdueInvoices.length
              ? `${plural(overdueInvoices.length, "invoice")} past due · ${formatMoney(overdueFils)}`
              : "Nothing past due"
          }
          icon={TriangleAlert}
          accent={overdueInvoices.length ? "from-blush-600 to-lilac-500" : "from-ink-400 to-ink-300"}
        />
        <StatCard
          label="Collected this month"
          value={formatMoneyCompact(collectedFils)}
          hint={`${monthLabel} · ${plural(paidThisMonth.length, "payment")}`}
          icon={Banknote}
          accent="from-aqua-500 to-mint-500"
        />
        <StatCard
          label="Quotes awaiting response"
          value={sentQuotes.length}
          hint={sentQuotes.length ? `${formatMoney(awaitingFils)} in play` : "No quotes out with clients"}
          icon={Hourglass}
          accent="from-lilac-500 to-azure-500"
        />
      </section>

      <Card padded={false} className="mt-6 overflow-hidden">
        {/* Tabs + search */}
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Billing documents" className="flex w-full rounded-xl bg-haze p-1 md:w-auto">
            {(
              [
                { value: "invoices", label: "Invoices", count: totalInvoices, icon: Receipt },
                { value: "quotes", label: "Quotes", count: totalQuotes, icon: FileText },
              ] as const
            ).map(({ value, label, count, icon: Icon }) => {
              const active = tab === value;
              return (
                <Link
                  key={value}
                  href={billingHref({ tab: value })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[0.84rem] font-semibold transition-all md:flex-none",
                    active
                      ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(7_38_60_/_0.08),0_4px_12px_-6px_rgb(7_38_60_/_0.18)]"
                      : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-abyss-600" : "text-ink-400")} aria-hidden="true" />
                  {label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[0.68rem] tabular-nums",
                      active ? "bg-ink-100 text-ink-700" : "bg-white/70 text-ink-500",
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>

          <Form action="/admin/billing" role="search" className="relative w-full md:w-72">
            <input type="hidden" name="tab" value={tab} />
            {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
            <label htmlFor="billing-search" className="sr-only">
              Search {tab}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              key={q}
              id="billing-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Number, client or company"
              maxLength={100}
              // The custom clear link below replaces the browser's own clear button.
              className={cn(inputClass, "pl-9 [&::-webkit-search-cancel-button]:hidden", q && "pr-9")}
            />
            {q && (
              <Link
                href={billingHref({ tab, status: activeStatus })}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </Form>
        </div>

        {/* Status filter */}
        <ul className="no-scrollbar flex gap-2 overflow-x-auto border-b border-ink-100 px-4 py-3" aria-label="Filter by status">
          {[{ value: null, label: "All", count: tab === "invoices" ? totalInvoices : totalQuotes }, ...chips].map((chip) => {
            const active = activeStatus === chip.value;
            return (
              <li key={chip.value ?? "all"} className="shrink-0">
                <Link
                  href={billingHref({ tab, status: chip.value, q })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.78rem] font-medium transition-colors",
                    active
                      ? "border-abyss-600/30 bg-abyss-600/[0.07] text-abyss-700"
                      : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
                    chip.value === "OVERDUE" && chip.count > 0 && !active && "border-red-200 text-red-600",
                  )}
                >
                  {chip.label}
                  <span className="tabular-nums text-ink-500">{chip.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {rowCount === 0 ? (
          <div className="p-4 sm:p-6">
            {filtered ? (
              <EmptyState
                icon={SearchX}
                title={`No ${tab} match these filters`}
                description={q ? `Nothing found for “${q}”. Try a client name, company or document number.` : "Try another status."}
                action={
                  <LinkButton href={billingHref({ tab })} variant="secondary" size="sm">
                    Clear filters
                  </LinkButton>
                }
              />
            ) : tab === "invoices" ? (
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                description="Create an invoice from scratch, or convert an accepted quote so nothing has to be retyped."
                action={
                  <LinkButton href="/admin/billing/invoices/new" size="sm">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    New invoice
                  </LinkButton>
                }
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No quotes yet"
                description="Quotes are usually started from a lead in the CRM, so the client details are filled in for you."
                action={
                  <LinkButton href="/admin/billing/quotes/new" size="sm">
                    <FilePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    New quote
                  </LinkButton>
                }
              />
            )}
          </div>
        ) : tab === "invoices" ? (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Client</Th>
                <Th>Issued</Th>
                <Th>Due</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = effectiveInvoiceStatus(inv, now);
                // Calendar days on the business clock; <= 0 only for a record stored as OVERDUE early.
                const lateBy = status === "OVERDUE" ? calendarDaysBetween(inv.dueDate, now) : 0;
                const href = `/admin/billing/invoices/${inv.id}`;
                return (
                  <tr key={inv.id} className="transition-colors hover:bg-haze/60">
                    <Td className="whitespace-nowrap">
                      <Link href={href} className="font-mono text-[0.8rem] font-medium text-abyss-600 hover:underline">
                        {inv.number}
                      </Link>
                    </Td>
                    <Td>
                      {/* max-width on the inner elements: table cells ignore it in auto layout. */}
                      <Link href={href} className="block max-w-64 truncate font-medium text-ink-900 hover:text-abyss-600">
                        {inv.clientName}
                      </Link>
                      {inv.clientCompany && (
                        <span className="block max-w-64 truncate text-[0.78rem] text-ink-500">{inv.clientCompany}</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{formatBusinessDate(inv.issueDate)}</Td>
                    <Td className="whitespace-nowrap">
                      <span className={cn(status === "OVERDUE" && "font-medium text-red-600")}>
                        {formatBusinessDate(inv.dueDate)}
                      </span>
                      {status === "OVERDUE" && lateBy >= 0 && (
                        <span className="block text-[0.72rem] text-red-600">
                          {lateBy === 0 ? "Due today" : `${plural(lateBy, "day")} late`}
                        </span>
                      )}
                      {status === "PAID" && inv.paidAt && (
                        <span className="block text-[0.72rem] text-ink-500">Paid {formatBusinessDate(inv.paidAt)}</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums text-ink-900">
                      <span className={cn(status === "VOID" && "text-ink-500 line-through")}>
                        {formatMoney(totalOf(inv), inv.currency)}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={status} map={INVOICE_STATUS} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Quote</Th>
                <Th>Client</Th>
                <Th>Issued</Th>
                <Th>Valid until</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const lapsed = isQuoteLapsed(quote, now);
                const href = `/admin/billing/quotes/${quote.id}`;
                return (
                  <tr key={quote.id} className="transition-colors hover:bg-haze/60">
                    <Td className="whitespace-nowrap">
                      <Link href={href} className="font-mono text-[0.8rem] font-medium text-abyss-600 hover:underline">
                        {quote.number}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={href} className="block max-w-64 truncate font-medium text-ink-900 hover:text-abyss-600">
                        {quote.clientName}
                      </Link>
                      {quote.clientCompany && (
                        <span className="block max-w-64 truncate text-[0.78rem] text-ink-500">{quote.clientCompany}</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{formatBusinessDate(quote.issueDate)}</Td>
                    <Td className="whitespace-nowrap">
                      <span className={cn(lapsed && "font-medium text-amber-700")}>{formatBusinessDate(quote.validUntil)}</span>
                      {lapsed && <span className="block text-[0.72rem] text-amber-700">Validity ended</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums text-ink-900">
                      {formatMoney(totalOf(quote), quote.currency)}
                    </Td>
                    <Td>
                      <StatusBadge status={quote.status} map={QUOTE_STATUS} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {rowCount === LIST_LIMIT && (
          <p className="border-t border-ink-100 px-4 py-3 text-[0.78rem] text-ink-500">
            Showing the latest {LIST_LIMIT} {tab}. Use search or a status filter to narrow the list.
          </p>
        )}
      </Card>

      <p className="mt-3 text-[0.72rem] text-ink-500">
        All amounts in {DEFAULT_CURRENCY}, including VAT. Sent invoices count as overdue from the day after their due
        date (Dubai time).
      </p>
    </>
  );
}

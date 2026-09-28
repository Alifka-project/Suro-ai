import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import {
  Banknote,
  FilePlus,
  FileSignature,
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
import type { AgreementStatus, InvoiceStatus, Prisma, QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/dal";
import { AGREEMENT_STATUS, AGREEMENT_STATUS_ORDER, isAgreementStatus } from "@/lib/admin/agreement-terms";
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

type Tab = "invoices" | "quotes" | "agreements";
type Param = string | string[] | undefined;

const TABS: readonly Tab[] = ["invoices", "quotes", "agreements"];
const isTab = (v: unknown): v is Tab => typeof v === "string" && (TABS as readonly string[]).includes(v);

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
  const rawTab = one(sp.tab);
  const tab: Tab = isTab(rawTab) ? rawTab : "invoices";
  const rawStatus = one(sp.status);
  const invoiceStatus = tab === "invoices" && isInvoiceStatus(rawStatus) ? rawStatus : null;
  const quoteStatus = tab === "quotes" && isQuoteStatus(rawStatus) ? rawStatus : null;
  const agreementStatus = tab === "agreements" && isAgreementStatus(rawStatus) ? rawStatus : null;
  const activeStatus: string | null = invoiceStatus ?? quoteStatus ?? agreementStatus;
  const q = (one(sp.q) ?? "").trim().slice(0, 100);

  const now = new Date();
  const month = currentMonthRange(now);

  // ── Finance KPIs ───────────────────────────────────────────────────────────
  const [openInvoices, paidThisMonth, sentQuotes, invoiceStatusRows, quoteGroups, agreementGroups] = await Promise.all([
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
    db.agreement.groupBy({ by: ["status"], _count: { _all: true } }),
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
  const agreementCounts = new Map<AgreementStatus, number>(agreementGroups.map((g) => [g.status, g._count._all]));
  const totalInvoices = invoiceStatusRows.length;
  const totalQuotes = quoteGroups.reduce((sum, g) => sum + g._count._all, 0);
  const totalAgreements = agreementGroups.reduce((sum, g) => sum + g._count._all, 0);
  const tabTotal: Record<Tab, number> = { invoices: totalInvoices, quotes: totalQuotes, agreements: totalAgreements };

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
  const agreementWhere: Prisma.AgreementWhereInput = {
    AND: [
      agreementStatus ? { status: agreementStatus } : {},
      searchFields ? { OR: [...searchFields, { projectName: contains(q) }] } : {},
    ],
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

  const [invoices, quotes, agreements] = await Promise.all([
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
    tab === "agreements"
      ? db.agreement.findMany({
          where: agreementWhere,
          orderBy: [{ createdAt: "desc" }, { number: "desc" }],
          take: LIST_LIMIT,
          select: {
            id: true,
            number: true,
            status: true,
            clientName: true,
            clientCompany: true,
            projectName: true,
            effectiveDate: true,
            totalFils: true,
            currency: true,
            quote: { select: { id: true, number: true } },
            project: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const rowCount = { invoices: invoices.length, quotes: quotes.length, agreements: agreements.length }[tab];
  const filtered = Boolean(activeStatus || q);
  const chips =
    tab === "invoices"
      ? INVOICE_STATUS_ORDER.map((s) => ({ value: s, label: INVOICE_STATUS[s].label, count: invoiceCounts.get(s) ?? 0 }))
      : tab === "quotes"
        ? QUOTE_STATUS_ORDER.map((s) => ({ value: s, label: QUOTE_STATUS[s].label, count: quoteCounts.get(s) ?? 0 }))
        : AGREEMENT_STATUS_ORDER.map((s) => ({
            value: s,
            label: AGREEMENT_STATUS[s].label,
            count: agreementCounts.get(s) ?? 0,
          }));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Billing"
        description="Quotations, service agreements, tax invoices and cash collected."
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
          {/* Three tabs share a phone's width: icons and counts appear from sm up
              (the "All" chip below carries the active tab's count on phones). */}
          <nav aria-label="Billing documents" className="flex w-full rounded-xl bg-haze p-1 md:w-auto">
            {(
              [
                { value: "invoices", label: "Invoices", icon: Receipt },
                { value: "quotes", label: "Quotes", icon: FileText },
                { value: "agreements", label: "Agreements", icon: FileSignature },
              ] as const
            ).map(({ value, label, icon: Icon }) => {
              const active = tab === value;
              return (
                <Link
                  key={value}
                  href={billingHref({ tab: value })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-[0.84rem] font-semibold transition-all sm:px-4 md:flex-none",
                    active
                      ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(7_38_60_/_0.08),0_4px_12px_-6px_rgb(7_38_60_/_0.18)]"
                      : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  <Icon
                    className={cn("hidden h-4 w-4 shrink-0 sm:block", active ? "text-abyss-600" : "text-ink-400")}
                    aria-hidden="true"
                  />
                  <span className="truncate">{label}</span>
                  <span
                    className={cn(
                      "hidden rounded-full px-1.5 py-px text-[0.68rem] tabular-nums sm:inline",
                      active ? "bg-ink-100 text-ink-700" : "bg-white/70 text-ink-500",
                    )}
                  >
                    <span className="sr-only">(</span>
                    {tabTotal[value]}
                    <span className="sr-only">)</span>
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
              placeholder={tab === "agreements" ? "Number, client or project" : "Number, client or company"}
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
        <ul className="no-scrollbar relative flex gap-2 overflow-x-auto border-b border-ink-100 px-4 py-3" aria-label="Filter by status">
          {[{ value: null, label: "All", count: tabTotal[tab] }, ...chips].map((chip) => {
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
                description={
                  q
                    ? `Nothing found for “${q}”. Try a client name, company${tab === "agreements" ? ", project" : ""} or document number.`
                    : "Try another status."
                }
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
            ) : tab === "agreements" ? (
              <EmptyState
                icon={FileSignature}
                title="No service agreements yet"
                description="An agreement is generated from its quotation when the quote is accepted or the opportunity is marked Won — or on demand from any open quote."
                action={
                  <LinkButton href={billingHref({ tab: "quotes" })} size="sm" variant="secondary">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Go to quotes
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
        ) : tab === "agreements" ? (
          <Table>
            <thead>
              <tr>
                <Th>Agreement</Th>
                <Th>Client</Th>
                <Th>Project</Th>
                <Th>Effective</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th>Quotation</Th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => {
                const href = `/admin/billing/agreements/${agreement.id}`;
                return (
                  <tr key={agreement.id} className="transition-colors hover:bg-haze/60">
                    <Td className="whitespace-nowrap">
                      <Link href={href} className="font-mono text-[0.8rem] font-medium text-abyss-600 hover:underline">
                        {agreement.number}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={href} className="block max-w-56 truncate font-medium text-ink-900 hover:text-abyss-600">
                        {agreement.clientName}
                      </Link>
                      {agreement.clientCompany && (
                        <span className="block max-w-56 truncate text-[0.78rem] text-ink-500">{agreement.clientCompany}</span>
                      )}
                    </Td>
                    <Td>
                      <span className="block max-w-56 truncate text-ink-800">{agreement.projectName}</span>
                      {agreement.project && (
                        <Link
                          href={`/admin/projects/${agreement.project.id}`}
                          className="text-[0.74rem] font-medium text-abyss-600 hover:underline"
                        >
                          Project started
                        </Link>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{formatBusinessDate(agreement.effectiveDate)}</Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums text-ink-900">
                      <span className={cn(agreement.status === "CANCELLED" && "text-ink-500 line-through")}>
                        {formatMoney(agreement.totalFils, agreement.currency)}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={agreement.status} map={AGREEMENT_STATUS} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {agreement.quote ? (
                        <Link
                          href={`/admin/billing/quotes/${agreement.quote.id}`}
                          className="font-mono text-[0.78rem] text-ink-600 hover:text-abyss-600 hover:underline"
                        >
                          {agreement.quote.number}
                        </Link>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
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
        date (Dubai time). Agreement totals are the snapshot taken from their quotation.
      </p>
    </>
  );
}

import type { InvoiceStatus, LeadStatus, QuoteStatus } from "@prisma/client";
import type { ClientStatus } from "@/lib/admin/labels";

/*
 * Shapes the dashboard page hands to its components. Plain, serialisable
 * data only (dates as ISO strings) — the client table receives these as props.
 */

export type DashboardKpis = {
  /** Every client on the list (all time; removed clients excluded). */
  totalClients: number;
  newThisMonth: number;
  /** Status New: nothing sent to them yet. */
  statusNew: number;
  /** Status Goal (deal closed). */
  goal: number;
  /** Goal as a share of all clients, 0–100, rounded. */
  goalRate: number;
  /**
   * What the projects that aren't cancelled are worth, in fils (AED): each
   * one's latest live quotation (VAT included), else its expected value.
   */
  projectValueFils: number;
  /** Projects counted in projectValueFils (the rest have no value yet). */
  valuedProjects: number;
  /** Clients that aren't cancelled. */
  openProjects: number;
  /** Paid invoices over the last 12 months, in fils (AED). */
  revenue12mFils: number;
  currency: string;
};

/** One business-clock month. `key` is "2026-09". */
export type MonthPoint = { key: string; label: string; fullLabel: string };

export type RevenuePoint = MonthPoint & {
  /** Paid invoices by payment month. */
  collectedFils: number;
  /** Invoices issued that month (sent, paid or overdue; drafts and voids excluded). */
  invoicedFils: number;
};

export type EngagementPoint = MonthPoint & {
  /** New clients that month (website enquiries; while the CRM is off, that's every client). */
  enquiries: number;
  /**
   * Distinct clients the team acted on that month: a status change or other
   * timeline event (arrivals excluded), or a quotation or invoice created.
   */
  engaged: number;
};

export type ClientDocument = {
  id: string;
  number: string;
  status: QuoteStatus | InvoiceStatus;
  totalFils: number;
  currency: string;
};

export type ClientRow = {
  id: string;
  createdAt: string;
  status: LeadStatus;
  source: string;
  clientType: "COMPANY" | "INDIVIDUAL";
  fullName: string;
  /** Project name: set when the project was added by hand ("Add project"). */
  title: string | null;
  /** Expected value in fils (AED), when known. */
  valueFils: number | null;
  companyName: string | null;
  role: string | null;
  companySize: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  contactPreference: string | null;
  services: string[];
  systems: string | null;
  timeline: string | null;
  budget: string | null;
  message: string | null;
  /** Digits for https://wa.me/<digits>, or null when the number can't be dialled internationally. */
  whatsapp: string | null;
  /** tel: href, or null without a phone number. */
  tel: string | null;
  /** Most recent quotation, and how many exist. */
  quote: ClientDocument | null;
  quoteCount: number;
  /**
   * The invoice that most needs attention: the longest-overdue one, else the
   * unpaid one due soonest, else the most recent. Status is the effective
   * one (SENT past its due day reads OVERDUE).
   */
  invoice: ClientDocument | null;
  invoiceCount: number;
  /** Invoices sent and not yet paid, overdue ones included. */
  unpaidInvoiceCount: number;
  /** Of unpaidInvoiceCount: those past their due day. */
  overdueInvoiceCount: number;
  /** Expenses recorded against this project, in fils (AED), and how many. */
  costFils: number;
  costCount: number;
};

export type StatusCount = { status: LeadStatus; count: number };

export type ClientsPage = {
  rows: ClientRow[];
  /** Matching rows across all pages (after search and status filter). */
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** Per-status counts for the filter chips (search applied, status filter not). */
  statusCounts: StatusCount[];
  /** All clients matching the search, any status. */
  matchingAll: number;
  /** The client the URL points at (?client=<id>) when it isn't on this page. */
  focusMissing: boolean;
};

export type DashboardData = {
  now: string;
  kpis: DashboardKpis;
  revenue: RevenuePoint[];
  engagement: EngagementPoint[];
  clients: ClientsPage;
};

export type ClientFilters = {
  q: string;
  status: ClientStatus | null;
  page: number;
  /** ?client=<id>: open this client's row (e.g. from the notification email). */
  focus: string | null;
};

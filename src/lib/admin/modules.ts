/**
 * Which admin modules are switched on.
 *
 * The admin currently runs as ONE page: the client dashboard at /admin. The
 * full CRM, projects, analytics and billing modules are kept in the codebase,
 * untouched, and switched off here.
 *
 * To bring a module back, set its flag to true AND the flags of every module
 * it needs (MODULE_REQUIRES below). The hidden modules link to one another,
 * and a link into a module that is still off would only bounce to the
 * dashboard, so a module whose requirements are not all on stays hidden.
 * In practice: billing, agreements and projects come back together; the CRM
 * needs those three; analytics needs all of them.
 *
 * Quotation and invoice DOCUMENT pages (create, view, edit, print) always stay
 * reachable: the dashboard's client table opens them. Only the billing
 * overview and list pages belong to the `billing` flag.
 *
 * Pure: imported by src/proxy.ts, server pages and client components alike.
 */
export const ADMIN_MODULES = {
  /** The full analytics page (/admin/analytics). */
  analytics: false,
  /** Pipeline, leads list, activities and opportunity pages (/admin/crm/**). */
  crm: false,
  /** Projects and tasks (/admin/projects/**). */
  projects: false,
  /** Billing overview and the quotation / invoice LIST pages. */
  billing: false,
  /**
   * Service agreements (/admin/billing/agreements/**) and the automation that
   * generates one when a quotation is accepted or a deal is won. While off,
   * accepting a quote still marks the client "Goal", but no agreement is
   * generated.
   */
  agreements: false,
} as const;

export type AdminModule = keyof typeof ADMIN_MODULES;

/**
 * The modules each module links into (pages, cards, tabs, toasts). A link to
 * a client's opportunity page (/admin/crm/<id>) doesn't count: with the CRM
 * off it opens that client's row on the dashboard instead.
 *
 * - analytics: pipeline, leads and activity lists (crm), invoice lists
 *   (billing), project and agreement panels.
 * - crm: an opportunity's linked agreement and project.
 * - billing: the Agreements tab and its project links.
 * - agreements: back to the billing Agreements tab; the agreement's project.
 * - projects: the project's agreement and payment schedule.
 */
export const MODULE_REQUIRES: Record<AdminModule, readonly AdminModule[]> = {
  analytics: ["crm", "billing", "projects", "agreements"],
  crm: ["agreements", "projects"],
  billing: ["agreements", "projects"],
  agreements: ["billing", "projects"],
  projects: ["agreements"],
};

/** True when the module's flag is on and so is every module it needs, directly or indirectly. */
export function moduleEnabled(name: AdminModule): boolean {
  const seen = new Set<AdminModule>();
  const pending: AdminModule[] = [name];
  while (pending.length > 0) {
    const next = pending.pop() as AdminModule;
    if (seen.has(next)) continue;
    if (!ADMIN_MODULES[next]) return false;
    seen.add(next);
    pending.push(...MODULE_REQUIRES[next]);
  }
  return true;
}

/** Path prefixes owned by each module. A path belongs to a module if it equals or sits under one. */
const MODULE_PATHS: Record<AdminModule, readonly string[]> = {
  analytics: ["/admin/analytics"],
  crm: ["/admin/crm"],
  projects: ["/admin/projects"],
  // Exact pages only: /admin/billing/quotes/<id> etc. must stay reachable.
  billing: [],
  agreements: ["/admin/billing/agreements"],
};

/** The billing overview and list pages (exact paths). */
const BILLING_LIST_PAGES = ["/admin/billing", "/admin/billing/quotes", "/admin/billing/invoices"];

/** CRM sub-pages that sit where an opportunity id would (/admin/crm/<segment>). */
const CRM_RESERVED = new Set(["pipeline", "activities"]);

const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const normalise = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

/**
 * Where a request for a switched-off module should go instead, or null when
 * the path is allowed. An old CRM link to one client (e.g. from a lead
 * notification email) opens that client on the dashboard.
 */
export function hiddenPathRedirect(pathname: string): string | null {
  const path = normalise(pathname);
  if (!moduleEnabled("crm") && under(path, "/admin/crm")) {
    const id = /^\/admin\/crm\/([A-Za-z0-9_-]+)$/.exec(path)?.[1];
    return id && !CRM_RESERVED.has(id) ? clientHref(id) : "/admin";
  }
  for (const key of ["analytics", "projects", "agreements"] as const) {
    if (!moduleEnabled(key) && MODULE_PATHS[key].some((p) => under(path, p))) return "/admin";
  }
  if (!moduleEnabled("billing") && BILLING_LIST_PAGES.includes(path)) return "/admin";
  return null;
}

/**
 * Where to send someone who clicks a client's name anywhere in the admin:
 * the full opportunity page when the CRM is on, otherwise that client's row
 * on the dashboard.
 */
export function clientHref(leadId: string): string {
  return moduleEnabled("crm") ? `/admin/crm/${leadId}` : `/admin?client=${encodeURIComponent(leadId)}#clients`;
}

/**
 * The `next` page to hand the login form when a signed-out visitor is sent
 * there, or null for the dashboard (the login form's default).
 *
 * The login action accepts /admin paths and exactly one query form,
 * /admin?client=<id> (see safeNext in src/app/admin/actions.ts), so a link to
 * one client's row on the dashboard — as in the new-enquiry email — survives
 * signing in.
 */
export function loginReturnPath(pathname: string, search: URLSearchParams): string | null {
  if (normalise(pathname) !== "/admin") return pathname;
  const client = search.get("client");
  return client && CLIENT_ID.test(client) ? `/admin?client=${client}` : null;
}

/** "Back" target for quotation and invoice pages. */
export function billingBackHref(kind: "quotes" | "invoices"): { href: string; label: string } {
  return moduleEnabled("billing")
    ? { href: `/admin/billing?tab=${kind}`, label: kind === "quotes" ? "All quotes" : "All invoices" }
    : { href: "/admin#clients", label: "Back to dashboard" };
}

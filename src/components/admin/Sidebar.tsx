"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Users,
  Receipt,
  ReceiptText,
  FolderKanban,
  ExternalLink,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/admin/actions";
import { initials } from "@/lib/admin/labels";
import { hiddenPathRedirect, moduleEnabled, type AdminModule } from "@/lib/admin/modules";
import { cn } from "./ui";

/** True on `href` itself and on every route nested under it. */
const within = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** What Tab can land on inside the drawer, for the focus trap. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Counts = { newLeads: number; overdueActivities: number };

type NavChild = {
  href: string;
  label: string;
  /** Billing's list is one page with a ?tab= switch, so matching needs the tab too. */
  match: (path: string, tab: string | null) => boolean;
  badge?: "overdueActivities";
  /** Shown only while this module is switched on (src/lib/admin/modules.ts). */
  module?: AdminModule;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Route prefix the section owns, for its active state. */
  section: string;
  exact?: boolean;
  badge?: "newLeads";
  children?: NavChild[];
  /** Shown only while one of these modules is switched on. Always shown without it. */
  modules?: AdminModule[];
};

/*
 * Every section the admin has. Modules switched off in src/lib/admin/modules.ts
 * keep their entries here but are left out of the rendered nav, so turning a
 * module back on brings its links back with nothing else to change. With the
 * current flags the nav is the one client dashboard.
 *
 * A sub-link stays active on the detail and edit pages beneath it, e.g.
 * /admin/crm/<id> under Leads.
 */
const NAV: NavItem[] = [
  // Clients with status New are counted here: the dashboard's client table is where they are.
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, section: "/admin", exact: true, badge: "newLeads" },
  // What the business spends. Always shown; Dashboard is `exact`, so it stays unlit here.
  { href: "/admin/expenses", label: "Expenses", icon: ReceiptText, section: "/admin/expenses" },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    section: "/admin/analytics",
    modules: ["analytics"],
  },
  {
    href: "/admin/crm/pipeline",
    label: "CRM",
    icon: Users,
    section: "/admin/crm",
    modules: ["crm"],
    children: [
      { href: "/admin/crm/pipeline", label: "Pipeline", match: (p) => within(p, "/admin/crm/pipeline") },
      {
        href: "/admin/crm",
        label: "Leads",
        match: (p) => within(p, "/admin/crm") && !within(p, "/admin/crm/pipeline") && !within(p, "/admin/crm/activities"),
      },
      {
        href: "/admin/crm/activities",
        label: "Activities",
        match: (p) => within(p, "/admin/crm/activities"),
        badge: "overdueActivities",
      },
    ],
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: Receipt,
    section: "/admin/billing",
    modules: ["billing", "agreements"],
    children: [
      {
        href: "/admin/billing?tab=quotes",
        label: "Quotations",
        match: (p, tab) => within(p, "/admin/billing/quotes") || (p === "/admin/billing" && tab === "quotes"),
        module: "billing",
      },
      {
        href: "/admin/billing/agreements",
        label: "Agreements",
        match: (p, tab) => within(p, "/admin/billing/agreements") || (p === "/admin/billing" && tab === "agreements"),
        module: "agreements",
      },
      {
        // Invoices is the billing page's default tab.
        href: "/admin/billing?tab=invoices",
        label: "Invoices",
        match: (p, tab) =>
          within(p, "/admin/billing/invoices") || (p === "/admin/billing" && tab !== "quotes" && tab !== "agreements"),
        module: "billing",
      },
    ],
  },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, section: "/admin/projects", modules: ["projects"] },
];

/**
 * The nav as it renders with the current module flags. A section keeps its
 * own link while that page is reachable (so turning a module back on restores
 * it exactly); when the page itself is switched off, e.g. the billing overview
 * with only agreements on, the section opens its first remaining sub-link.
 */
const VISIBLE_NAV: NavItem[] = NAV.flatMap((item) => {
  if (item.modules && !item.modules.some(moduleEnabled)) return [];
  if (!item.children) return [item];
  const children = item.children.filter((child) => !child.module || moduleEnabled(child.module));
  if (children.length === 0) return [];
  const ownPageShown = hiddenPathRedirect(item.href.split("?")[0]) === null;
  return [{ ...item, href: ownPageShown ? item.href : children[0].href, children }];
});

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Count pill. The number is spelled out for screen readers, never carried by colour alone. */
function CountBadge({ count, kind }: { count: number; kind: "new" | "overdue" }) {
  const text = kind === "new" ? plural(count, "new client", "new clients") : `${count} overdue`;
  return (
    <span
      title={text}
      className={cn(
        "ml-auto rounded-full px-2 py-0.5 text-[0.68rem] font-bold tabular-nums",
        kind === "new" ? "bg-linear-to-r from-azure-500 to-aqua-500 text-white" : "bg-red-100 text-red-700",
      )}
    >
      <span className="sr-only">, {text}</span>
      <span aria-hidden="true">{count}</span>
    </span>
  );
}

export function Sidebar({
  newLeads,
  overdueActivities,
  admin,
}: Counts & {
  /** The signed-in admin, shown at the foot of the rail. */
  admin: { name: string; username: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [open, setOpen] = useState(false);
  const counts: Counts = { newLeads, overdueActivities };

  // Close the mobile drawer whenever the route changes — including browser
  // back/forward, which a link onClick wouldn't catch. Adjusting state during
  // render (React's pattern for "reset when a value changes") avoids the extra
  // cascading render a setState-in-useEffect would cause. The query string is
  // part of the route here: Quotations and Invoices differ only by ?tab=.
  const route = `${pathname}?${searchParams.toString()}`;
  const [lastRoute, setLastRoute] = useState(route);
  if (route !== lastRoute) {
    setLastRoute(route);
    setOpen(false);
  }

  // The drawer is a modal dialog, so it owns the keyboard while open: focus
  // moves in on open, Escape closes it, Tab and Shift+Tab wrap inside it, and
  // focus goes back to the menu button on close (however it was closed).
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      const drawer = drawerRef.current;
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!drawer.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      toggle?.focus();
    };
  }, [open]);

  const inSection = (item: NavItem) => (item.exact ? pathname === item.section : within(pathname, item.section));
  const accountActive = within(pathname, "/admin/account");

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <Link href="/admin" className="flex shrink-0 items-center gap-2.5 px-3 py-4">
        <Image src="/brand/suloai-mark.png" alt="" width={226} height={240} className="h-8 w-auto" />
        <span className="font-display text-[1.05rem] font-bold tracking-[0.02em] text-ink-900">
          SULO<span className="text-gradient">AI</span>
        </span>
        <span className="ml-auto rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-500">
          Admin
        </span>
      </Link>

      {/* Scrolls on its own when a short screen can't fit every link, so the
          account block below stays reachable. */}
      <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3 pt-2">
        {VISIBLE_NAV.map((item) => {
          const { href, label, icon: Icon, badge, children } = item;
          const active = inSection(item);
          // A section with sub-pages marks the sub-link as the current page;
          // its own row only shows that you are inside it.
          const current = active && !children;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.88rem] font-medium transition-colors",
                  current
                    ? "bg-ink-900/[0.04] text-ink-900"
                    : active
                      ? "text-ink-900 hover:bg-ink-900/[0.03]"
                      : "text-ink-500 hover:bg-ink-900/[0.03] hover:text-ink-800",
                )}
              >
                {current && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-linear-to-b from-abyss-600 via-azure-500 to-aqua-500"
                  />
                )}
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-abyss-600" : "text-ink-400 group-hover:text-ink-600")} aria-hidden="true" />
                {label}
                {badge && counts[badge] > 0 && <CountBadge count={counts[badge]} kind="new" />}
              </Link>

              {children && (
                <ul className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-ink-100 pl-2">
                  {children.map((child) => {
                    const childActive = child.match(pathname, tab);
                    const count = child.badge ? counts[child.badge] : 0;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.82rem] transition-colors",
                            childActive
                              ? "bg-ink-900/[0.04] font-semibold text-ink-900"
                              : "font-medium text-ink-500 hover:bg-ink-900/[0.03] hover:text-ink-800",
                          )}
                        >
                          {childActive && (
                            // Sits on the guide line, like the section marker on a top-level row.
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-1.5 -left-[9px] w-[2px] rounded-full bg-linear-to-b from-abyss-600 via-azure-500 to-aqua-500"
                            />
                          )}
                          {child.label}
                          {count > 0 && <CountBadge count={count} kind="overdue" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 space-y-1 border-t border-ink-100 px-2 py-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.85rem] font-medium text-ink-500 transition-colors hover:bg-ink-900/[0.03] hover:text-ink-800"
        >
          <ExternalLink className="h-[18px] w-[18px] text-ink-400" aria-hidden="true" />
          View website
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <div className="flex items-center gap-1">
          <Link
            href="/admin/account"
            aria-current={accountActive ? "page" : undefined}
            title={`Signed in as ${admin.name} (${admin.username})`}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors",
              accountActive ? "bg-ink-900/[0.04]" : "hover:bg-ink-900/[0.03]",
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-abyss-600 via-azure-500 to-aqua-500 font-display text-[0.7rem] font-bold text-white"
            >
              {initials(admin.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.84rem] font-semibold text-ink-900">{admin.name}</span>
              <span className="block truncate text-[0.72rem] text-ink-500">Your account</span>
            </span>
          </Link>
          <form action={logout} className="shrink-0">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop: fixed rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-100 bg-white/85 backdrop-blur-xl lg:block print:hidden">
        {nav}
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/85 px-4 py-3 backdrop-blur-xl lg:hidden print:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/brand/suloai-mark.png" alt="" width={226} height={240} className="h-7 w-auto" />
          <span className="font-display font-bold text-ink-900">
            SULO<span className="text-gradient">AI</span>
          </span>
        </Link>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={
            newLeads + overdueActivities > 0
              ? `Open navigation (${[
                  newLeads > 0 && plural(newLeads, "new client", "new clients"),
                  overdueActivities > 0 && plural(overdueActivities, "overdue activity", "overdue activities"),
                ]
                  .filter(Boolean)
                  .join(", ")})`
              : "Open navigation"
          }
          aria-expanded={open}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white"
        >
          <Menu className="h-4 w-4 text-ink-700" aria-hidden="true" />
          {/* Something is waiting inside the drawer: the counts are in the label. */}
          {newLeads + overdueActivities > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                overdueActivities > 0 ? "bg-red-500" : "bg-azure-500",
              )}
            />
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          {/* A pointer target only: keyboard users have the close button and
              Escape, so the invisible full-screen scrim stays out of the Tab order. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm"
          />
          <aside ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

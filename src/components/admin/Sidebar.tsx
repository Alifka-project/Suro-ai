"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  FolderKanban,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/app/admin/actions";
import { cn } from "./ui";

const NAV = [
  { href: "/admin", label: "Analytics", icon: LayoutDashboard, exact: true },
  { href: "/admin/crm", label: "CRM", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: Receipt },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
];

export function Sidebar({ newLeads }: { newLeads: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes — including browser
  // back/forward, which a link onClick wouldn't catch. Adjusting state during
  // render (React's pattern for "reset when a value changes") avoids the extra
  // cascading render a setState-in-useEffect would cause.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2.5 px-3 py-4">
        <Image src="/brand/suloai-mark.png" alt="" width={226} height={240} className="h-8 w-auto" />
        <span className="font-display text-[1.05rem] font-bold tracking-[0.02em] text-ink-900">
          SULO<span className="text-gradient">AI</span>
        </span>
        <span className="ml-auto rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-500">
          Admin
        </span>
      </Link>

      <ul className="mt-4 space-y-1 px-2">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.88rem] font-medium transition-colors",
                  active ? "bg-ink-900/[0.04] text-ink-900" : "text-ink-500 hover:bg-ink-900/[0.03] hover:text-ink-800",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-linear-to-b from-abyss-600 via-azure-500 to-aqua-500"
                  />
                )}
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-abyss-600" : "text-ink-400 group-hover:text-ink-600")} aria-hidden="true" />
                {label}
                {href === "/admin/crm" && newLeads > 0 && (
                  <span className="ml-auto rounded-full bg-linear-to-r from-azure-500 to-aqua-500 px-2 py-0.5 text-[0.68rem] font-bold text-white">
                    {newLeads}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-1 border-t border-ink-100 px-2 py-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.85rem] font-medium text-ink-500 transition-colors hover:bg-ink-900/[0.03] hover:text-ink-800"
        >
          <ExternalLink className="h-[18px] w-[18px] text-ink-400" aria-hidden="true" />
          View website
        </a>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.85rem] font-medium text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            Sign out
          </button>
        </form>
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
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white"
        >
          <Menu className="h-4 w-4 text-ink-700" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100"
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

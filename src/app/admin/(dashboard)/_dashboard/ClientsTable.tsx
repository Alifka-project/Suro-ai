import Link from "next/link";
import type { ReactNode } from "react";
import { Inbox, Info, SearchX } from "lucide-react";
import { Card, EmptyState, LinkButton, cn } from "@/components/admin/ui";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { AddProjectButton } from "./AddProject";
import { ClientList } from "./ClientList";
import { StatusProvider } from "./StatusProvider";
import { TablePagination, TableSearch, TableStatusFilter, dashboardHref } from "./TableToolbar";
import type { ClientFilters, ClientsPage } from "./types";

/*
 * "Clients": everyone who filled in the website form, with their details,
 * WhatsApp / call buttons, quotation, invoice and a status that can be changed
 * in place. The section the dashboard links to as /admin#clients.
 *
 * A Server Component: the toolbar, notices, empty states and paging are plain
 * HTML and links. Only the rows (details toggles, status selects) and the
 * status-change toast run in the browser.
 */

const HEADING_ID = "clients-heading";

export function ClientsTable({ page, filters, now }: { page: ClientsPage; filters: ClientFilters; now: string }) {
  const { q, status, focus } = filters;
  const filtered = Boolean(q || status);
  // Without a search, `matchingAll` is every client there is.
  const noClientsYet = !q && page.matchingAll === 0;
  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);

  let body: ReactNode;
  if (noClientsYet) {
    body = (
      <div className="p-4 sm:p-5">
        <EmptyState
          icon={Inbox}
          title="No clients yet"
          description="Clients appear here when someone fills in the form on the website, or when you add a project yourself with “Add project” above."
        />
      </div>
    );
  } else if (page.total === 0) {
    body = (
      <div className="p-4 sm:p-5">
        <EmptyState
          icon={SearchX}
          title="No matching clients"
          description={
            q ? (
              <>
                Nothing matches{" "}
                <span className="font-semibold text-ink-700 [overflow-wrap:anywhere]">&ldquo;{q}&rdquo;</span>
                {status ? ` with the status ${LEAD_STATUS[status].label}` : ""}. Try a name, company or email address.
              </>
            ) : (
              `No client has the status ${status ? LEAD_STATUS[status].label : ""} right now.`
            )
          }
          action={
            <LinkButton href={dashboardHref({})} variant="secondary" size="sm">
              Clear filters
            </LinkButton>
          }
        />
      </div>
    );
  } else {
    body = <ClientList rows={page.rows} now={now} focus={focus} />;
  }

  return (
    <section id="clients" aria-labelledby={HEADING_ID} className="min-w-0">
      <StatusProvider headingId={HEADING_ID}>
        <Card padded={false} className="min-w-0">
          {/* Header and toolbar */}
          <div className="space-y-4 border-b border-ink-100 px-4 pb-4 pt-5 sm:px-5">
            {/* One Add project button in a fixed place, empty table or not: the
                dialog it owns must survive the table re-rendering around it.
                Phones: title and button on the first row, search below at full
                width. From md: title · search · button on one row. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 md:grid-cols-[minmax(0,1fr)_18rem_auto] md:items-end md:gap-x-4">
              <div className="col-start-1 row-start-1 min-w-0">
                <h2
                  id={HEADING_ID}
                  tabIndex={-1}
                  className="font-display text-[1.05rem] font-bold text-ink-900 focus:outline-none"
                >
                  Clients
                </h2>
                <p className="mt-0.5 text-[0.8rem] text-ink-550">
                  Website enquiries and projects you add yourself, newest first.
                </p>
              </div>
              {!noClientsYet && (
                <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                  <TableSearch q={q} status={status} />
                </div>
              )}
              <div className="col-start-2 row-start-1 md:col-start-3">
                <AddProjectButton />
              </div>
            </div>

            {!noClientsYet && (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                <TableStatusFilter active={status} counts={page.statusCounts} all={page.matchingAll} q={q} />
                {page.total > 0 && (
                  <p className="shrink-0 text-[0.78rem] tabular-nums text-ink-550">
                    Showing{" "}
                    <span className="font-semibold text-ink-800">
                      {from}–{to}
                    </span>{" "}
                    of <span className="font-semibold text-ink-800">{page.total}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {page.focusMissing && focus && <FocusNotice id={focus} filtered={filtered} />}

          {/* Clips the row tints to the card's rounded bottom corners (clip, not
              hidden: it must not become a scroll container, or the sticky table
              header would stop sticking). */}
          <div className="overflow-clip rounded-b-2xl">
            {body}
            <TablePagination page={page.page} pageCount={page.pageCount} q={q} status={status} />
          </div>
        </Card>
      </StatusProvider>
    </section>
  );
}

/** The linked client (?client=<id>) isn't in this list. */
function FocusNotice({ id, filtered }: { id: string; filtered: boolean }) {
  return (
    <div
      className={cn(
        "mx-4 mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[0.82rem] ring-1 ring-inset sm:mx-5",
        "bg-amber-400/10 text-ink-800 ring-amber-400/35",
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      {filtered ? (
        <p>
          That client isn&apos;t in the current filter —{" "}
          <Link
            href={`/admin?client=${encodeURIComponent(id)}#clients`}
            className="font-semibold text-abyss-600 underline underline-offset-2 hover:text-abyss-700"
          >
            clear filters to see them
          </Link>
          .
        </p>
      ) : (
        <p>That client isn&apos;t on the list. They may have been removed.</p>
      )}
    </div>
  );
}

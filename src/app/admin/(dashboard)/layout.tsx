import { Sidebar } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/admin/dal";
import { db } from "@/lib/db";

/**
 * Dashboard shell. The requireAdmin() call here is one layer of several — per
 * the Next 16 auth guide a layout does not re-run on client navigation, so
 * every page and Server Action repeats the check on its own.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const newLeads = await db.lead.count({ where: { status: "NEW" } });

  return (
    <>
      <Sidebar newLeads={newLeads} />
      <div className="lg:pl-64 print:pl-0">
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </>
  );
}

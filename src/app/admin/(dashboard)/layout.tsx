import { Sidebar } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/admin/dal";
import { moduleEnabled } from "@/lib/admin/modules";
import { startOfBusinessDay } from "@/lib/admin/time";
import { db } from "@/lib/db";

/**
 * Dashboard shell. The requireAdmin() call here is one layer of several — per
 * the Next 16 auth guide a layout does not re-run on client navigation, so
 * every page and Server Action repeats the check on its own.
 *
 * The sidebar badges are recounted whenever an action revalidates the /admin
 * layout (every status change and billing action does), so they stay current.
 * Only what the visible nav shows is counted: the overdue-activities badge
 * belongs to the CRM, so it is skipped while the CRM is switched off.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [newLeads, overdueActivities] = await Promise.all([
    // Clients who filled in the form and haven't been contacted yet.
    db.lead.count({ where: { status: "NEW" } }),
    // Same rule as the Activities planner: open, due before today began on the
    // business clock, on an opportunity that is still in play.
    moduleEnabled("crm")
      ? db.activity.count({
          where: { doneAt: null, dueDate: { lt: startOfBusinessDay() }, lead: { status: { not: "LOST" } } },
        })
      : Promise.resolve(0),
  ]);

  return (
    <>
      <Sidebar
        newLeads={newLeads}
        overdueActivities={overdueActivities}
        admin={{ name: admin.name, username: admin.username }}
      />
      <div className="lg:pl-64 print:pl-0">
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </>
  );
}

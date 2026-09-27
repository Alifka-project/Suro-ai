import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";

/** /admin/billing/invoices is the invoices tab of the billing overview. */
export default async function InvoicesIndexPage() {
  await requireAdmin();
  redirect("/admin/billing?tab=invoices");
}

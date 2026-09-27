import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";

/** /admin/billing/quotes is the quotes tab of the billing overview. */
export default async function QuotesIndexPage() {
  await requireAdmin();
  redirect("/admin/billing?tab=quotes");
}

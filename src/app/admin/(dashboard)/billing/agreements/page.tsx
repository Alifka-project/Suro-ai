import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { isAgreementStatus } from "@/lib/admin/agreement-terms";

type Param = string | string[] | undefined;

const one = (v: Param) => (Array.isArray(v) ? v[0] : v);

/**
 * /admin/billing/agreements is the agreements tab of the billing overview.
 * A status filter and search (e.g. the analytics status chips) carry over.
 */
export default async function AgreementsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: Param; q?: Param }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const params = new URLSearchParams({ tab: "agreements" });
  const status = one(sp.status);
  if (isAgreementStatus(status)) params.set("status", status);
  const q = (one(sp.q) ?? "").trim().slice(0, 100);
  if (q) params.set("q", q);
  redirect(`/admin/billing?${params.toString()}`);
}

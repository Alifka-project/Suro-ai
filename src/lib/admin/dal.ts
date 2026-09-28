import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decrypt, SESSION_COOKIE } from "./session";

/** The signed-in admin, as every page and Server Action sees it. */
export type AdminSession = { id: string; username: string; name: string };

/**
 * The session's account, or null when there is no valid session: no cookie, a
 * forged or expired one, a deactivated or deleted account, or a session issued
 * before the account's last password change. Never redirects.
 */
export const getAdmin = cache(async (): Promise<AdminSession | null> => {
  const session = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const admin = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, name: true, active: true, sessionVersion: true },
  });
  if (!admin || !admin.active || admin.sessionVersion !== session.ver) return null;
  return { id: admin.id, username: admin.username, name: admin.name };
});

/**
 * THE authorization gate. Call it at the top of every admin data read and
 * every admin Server Action; it returns the signed-in admin.
 *
 * Why not rely on the layout or proxy? Per the Next 16 auth guide, layouts do
 * not re-render on client navigation, and proxy is documented as an
 * optimistic check only. Server Actions are public HTTP endpoints — anyone can
 * POST to them directly. So authorization has to sit next to the data.
 *
 * The account is re-read from the database (once per request, via `cache`),
 * so deactivating an admin or changing their password takes effect at once
 * instead of when the 7-day cookie expires.
 */
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
});

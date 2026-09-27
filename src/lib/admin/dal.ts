import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt, SESSION_COOKIE } from "./session";

/**
 * THE authorization gate. Call it at the top of every admin data read and
 * every admin Server Action.
 *
 * Why not rely on the layout or proxy? Per the Next 16 auth guide, layouts do
 * not re-render on client navigation, and proxy is documented as an
 * optimistic check only. Server Actions are public HTTP endpoints — anyone can
 * POST to them directly. So authorization has to sit next to the data.
 *
 * `cache` dedupes the cookie decode within a single render pass.
 */
export const requireAdmin = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);
  if (!session) redirect("/admin/login");
  return session;
});

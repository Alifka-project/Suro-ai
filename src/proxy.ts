import { NextResponse, type NextRequest } from "next/server";
import { hiddenPathRedirect, loginReturnPath } from "@/lib/admin/modules";
import { decrypt, SESSION_COOKIE } from "@/lib/admin/session";

/**
 * Optimistic gate for /admin: bounce visitors without a signed session cookie
 * to the login page before any admin route renders. This is a convenience
 * layer, not the security boundary — every admin read and mutation re-checks
 * the session AND the account through requireAdmin() in src/lib/admin/dal.ts.
 *
 * The proxy can't see the database, so it never sends a signed-in visitor
 * away from the login page: a cookie can be validly signed yet belong to a
 * deactivated account or predate a password change, and bouncing it to /admin
 * (which bounces it straight back) would loop. The login page does that
 * redirect itself, after the full check.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";

  if (!isLogin && !(await decrypt(req.cookies.get(SESSION_COOKIE)?.value))) {
    const url = new URL("/admin/login", req.nextUrl);
    // Back to the page asked for after signing in — including one client's
    // row on the dashboard (?client=<id>, the new-enquiry email's link).
    const back = loginReturnPath(pathname, req.nextUrl.searchParams);
    if (back) url.searchParams.set("next", back);
    return NextResponse.redirect(url);
  }

  // Switched-off modules (src/lib/admin/modules.ts) are kept in the code but
  // not reachable: their pages send the visitor to the dashboard instead.
  const redirectTo = isLogin ? null : hiddenPathRedirect(pathname);
  if (redirectTo) return NextResponse.redirect(new URL(redirectTo, req.nextUrl));

  const res = NextResponse.next();
  // Nothing under /admin should ever be indexed or cached by a shared proxy.
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

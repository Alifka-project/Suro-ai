import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/admin/session";

/**
 * Optimistic gate for /admin: bounce signed-out visitors to the login page
 * before any admin route renders. This is a convenience layer, not the
 * security boundary — every admin read and mutation re-checks the session
 * through requireAdmin() in src/lib/admin/dal.ts.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isLogin) {
    const url = new URL("/admin/login", req.nextUrl);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  const res = NextResponse.next();
  // Nothing under /admin should ever be indexed or cached by a shared proxy.
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

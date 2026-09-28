import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "suloai_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What the signed cookie carries. `sub` is the AdminUser id and `ver` its
 * sessionVersion at sign-in: requireAdmin() re-reads the account on every
 * request and refuses the cookie once the account is deactivated or its
 * version moves on (password change / "sign out everywhere").
 */
export type SessionPayload = {
  role: "admin";
  sub: string;
  ver: number;
  expiresAt: number;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  // Refuse to run with a missing or trivially short secret rather than
  // silently signing cookies with something guessable.
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(secretKey());
}

/** The verified payload, or null for a missing, forged, expired or old-format token. Never throws. */
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (
      payload.role !== "admin" ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.ver !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }
    return { role: "admin", sub: payload.sub, ver: payload.ver, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

export async function createSession(admin: { id: string; sessionVersion: number }): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = await encrypt({ role: "admin", sub: admin.id, ver: admin.sessionVersion, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

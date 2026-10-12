"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dummyPasswordHash, normalizeUsername, verifyPassword } from "@/lib/admin/password";
import { createSession, deleteSession } from "@/lib/admin/session";

export type LoginState = { error?: string; username?: string } | undefined;

/**
 * In-memory limits — a speed bump per instance, not a hard wall.
 *
 * - Per IP: after 5 failures in 15 minutes, that IP is refused outright.
 *   Signing in only clears the IP's failures for the ID that signed in.
 * - Per sign-in ID: after 10 failures in 15 minutes (guessing spread across
 *   many IPs), the ID only takes attempts from IPs with no recent failures.
 *   Each guessing IP is then down to one try per window, while the real
 *   admin, on a clean IP, can't be locked out by someone else's failures.
 *
 * The client IP comes from the hosting proxy's headers: Vercel sets
 * x-real-ip and overwrites x-forwarded-for. Behind a host that passes
 * client-supplied values through, the per-IP limit is only as good as that.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_PER_USERNAME = 10;
/** Failures kept per key: enough to tell whether either limit is reached. */
const KEEP_PER_KEY = Math.max(MAX_PER_IP, MAX_PER_USERNAME);
/** Past this many keys, expired ones are swept on the next failure. */
const SWEEP_AT = 5000;
/** Hard ceiling on memory: past it, the oldest keys are dropped as well. */
const MAX_KEYS = 20_000;
/**
 * One failed attempt: when (t) and which normalized sign-in ID it was for (u).
 * Under an IP key, u tells failures against different IDs apart.
 */
type Failure = { t: number; u: string };
const failures = new Map<string, Failure[]>();

function recent(key: string): Failure[] {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((f) => now - f.t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

function recordFailure(key: string, username: string) {
  const now = Date.now();
  failures.set(key, [...recent(key), { t: now, u: username }].slice(-KEEP_PER_KEY));
  // Keys are otherwise only pruned when looked up again, so IPs and IDs that
  // never come back would pile up.
  if (failures.size <= SWEEP_AT) return;
  for (const [k, list] of failures) {
    if (list.every((f) => now - f.t >= WINDOW_MS)) failures.delete(k);
  }
  // Still over the ceiling means a flood of fresh (likely spoofed) IPs or IDs
  // within one window. Forget the oldest entries (a Map iterates in insertion
  // order): memory stays bounded, and stopping such a flood is the job of the
  // host's edge rate limiting, not of this speed bump.
  if (failures.size <= MAX_KEYS) return;
  for (const k of failures.keys()) {
    if (failures.size <= SWEEP_AT) break;
    failures.delete(k);
  }
}

function clientIp(h: Headers): string {
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Only same-site /admin paths are allowed as a post-login destination.
 * Anything else — "https://evil.com", "//evil.com", "/\\evil.com" — would turn
 * the login page into an open redirect.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  // One client's row on the dashboard (the new-enquiry email links there).
  if (/^\/admin\?client=[A-Za-z0-9_-]{1,64}$/.test(next)) return next;
  return /^\/admin(\/[A-Za-z0-9\-_/]*)?$/.test(next) && next !== "/admin/login" ? next : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = clientIp(await headers());

  const rawUsername = formData.get("username");
  const password = formData.get("password");
  const typed = typeof rawUsername === "string" ? rawUsername.slice(0, 64) : "";
  const username = normalizeUsername(typed);

  const ipKey = `ip:${ip}`;
  const userKey = `user:${username}`;
  const ipFailures = recent(ipKey).length;
  const idUnderAttack = !!username && recent(userKey).length >= MAX_PER_USERNAME;
  if (ipFailures >= MAX_PER_IP || (idUnderAttack && ipFailures > 0)) {
    return { error: "Too many attempts. Try again in 15 minutes.", username: typed };
  }

  const fail = async (): Promise<LoginState> => {
    recordFailure(ipKey, username);
    if (username) recordFailure(userKey, username);
    // Deliberately vague — never says whether the ID exists — and a small
    // fixed delay blunts rapid guessing.
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Incorrect admin ID or password.", username: typed };
  };

  if (!username || typeof password !== "string" || password.length === 0 || password.length > 200) {
    return fail();
  }

  const admin = await db.adminUser.findUnique({
    where: { username },
    select: { id: true, passwordHash: true, active: true, sessionVersion: true },
  });
  // Unknown or inactive IDs still pay for a full scrypt verification, so the
  // response time doesn't reveal which IDs exist.
  const ok = await verifyPassword(password, admin?.passwordHash ?? (await dummyPasswordHash()));
  if (!admin || !admin.active || !ok) return fail();

  // The IP's failures for this ID are forgiven, but only those: wiping the
  // whole slate would let someone reset the IP's budget forever by signing in
  // as themselves between guesses at another admin's password. The ID's own
  // failures stay until they expire: they only restrict IPs that failed
  // themselves, and clearing them would hand anyone still guessing at this ID
  // a fresh budget.
  const otherIds = recent(ipKey).filter((f) => f.u !== username);
  if (otherIds.length) failures.set(ipKey, otherIds);
  else failures.delete(ipKey);
  await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await createSession(admin);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}

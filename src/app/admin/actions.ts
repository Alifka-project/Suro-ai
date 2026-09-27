"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, deleteSession, passwordMatches } from "@/lib/admin/session";

export type LoginState = { error?: string } | undefined;

/** 5 attempts per IP per 15 minutes. In-memory: a speed bump per instance, not a hard wall. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, recent);
  return recent.length >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  attempts.set(ip, [...(attempts.get(ip) ?? []), Date.now()]);
}

/**
 * Only same-site /admin paths are allowed as a post-login destination.
 * Anything else — "https://evil.com", "//evil.com", "/\\evil.com" — would turn
 * the login page into an open redirect.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return /^\/admin(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  if (tooManyAttempts(ip)) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(password)) {
    recordFailure(ip);
    // Deliberately vague, and a small fixed delay blunts rapid guessing.
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Incorrect password." };
  }

  attempts.delete(ip);
  await createSession();
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}

"use server";

import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/dal";
import {
  PASSWORD_MAX_LENGTH,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "@/lib/admin/password";
import { createSession } from "@/lib/admin/session";
import { db } from "@/lib/db";

/*
 * Account Server Actions — the signed-in admin's own password and sessions.
 *
 * Every export here is a public POST endpoint, so each one re-checks the
 * session first and only ever touches the caller's own account: the id comes
 * from requireAdmin(), never from the form.
 *
 * Sessions are stateless signed cookies carrying the account's sessionVersion
 * (see src/lib/admin/session.ts). Bumping the version revokes every cookie
 * issued before; re-issuing this device's cookie with the new version keeps
 * the admin who asked signed in here.
 */

export type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/**
 * `null` is the idle state. `at` changes on every submission. `signedOut` means
 * every session on the account, this one included, has just been revoked.
 */
export type AccountActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<PasswordField, string>>;
  signedOut?: boolean;
  at: number;
} | null;

function failure(message: string, fieldErrors?: Partial<Record<PasswordField, string>>): AccountActionState {
  return { ok: false, message, fieldErrors, at: Date.now() };
}

function success(message: string): AccountActionState {
  return { ok: true, message, at: Date.now() };
}

/** Passwords are taken exactly as typed: no trimming, since spaces are legal characters. */
function password(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** The record changed or disappeared between the check and the write. */
function isGoneError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

/*
 * Wrong current passwords, counted per account in memory: a speed bump per
 * instance, like sign-in's limiter in src/app/admin/actions.ts. Changing the
 * password needs a valid session, so what this stops is a stolen or borrowed
 * cookie being used to guess the password, which would turn a cookie theft
 * into a takeover. (A per-IP count adds nothing here: the cookie already pins
 * every guess to one account.)
 *
 * The limit ends the session doing the guessing rather than just pausing it:
 * the MAX_WRONG_PASSWORDS-th wrong guess in the window revokes every session
 * on the account, this one included. The real owner signs back in with the
 * password they know; whoever holds a copied cookie is left with nothing.
 */
const WRONG_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const MAX_WRONG_PASSWORDS = 5;
/** Warn once this few guesses are left before the sign-out. */
const WARN_WHEN_LEFT = 2;
const wrongPasswords = new Map<string, number[]>();

/** The account's wrong guesses still inside the window, oldest first. */
function recentWrongPasswords(adminId: string): number[] {
  const now = Date.now();
  const list = (wrongPasswords.get(adminId) ?? []).filter((t) => now - t < WRONG_PASSWORD_WINDOW_MS);
  if (list.length) wrongPasswords.set(adminId, list);
  else wrongPasswords.delete(adminId);
  return list;
}

function minutesUntilUnlocked(attempts: number[]): number {
  return Math.max(1, Math.ceil((attempts[0] + WRONG_PASSWORD_WINDOW_MS - Date.now()) / 60_000));
}

export async function changePassword(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const admin = await requireAdmin();

  const current = password(formData.get("currentPassword"));
  const next = password(formData.get("newPassword"));
  const confirm = password(formData.get("confirmPassword"));

  const fieldErrors: Partial<Record<PasswordField, string>> = {};
  if (!current) fieldErrors.currentPassword = "Enter your current password.";
  const problem = next ? passwordProblem(next) : "Enter a new password.";
  if (problem) fieldErrors.newPassword = problem;
  else if (next === current) fieldErrors.newPassword = "Choose a password you aren't using now.";
  if (!fieldErrors.newPassword && confirm !== next) fieldErrors.confirmPassword = "This doesn't match the new password.";
  if (Object.keys(fieldErrors).length > 0) return failure("Check the highlighted fields.", fieldErrors);

  const account = await db.adminUser.findUnique({
    where: { id: admin.id },
    select: { passwordHash: true },
  });
  if (!account) return failure("Your account could not be found. Sign in again.");

  // Check the limit and take a slot in one synchronous step, before the next
  // await: a burst of parallel POSTs can't all slip under the limit, because
  // each counts as a wrong guess up front and only the right password clears it.
  const earlier = recentWrongPasswords(admin.id);
  if (earlier.length >= MAX_WRONG_PASSWORDS) {
    const minutes = minutesUntilUnlocked(earlier);
    return failure(
      `Too many wrong passwords were entered for this account. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    );
  }
  wrongPasswords.set(admin.id, [...earlier, Date.now()]);

  // Over-long input can't be the current password (sign-in refuses it too),
  // and there's no reason to spend a full scrypt run on it.
  const matches = current.length <= PASSWORD_MAX_LENGTH && (await verifyPassword(current, account.passwordHash));
  if (!matches) {
    // A small fixed delay, like sign-in, blunts rapid guessing from a borrowed session.
    await new Promise((r) => setTimeout(r, 400));

    const used = recentWrongPasswords(admin.id).length;
    if (used >= MAX_WRONG_PASSWORDS) {
      // updateMany: a deleted account simply matches nothing instead of throwing.
      // The guesses stay counted, so changes also pause for the rest of the window.
      await db.adminUser.updateMany({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } });
      return {
        ok: false,
        message:
          "Too many wrong passwords. To protect the account, every session has been signed out, including this one. Sign in again to continue.",
        signedOut: true,
        at: Date.now(),
      };
    }

    const left = MAX_WRONG_PASSWORDS - used;
    return failure(
      left <= WARN_WHEN_LEFT
        ? `Your current password is incorrect. ${left} more wrong ${left === 1 ? "try" : "tries"} and every session on this account, including this one, will be signed out.`
        : "Your current password is incorrect.",
      { currentPassword: "That isn't your current password." },
    );
  }
  wrongPasswords.delete(admin.id);

  const passwordHash = await hashPassword(next);
  try {
    // Compare-and-set on the old hash: if the password changed elsewhere since
    // it was verified above, this write matches nothing instead of overwriting it.
    const updated = await db.adminUser.update({
      where: { id: admin.id, active: true, passwordHash: account.passwordHash },
      data: { passwordHash, sessionVersion: { increment: 1 } },
      select: { id: true, sessionVersion: true },
    });
    await createSession(updated);
  } catch (err) {
    if (isGoneError(err)) {
      return failure("Your password was changed somewhere else a moment ago. Reload the page and try again.");
    }
    throw err;
  }

  return success("Password changed. Every other device has been signed out; this one stays signed in.");
}

/** Takes no input: it only ever acts on the caller's own account. */
export async function signOutOtherDevices(): Promise<AccountActionState> {
  const admin = await requireAdmin();
  try {
    const updated = await db.adminUser.update({
      where: { id: admin.id, active: true },
      data: { sessionVersion: { increment: 1 } },
      select: { id: true, sessionVersion: true },
    });
    await createSession(updated);
  } catch (err) {
    if (isGoneError(err)) return failure("Your account could not be found. Sign in again.");
    throw err;
  }
  return success("Signed out on every other device. This one stays signed in.");
}

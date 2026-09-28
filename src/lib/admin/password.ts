/**
 * Admin password hashing with scrypt from node:crypto (no native dependency).
 *
 * Deliberately free of "server-only" and of "@/" path aliases so the account
 * script (scripts/admin-user.mjs) can import this file directly with Node.
 * It can never reach a browser bundle anyway: node:crypto would fail the build.
 *
 * Stored format: scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 * The parameters travel with each hash, so they can be raised later without
 * invalidating existing passwords.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 16384; // N = 2^14
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Constant-time check. A malformed stored hash never matches and never throws. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map((v) => Number.parseInt(v, 10));
  // Refuse absurd parameters from a tampered row rather than burning CPU/memory on them.
  if (![N, r, p].every(Number.isSafeInteger) || N < 2 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  try {
    const actual = await derive(password, salt, N, r, p);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * A real hash of a random password, verified against when the sign-in ID does
 * not exist — so "unknown ID" takes as long as "wrong password" and response
 * timing doesn't reveal which admin IDs are valid.
 */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummyHash;
}

/** Sign-in IDs are case-insensitive: stored and compared lower-case. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Null when acceptable, otherwise a message to show. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  return null;
}

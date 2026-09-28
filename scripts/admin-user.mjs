#!/usr/bin/env node
/**
 * Manage dashboard sign-in accounts.
 *
 *   npm run admin:user -- list
 *   npm run admin:user -- create <admin-id> "<Display name>"
 *   npm run admin:user -- set-password <admin-id>
 *   npm run admin:user -- deactivate <admin-id>
 *   npm run admin:user -- activate <admin-id>
 *
 * Passwords are never taken as command-line arguments (they would land in
 * shell history and the process list). In a terminal you are prompted with
 * hidden input; otherwise the first line of stdin is used, e.g.
 *   printf '%s\n' "$PASSWORD" | npm run admin:user -- set-password alifka123
 *
 * Uses DATABASE_URL from the environment or .env.local — check which database
 * that points at before creating accounts.
 */
import { PrismaClient } from "@prisma/client";
import {
  hashPassword,
  normalizeUsername,
  passwordProblem,
  USERNAME_PATTERN,
} from "../src/lib/admin/password.ts";

const [command, rawUsername, ...rest] = process.argv.slice(2);
const db = new PrismaClient();

function die(message) {
  console.error(message);
  process.exit(1);
}

async function readStdinLine() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
    if (data.includes("\n")) break;
  }
  return data.split(/\r?\n/)[0];
}

/** C0 controls and DEL: a browser password field can never submit these. */
const CONTROL_CHAR = /[\u0000-\u001f\u007f]/;

/**
 * Hidden input in raw mode. A chunk is not one keystroke — a paste arrives
 * as one chunk, often ending in a newline — so each chunk is read character
 * by character: Enter ends the prompt (anything pasted after it is dropped),
 * Backspace deletes, and arrow/function keys (escape sequences) and other
 * control characters are ignored rather than stored in the password.
 */
function promptHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let chars = [];
    // Escape-sequence state: "" none, "esc" after ESC, "csi" inside ESC [ …, "ss3" after ESC O.
    let escape = "";
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      resolve(chars.join(""));
    };
    const onData = (chunk) => {
      // for…of walks code points, so an emoji or other astral character stays whole.
      for (const ch of chunk) {
        if (escape === "esc") {
          escape = ch === "[" ? "csi" : ch === "O" ? "ss3" : "";
          continue;
        }
        if (escape === "csi") {
          // Parameters until a final byte in @ … ~ ends the sequence.
          if (ch >= "@" && ch <= "~") escape = "";
          continue;
        }
        if (escape === "ss3") {
          escape = "";
          continue;
        }
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish();
        if (ch === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") chars = chars.slice(0, -1);
        else if (ch === "\u001b") escape = "esc";
        else if (!CONTROL_CHAR.test(ch)) chars.push(ch);
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword() {
  let password;
  if (process.stdin.isTTY) {
    password = await promptHidden("New password: ");
    const again = await promptHidden("Repeat password: ");
    if (password !== again) die("Passwords do not match.");
  } else {
    password = await readStdinLine();
  }
  password ??= "";
  // Belt and braces for piped input (e.g. a stray tab or CR from a file): a
  // password the sign-in form can't reproduce would lock the account out.
  if (CONTROL_CHAR.test(password)) {
    die("Password rejected: it contains a control character (tab, carriage return, escape…). Type or paste it again.");
  }
  const problem = passwordProblem(password);
  if (problem) die(`Password rejected: ${problem}`);
  return password;
}

function requireUsername() {
  if (!rawUsername) die("Give the admin ID, e.g. `create alifka123 \"Alifka\"`.");
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_PATTERN.test(username)) {
    die("Admin IDs are 3–32 characters: letters, numbers, dot, dash or underscore, starting with a letter or number.");
  }
  return username;
}

async function main() {
  switch (command) {
    case "list": {
      const admins = await db.adminUser.findMany({ orderBy: { createdAt: "asc" } });
      if (admins.length === 0) console.log("No admin accounts yet.");
      for (const a of admins) {
        console.log(
          `${a.username.padEnd(20)} ${a.name.padEnd(20)} ${a.active ? "active  " : "INACTIVE"} last sign-in: ${a.lastLoginAt?.toISOString() ?? "never"}`,
        );
      }
      return;
    }
    case "create": {
      const username = requireUsername();
      const name = rest.join(" ").trim() || rawUsername;
      if (await db.adminUser.findUnique({ where: { username } })) {
        die(`"${username}" already exists. Use set-password to change its password.`);
      }
      const passwordHash = await hashPassword(await readPassword());
      await db.adminUser.create({ data: { username, name, passwordHash } });
      console.log(`Created admin "${username}" (${name}).`);
      return;
    }
    case "set-password": {
      const username = requireUsername();
      if (!(await db.adminUser.findUnique({ where: { username } }))) die(`No admin "${username}".`);
      const passwordHash = await hashPassword(await readPassword());
      // Bumping the version signs out every existing session for this account.
      await db.adminUser.update({
        where: { username },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      console.log(`Password changed for "${username}". Their other sessions are signed out.`);
      return;
    }
    case "deactivate":
    case "activate": {
      const username = requireUsername();
      const active = command === "activate";
      const updated = await db.adminUser.updateMany({
        where: { username },
        data: { active, sessionVersion: { increment: 1 } },
      });
      if (updated.count === 0) die(`No admin "${username}".`);
      console.log(`${active ? "Activated" : "Deactivated"} "${username}".`);
      return;
    }
    default:
      die("Usage: admin-user.mjs list | create <id> \"<name>\" | set-password <id> | deactivate <id> | activate <id>");
  }
}

try {
  await main();
} finally {
  await db.$disconnect();
}

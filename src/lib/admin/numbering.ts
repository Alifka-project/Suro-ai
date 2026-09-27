import "server-only";
import { db } from "@/lib/db";

const PREFIX = { quote: "Q", invoice: "INV" } as const;

/**
 * Next sequential document number, e.g. "INV-2026-0007". The upsert with
 * `increment` is a single atomic statement in Postgres, so concurrent creates
 * can't collide, and numbering restarts at 0001 each calendar year.
 */
export async function nextDocumentNumber(kind: keyof typeof PREFIX): Promise<string> {
  const year = new Date().getFullYear();
  const { value } = await db.counter.upsert({
    where: { key: `${kind}-${year}` },
    create: { key: `${kind}-${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIX[kind]}-${year}-${String(value).padStart(4, "0")}`;
}

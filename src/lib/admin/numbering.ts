import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calendarDay } from "./time";

const PREFIX = { quote: "Q", invoice: "INV", agreement: "SA" } as const;
export type DocumentKind = keyof typeof PREFIX;

/**
 * Next sequential document number, e.g. "INV-2026-0007" or "SA-2026-0001".
 * The upsert with `increment` is a single atomic statement in Postgres, so
 * concurrent creates can't collide, and numbering restarts at 0001 each
 * calendar year on the business (Dubai) clock.
 *
 * Pass the transaction client when the document is created inside a
 * transaction: a rolled-back create then rolls the counter back with it
 * instead of leaving a gap.
 */
export async function nextDocumentNumber(
  kind: DocumentKind,
  client: Prisma.TransactionClient = db,
): Promise<string> {
  const { year } = calendarDay(new Date());
  const { value } = await client.counter.upsert({
    where: { key: `${kind}-${year}` },
    create: { key: `${kind}-${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIX[kind]}-${year}-${String(value).padStart(4, "0")}`;
}

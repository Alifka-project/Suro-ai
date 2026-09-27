/**
 * Input parsing shared by the document editor (live totals) and the Server
 * Actions (authoritative validation). Keeping one implementation means the
 * total the admin sees while typing is exactly the total that gets saved.
 * Pure — safe to import from client components.
 */
import { parseMoneyToFils } from "@/lib/admin/money";

export const MAX_LINE_ITEMS = 100;
export const MAX_QUANTITY = 100_000;
/** AED 10,000,000 per unit — comfortably inside Postgres int4 once in fils. */
export const MAX_UNIT_PRICE_FILS = 1_000_000_000;

const DECIMAL_RE = /^(\d+(\.\d*)?|\.\d+)$/;
const PERCENT_RE = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;

/** Quantity > 0, up to 3 decimals (e.g. 1.5 days). Null when invalid. */
export function parseQuantity(input: string | number): number | null {
  const s = String(input).trim();
  if (!DECIMAL_RE.test(s)) return null;
  const n = Math.round(Number(s) * 1000) / 1000;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_QUANTITY) return null;
  return n;
}

/**
 * Unit price in AED ("12500", "12,500", "AED 1,000.50") -> fils, >= 0, at most
 * two decimals, capped at MAX_UNIT_PRICE_FILS. The shared strict parser rejects
 * anything else ("1e5", "12.500,50", "45k"), so a typo is an error rather than
 * a silently different price. A number (from a hand-made POST) is checked as
 * its string form, so it gets the same strict format check, not rounding.
 */
export function parseUnitPriceFils(input: string | number): number | null {
  const fils = parseMoneyToFils(String(input));
  if (fils === null || fils > MAX_UNIT_PRICE_FILS) return null;
  return fils;
}

/** VAT percent ("5", "5%", "0", "12.5") -> basis points 0..10,000. Null when invalid. */
export function parseVatPercentToBps(input: string): number | null {
  const s = input.trim().replace(/%$/, "").trim();
  if (!PERCENT_RE.test(s)) return null;
  const pct = Number(s);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return Math.round(pct * 100);
}

/** Basis points -> editable percent string: 500 -> "5", 525 -> "5.25". */
export function bpsToPercentInput(bps: number): string {
  const whole = Math.floor(bps / 100);
  const rest = bps % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}

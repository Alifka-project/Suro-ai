/**
 * Money helpers. Everything is integer fils (1 AED = 100 fils); VAT is basis
 * points (500 = 5%). Pure functions — safe to import from client components.
 */

export const DEFAULT_CURRENCY = "AED";
export const DEFAULT_VAT_BPS = 500;

export type MoneyLine = { quantity: number; unitPriceFils: number };

/**
 * Quantity is a float (1.5 days), so `quantity * unitPriceFils` can land a hair
 * under a half: 1.005 * 100 is 100.49999999999999, which rounds to 100 instead
 * of 101. Scaling the quantity to exact integer thousandths first keeps the
 * whole product in integers. Quantities are validated to 3 decimal places.
 */
export function lineTotalFils(line: MoneyLine): number {
  const milli = Math.round(line.quantity * 1000);
  return Math.round((milli * line.unitPriceFils) / 1000);
}

export function documentTotals(lines: MoneyLine[], vatBps: number) {
  const subtotalFils = lines.reduce((sum, l) => sum + lineTotalFils(l), 0);
  // Round VAT once on the subtotal, not per line — per-line rounding can put
  // the invoice total a fil or two away from what the client's own calculator says.
  const vatFils = Math.round((subtotalFils * vatBps) / 10_000);
  return { subtotalFils, vatFils, totalFils: subtotalFils + vatFils };
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(fils: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  if (fils === null || fils === undefined) return "—";
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, f);
  }
  return f.format(fils / 100);
}

/** Compact form for KPI tiles and chart axes: "AED 1.2M", "AED 84K". */
export function formatMoneyCompact(fils: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(fils / 100);
}

/**
 * Accepts plain amounts only: "12500", "12,500", "12500.5", "AED 12,500.50".
 * Commas only as thousands separators, at most two decimals.
 */
const AMOUNT_PATTERN = /^(?:AED\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/i;

/**
 * Parse a typed amount into integer fils, or null when it is not a plain
 * non-negative amount.
 *
 * Deliberately strict. An earlier version stripped unknown characters, which
 * silently misread "1e5" as AED 15.00, "12.500,50" as AED 12.50 and "45k" as
 * AED 45.00 — wrong prices with no error. Whole and fractional parts are
 * combined as integers, so no float rounding is involved.
 */
export function parseMoneyToFils(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1].replace(/,/g, ""));
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(whole * 100 + fraction)) return null;
  return whole * 100 + fraction;
}

/** Integer fils -> an editable amount ("12500", "12500.50") without float maths. "" for none. */
export function filsToInput(fils: number | null | undefined): string {
  if (fils === null || fils === undefined) return "";
  const whole = Math.floor(fils / 100);
  const cents = fils % 100;
  return cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, "0")}`;
}

export function formatVat(bps: number): string {
  return `${(bps / 100).toLocaleString("en-AE", { maximumFractionDigits: 2 })}%`;
}

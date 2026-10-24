/*
 * RFC 4180 CSV for the expenses export. Pure.
 *
 * Text cells are neutralised against spreadsheet formula injection: a value
 * that starts with = + - @, a tab or a carriage return would be run as a
 * formula by Excel, Numbers or Google Sheets, so it gets a leading apostrophe
 * and opens as plain text. Numbers are written by this code, never typed by a
 * user, so they are left alone.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

type Cell = { text: string } | { number: string };

export const text = (value: string | null | undefined): Cell => ({ text: value ?? "" });
export const number = (value: string): Cell => ({ number: value });

function encode(cell: Cell): string {
  const raw = "number" in cell ? cell.number : FORMULA_START.test(cell.text) ? `'${cell.text}` : cell.text;
  return NEEDS_QUOTES.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/** Rows to a CSV document: CRLF line endings, preceded by a UTF-8 BOM so Excel reads accents and Arabic correctly. */
export function toCsv(rows: Cell[][]): string {
  return `﻿${rows.map((row) => row.map(encode).join(",")).join("\r\n")}\r\n`;
}

/** Integer fils as a plain amount with two decimals and no separators: 123456 -> "1234.56". */
export function filsToPlain(fils: number): string {
  const sign = fils < 0 ? "-" : "";
  const abs = Math.abs(fils);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

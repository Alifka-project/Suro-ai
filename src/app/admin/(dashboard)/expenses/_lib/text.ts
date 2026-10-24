/*
 * Text from a form or a URL, made safe to store and to search with. Postgres
 * `text` can't hold U+0000 (a query or a write carrying one fails outright),
 * and no other control character belongs in an expense or a search either, so
 * they are dropped. Tab, line feed and carriage return are left for the caller:
 * single-line fields fold them into spaces, notes keep line breaks. Pure: safe
 * in Server and Client Components.
 */

/** C0 controls except tab, LF and CR; DEL; C1 controls. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

/** One trimmed line: control characters dropped, every run of whitespace a single space. */
export function singleLine(value: string): string {
  return stripControlChars(value).replace(/\s+/g, " ").trim();
}

/**
 * Phone numbers from the website form are free text: "+971 50 123 4567",
 * "00971501234567", "971 50 123 4567" (code typed without + or 00),
 * "+971 (0) 50 123 4567", or a local "050 123 4567". WhatsApp (wa.me) and a
 * clean tel: link both need the full international number, so a local number
 * is completed with the dialling code of the country the client picked in
 * the form. Pure — safe anywhere.
 */

/** Dialling codes for the countries clients most often pick. Keys are lower-case country names. */
const DIAL_CODES: Record<string, string> = {
  "united arab emirates": "971",
  uae: "971",
  "saudi arabia": "966",
  qatar: "974",
  oman: "968",
  kuwait: "965",
  bahrain: "973",
  egypt: "20",
  jordan: "962",
  lebanon: "961",
  india: "91",
  pakistan: "92",
  "sri lanka": "94",
  bangladesh: "880",
  philippines: "63",
  indonesia: "62",
  malaysia: "60",
  singapore: "65",
  "united kingdom": "44",
  "united states": "1",
  "united states of america": "1",
  canada: "1",
  germany: "49",
  france: "33",
  netherlands: "31",
  "south africa": "27",
  kenya: "254",
  nigeria: "234",
  turkey: "90",
  "türkiye": "90",
  australia: "61",
};

/**
 * Shortest national number (digits after the country code, trunk 0 dropped)
 * for countries where the usual 8 would misread a number. India and
 * US/Canada numbers are 10 digits, and an Indian one can itself start with
 * 91; Lebanese numbers can be 7 digits.
 */
const MIN_NATIONAL: Record<string, number> = { "1": 10, "91": 10, "961": 7 };
const DEFAULT_MIN_NATIONAL = 8;

/**
 * The number as digits with its country code ("971501234567"), or null when
 * it can't be completed: no country code and no known country, or a length
 * outside what E.164 allows.
 */
export function dialableNumber(phone: string, country?: string | null): string | null {
  // "(0)" marks a trunk zero that is not dialled from abroad: "+44 (0)20 …".
  const trimmed = phone.replace(/\(\s*0\s*\)/g, " ").trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const code = country ? DIAL_CODES[country.trim().toLowerCase()] : undefined;

  if (/^\(?\+/.test(trimmed)) {
    // Already international: "+971 …" or "(+971) …".
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else {
    if (!code) return null;
    // "971 50 123 4567": the client typed the code without + or 00. Only
    // taken as such when a full national number follows it, so a local
    // number that happens to begin with the same digits is still completed.
    const typedWithCode =
      digits.startsWith(code) && digits.length - code.length >= (MIN_NATIONAL[code] ?? DEFAULT_MIN_NATIONAL);
    // A local number's trunk prefix (the leading 0) is dropped after the country code.
    if (!typedWithCode) digits = code + digits.replace(/^0+/, "");
  }

  // "+971 050 …": a trunk 0 kept after the client's own country code is not
  // dialled internationally (none of the countries above use a leading 0).
  if (code && digits.startsWith(`${code}0`)) digits = code + digits.slice(code.length).replace(/^0+/, "");

  // Country codes never start with 0; E.164 allows at most 15 digits.
  if (digits.startsWith("0") || digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** tel: link with the international number when it can be worked out, else the digits as typed. */
export function telLink(phone: string, country?: string | null): string | null {
  const full = dialableNumber(phone, country);
  if (full) return `tel:+${full}`;
  const raw = phone.replace(/[^\d+]/g, "");
  return raw.replace(/\D/g, "").length >= 6 ? `tel:${raw}` : null;
}

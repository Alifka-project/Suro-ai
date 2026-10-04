/**
 * Brand glow colours as "r g b" triplets, for rgb(var / alpha) styles.
 *
 * A plain module (no "use client") so server components can read the values.
 * Importing them from SpotlightCard.tsx, a client module, would hand a server
 * component a client reference instead of the strings. SpotlightCard
 * re-exports GLOW for existing client imports.
 */
export const GLOW = {
  abyss: "7 102 163",
  azure: "56 134 213",
  aqua: "65 176 204",
  mint: "142 209 196",
  lilac: "181 171 230",
  blush: "253 156 194",
} as const;

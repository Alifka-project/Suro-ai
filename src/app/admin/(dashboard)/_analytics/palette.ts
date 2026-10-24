/**
 * Chart colours for the analytics overview, taken from the SULOAI brand ramps
 * in globals.css. Kept as hex literals (not CSS variables) because recharts
 * paints SVG attributes directly.
 *
 * Every chart and bar list on this page plots a single series, so each one
 * takes a single hue. Text colours clear WCAG AA (4.5:1) on white.
 *
 * Pipeline stage dots use TONE_DOT from @/lib/admin/labels, the same classes
 * the CRM board lanes and filter chips use, so a stage keeps one colour
 * everywhere in the dashboard.
 */

export const CHART = {
  /** Leads trend line + area wash (3.8:1 on white). */
  azure: "#3686d5",
  /** Revenue columns and pipeline bars (6.1:1 on white). */
  abyss: "#0766a3",
  /** Hovered revenue column: one step lighter on the same ramp. */
  abyssHover: "#2067a5",
  /** Services bar list (3.2:1 on white). */
  aqua: "#2f9bb8",
  /** Axis ticks (ink-600, 6.5:1 on white; ink-400 and ink-500 fall short of AA). */
  muted: "#2c6288",
  /** Primary chart text (ink-900). */
  ink: "#06253c",
  /** Hairline gridlines (ink-100). */
  grid: "#eaf1f6",
  /** Crosshair / hover band (ink-200 / haze). */
  cursor: "#d3e0e9",
  haze: "#eef5fa",
  surface: "#ffffff",
  /**
   * Expense columns on the Expenses page (blush-ink, 6.1:1 on white). The
   * dashboard's Engagement line repeats this hex as COLOR.engaged in
   * _dashboard/charts.tsx: change both together.
   */
  blushInk: "#b02e63",
  /** Hovered expense column: one step darker on the same ramp. */
  blushInkHover: "#8f2350",
} as const;

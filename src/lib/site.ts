/**
 * Site-wide facts: where the site lives, who it belongs to, how to reach us,
 * and the section anchors every nav, footer and CTA link points at. One place,
 * so the header, footer, metadata and structured data can never disagree.
 */

/**
 * The public URL that canonical links, the sitemap, OpenGraph and structured
 * data use. Order of preference:
 * 1. NEXT_PUBLIC_SITE_URL — set this once a custom domain points at Vercel.
 * 2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's production domain for the
 *    project, provided automatically at build and run time.
 * 3. localhost, for development.
 *
 * Deliberately not hard-coded to suloai.com: that domain currently serves a
 * different (Squarespace) site, and a canonical URL pointing there would tell
 * search engines this page is a copy of it.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  // The NEXT_PUBLIC_ twin is what Vercel exposes to browser code; the plain
  // one is available on the server. Either is the same domain.
  const vercel = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  )?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

export const BRAND = {
  name: "SULOAI",
  /** The client's positioning line. */
  tagline: "Small task or complex system — we turn business challenges into smarter solutions.",
  /** Short descriptor for titles, the footer and document letterheads. */
  descriptor: "Business automation & AI",
} as const;

/** The three things we do, in the order the client lists them. */
export const VALUE_PILLARS = [
  { key: "automation", label: "Automation", line: "Workflows take over the repetitive work." },
  { key: "integration", label: "Integration", line: "Your systems pass data to each other." },
  { key: "intelligence", label: "Intelligence", line: "AI that finds, checks and flags for you." },
] as const;

export const CONTACT = {
  email: "suloai.automation@gmail.com",
  /**
   * Null until the client confirms the real number. While null, the WhatsApp
   * link is hidden everywhere instead of showing a placeholder number.
   * Format when set: international, e.g. "+971 50 123 4567".
   */
  whatsapp: null as string | null,
  city: "Dubai",
  country: "United Arab Emirates",
  countryCode: "AE",
  serviceArea: "Working with clients across the GCC, Europe and Asia",
} as const;

/**
 * External booking page (Calendly, Google Calendar appointment page, …).
 * When unset, every "Book a call" button opens the contact form with
 * "Video call" preselected as the contact preference.
 */
export const BOOKING_URL: string | null = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || null;

/** The client's own profile line, and the only figures we publish. */
export const PROFILE = {
  summary: "A team with more than 100 projects delivered for individuals, SMEs and large enterprises.",
  credentials: [
    { value: "100+", label: "projects delivered" },
    { value: "3", label: "client sizes: individuals, SMEs, enterprises" },
    { value: "8", label: "business functions covered" },
  ],
} as const;

/** Section anchors, used by the nav, the footer and in-page CTAs. */
export const SECTION_IDS = {
  painPoints: "pain-points",
  approach: "approach",
  functions: "functions",
  services: "services",
  about: "about",
  faq: "faq",
  contact: "contact",
} as const;

/** Builds a WhatsApp click-to-chat link from CONTACT.whatsapp, or null. */
export function whatsappHref(): string | null {
  if (!CONTACT.whatsapp) return null;
  const digits = CONTACT.whatsapp.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

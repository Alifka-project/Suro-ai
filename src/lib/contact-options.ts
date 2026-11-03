/**
 * The contact form's option lists. No zod here (and no "use client"): the
 * client form renders its options from this file without shipping zod, and
 * contact-schema.ts builds the shared schema from the same lists, so adding a
 * budget band is still a one-line change.
 *
 * The service options are the packages' form labels ("Package 1: Automate")
 * plus "Not sure yet", defined once in packages.ts. They're what a lead stores
 * in the CRM and what the service agreement prints as its package reference.
 */
export { SERVICE_OPTIONS, NOT_SURE_OPTION } from "./packages";

export const COMPANY_SIZES = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–1000 employees",
  "1000+ employees",
] as const;

export const INDUSTRIES = [
  "Manufacturing",
  "Distribution & wholesale",
  "Retail & e-commerce",
  "Logistics & 3PL",
  "Freight forwarding",
  "Pharmaceutical & healthcare",
  "Food & beverage",
  "Automotive",
  "Electronics",
  "Construction & industrial",
  "Agriculture",
  "Energy & utilities",
  "Financial services",
  "Professional services",
  "Real estate & property",
  "Hospitality & tourism",
  "Education",
  "Public sector",
  "Other",
] as const;

export const TIMELINES = [
  "Urgent — within 30 days",
  "This quarter",
  "Next 3–6 months",
  "Exploring / budgeting for later",
] as const;

export const BUDGETS = [
  "Under $5,000",
  "$5,000 – $15,000",
  "$15,000 – $50,000",
  "$50,000 – $150,000",
  "$150,000+",
  "Need guidance on budget",
] as const;

export const CONTACT_PREFERENCES = [
  "Email",
  "Phone call",
  "WhatsApp",
  "Video call",
] as const;

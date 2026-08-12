import { z } from "zod";

/**
 * Shared by the client form and the API route, so validation can never drift
 * between the two. Every option list here is exported for the UI to render, so
 * adding a service or budget band is a one-line change.
 */

export const SERVICE_OPTIONS = [
  "Power Automate / Power Platform",
  "Excel & VBA engineering",
  "Process & workflow automation",
  "System integration & EDI",
  "AI chatbot / support agent",
  "Embedded AI copilot",
  "Document intelligence",
  "Forecasting & analytics",
  "Dashboards & reporting",
  "Not sure yet — need advice",
] as const;

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

export const contactSchema = z
  .object({
    clientType: z.enum(["company", "individual"], {
      message: "Let us know whether this is for a company or yourself",
    }),

    fullName: z
      .string()
      .trim()
      .min(2, "Please enter your full name")
      .max(100, "That name is longer than we can store"),

    email: z.email("Please enter a valid email address"),

    phone: z
      .string()
      .trim()
      .min(6, "Please include a reachable phone number")
      .max(32, "That number looks too long")
      .regex(/^[+()\d\s.-]+$/, "Digits, spaces, and + ( ) - only"),

    country: z.string().trim().min(2, "Which country are you based in?"),

    city: z.string().trim().min(1, "Which city?"),

    companyName: z.string().trim().max(120).optional().or(z.literal("")),

    role: z.string().trim().max(120).optional().or(z.literal("")),

    companySize: z.enum(COMPANY_SIZES).optional(),

    industry: z.enum(INDUSTRIES).optional(),

    services: z
      .array(z.enum(SERVICE_OPTIONS))
      .min(1, "Pick at least one — 'Not sure yet' is a valid answer"),

    systems: z.string().trim().max(300).optional().or(z.literal("")),

    timeline: z.enum(TIMELINES, { message: "When would you want this live?" }),

    budget: z.enum(BUDGETS, { message: "Pick a range so we can scope realistically" }),

    message: z
      .string()
      .trim()
      .min(20, "A sentence or two about the process helps us prepare")
      .max(2000, "Please keep it under 2000 characters"),

    contactPreference: z.enum(CONTACT_PREFERENCES),

    consent: z.literal(true, {
      message: "We need your permission to reply",
    }),

    /**
     * Honeypot — real people never see or fill this. Deliberately permissive:
     * if the schema rejected a filled value, the bot would get a 400 naming the
     * field and learn exactly what caught it. The API route accepts these
     * silently with a 200 instead and simply drops them.
     */
    website: z.string().max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.clientType !== "company") return;

    if (!val.companyName || val.companyName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Company name is required",
      });
    }
    if (!val.companySize) {
      ctx.addIssue({
        code: "custom",
        path: ["companySize"],
        message: "Company size affects the price — please pick one",
      });
    }
    if (!val.industry) {
      ctx.addIssue({
        code: "custom",
        path: ["industry"],
        message: "Please choose the closest industry",
      });
    }
  });

export type ContactInput = z.infer<typeof contactSchema>;

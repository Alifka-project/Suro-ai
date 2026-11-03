import { z } from "zod";
import {
  SERVICE_OPTIONS,
  COMPANY_SIZES,
  INDUSTRIES,
  TIMELINES,
  BUDGETS,
  CONTACT_PREFERENCES,
} from "./contact-options";

/**
 * Shared by the client form and the API route, so validation can never drift
 * between the two. The option lists live in contact-options.ts, which has no
 * zod in it: the form renders its options from there and loads this module
 * (and zod with it) only when it's about to validate. They're re-exported
 * here, so the route and the schema read from one place.
 */
export {
  SERVICE_OPTIONS,
  NOT_SURE_OPTION,
  COMPANY_SIZES,
  INDUSTRIES,
  TIMELINES,
  BUDGETS,
  CONTACT_PREFERENCES,
} from "./contact-options";

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

    email: z.email("Please enter a valid email address").max(254, "That email address is too long"),

    phone: z
      .string()
      .trim()
      .min(6, "Please include a reachable phone number")
      .max(32, "That number looks too long")
      .regex(/^[+()\d\s.-]+$/, "Digits, spaces, and + ( ) - only"),

    country: z
      .string()
      .trim()
      .min(2, "Which country are you based in?")
      .max(80, "That country name is too long"),

    city: z.string().trim().min(1, "Which city?").max(80, "That city name is too long"),

    companyName: z.string().trim().max(120).optional().or(z.literal("")),

    role: z.string().trim().max(120).optional().or(z.literal("")),

    companySize: z
      .enum(COMPANY_SIZES, { message: "Company size affects the price — please pick one" })
      .optional(),

    industry: z.enum(INDUSTRIES, { message: "Please choose the closest industry" }).optional(),

    services: z
      .array(z.enum(SERVICE_OPTIONS))
      .min(1, "Pick at least one — 'Not sure yet' is a valid answer")
      .max(SERVICE_OPTIONS.length, "Pick each option at most once")
      .refine((list) => new Set(list).size === list.length, "Pick each option at most once"),

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

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  Loader2,
  Send,
  User,
  PartyPopper,
} from "lucide-react";
import {
  contactSchema,
  SERVICE_OPTIONS,
  COMPANY_SIZES,
  INDUSTRIES,
  TIMELINES,
  BUDGETS,
  CONTACT_PREFERENCES,
  type ContactInput,
} from "@/lib/contact-schema";
import { easeOutExpo } from "@/lib/motion";

const COUNTRIES = [
  "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Cambodia",
  "Canada", "Chile", "China", "Colombia", "Czechia", "Denmark", "Egypt",
  "Finland", "France", "Germany", "Hong Kong SAR", "Hungary", "India",
  "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kenya",
  "Malaysia", "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria",
  "Norway", "Pakistan", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Saudi Arabia", "Singapore", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Thailand",
  "Türkiye", "United Arab Emirates", "United Kingdom", "United States",
  "Vietnam",
];

const STEPS = [
  { id: 0, label: "About you", hint: "Who we'd be talking to" },
  { id: 1, label: "Your setup", hint: "What shapes the price" },
  { id: 2, label: "The project", hint: "What you need built" },
] as const;

type StepFields = readonly (keyof ContactInput)[];

const STEP_FIELDS: Record<number, StepFields> = {
  0: ["clientType", "fullName", "email", "phone", "country", "city", "contactPreference"],
  1: ["companyName", "role", "companySize", "industry"],
  2: ["services", "timeline", "budget", "message", "consent"],
};

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.22 }}
          className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] text-blush-600"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function ContactForm() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: {
      clientType: "company",
      services: [],
      contactPreference: "Email",
      website: "",
    },
  });

  const clientType = watch("clientType");
  const selectedServices = watch("services") ?? [];
  const contactPreference = watch("contactPreference");
  const isCompany = clientType === "company";

  /**
   * The company-only requirements live in the schema's superRefine, which zod
   * only reaches once the base object parses. On step 2 the step-3 fields are
   * still empty, so the base parse fails, superRefine never runs, and
   * `trigger` would wave the user through with an empty company name. Checked
   * explicitly here instead.
   */
  function validateCompanyStep(): boolean {
    if (getValues("clientType") !== "company") return true;

    const checks: [keyof ContactInput, boolean, string][] = [
      [
        "companyName",
        (getValues("companyName") ?? "").trim().length >= 2,
        "Company name is required",
      ],
      ["companySize", !!getValues("companySize"), "Company size affects the price — please pick one"],
      ["industry", !!getValues("industry"), "Please choose the closest industry"],
    ];

    let ok = true;
    for (const [field, passed, message] of checks) {
      if (!passed) {
        setError(field, { type: "manual", message }, { shouldFocus: ok });
        ok = false;
      }
    }
    return ok;
  }

  async function next() {
    const valid = await trigger(STEP_FIELDS[step] as (keyof ContactInput)[], {
      shouldFocus: true,
    });
    if (!valid) return;
    if (step === 1 && !validateCompanyStep()) return;

    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  /** Never let a submit fail silently on a step the user can't see. */
  function onInvalid(formErrors: Record<string, unknown>) {
    for (const [index, fields] of Object.entries(STEP_FIELDS)) {
      if (fields.some((f) => f in formErrors)) {
        const target = Number(index);
        if (target !== step) {
          setDirection(target > step ? 1 : -1);
          setStep(target);
        }
        return;
      }
    }
  }

  function back() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(values: ContactInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setServerError(
          json.error ?? "We couldn't send that. Please try again in a moment."
        );
        return;
      }
      setSent(true);
    } catch {
      setServerError(
        "Network error — check your connection and try again, or email us directly."
      );
    }
  }

  /* ── Success ──────────────────────────────────────────────────────── */
  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: easeOutExpo }}
        className="relative overflow-hidden rounded-[1.75rem] glass-strong p-7 text-center sm:p-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-mint-400 opacity-40 blur-[80px] animate-float"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-lilac-400 opacity-40 blur-[80px] animate-float-slow"
        />

        <motion.span
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 16 }}
          className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-abyss-600 via-azure-500 to-aqua-500 text-white shadow-[0_16px_36px_-16px_rgb(32_103_165_/_0.9)]"
        >
          <PartyPopper className="h-7 w-7" aria-hidden="true" />
        </motion.span>

        <h3 className="relative mt-6 text-[1.5rem] font-bold sm:text-[1.9rem]">
          That&apos;s with us.
        </h3>
        <p className="relative mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink-600">
          You&apos;ll hear back within one business day — from a person who has
          read what you wrote, with a first view on scope and price. If it&apos;s
          urgent, reply to that email and say so.
        </p>

        <div className="relative mx-auto mt-7 grid max-w-lg gap-2.5 text-left sm:grid-cols-3">
          {[
            { n: "01", t: "We read it properly", d: "Not an auto-reply" },
            { n: "02", t: "First scope view", d: "Within one business day" },
            { n: "03", t: "45-min session", d: "Only if it's a fit" },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
              className="rounded-2xl border border-ink-100 bg-white/70 p-3.5"
            >
              <p className="font-mono text-[0.65rem] text-ink-400">{s.n}</p>
              <p className="mt-1 text-[0.85rem] font-semibold text-ink-900">
                {s.t}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-ink-500">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  /* ── Form ─────────────────────────────────────────────────────────── */
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] glass-strong sm:rounded-[2rem]">
      {/* Progress */}
      <div className="border-b border-ink-100 p-5 sm:p-7">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-ink-400">
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 className="mt-1 truncate text-[1.15rem] font-bold sm:text-[1.35rem]">
              {STEPS[step].label}
            </h3>
          </div>
          <p className="hidden shrink-0 text-right text-[0.78rem] text-ink-500 sm:block">
            {STEPS[step].hint}
          </p>
        </div>

        <div className="mt-4 flex gap-1.5">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"
            >
              <motion.div
                initial={false}
                animate={{ scaleX: s.id <= step ? 1 : 0 }}
                transition={{ duration: 0.55, ease: easeOutExpo }}
                className="h-full origin-left rounded-full bg-linear-to-r from-abyss-600 via-azure-500 to-aqua-500"
              />
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="p-5 sm:p-7"
      >
        {/* Honeypot */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-0">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register("website")}
          />
        </div>

        <div className="relative">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {/* ── Step 1 ──────────────────────────────────────────── */}
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                initial={{ opacity: 0, x: direction * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -28 }}
                transition={{ duration: 0.4, ease: easeOutExpo }}
                className="space-y-5"
              >
                <fieldset>
                  <legend className="label">
                    Are you enquiring as a company or an individual?
                  </legend>
                  <div className="mt-1 grid grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          value: "company",
                          label: "Company",
                          hint: "Team, department or business",
                          icon: Building2,
                        },
                        {
                          value: "individual",
                          label: "Individual",
                          hint: "Freelance or personal project",
                          icon: User,
                        },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const active = clientType === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`relative cursor-pointer overflow-hidden rounded-2xl border p-3.5 transition-all duration-300 ${
                            active
                              ? "border-azure-400 bg-white shadow-[0_10px_26px_-16px_rgb(32_103_165_/_0.8)]"
                              : "border-ink-200/80 bg-white/60 hover:border-ink-300"
                          }`}
                        >
                          <input
                            type="radio"
                            value={opt.value}
                            className="sr-only"
                            {...register("clientType")}
                          />
                          {active && (
                            <motion.span
                              layoutId="client-type-glow"
                              className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-azure-400/12 to-lilac-400/12"
                              transition={{ duration: 0.4, ease: easeOutExpo }}
                            />
                          )}
                          <span className="flex items-center gap-2">
                            <Icon
                              className={`h-4 w-4 ${active ? "text-azure-500" : "text-ink-400"}`}
                              aria-hidden="true"
                            />
                            <span
                              className={`text-[0.9rem] font-semibold ${active ? "text-ink-900" : "text-ink-700"}`}
                            >
                              {opt.label}
                            </span>
                          </span>
                          <span className="mt-1 block text-[0.72rem] leading-snug text-ink-500">
                            {opt.hint}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FieldError message={errors.clientType?.message} />
                </fieldset>

                <div>
                  <label htmlFor="fullName" className="label">
                    Full name <span className="text-blush-600">*</span>
                  </label>
                  <input
                    id="fullName"
                    className="field"
                    autoComplete="name"
                    placeholder="Alifka Roosseo"
                    aria-invalid={!!errors.fullName}
                    {...register("fullName")}
                  />
                  <FieldError message={errors.fullName?.message} />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="email" className="label">
                      Email <span className="text-blush-600">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      className="field"
                      autoComplete="email"
                      placeholder="you@company.com"
                      aria-invalid={!!errors.email}
                      {...register("email")}
                    />
                    <FieldError message={errors.email?.message} />
                  </div>

                  <div>
                    <label htmlFor="phone" className="label">
                      Phone / WhatsApp <span className="text-blush-600">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      className="field"
                      autoComplete="tel"
                      placeholder="+62 812 3456 7890"
                      aria-invalid={!!errors.phone}
                      {...register("phone")}
                    />
                    <FieldError message={errors.phone?.message} />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="country" className="label">
                      Country of residence <span className="text-blush-600">*</span>
                    </label>
                    <input
                      id="country"
                      className="field"
                      list="country-list"
                      autoComplete="country-name"
                      placeholder="Start typing…"
                      aria-invalid={!!errors.country}
                      {...register("country")}
                    />
                    <datalist id="country-list">
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                    <FieldError message={errors.country?.message} />
                  </div>

                  <div>
                    <label htmlFor="city" className="label">
                      City <span className="text-blush-600">*</span>
                    </label>
                    <input
                      id="city"
                      className="field"
                      autoComplete="address-level2"
                      placeholder="Jakarta"
                      aria-invalid={!!errors.city}
                      {...register("city")}
                    />
                    <FieldError message={errors.city?.message} />
                  </div>
                </div>

                <fieldset>
                  <legend className="label">How should we reach you?</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {CONTACT_PREFERENCES.map((pref) => {
                      const active = contactPreference === pref;
                      return (
                        <label
                          key={pref}
                          className={`cursor-pointer rounded-full border px-3.5 py-2 text-[0.82rem] transition-all duration-300 ${
                            active
                              ? "border-transparent bg-linear-to-r from-abyss-600 to-azure-500 text-white shadow-[0_8px_20px_-10px_rgb(32_103_165_/_0.85)]"
                              : "border-ink-200/80 bg-white/60 text-ink-600 hover:border-aqua-400 hover:text-ink-900"
                          }`}
                        >
                          <input
                            type="radio"
                            value={pref}
                            className="sr-only"
                            {...register("contactPreference")}
                          />
                          {pref}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </motion.div>
            )}

            {/* ── Step 2 ──────────────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                initial={{ opacity: 0, x: direction * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -28 }}
                transition={{ duration: 0.4, ease: easeOutExpo }}
                className="space-y-5"
              >
                <p className="rounded-2xl border border-ink-100 bg-white/60 p-3.5 text-[0.82rem] leading-relaxed text-ink-600">
                  {isCompany
                    ? "Company size and industry genuinely change the price — governance reviews, user counts, and integration complexity all scale with them."
                    : "Nothing here is required for individuals. Anything you add helps us scope more accurately."}
                </p>

                {isCompany && (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="companyName" className="label">
                          Company name <span className="text-blush-600">*</span>
                        </label>
                        <input
                          id="companyName"
                          className="field"
                          autoComplete="organization"
                          placeholder="Acme Logistics"
                          aria-invalid={!!errors.companyName}
                          {...register("companyName")}
                        />
                        <FieldError message={errors.companyName?.message} />
                      </div>

                      <div>
                        <label htmlFor="role" className="label">
                          Your role
                        </label>
                        <input
                          id="role"
                          className="field"
                          autoComplete="organization-title"
                          placeholder="Head of Supply Chain"
                          {...register("role")}
                        />
                        <FieldError message={errors.role?.message} />
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="companySize" className="label">
                          Company size <span className="text-blush-600">*</span>
                        </label>
                        <select
                          id="companySize"
                          className="field"
                          defaultValue=""
                          aria-invalid={!!errors.companySize}
                          {...register("companySize")}
                        >
                          <option value="" disabled>
                            Select a range
                          </option>
                          {COMPANY_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <FieldError message={errors.companySize?.message} />
                      </div>

                      <div>
                        <label htmlFor="industry" className="label">
                          Industry <span className="text-blush-600">*</span>
                        </label>
                        <select
                          id="industry"
                          className="field"
                          defaultValue=""
                          aria-invalid={!!errors.industry}
                          {...register("industry")}
                        >
                          <option value="" disabled>
                            Select the closest
                          </option>
                          {INDUSTRIES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <FieldError message={errors.industry?.message} />
                      </div>
                    </div>
                  </>
                )}

                {!isCompany && (
                  <div>
                    <label htmlFor="role-individual" className="label">
                      What do you do?
                    </label>
                    <input
                      id="role-individual"
                      className="field"
                      placeholder="Independent logistics consultant"
                      {...register("role")}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="systems" className="label">
                    Systems you run on
                  </label>
                  <input
                    id="systems"
                    className="field"
                    placeholder="SAP, Excel, Outlook, a 3PL portal…"
                    {...register("systems")}
                  />
                  <p className="mt-1.5 text-[0.75rem] text-ink-400">
                    Whether your systems have usable APIs is the single biggest
                    driver of build time.
                  </p>
                  <FieldError message={errors.systems?.message} />
                </div>
              </motion.div>
            )}

            {/* ── Step 3 ──────────────────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                initial={{ opacity: 0, x: direction * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -28 }}
                transition={{ duration: 0.4, ease: easeOutExpo }}
                className="space-y-5"
              >
                <fieldset>
                  <legend className="label">
                    What are you interested in?{" "}
                    <span className="text-blush-600">*</span>
                    <span className="ml-1 font-normal text-ink-400">
                      (pick any)
                    </span>
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {SERVICE_OPTIONS.map((s) => {
                      const active = selectedServices.includes(s);
                      return (
                        <label
                          key={s}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-[0.8rem] transition-all duration-300 ${
                            active
                              ? "border-transparent bg-linear-to-r from-azure-500 to-aqua-500 text-white shadow-[0_8px_20px_-10px_rgb(32_103_165_/_0.85)]"
                              : "border-ink-200/80 bg-white/60 text-ink-600 hover:border-aqua-400 hover:text-ink-900"
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={s}
                            className="sr-only"
                            {...register("services")}
                          />
                          {active && (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {s}
                        </label>
                      );
                    })}
                  </div>
                  <FieldError message={errors.services?.message} />
                </fieldset>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="timeline" className="label">
                      Timeline <span className="text-blush-600">*</span>
                    </label>
                    <select
                      id="timeline"
                      className="field"
                      defaultValue=""
                      aria-invalid={!!errors.timeline}
                      {...register("timeline")}
                    >
                      <option value="" disabled>
                        When do you need this?
                      </option>
                      {TIMELINES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.timeline?.message} />
                  </div>

                  <div>
                    <label htmlFor="budget" className="label">
                      Budget range <span className="text-blush-600">*</span>
                    </label>
                    <select
                      id="budget"
                      className="field"
                      defaultValue=""
                      aria-invalid={!!errors.budget}
                      {...register("budget")}
                    >
                      <option value="" disabled>
                        Select a range
                      </option>
                      {BUDGETS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.budget?.message} />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="label">
                    What&apos;s the process that&apos;s costing you?{" "}
                    <span className="text-blush-600">*</span>
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    className="field resize-none"
                    placeholder="Walk us through it — who does what, how often, in which system, and where it goes wrong. The more specific, the better our first answer."
                    aria-invalid={!!errors.message}
                    {...register("message")}
                  />
                  <FieldError message={errors.message?.message} />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink-100 bg-white/60 p-3.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-azure-500"
                    {...register("consent")}
                  />
                  <span className="text-[0.8rem] leading-relaxed text-ink-600">
                    I agree to Suro AI contacting me about this enquiry. My
                    details won&apos;t be sold or added to a marketing list.
                    <FieldError message={errors.consent?.message} />
                  </span>
                </label>

                <AnimatePresence>
                  {serverError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      role="alert"
                      className="flex items-start gap-2 rounded-2xl border border-blush-300 bg-blush-200/40 p-3.5 text-[0.82rem] text-ink-800"
                    >
                      <CircleAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-blush-600"
                        aria-hidden="true"
                      />
                      {serverError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn-ghost">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          ) : (
            <p className="hidden text-[0.75rem] text-ink-400 sm:block">
              Takes about 90 seconds
            </p>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="btn-primary w-full sm:w-auto"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send my enquiry
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

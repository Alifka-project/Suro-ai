"use client";

import { useEffect, useRef, useState } from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  Loader2,
  MailCheck,
  Send,
  User,
  Video,
} from "lucide-react";
import {
  contactSchema,
  SERVICE_OPTIONS,
  NOT_SURE_OPTION,
  COMPANY_SIZES,
  INDUSTRIES,
  TIMELINES,
  BUDGETS,
  CONTACT_PREFERENCES,
  type ContactInput,
} from "@/lib/contact-schema";
import { PACKAGE_GROUPS, PACKAGES } from "@/lib/packages";
import {
  CONTACT_HREF,
  CONTACT_INTENT_EVENT,
  type ContactIntent,
} from "@/lib/contact-intent";
import { CONTACT } from "@/lib/site";
import { easeOutExpo } from "@/lib/motion";

const COUNTRIES = [
  "Australia", "Austria", "Bahrain", "Bangladesh", "Belgium", "Brazil",
  "Cambodia", "Canada", "Chile", "China", "Colombia", "Czechia", "Denmark",
  "Egypt", "Finland", "France", "Germany", "Hong Kong SAR", "Hungary",
  "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Jordan",
  "Kenya", "Kuwait", "Lebanon", "Malaysia", "Mexico", "Morocco",
  "Netherlands", "New Zealand", "Nigeria", "Norway", "Oman", "Pakistan",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
  "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Thailand", "Türkiye",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam",
];

const STEPS = [
  { id: 0, label: "About you" },
  { id: 1, label: "Your setup" },
  { id: 2, label: "The project" },
] as const;

type FieldName = keyof ContactInput;

const STEP_FIELDS: Record<number, readonly FieldName[]> = {
  0: ["clientType", "fullName", "email", "phone", "country", "city", "contactPreference"],
  1: ["companyName", "role", "companySize", "industry", "systems"],
  2: ["services", "timeline", "budget", "message", "consent"],
};

const CALL_PREFERENCES: readonly string[] = ["Video call", "Phone call"];
const SERVICE_VALUES: readonly string[] = SERVICE_OPTIONS;

/** Focus ring for cards and pills whose real input is visually hidden. */
const HIDDEN_INPUT_FOCUS =
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-azure-500 has-[:focus-visible]:ring-offset-2";

const errorId = (name: FieldName) => `${name}-error`;

function Required() {
  return (
    <span aria-hidden="true" className="text-rose-700">
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, height: "auto" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
          transition={{ duration: reduced ? 0 : 0.22 }}
          className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] text-rose-700"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** One package (or "Not sure yet") in the services step. */
function ServiceChoice({
  value,
  number,
  name,
  hint,
  checked,
  field,
}: {
  value: string;
  number?: number;
  name: string;
  hint?: string;
  checked: boolean;
  field: UseFormRegisterReturn<"services">;
}) {
  return (
    <label
      className={`relative flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-[border-color,background-color,box-shadow] duration-300 ${HIDDEN_INPUT_FOCUS} ${
        checked
          ? "border-azure-400 bg-white shadow-[0_10px_26px_-16px_rgb(32_103_165_/_0.8)]"
          : "border-ink-200/80 bg-white/60 hover:border-ink-300"
      }`}
    >
      <input type="checkbox" value={value} className="sr-only" {...field} />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-300 ${
          checked
            ? "border-transparent bg-linear-to-br from-abyss-600 to-azure-500 text-white"
            : "border-ink-300 bg-white"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.86rem] font-semibold leading-snug text-ink-900">
          {number !== undefined && (
            <span className="mr-1.5 font-mono text-[0.72rem] font-medium text-abyss-600">
              <span className="sr-only">Package </span>
              {number}
              <span className="sr-only">:</span>
            </span>
          )}
          {name}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-600">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export function ContactForm() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  /**
   * False until the visitor first changes step. The first panel is
   * server-rendered (Footer → ContactForm), so it must be visible in that HTML
   * rather than starting at opacity 0 and waiting for hydration to fade in.
   */
  const [stepped, setStepped] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  /** Set by a "Book a call" button elsewhere on the page. */
  const [callRequested, setCallRequested] = useState(false);
  /** Packages ticked by a "Talk to us about …" button elsewhere on the page. */
  const [askedAbout, setAskedAbout] = useState<string[]>([]);

  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** What to focus once the next step has rendered. */
  const focusAfterStep = useRef<FieldName | "first" | null>(null);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setError,
    clearErrors,
    setFocus,
    setValue,
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

  const clientType = useWatch({ control, name: "clientType" });
  const selectedServices = useWatch({ control, name: "services" }) ?? [];
  const contactPreference = useWatch({ control, name: "contactPreference" });
  const isCompany = clientType === "company";

  // Notes for intents that still hold — they disappear if the visitor changes
  // their mind in the form itself.
  const showCallNote = callRequested && CALL_PREFERENCES.includes(contactPreference);
  const askedAboutTicked = askedAbout.filter((label) => selectedServices.includes(label));

  /**
   * "Book a call" and "Talk to us about <package>" buttons elsewhere on the
   * page are plain links to #contact that also dispatch CONTACT_INTENT_EVENT.
   * Pre-fill the form from it, then — once the link's own jump has happened —
   * bring the form into view and move focus to its heading.
   */
  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | undefined;

    function onIntent(event: Event) {
      const intent = (event as CustomEvent<ContactIntent>).detail;
      if (!intent) return;

      if (intent.kind === "call") {
        setValue("contactPreference", "Video call", { shouldDirty: true });
        setCallRequested(true);
      }

      const label = intent.packageLabel;
      if (label && SERVICE_VALUES.includes(label)) {
        const current = getValues("services") ?? [];
        if (!current.includes(label)) {
          setValue("services", [...current, label], { shouldDirty: true });
        }
        clearErrors("services");
        setAskedAbout((prev) => (prev.includes(label) ? prev : [...prev, label]));
      }

      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        // A modified click opened the link in a new tab: leave this page be.
        if (window.location.hash !== CONTACT_HREF) return;
        cardRef.current?.scrollIntoView({ block: "start" });
        headingRef.current?.focus({ preventScroll: true });
      }, 0);
    }

    window.addEventListener(CONTACT_INTENT_EVENT, onIntent);
    return () => {
      window.removeEventListener(CONTACT_INTENT_EVENT, onIntent);
      clearTimeout(focusTimer);
    };
  }, [getValues, setValue, clearErrors]);

  /** After a step change: focus the field that needs attention, or the step's first field. */
  useEffect(() => {
    const target = focusAfterStep.current;
    if (!target) return;
    focusAfterStep.current = null;

    if (target !== "first") {
      setFocus(target);
      return;
    }
    const card = cardRef.current;
    if (card && card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ block: "start" });
    }
    panelRef.current
      // Radio groups are skipped: on step 1 the name field is the useful start.
      ?.querySelector<HTMLElement>(
        "input:not([tabindex='-1']):not([type='radio']), select, textarea"
      )
      ?.focus({ preventScroll: true });
  }, [step, setFocus]);

  // Announce the result to everyone, including screen-reader users.
  useEffect(() => {
    if (sent) headingRef.current?.focus();
  }, [sent]);

  /**
   * The company-only requirements live in the schema's superRefine, which zod
   * only reaches once the base object parses. On step 2 the step-3 fields are
   * still empty, so the base parse fails, superRefine never runs, and
   * `trigger` would wave the user through with an empty company name. Checked
   * explicitly here instead.
   */
  function validateCompanyStep(): boolean {
    if (getValues("clientType") !== "company") return true;

    const checks: [FieldName, boolean, string][] = [
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

  function goTo(target: number, focus: FieldName | "first") {
    focusAfterStep.current = focus;
    setDirection(target > step ? 1 : -1);
    setStepped(true);
    setStep(target);
  }

  async function next() {
    if (step === 1 && getValues("clientType") !== "company") {
      // Company fields touched before switching to "individual" are hidden
      // now, but an empty select still holds "" and would fail validation
      // where nobody can see it.
      setValue("companyName", "");
      setValue("companySize", undefined);
      setValue("industry", undefined);
    }
    const valid = await trigger([...STEP_FIELDS[step]], { shouldFocus: true });
    // Run the company checks even when the resolver already failed, so every
    // problem on the step shows at once and with a readable message.
    const companyOk = step === 1 ? validateCompanyStep() : true;
    if (!valid || !companyOk) return;
    goTo(Math.min(step + 1, STEPS.length - 1), "first");
  }

  function back() {
    goTo(Math.max(step - 1, 0), "first");
  }

  /** Never let a submit fail silently on a step the user can't see. */
  function onInvalid(formErrors: FieldErrors<ContactInput>) {
    for (const [index, fields] of Object.entries(STEP_FIELDS)) {
      const firstError = fields.find((f) => f in formErrors);
      if (!firstError) continue;
      const target = Number(index);
      // On the current step react-hook-form focuses the field itself.
      if (target !== step) goTo(target, firstError);
      return;
    }
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
        `Network error. Check your connection and try again, or email us at ${CONTACT.email}.`
      );
    }
  }

  /** aria-describedby for a field, pointing at its error while it has one. */
  const describedBy = (name: FieldName) => (errors[name] ? errorId(name) : undefined);

  /**
   * Step panels animate in only after a step change. `initial: false` on the
   * first mount renders the panel in its final state on the server, which
   * also keeps `reduced` (unknown on the server) out of the SSR markup, so
   * reduced-motion visitors get no hydration mismatch. Later panels mount
   * client-side only, where `reduced` is known.
   */
  const panelMotion = {
    initial: stepped ? { opacity: 0, x: reduced ? 0 : direction * 28 } : false,
    animate: { opacity: 1, x: 0 },
    transition: { duration: reduced ? 0 : 0.4, ease: easeOutExpo },
  } as const;

  /* ── Success ──────────────────────────────────────────────────────── */
  if (sent) {
    const wantsCall = CALL_PREFERENCES.includes(getValues("contactPreference"));
    return (
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.6, ease: easeOutExpo }}
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

        <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-abyss-600 via-azure-500 to-aqua-500 text-white shadow-[0_16px_36px_-16px_rgb(32_103_165_/_0.9)]">
          <MailCheck className="h-7 w-7" aria-hidden="true" />
        </span>

        <h3
          ref={headingRef}
          tabIndex={-1}
          className="relative mt-6 text-[1.5rem] font-bold focus:outline-none sm:text-[1.9rem]"
        >
          Thanks, we&apos;ve got it.
        </h3>
        <p className="relative mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink-600">
          We&apos;ll read it and get back to you
          {wantsCall && " with a few times for the call"}. If it&apos;s
          urgent, email{" "}
          <a
            href={`mailto:${CONTACT.email}`}
            className="font-semibold text-abyss-600 underline decoration-abyss-600/30 underline-offset-4 hover:decoration-abyss-600"
          >
            {CONTACT.email}
          </a>
          .
        </p>

        <ol className="relative mx-auto mt-7 grid max-w-lg gap-2.5 text-left sm:grid-cols-3">
          {[
            { t: "We read it", d: "Your message goes straight to the team" },
            { t: "We reply", d: "With questions or a first view on scope" },
            { t: "A call", d: "If it's a good fit" },
          ].map((s, i) => (
            <motion.li
              key={s.t}
              initial={{ opacity: 0, y: reduced ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.35 + i * 0.1, duration: reduced ? 0 : 0.5 }}
              className="rounded-2xl border border-ink-100 bg-white/70 p-3.5"
            >
              <p aria-hidden="true" className="font-mono text-[0.65rem] text-ink-550">
                {`0${i + 1}`}
              </p>
              <p className="mt-1 text-[0.85rem] font-semibold text-ink-900">{s.t}</p>
              <p className="mt-0.5 text-[0.75rem] text-ink-600">{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    );
  }

  /* ── Form ─────────────────────────────────────────────────────────── */
  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-[1.75rem] glass-strong sm:rounded-[2rem]"
    >
      {/* Heading, intent notes and progress */}
      <div className="border-b border-ink-100 p-5 sm:p-7">
        <div className="flex items-baseline justify-between gap-4">
          <h3
            ref={headingRef}
            id="contact-form-title"
            tabIndex={-1}
            className="text-[1.25rem] font-bold focus:outline-none sm:text-[1.45rem]"
          >
            Talk to us
          </h3>
          <p className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-ink-550">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {(showCallNote || askedAboutTicked.length > 0) && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {showCallNote && (
              <li className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-azure-500/10 px-2.5 py-1 text-[0.76rem] text-abyss-700">
                <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-semibold">Booking a call.</span> We&apos;ll
                  reply with times that suit you.
                </span>
              </li>
            )}
            {askedAboutTicked.map((label) => (
              <li
                key={label}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-azure-500/10 px-2.5 py-1 text-[0.76rem] text-abyss-700"
              >
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="sr-only">Selected: </span>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        )}

        <ol aria-label="Form progress" className="mt-4 grid grid-cols-3 gap-1.5">
          {STEPS.map((s) => {
            const current = s.id === step;
            return (
              <li key={s.id} aria-current={current ? "step" : undefined} className="min-w-0">
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <motion.div
                    initial={false}
                    animate={{ scaleX: s.id <= step ? 1 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.55, ease: easeOutExpo }}
                    className="h-full origin-left rounded-full bg-linear-to-r from-abyss-600 via-azure-500 to-aqua-500"
                  />
                </div>
                <p
                  className={`mt-2 truncate text-[0.72rem] ${
                    current ? "font-semibold text-ink-900" : "text-ink-550"
                  }`}
                >
                  {s.label}
                  {s.id < step && <span className="sr-only"> (done)</span>}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <form
        // Wrapped so handleSubmit runs on submit, not during render.
        onSubmit={(e) => handleSubmit(onSubmit, onInvalid)(e)}
        noValidate
        aria-labelledby="contact-form-title"
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

        {/* No AnimatePresence around the step panels. With mode="wait" the
            next step only mounts once the previous one finishes exiting, so a
            paused rAF (backgrounded tab, a dropped frame) could leave the
            header on the new step with the old step's fields still rendered —
            and the form stuck there. Keying on `step` swaps immediately and
            lets the incoming panel animate itself in. */}
        <div ref={panelRef} className="relative">
          {/* ── Step 1 ──────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step-0" {...panelMotion} className="space-y-5">
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
                        className={`relative min-w-0 cursor-pointer overflow-hidden rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-300 ${HIDDEN_INPUT_FOCUS} ${
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
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-azure-400/12 to-lilac-400/12"
                            transition={{ duration: reduced ? 0 : 0.4, ease: easeOutExpo }}
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
                          {active && (
                            <Check className="ml-auto h-3.5 w-3.5 text-azure-500" aria-hidden="true" />
                          )}
                        </span>
                        <span className="mt-1 block text-[0.72rem] leading-snug text-ink-600">
                          {opt.hint}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FieldError id={errorId("clientType")} message={errors.clientType?.message} />
              </fieldset>

              <div>
                <label htmlFor="fullName" className="label">
                  Full name <Required />
                </label>
                <input
                  id="fullName"
                  className="field"
                  autoComplete="name"
                  maxLength={100}
                  aria-required="true"
                  aria-invalid={!!errors.fullName}
                  aria-describedby={describedBy("fullName")}
                  {...register("fullName")}
                />
                <FieldError id={errorId("fullName")} message={errors.fullName?.message} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="email" className="label">
                    Email <Required />
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    className="field"
                    autoComplete="email"
                    placeholder="you@company.com"
                    aria-required="true"
                    aria-invalid={!!errors.email}
                    aria-describedby={describedBy("email")}
                    {...register("email")}
                  />
                  <FieldError id={errorId("email")} message={errors.email?.message} />
                </div>

                <div className="min-w-0">
                  <label htmlFor="phone" className="label">
                    Phone / WhatsApp <Required />
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    className="field"
                    autoComplete="tel"
                    placeholder="+971 50 123 4567"
                    aria-required="true"
                    aria-invalid={!!errors.phone}
                    aria-describedby={describedBy("phone")}
                    {...register("phone")}
                  />
                  <FieldError id={errorId("phone")} message={errors.phone?.message} />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="country" className="label">
                    Country <Required />
                  </label>
                  <input
                    id="country"
                    className="field"
                    list="country-list"
                    autoComplete="country-name"
                    placeholder="Start typing…"
                    aria-required="true"
                    aria-invalid={!!errors.country}
                    aria-describedby={describedBy("country")}
                    {...register("country")}
                  />
                  <datalist id="country-list">
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <FieldError id={errorId("country")} message={errors.country?.message} />
                </div>

                <div className="min-w-0">
                  <label htmlFor="city" className="label">
                    City <Required />
                  </label>
                  <input
                    id="city"
                    className="field"
                    autoComplete="address-level2"
                    placeholder="Dubai"
                    aria-required="true"
                    aria-invalid={!!errors.city}
                    aria-describedby={describedBy("city")}
                    {...register("city")}
                  />
                  <FieldError id={errorId("city")} message={errors.city?.message} />
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
                        className={`relative flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.82rem] transition-[border-color,background-color,color,box-shadow] duration-300 ${HIDDEN_INPUT_FOCUS} ${
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
                        {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
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
            <motion.div key="step-1" {...panelMotion} className="space-y-5">
              <p className="rounded-2xl border border-ink-100 bg-white/60 p-3.5 text-[0.82rem] leading-relaxed text-ink-600">
                {isCompany
                  ? "Company size and industry affect the price: security reviews, user numbers and integration work all grow with them."
                  : "Nothing here is required for individuals. Anything you add helps us scope more accurately."}
              </p>

              {isCompany && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="companyName" className="label">
                        Company name <Required />
                      </label>
                      <input
                        id="companyName"
                        className="field"
                        autoComplete="organization"
                        maxLength={120}
                        aria-required="true"
                        aria-invalid={!!errors.companyName}
                        aria-describedby={describedBy("companyName")}
                        {...register("companyName")}
                      />
                      <FieldError id={errorId("companyName")} message={errors.companyName?.message} />
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="role" className="label">
                        Your role
                      </label>
                      <input
                        id="role"
                        className="field"
                        autoComplete="organization-title"
                        placeholder="e.g. Finance Manager"
                        maxLength={120}
                        aria-invalid={!!errors.role}
                        aria-describedby={describedBy("role")}
                        {...register("role")}
                      />
                      <FieldError id={errorId("role")} message={errors.role?.message} />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="companySize" className="label">
                        Company size <Required />
                      </label>
                      <select
                        id="companySize"
                        className="field"
                        defaultValue=""
                        aria-required="true"
                        aria-invalid={!!errors.companySize}
                        aria-describedby={describedBy("companySize")}
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
                      <FieldError id={errorId("companySize")} message={errors.companySize?.message} />
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="industry" className="label">
                        Industry <Required />
                      </label>
                      <select
                        id="industry"
                        className="field"
                        defaultValue=""
                        aria-required="true"
                        aria-invalid={!!errors.industry}
                        aria-describedby={describedBy("industry")}
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
                      <FieldError id={errorId("industry")} message={errors.industry?.message} />
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
                    placeholder="e.g. Freelance consultant"
                    maxLength={120}
                    aria-invalid={!!errors.role}
                    aria-describedby={describedBy("role")}
                    {...register("role")}
                  />
                  <FieldError id={errorId("role")} message={errors.role?.message} />
                </div>
              )}

              <div>
                <label htmlFor="systems" className="label">
                  Systems you use
                </label>
                <input
                  id="systems"
                  className="field"
                  placeholder="Excel, Outlook, SAP, Odoo, a supplier portal…"
                  maxLength={300}
                  aria-invalid={!!errors.systems}
                  aria-describedby={errors.systems ? `systems-hint ${errorId("systems")}` : "systems-hint"}
                  {...register("systems")}
                />
                <p id="systems-hint" className="mt-1.5 text-[0.75rem] text-ink-550">
                  Whether your systems have usable APIs affects build time more
                  than anything else.
                </p>
                <FieldError id={errorId("systems")} message={errors.systems?.message} />
              </div>
            </motion.div>
          )}

          {/* ── Step 3 ──────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step-2" {...panelMotion} className="space-y-5">
              <fieldset aria-describedby={describedBy("services")}>
                <legend className="label">
                  What do you need help with? <Required />
                  <span className="ml-1 font-normal text-ink-550">(pick any)</span>
                </legend>
                <div className="mt-2 space-y-4">
                  {PACKAGE_GROUPS.map((group) => {
                    const items = PACKAGES.filter((p) => p.group === group.id);
                    if (items.length === 0) return null;
                    return (
                      <fieldset key={group.id} className="min-w-0">
                        <legend className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-550">
                          {group.title}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {items.map((p) => (
                            <ServiceChoice
                              key={p.id}
                              value={p.formLabel}
                              number={p.number}
                              name={p.name}
                              hint={p.promise}
                              checked={selectedServices.includes(p.formLabel)}
                              field={register("services")}
                            />
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                  <ServiceChoice
                    value={NOT_SURE_OPTION}
                    name={NOT_SURE_OPTION}
                    hint="We'll suggest where to start."
                    checked={selectedServices.includes(NOT_SURE_OPTION)}
                    field={register("services")}
                  />
                </div>
                <FieldError id={errorId("services")} message={errors.services?.message} />
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="timeline" className="label">
                    Timeline <Required />
                  </label>
                  <select
                    id="timeline"
                    className="field"
                    defaultValue=""
                    aria-required="true"
                    aria-invalid={!!errors.timeline}
                    aria-describedby={describedBy("timeline")}
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
                  <FieldError id={errorId("timeline")} message={errors.timeline?.message} />
                </div>

                <div className="min-w-0">
                  <label htmlFor="budget" className="label">
                    Budget range <Required />
                  </label>
                  <select
                    id="budget"
                    className="field"
                    defaultValue=""
                    aria-required="true"
                    aria-invalid={!!errors.budget}
                    aria-describedby={describedBy("budget")}
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
                  <FieldError id={errorId("budget")} message={errors.budget?.message} />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="label">
                  What would you like to fix or build? <Required />
                </label>
                <textarea
                  id="message"
                  rows={5}
                  className="field resize-none"
                  maxLength={2000}
                  placeholder="Who does what, how often, in which system, and where it goes wrong. The more specific, the better our first answer."
                  aria-required="true"
                  aria-invalid={!!errors.message}
                  aria-describedby={describedBy("message")}
                  {...register("message")}
                />
                <FieldError id={errorId("message")} message={errors.message?.message} />
              </div>

              <div>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/60 p-3.5 ${
                    errors.consent ? "border-blush-600" : "border-ink-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-azure-500"
                    aria-required="true"
                    aria-invalid={!!errors.consent}
                    aria-describedby={describedBy("consent")}
                    {...register("consent")}
                  />
                  <span className="text-[0.8rem] leading-relaxed text-ink-600">
                    I agree to SULOAI contacting me about this enquiry. My
                    details won&apos;t be sold or added to a marketing list.
                  </span>
                </label>
                <FieldError id={errorId("consent")} message={errors.consent?.message} />
              </div>

              <AnimatePresence>
                {serverError && (
                  <motion.p
                    initial={{ opacity: 0, y: reduced ? 0 : -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl border border-blush-300 bg-blush-200/40 p-3.5 text-[0.82rem] text-ink-800"
                  >
                    <CircleAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-rose-700"
                      aria-hidden="true"
                    />
                    {serverError}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 && (
            <button type="button" onClick={back} className="btn-ghost">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="btn-primary w-full sm:ml-auto sm:w-auto"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

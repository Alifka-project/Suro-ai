import Image from "next/image";
import { ArrowUp, Mail, MapPin, MessageCircle, type LucideIcon } from "lucide-react";
import { ContactForm } from "@/components/sections/ContactForm";
import { ContactLink } from "@/components/ui/ContactLink";
import { PACKAGES } from "@/lib/packages";
import { BRAND, CONTACT, PROFILE, SECTION_IDS, whatsappHref } from "@/lib/site";

const COMPANY_LINKS = [
  { id: SECTION_IDS.painPoints, label: "Pain points" },
  { id: SECTION_IDS.functions, label: "Functions" },
  { id: SECTION_IDS.process, label: "How it works" },
  { id: SECTION_IDS.about, label: "About" },
  { id: SECTION_IDS.faq, label: "FAQ" },
];

type ContactDetail = {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  note?: string;
};

/**
 * Contact details from CONTACT. WhatsApp only appears once a real number is
 * set there; until then it is left out rather than shown as a placeholder.
 */
function contactDetails(): ContactDetail[] {
  const whatsapp = whatsappHref();
  return [
    { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    ...(whatsapp && CONTACT.whatsapp
      ? [{ icon: MessageCircle, label: "WhatsApp", value: CONTACT.whatsapp, href: whatsapp }]
      : []),
    {
      icon: MapPin,
      label: "Based in",
      value: `${CONTACT.city}, ${CONTACT.country}`,
      note: CONTACT.serviceArea,
    },
  ];
}

/**
 * Server-rendered. The interactive parts are client islands: the contact form
 * and the "Book a call" link.
 */
export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden px-4 pt-14 sm:px-6 sm:pt-18 lg:px-8">
      {/* Aurora bed */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-b from-canvas via-haze to-white" />
        <div className="absolute -left-[10%] top-[6%] h-[46vh] w-[46vh] rounded-full bg-abyss-600 opacity-20 blur-[110px] animate-aurora" />
        <div className="absolute right-[-8%] top-[24%] h-[42vh] w-[42vh] rounded-full bg-blush-500 opacity-25 blur-[100px] animate-aurora-slow" />
        <div className="absolute bottom-[8%] left-[28%] h-[40vh] w-[40vh] rounded-full bg-mint-400 opacity-25 blur-[100px] animate-float-slow" />
        <div className="absolute inset-0 grid-field opacity-40 mask-fade-b" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* ── Contact: pitch + details, then the form ─────────────────── */}
        <section
          id={SECTION_IDS.contact}
          aria-labelledby="contact-heading"
          className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14"
        >
          <div className="min-w-0 lg:pt-4">
            <p className="eyebrow">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-r from-aqua-500 to-blush-500"
              />
              Contact
            </p>

            <h2
              id="contact-heading"
              className="mt-4 text-[clamp(1.85rem,5.2vw,3.1rem)] font-bold leading-[1.1]"
            >
              Tell us what&apos;s <span className="text-gradient">slowing you down</span>
            </h2>

            <p className="mt-5 max-w-md text-[1rem] leading-relaxed text-ink-600">
              Fill in the form and we&apos;ll get back to you. Rather talk it
              through?{" "}
              <ContactLink
                intent={{ kind: "call" }}
                className="font-semibold text-abyss-600 underline decoration-abyss-600/30 underline-offset-4 transition-colors hover:decoration-abyss-600"
              >
                Book a call
              </ContactLink>
              .
            </p>

            <address className="mt-8 not-italic">
              <ul className="space-y-4">
                {contactDetails().map(({ icon: Icon, label, value, href, note }) => {
                  const external = href?.startsWith("http") ?? false;
                  return (
                    <li key={label} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass">
                        <Icon className="h-4 w-4 text-abyss-600" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-550">
                          {label}
                        </p>
                        {href ? (
                          <a
                            href={href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noopener noreferrer" : undefined}
                            className="break-words text-[0.92rem] font-medium text-ink-800 underline-offset-4 transition-colors hover:text-abyss-600 hover:underline"
                          >
                            {value}
                            {external && <span className="sr-only"> (opens in a new tab)</span>}
                          </a>
                        ) : (
                          <p className="text-[0.92rem] font-medium text-ink-800">{value}</p>
                        )}
                        {note && (
                          <p className="mt-0.5 text-[0.85rem] leading-relaxed text-ink-600">
                            {note}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </address>
          </div>

          <div className="min-w-0">
            <ContactForm />
          </div>
        </section>

        {/* ── Bottom bar ───────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-ink-100 pt-10 sm:mt-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:gap-14">
            <div className="min-w-0">
              <a
                href="#top"
                aria-label={`${BRAND.name}, back to top`}
                className="inline-flex items-center gap-2.5"
              >
                <Image
                  src="/brand/suloai-mark.png"
                  alt=""
                  aria-hidden="true"
                  width={34}
                  height={36}
                  className="h-9 w-auto"
                />
                <span className="font-display text-[1.15rem] font-bold tracking-[0.02em] text-ink-900">
                  SULO<span className="text-gradient">AI</span>
                </span>
              </a>
              <p className="mt-4 max-w-sm text-[0.88rem] leading-relaxed text-ink-600">
                {BRAND.descriptor}. {PROFILE.summary}
              </p>
            </div>

            <nav
              aria-label="Footer"
              className="grid min-w-0 gap-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <p
                  id="footer-services"
                  className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-550"
                >
                  Services
                </p>
                <ul aria-labelledby="footer-services" className="mt-3 sm:columns-2 sm:gap-x-8">
                  {PACKAGES.map((p) => (
                    <li key={p.id} className="mb-2.5 break-inside-avoid">
                      <a
                        href={`#service-${p.id}`}
                        className="text-[0.85rem] text-ink-600 transition-colors hover:text-ink-900"
                      >
                        {p.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <p
                  id="footer-company"
                  className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-550"
                >
                  Company
                </p>
                <ul aria-labelledby="footer-company" className="mt-3">
                  {COMPANY_LINKS.map((l) => (
                    <li key={l.id} className="mb-2.5">
                      <a
                        href={`#${l.id}`}
                        className="text-[0.85rem] text-ink-600 transition-colors hover:text-ink-900"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ink-100 py-6 sm:flex-row">
            <p className="text-center font-mono text-[0.7rem] text-ink-550 sm:text-left">
              © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
            </p>
            <a
              href="#top"
              className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-550 transition-colors hover:text-ink-800"
            >
              Back to top
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

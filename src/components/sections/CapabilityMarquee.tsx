"use client";

const CAPABILITIES = [
  "Power Automate",
  "Excel VBA",
  "Power Apps",
  "Claude API",
  "Power BI",
  "Document AI",
  "SAP",
  "Dynamics 365",
  "NetSuite",
  "Odoo",
  "EDI 850 / 856",
  "Power Query",
  "SharePoint",
  "Azure Functions",
  "SQL",
  "WhatsApp Business",
  "RAG pipelines",
  "Python forecasting",
];

/**
 * Infinite capability rail. The track holds two identical halves and slides by
 * exactly -50%, so the loop is seamless at any width.
 */
export function CapabilityMarquee() {
  return (
    <section
      aria-label="Technologies we build with"
      className="relative border-y border-ink-100/80 bg-white/50 py-5 backdrop-blur-sm"
    >
      <div className="mask-fade-x overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-8 pr-8 sm:gap-12 sm:pr-12">
          {[0, 1].map((half) => (
            <div
              key={half}
              className="flex items-center gap-8 sm:gap-12"
              aria-hidden={half === 1}
            >
              {CAPABILITIES.map((c) => (
                <span
                  key={c}
                  className="flex shrink-0 items-center gap-2.5 font-display text-[0.92rem] font-medium text-ink-500 sm:text-[1.02rem]"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-linear-to-r from-aqua-500 to-lilac-400"
                  />
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

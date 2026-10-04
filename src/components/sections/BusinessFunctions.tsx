import {
  ArrowRight,
  Banknote,
  Factory,
  Handshake,
  LayoutDashboard,
  Scale,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { packageById, type ServicePackage } from "@/lib/packages";
import { SECTION_IDS } from "@/lib/site";
import { BusinessFunctionTabs } from "./BusinessFunctionTabs";

/**
 * "Across every business function": the client's eight functions and their
 * use cases, one function at a time.
 *
 * A server component. All eight panels are rendered here and handed to a
 * small client island that only tracks which tab is selected, so every use
 * case is in the server HTML (inactive panels are `hidden`, not unmounted).
 *
 * Colours are Tailwind classes, not GLOW triplets: GLOW lives in a client
 * module, and a server component can't read properties of a client export.
 */

type Tone = {
  /** Gradient stops for the icon badges. */
  gradient: string;
  /** Solid colour for the chip bullets. */
  dot: string;
};

type BusinessFunction = {
  id: string;
  name: string;
  /** Tab label below lg, where tabs sit two or four to a row. */
  shortName: string;
  icon: LucideIcon;
  useCases: string[];
  /** Package ids from packages.ts that usually apply, in package order. */
  packageIds: string[];
  tone: Tone;
};

const FUNCTIONS: BusinessFunction[] = [
  {
    id: "finance",
    name: "Finance & Accounting",
    shortName: "Finance",
    icon: Banknote,
    useCases: [
      "Invoice processing",
      "Credit notes",
      "Reconciliation",
      "Financial reporting",
      "Month-end consolidation",
      "Number mismatch and comparison checks",
      "Accounts payable & receivable ageing and follow-up",
      "Expense report processing & approval routing",
    ],
    packageIds: ["automate", "data-flow-reporting", "ai-agents"],
    tone: { gradient: "from-abyss-600 to-azure-400", dot: "bg-abyss-600" },
  },
  {
    id: "procurement",
    name: "Procurement",
    shortName: "Procurement",
    icon: ShoppingCart,
    useCases: [
      "RFQ & quotation comparison",
      "Purchase order tracking",
      "Supplier management",
      "Supplier follow-ups",
      "Vendor performance scorecards",
      "Purchase request approval workflow",
      "Spend analysis & reporting",
    ],
    packageIds: ["automate", "connect", "data-flow-reporting"],
    tone: { gradient: "from-azure-600 to-aqua-400", dot: "bg-azure-500" },
  },
  {
    id: "supply-chain",
    name: "Supply Chain, Logistics & Operations",
    shortName: "Supply chain",
    icon: Truck,
    useCases: [
      "Order books",
      "Automated daily inventory reports",
      "Shipment tracking",
      "ETD/ETA monitoring with delay alerts",
      "Warehouse reporting",
      "Master data",
      "Sales order processing",
      "Stock discrepancy alerts between WMS and customer ERP",
      "Automated document collection and data updates",
      "Auto-send invoices & packing lists to customers",
    ],
    packageIds: ["connect", "data-flow-reporting", "ai-agents"],
    tone: { gradient: "from-aqua-600 to-mint-500", dot: "bg-aqua-500" },
  },
  {
    id: "hr",
    name: "HR & Administration",
    shortName: "HR & admin",
    icon: Users,
    useCases: [
      "Employee data",
      "Document management",
      "Onboarding",
      "Recurring reports",
      "Administrative workflows",
      "Contract and visa renewal alerts",
      "Leave & attendance tracking and reminders",
      "Payroll data preparation",
      "Offboarding checklist automation",
    ],
    packageIds: ["automate", "connect", "web-business-apps"],
    tone: { gradient: "from-mint-600 to-aqua-400", dot: "bg-mint-600" },
  },
  {
    id: "sales",
    name: "Sales & Customer Service",
    shortName: "Sales & service",
    icon: Handshake,
    useCases: [
      "Customer databases",
      "Order processing",
      "Customer tracking",
      "Case management",
      "Automated sales reporting",
      "AI-assisted portal for sales search and lookup",
      "Quote & proposal generation",
      "Lead follow-up reminders & pipeline tracking",
      "Renewal & subscription expiry tracking",
    ],
    packageIds: ["connect", "ai-agents", "web-business-apps"],
    tone: { gradient: "from-lilac-600 to-lilac-400", dot: "bg-lilac-600" },
  },
  {
    id: "legal",
    name: "Legal & Compliance",
    shortName: "Legal",
    icon: Scale,
    useCases: [
      "Contract tracking",
      "Certificate management",
      "Expiry monitoring",
      "Compliance reporting",
      "AI-assisted automated alerts",
      "Document version control & audit trail logging",
    ],
    packageIds: ["automate", "ai-agents", "web-business-apps"],
    tone: { gradient: "from-blush-600 to-lilac-400", dot: "bg-blush-600" },
  },
  {
    id: "manufacturing",
    name: "Manufacturing & Planning",
    shortName: "Manufacturing",
    icon: Factory,
    useCases: [
      "Production reports",
      "Material tracking with shortage & overstock alerts",
      "Planning data",
      "KPI reporting",
      "Exception monitoring",
      "Machine downtime tracking",
      "Maintenance schedule alerts",
    ],
    packageIds: ["connect", "data-flow-reporting", "web-business-apps"],
    tone: { gradient: "from-abyss-500 to-aqua-500", dot: "bg-abyss-500" },
  },
  {
    id: "management",
    name: "Executive & Business Management",
    shortName: "Management",
    icon: LayoutDashboard,
    useCases: [
      "Real-time portal dashboards",
      "Customised portals for mobile & desktop",
      "Multi-source data consolidation",
      "AI assistant for issue flagging and insight analysis",
    ],
    packageIds: ["data-flow-reporting", "ai-agents", "web-business-apps"],
    tone: { gradient: "from-azure-500 to-lilac-500", dot: "bg-azure-500" },
  },
];

/** Resolves package ids, failing the render (and so the build) on a typo. */
function packagesFor(ids: string[]): ServicePackage[] {
  return ids.map((id) => {
    const pkg = packageById(id);
    if (!pkg) throw new Error(`BusinessFunctions: unknown package id "${id}"`);
    return pkg;
  });
}

function FunctionPanel({ fn }: { fn: BusinessFunction }) {
  const Icon = fn.icon;
  const packages = packagesFor(fn.packageIds);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl glass p-5 motion-safe:animate-[rise_0.5s_var(--ease-out-expo)_both] sm:p-7">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${fn.tone.gradient}`}
      />

      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[0_10px_22px_-12px_rgb(7_38_60/0.6)] ${fn.tone.gradient}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-600">
            What we automate
          </p>
          <h3 className="mt-0.5 text-[1.12rem] font-bold leading-snug sm:text-[1.3rem]">
            {fn.name}
          </h3>
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2 lg:gap-2.5">
        {fn.useCases.map((useCase) => (
          <li
            key={useCase}
            className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-ink-200/80 bg-white/80 px-3 py-1.5 text-[0.84rem] leading-snug text-ink-700 lg:px-3.5 lg:py-2 lg:text-[0.88rem]"
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${fn.tone.dot}`} />
            <span className="min-w-0">{useCase}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <div className="border-t border-ink-100 pt-4">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-600">
            Packages that usually fit
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {packages.map((pkg) => (
              <li key={pkg.id} className="min-w-0 max-w-full">
                <a
                  href={`#service-${pkg.id}`}
                  className="relative inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[0.8rem] font-semibold text-abyss-600 ring-1 ring-ink-200/80 transition-colors hover:bg-white hover:text-abyss-700 hover:ring-aqua-400"
                >
                  {/* One text run, so the link's name reads "Package 2 Connect". */}
                  <span className="min-w-0">
                    <span className="sr-only">Package </span>
                    <span className="font-mono text-[0.7rem] font-medium text-ink-600">
                      {pkg.number}
                    </span>{" "}
                    {pkg.name}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function BusinessFunctions() {
  return (
    <section
      id={SECTION_IDS.functions}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-canvas via-haze/60 to-canvas"
      />
      <Orb
        className="-right-24 top-16 hidden md:block"
        color="bg-blush-400"
        size="h-80 w-80"
        opacity={0.18}
      />
      <Orb
        className="-left-24 bottom-8 hidden lg:block"
        color="bg-azure-400"
        size="h-72 w-72"
        opacity={0.18}
        delay="-7s"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Where we work"
          title={
            <>
              Across every <span className="text-gradient">business function</span>
            </>
          }
          lede="Supply chain is where we started. Choose a function to see what we automate there."
        />

        <BusinessFunctionTabs
          label="Business functions"
          items={FUNCTIONS.map((fn) => {
            const Icon = fn.icon;
            return {
              id: fn.id,
              label: fn.name,
              shortLabel: fn.shortName,
              icon: <Icon className="h-4 w-4" />,
              tone: fn.tone.gradient,
              panel: <FunctionPanel fn={fn} />,
            };
          })}
        />
      </div>
    </section>
  );
}

/**
 * The service packages, 0 to 9, from the client's brief ("Our Services — From
 * Basic to Complex"). Used by the Services section, the contact form's service
 * options, the hero solution engine's recommendations, the hook section's
 * links and the structured data — so a package is described identically
 * everywhere.
 *
 * `formLabel` is what a lead stores in the CRM. It deliberately reads
 * "Package 1: Automate": the service agreement's "Package reference" line is
 * filled from it, in the format the client's agreement template uses.
 */

export type PackageGroupId = "start" | "existing" | "intelligence" | "new" | "special" | "training";

export const PACKAGE_GROUPS: { id: PackageGroupId; title: string; note: string }[] = [
  {
    id: "start",
    title: "Start here",
    note: "Not sure what you need yet? Begin with an audit.",
  },
  {
    id: "existing",
    title: "Working within what you already have",
    note: "Packages 1–3 don't ask you to change your tools. We work inside Excel, Outlook, SharePoint, OneDrive, your ERP, your CRM and whatever else you already run.",
  },
  {
    id: "intelligence",
    title: "Adding intelligence",
    note: "AI on top of your workflow, working with your process and your data.",
  },
  {
    id: "new",
    title: "Building something new",
    note: "Unlike packages 1–3, this isn't limited to your existing tools. We build a new one for you.",
  },
  {
    id: "special",
    title: "Special situations",
    note: "Stalled projects, problems that cross many systems, and keeping things running after launch.",
  },
  {
    id: "training",
    title: "Training",
    note: "For teams who want to keep improving their own processes.",
  },
];

/** One example: a request and what happens (package 4), or a chain of steps. */
export type PackageExample = { label?: string; steps: string[] };

export type ServicePackage = {
  /** Stable slug, used for anchors and structured data. */
  id: string;
  number: number;
  name: string;
  group: PackageGroupId;
  /** One line, shown on the card. */
  promise: string;
  /** Optional extra sentence under the promise. */
  intro?: string;
  coversLabel: string;
  covers: string[];
  /** Tools named by the client (package 2). */
  tools?: string[];
  /** How the package runs, as a step chain. */
  flow?: string[];
  examples?: PackageExample[];
  /** What the client receives (package 0). */
  deliverables?: string[];
  bestFor: string;
  /** Stored on CRM leads and printed as the agreement's package reference. */
  formLabel: string;
};

const pkg = (p: Omit<ServicePackage, "formLabel">): ServicePackage => ({
  ...p,
  formLabel: `Package ${p.number}: ${p.name}`,
});

export const PACKAGES: ServicePackage[] = [
  pkg({
    id: "automation-audit",
    number: 0,
    name: "Automation Audit",
    group: "start",
    promise: "Find out what's worth automating before you spend on it.",
    intro: "We look at your current process and find where the bottlenecks are.",
    coversLabel: "We look at",
    covers: ["Your files", "Your systems", "Manual steps", "Bottlenecks"],
    deliverables: [
      "Automation opportunities",
      "Recommended solution",
      "Estimated time saving",
      "Technology recommendation",
    ],
    bestFor: "Anyone who knows something is inefficient but isn't sure what to automate or where to start.",
  }),
  pkg({
    id: "automate",
    number: 1,
    name: "Automate",
    group: "existing",
    promise: "Turn repetitive tasks into one-click workflows.",
    coversLabel: "Good for",
    covers: [
      "Excel automation",
      "VBA",
      "File & PDF processing",
      "Email automation",
      "Report generation",
      "Data entry",
      "Repetitive uploads & downloads",
    ],
    examples: [
      {
        label: "Example",
        steps: ["Invoice arrives", "Read the file", "Rename", "Save to the right folder", "Update the tracker", "Send the email"],
      },
    ],
    bestFor: "Individuals, SMEs and teams with one specific manual task eating their time.",
  }),
  pkg({
    id: "connect",
    number: 2,
    name: "Connect",
    group: "existing",
    promise: "Make your systems talk to each other.",
    intro:
      "For when you run Excel, Outlook, SharePoint, OneDrive, an ERP, a CRM and web portals, and someone moves data between them by hand.",
    coversLabel: "Connects",
    covers: ["Excel", "Outlook", "SharePoint", "OneDrive", "ERP", "CRM", "Web portals"],
    tools: ["APIs", "Power Automate", "Browser automation", "VBA", "Python", "Webhooks", "Connectors"],
    examples: [
      { steps: ["Outlook", "SharePoint", "Excel dashboard"] },
      { steps: ["ERP", "Database", "Dashboard", "Outlook summary"] },
      { steps: ["Web portal", "Excel", "Report", "Email"] },
      { steps: ["CRM", "Power Automate", "Excel", "Teams update"] },
    ],
    bestFor:
      "Businesses with disconnected systems, where data is re-typed or copied between tools and reports take hours to prepare before they go to managers, customers or vendors.",
  }),
  pkg({
    id: "data-flow-reporting",
    number: 3,
    name: "Data Flow & Reporting",
    group: "existing",
    promise: "Turn scattered data into one reliable flow.",
    coversLabel: "Covers",
    covers: [
      "Excel & CSV consolidation",
      "Data cleaning",
      "Master data",
      "Data transformation",
      "Automated reports",
      "Dashboards",
      "KPI tracking",
      "Data validation",
      "Database design",
      "Single source of truth",
    ],
    flow: ["Collect", "Clean", "Transform", "Validate", "Consolidate", "Report"],
    bestFor:
      "Teams working from spreadsheets from many sources, who spend hours cleaning data, fixing formulas and copy-pasting to produce one report, and need one number everyone trusts instead of five versions.",
  }),
  pkg({
    id: "ai-agents",
    number: 4,
    name: "AI Agents & Intelligent Solutions",
    group: "intelligence",
    promise: "Add an AI assistant on top of your workflow.",
    intro: "Not a chatbot for the sake of having one: AI that works with your process and your data.",
    coversLabel: "Covers",
    covers: [
      "AI agents",
      "Internal chatbots",
      "Document assistants",
      "Data assistants",
      "FAQ & knowledge bots",
      "AI classification",
      "AI email assistants",
      "AI report summaries",
      "AI + workflow automation",
    ],
    examples: [
      {
        label: "“Check this shipment.”",
        steps: ["Pulls the latest data", "Checks the relevant systems", "Gives you the status"],
      },
      {
        label: "“Find all invoices waiting for action.”",
        steps: ["Searches your data", "Flags the exceptions", "Summarises what needs attention"],
      },
      {
        label: "“What's causing this order delay?”",
        steps: ["Reviews the available information", "Highlights the likely cause"],
      },
    ],
    bestFor:
      "Teams that already have automation in place (packages 1–3) and want it to answer questions or make judgement calls, not just move data. Also for anyone with a lot of data and documents who needs help managing them and spotting issues.",
  }),
  pkg({
    id: "web-business-apps",
    number: 5,
    name: "Web & Business Applications",
    group: "new",
    promise: "Not everything belongs in Excel.",
    coversLabel: "We build",
    covers: [
      "Internal web apps",
      "Customer portals",
      "Employee portals",
      "Search platforms",
      "Tracking systems",
      "Order management tools",
      "Inventory tools",
      "Approval systems",
      "Custom dashboards",
      "Database-backed applications",
    ],
    bestFor:
      "Businesses that have outgrown Excel and shared files, with data in several places, that need one proper tool their team or customers can use directly: a central place to search the data and act on it.",
  }),
  pkg({
    id: "project-rescue",
    number: 6,
    name: "Project Rescue & Recovery",
    group: "special",
    promise: "Get a stalled or broken project working and live.",
    coversLabel: "For when",
    covers: [
      "The project is pending",
      "The developer left mid-way",
      "The vendor didn't finish",
      "The prototype doesn't work properly",
      "The automation throws errors",
      "The app is built but can't be deployed",
      "Nobody maintains the code",
      "An integration is stuck",
      "The scope has spiralled",
    ],
    flow: ["Assess", "Diagnose", "Fix", "Complete", "Improve", "Deploy"],
    bestFor: "Businesses with an existing project that's stalled, broken or abandoned by a previous developer or vendor.",
  }),
  pkg({
    id: "custom-development",
    number: 7,
    name: "Digital Solution & Custom Development",
    group: "special",
    promise: "For a business problem when you don't yet know which technology it needs.",
    intro:
      "Combines any of the packages above into one solution, including a custom AI system built by SULOAI around your specific task.",
    coversLabel: "For",
    covers: [
      "Multiple departments",
      "Multiple systems",
      "Database work",
      "API integration",
      "Web applications",
      "Custom dashboards",
      "AI agents",
      "Complex workflows",
      "Enterprise-scale processes",
    ],
    flow: ["Understand the problem", "Design the solution", "Build", "Integrate", "Deploy"],
    bestFor:
      "Larger or more complex organisations facing a problem that spans several systems, departments or technologies at once.",
  }),
  pkg({
    id: "support",
    number: 8,
    name: "Support & Continuous Improvement",
    group: "special",
    promise: "After it's built, someone keeps watching it.",
    intro: "Available as monthly retainer support.",
    coversLabel: "Covers",
    covers: [
      "Bug fixing",
      "Monitoring",
      "Maintenance",
      "Enhancements",
      "New features",
      "Process optimisation",
      "AI model & prompt updates",
      "System updates",
    ],
    bestFor:
      "Anyone who has already built something, with us or elsewhere, and needs it maintained, monitored and improved over time.",
  }),
  pkg({
    id: "training",
    number: 9,
    name: "Training",
    group: "training",
    promise: "Learn to apply automation thinking in your own work.",
    coversLabel: "Covers",
    covers: [
      "Spotting what's worth automating",
      "Master data preparation",
      "Using automation tools in your daily work",
      "Sessions built around your own files and processes",
    ],
    bestFor: "Teams who want to build their own quick wins and keep improving after a project ends.",
  }),
];

/** Contact-form value for "I don't know yet". Also stored on the lead as is. */
export const NOT_SURE_OPTION = "Not sure yet — need advice";

/** Every value the contact form accepts for "services", in display order. */
export const SERVICE_OPTIONS = [...PACKAGES.map((p) => p.formLabel), NOT_SURE_OPTION] as const;

export function packageById(id: string): ServicePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

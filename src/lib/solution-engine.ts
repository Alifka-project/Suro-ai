/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLUTION ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Turns a free-text description of a business problem into a short outline:
 * what's usually going on, how we'd build the fix, typical tools, what usually
 * changes, and which service package (see packages.ts) fits.
 *
 * Deterministic and dependency-free: it runs instantly, costs nothing and
 * works offline. Weighted keyword scoring across playbooks for each business
 * function, plus detection of the systems and volumes the visitor mentions so
 * the reply can quote their own context back to them.
 *
 * Copy rules for playbooks: outcomes stay qualitative (no figures, no
 * "days → hours"), and there are no durations or prices. Timing and cost come
 * from the written scope after a conversation, never from this outline.
 *
 * Loaded on demand: the playbook copy is large, so PromptConsole imports this
 * module with a dynamic import() when a visitor submits a description, rather
 * than shipping it in the hero's initial JavaScript. Keep anything the console
 * needs before that (sample prompts, labels) out of this file.
 *
 * ── SWAPPING IN A REAL MODEL ────────────────────────────────────────────────
 * `generateSolution()` is the single seam. To back it with Claude instead:
 *   1. Create src/app/api/solution/route.ts that calls the Anthropic API and
 *      returns JSON matching the `SolutionResult` shape below (packageId must
 *      be one of the ids in packages.ts).
 *   2. In PromptConsole.tsx, replace the on-demand `generateSolution(input)`
 *      call with a `fetch("/api/solution", …)`, keeping this function as the
 *      fallback for errors, rate limits, or a missing API key.
 * Nothing else in the UI needs to change.
 */

export type BlueprintStep = {
  step: string;
  detail: string;
};

export type Outcome = {
  metric: string;
  label: string;
};

/** Ids of the packages in packages.ts that a playbook can recommend. */
export type PackageId =
  | "automation-audit"
  | "automate"
  | "connect"
  | "data-flow-reporting"
  | "ai-agents"
  | "web-business-apps"
  | "project-rescue"
  | "custom-development"
  | "support"
  | "training";

export type SolutionResult = {
  id: string;
  title: string;
  /** The package this answer recommends — look it up with packageById(). */
  packageId: PackageId;
  /** 0–1. Internal; the UI shows only `matchStrength`. */
  confidence: number;
  /** Plain-language reading of `confidence`, e.g. "Strong match". */
  matchStrength: string;
  diagnosis: string;
  blueprint: BlueprintStep[];
  stack: string[];
  outcomes: Outcome[];
  followUp: string;
  /** Phrases from the visitor's own input that drove the match. */
  signals: string[];
  /** Named systems detected in the input, echoed back to the visitor. */
  systems: string[];
};

type Playbook = {
  id: string;
  title: string;
  packageId: PackageId;
  /**
   * Weight 3 = decisive term, 2 = strong, 1 = supporting. Terms match at the
   * start of a word ("reconcil" matches "reconciliation"; "port" would not
   * match "report"). A trailing space makes a term whole-word (" eta ").
   * Write terms in lower case, with straight apostrophes.
   */
  keywords: { term: string; weight: number }[];
  diagnosis: (ctx: MatchContext) => string;
  blueprint: BlueprintStep[];
  stack: string[];
  outcomes: Outcome[];
  followUp: string;
};

type MatchContext = {
  systems: string[];
  volumePhrase: string | null;
};

/* ───────────────────────── System detection ───────────────────────── */

const SYSTEM_PATTERNS: { label: string; patterns: RegExp[] }[] = [
  { label: "SAP", patterns: [/\bsap\b/, /\bs\/?4\s?hana\b/, /\becc\b/] },
  { label: "Oracle", patterns: [/\boracle\b/, /\bnetsuite\b/, /\bjd ?edwards\b/] },
  {
    label: "Microsoft Dynamics 365",
    patterns: [/\bdynamics\b/, /\bd365\b/, /\bbusiness central\b/, /\bnav\b/],
  },
  { label: "Odoo", patterns: [/\bodoo\b/] },
  { label: "Tally", patterns: [/\btally\b/] },
  { label: "Sage", patterns: [/\bsage\b/] },
  { label: "QuickBooks", patterns: [/\bquickbooks\b/, /\bqbo\b/] },
  { label: "Xero", patterns: [/\bxero\b/] },
  { label: "Zoho", patterns: [/\bzoho\b/] },
  { label: "Excel", patterns: [/\bexcel\b/, /\bspreadsheets?\b/, /\bxlsx?\b/, /\bvba\b/, /\bmacros?\b/, /\bpivot/] },
  { label: "Google Sheets", patterns: [/\bgoogle sheets?\b/, /\bg ?sheets?\b/, /\bapps script\b/] },
  { label: "Outlook", patterns: [/\boutlook\b/, /\bexchange (server|online)\b/] },
  { label: "Gmail", patterns: [/\bgmail\b/, /\bgoogle workspace\b/] },
  {
    label: "Microsoft Teams",
    patterns: [/\b(ms|microsoft) teams\b/, /\b(in|on|via|over|through) teams\b/, /\bteams (chat|channel|message|meeting)s?\b/],
  },
  { label: "Slack", patterns: [/\bslack\b/] },
  { label: "WhatsApp", patterns: [/\bwhats ?app\b/, /\bwa business\b/] },
  { label: "SharePoint", patterns: [/\bsharepoint\b/] },
  { label: "OneDrive", patterns: [/\bonedrive\b/] },
  { label: "Google Drive", patterns: [/\bgoogle drive\b/] },
  { label: "Power Automate", patterns: [/\bpower automate\b/, /\bflows? keeps?\b/] },
  { label: "Power Apps", patterns: [/\bpower ?apps?\b/] },
  { label: "Power BI", patterns: [/\bpower ?bi\b/] },
  { label: "Tableau", patterns: [/\btableau\b/] },
  { label: "Shopify", patterns: [/\bshopify\b/] },
  { label: "WooCommerce", patterns: [/\bwoocommerce\b/] },
  { label: "Salesforce", patterns: [/\bsalesforce\b/] },
  { label: "HubSpot", patterns: [/\bhubspot\b/] },
  { label: "Bayzat", patterns: [/\bbayzat\b/] },
  { label: "Jira", patterns: [/\bjira\b/] },
  { label: "EDI", patterns: [/\bedi\b/, /\bx12\b/, /\bedifact\b/] },
  { label: "WMS", patterns: [/\bwms\b/, /\bwarehouse management\b/] },
  { label: "TMS", patterns: [/\btms\b/, /\btransport management\b/] },
  { label: "3PL portal", patterns: [/\b3pl\b/, /\bthird[- ]party logistics\b/] },
  { label: "SQL database", patterns: [/\bsql\b/, /\bpostgres\b/, /\bmysql\b/] },
];

function detectSystems(text: string): string[] {
  const found: string[] = [];
  for (const { label, patterns } of SYSTEM_PATTERNS) {
    if (patterns.some((p) => p.test(text)) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found.slice(0, 5);
}

const VOLUME_PATTERN =
  /\b\d[\d,.]*\s*\+?\s*(?:hours?|hrs?|days?|weeks?|people|staff|employees?|fte|orders?|invoices?|purchase orders?|pos|lines?|skus?|shipments?|containers?|emails?|tickets?|quotes?|rfqs?|reports?|files?|records?|rows?|contracts?|requests?|leads?|customers?|suppliers?|vendors?|visas?|users?)\b(?:\s+(?:a|per|each|every)\s+(?:day|week|month|year))?/i;

function detectVolume(text: string): string | null {
  const match = text.match(VOLUME_PATTERN);
  return match ? match[0].trim() : null;
}

/* ───────────────────────── Copy helpers ───────────────────────── */

/** Detected systems that are an ERP or accounting system, for "typed into SAP" phrasing. */
const ERP_SYSTEMS = new Set([
  "SAP",
  "Oracle",
  "Microsoft Dynamics 365",
  "Odoo",
  "Tally",
  "Sage",
  "QuickBooks",
  "Xero",
  "Zoho",
]);

/** Reads naturally whether we detected 0, 1, or several systems. */
function systemClause(systems: string[], fallback: string): string {
  if (systems.length === 0) return fallback;
  if (systems.length === 1) return systems[0];
  if (systems.length === 2) return `${systems[0]} and ${systems[1]}`;
  return `${systems.slice(0, -1).join(", ")} and ${systems[systems.length - 1]}`;
}

/** Quotes the visitor's own volume back to them, when they gave one. */
function volumeNote(ctx: MatchContext, tail = "so the time adds up quickly"): string {
  return ctx.volumePhrase ? ` You mentioned “${ctx.volumePhrase}”, ${tail}.` : "";
}

/* ───────────────────────── Playbooks ─────────────────────────
   Order matters only for ties: the earlier playbook wins. */

const PLAYBOOKS: Playbook[] = [
  /* ── Procurement ─────────────────────────────────────────── */
  {
    id: "po-processing",
    title: "Purchase orders from inbox to ERP, without retyping",
    packageId: "connect",
    keywords: [
      { term: "purchase order", weight: 3 },
      { term: "purchase requisition", weight: 3 },
      { term: "po processing", weight: 3 },
      { term: " po ", weight: 2 },
      { term: " pos ", weight: 2 },
      { term: "requisition", weight: 2 },
      { term: "procurement", weight: 2 },
      { term: "raise order", weight: 2 },
      { term: "order entry", weight: 2 },
      { term: "buying", weight: 1 },
      { term: "sourcing", weight: 1 },
      { term: "approval", weight: 1 },
      // Retyping POs is the PO problem, not a generic manual task.
      { term: "re-key", weight: 1 },
      { term: "by hand", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Purchase orders usually arrive by email or in spreadsheets, get typed into ${systemClause(
        ctx.systems.filter((s) => ERP_SYSTEMS.has(s)),
        "the ERP"
      )} by hand, then wait in an approval queue nobody can see.${volumeNote(
        ctx,
        "so the retyping alone takes real time every week"
      )} Each of those steps can run on rules, and approvals are usually the quickest visible win.`,
    blueprint: [
      {
        step: "Capture",
        detail:
          "A flow watches the shared mailbox and supplier portals and reads each PO or requisition, including PDFs and scans.",
      },
      {
        step: "Check",
        detail:
          "Lines are checked against your item master, agreed prices and budget limits. Only real exceptions go to a person, with the problem highlighted.",
      },
      {
        step: "Approve",
        detail:
          "Approvals go out in Teams or Outlook with one-click approve or reject, reminders when they wait too long, and a status anyone can check.",
      },
      {
        step: "Post",
        detail:
          "Approved orders are written into your ERP, the supplier gets a confirmation, and a dashboard shows cycle time and exceptions.",
      },
    ],
    stack: ["Power Automate", "Document AI", "ERP connector", "Teams / Outlook approvals", "Power BI"],
    outcomes: [
      { metric: "Less retyping", label: "clean orders go straight into the ERP" },
      { metric: "Faster approvals", label: "with reminders when an order waits" },
      { metric: "One status", label: "for every order, without chasing" },
    ],
    followUp:
      "Bring a handful of real POs (redacted is fine) and your approval rules to the first call. That's enough to scope the build.",
  },

  /* ── Finance ─────────────────────────────────────────────── */
  {
    id: "invoice-matching",
    title: "Supplier invoices matched to POs and receipts, without keying",
    packageId: "automate",
    keywords: [
      { term: "invoice", weight: 3 },
      { term: "three-way match", weight: 3 },
      { term: "3-way match", weight: 3 },
      { term: "accounts payable", weight: 3 },
      { term: " ap ", weight: 2 },
      { term: "credit note", weight: 2 },
      { term: "goods receipt", weight: 2 },
      { term: "grn", weight: 2 },
      { term: "billing", weight: 1 },
      { term: "payment", weight: 1 },
      { term: "reconcil", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `The invoice, the PO and the goods receipt sit in different places and formats, so someone matches them line by line${
        ctx.systems.length ? ` across ${systemClause(ctx.systems, "your systems")}` : ""
      }.${volumeNote(ctx)} Reading invoices automatically and matching them by your tolerance rules leaves your team with the disputes only.`,
    blueprint: [
      {
        step: "Read every format",
        detail: "Invoices are read from PDF, scan or email, with header and line items extracted and checked.",
      },
      {
        step: "Match by your rules",
        detail:
          "Invoice, PO and receipt are matched line by line using your price and quantity tolerances, including partial deliveries.",
      },
      {
        step: "Work the exceptions",
        detail: "Mismatches go to a short queue showing which field disagrees, with a supplier query ready to send.",
      },
      {
        step: "Post and track",
        detail: "Matched invoices post to your finance system, and a report shows what's waiting and why.",
      },
    ],
    stack: ["Document AI", "Power Automate", "Excel / VBA", "ERP or finance connector", "Power BI"],
    outcomes: [
      { metric: "Exceptions only", label: "left for your AP team to handle" },
      { metric: "Fewer errors", label: "than keying invoices by hand" },
      { metric: "Fewer missed", label: "early-payment discounts" },
    ],
    followUp:
      "Bring a sample month of invoices and your tolerance rules to the first call, and we can estimate how many would match without a person.",
  },
  {
    id: "month-end",
    title: "A shorter month-end, with reconciliations prepared for you",
    packageId: "data-flow-reporting",
    keywords: [
      { term: "month-end", weight: 3 },
      { term: "month end", weight: 3 },
      { term: "month close", weight: 3 },
      { term: "closing the books", weight: 3 },
      { term: "reconcil", weight: 3 },
      { term: "bank statement", weight: 3 },
      { term: "bank rec", weight: 3 },
      { term: "general ledger", weight: 3 },
      { term: "trial balance", weight: 3 },
      { term: "accrual", weight: 3 },
      { term: "intercompany", weight: 3 },
      { term: "accounts receivable", weight: 3 },
      { term: "ap/ar", weight: 3 },
      { term: "aging", weight: 3 },
      { term: "ageing", weight: 3 },
      { term: "vat return", weight: 3 },
      { term: "payment reminder", weight: 3 },
      { term: "late payment", weight: 3 },
      { term: " ar ", weight: 2 },
      { term: "receivable", weight: 2 },
      { term: "ledger", weight: 2 },
      { term: "journal", weight: 2 },
      { term: "overdue", weight: 2 },
      { term: "collections", weight: 2 },
      { term: "cash flow", weight: 2 },
      { term: "vat ", weight: 2 },
      { term: "corporate tax", weight: 2 },
      { term: "accounting", weight: 2 },
      { term: "accountant", weight: 2 },
      { term: "finance team", weight: 2 },
      { term: "expense", weight: 1 },
      { term: "statement", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Month-end usually slows down in the same places: exporting from ${systemClause(
        ctx.systems,
        "the accounting system and the bank"
      )}, matching transactions in spreadsheets, and rebuilding the same schedules every month.${volumeNote(
        ctx
      )} Most of that matching follows fixed rules, so it can be prepared before your team starts.`,
    blueprint: [
      {
        step: "Collect the data",
        detail: "Bank statements, ledger exports and sub-ledgers are pulled in on a schedule, in one consistent format.",
      },
      {
        step: "Match automatically",
        detail: "Transactions are matched by your rules, and anything that doesn't match is listed with the likely reason.",
      },
      {
        step: "Prepare the schedules",
        detail: "AP/AR ageing, accruals and VAT workings refresh from the same data instead of being rebuilt by hand.",
      },
      {
        step: "Review and sign off",
        detail: "Your team reviews the exceptions and signs off, with every adjustment recorded.",
      },
    ],
    stack: ["Power Query", "Python", "Excel", "Accounting system export or API", "Power BI"],
    outcomes: [
      { metric: "Matching prepared", label: "before your team starts" },
      { metric: "Same steps", label: "every month, written down" },
      { metric: "Ageing on demand", label: "at any point in the month" },
    ],
    followUp: "Bring last month's reconciliation file and the exports it's built from to the first call.",
  },

  /* ── HR & administration ─────────────────────────────────── */
  {
    id: "hr-admin",
    title: "Onboarding, renewals, leave and payroll prep without the chasing",
    packageId: "automate",
    keywords: [
      { term: " hr ", weight: 3 },
      { term: "human resources", weight: 3 },
      { term: "visa", weight: 3 },
      { term: "visa renewal", weight: 3 },
      { term: "visa expir", weight: 3 },
      { term: "emirates id", weight: 3 },
      { term: "labour card", weight: 3 },
      { term: "labor card", weight: 3 },
      { term: "work permit", weight: 3 },
      { term: "employee onboarding", weight: 3 },
      { term: "new hire", weight: 3 },
      { term: "new joiner", weight: 3 },
      { term: "offboarding", weight: 3 },
      { term: "annual leave", weight: 3 },
      { term: "sick leave", weight: 3 },
      { term: "leave request", weight: 3 },
      { term: "leave tracking", weight: 3 },
      { term: "leave balance", weight: 3 },
      { term: "attendance", weight: 3 },
      { term: "timesheet", weight: 3 },
      { term: "payroll", weight: 3 },
      { term: "probation", weight: 3 },
      { term: "employment contract", weight: 3 },
      { term: "gratuity", weight: 3 },
      { term: "wps ", weight: 3 },
      { term: "recruit", weight: 3 },
      { term: "employee", weight: 2 },
      { term: "passport", weight: 2 },
      { term: "overtime", weight: 2 },
      { term: "candidate", weight: 2 },
      { term: "contract renewal", weight: 2 },
      { term: "onboarding", weight: 1 },
      { term: "staff", weight: 1 },
      { term: "headcount", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `HR admin runs on dates and checklists: visa and contract renewals, onboarding steps, leave balances, payroll inputs. When those live in ${systemClause(
        ctx.systems,
        "spreadsheets and inboxes"
      )}, something eventually gets missed.${volumeNote(
        ctx
      )} Reminders, checklists and payroll preparation can run automatically from the data you already keep.`,
    blueprint: [
      {
        step: "One employee record",
        detail:
          "Key dates and documents (visa, ID, contract, probation) are kept in one list, in a tool you already use.",
      },
      {
        step: "Reminders before deadlines",
        detail: "Renewal alerts go to HR and the line manager weeks ahead, with a follow-up if nothing happens.",
      },
      {
        step: "Checklists that run themselves",
        detail: "Onboarding and offboarding tasks are assigned and tracked, from accounts and equipment to documents.",
      },
      {
        step: "Payroll inputs prepared",
        detail: "Attendance, leave and overtime are collected and checked before payroll, with exceptions listed.",
      },
    ],
    stack: ["Power Automate", "SharePoint / Excel", "Outlook / Teams", "HR system connector", "Power BI"],
    outcomes: [
      { metric: "Fewer missed", label: "renewal and expiry dates" },
      { metric: "Same checklist", label: "for every new joiner" },
      { metric: "Earlier payroll checks", label: "with exceptions flagged before the run" },
    ],
    followUp: "Bring the spreadsheet or list you use to track employee dates to the first call.",
  },

  /* ── Legal & compliance ──────────────────────────────────── */
  {
    id: "supplier-management",
    title: "Supplier onboarding and performance in one place",
    packageId: "web-business-apps",
    keywords: [
      { term: "supplier", weight: 3 },
      { term: "vendor", weight: 3 },
      { term: "supplier onboarding", weight: 3 },
      { term: "vendor onboarding", weight: 3 },
      { term: "vendor registration", weight: 3 },
      { term: "supplier portal", weight: 3 },
      { term: "scorecard", weight: 3 },
      { term: "supplier performance", weight: 3 },
      { term: "qualification", weight: 2 },
      { term: "due diligence", weight: 2 },
      { term: "certificate", weight: 2 },
      { term: "onboarding", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Supplier onboarding often lives in email threads, certificates expire unnoticed, and performance is judged on the last problem rather than the record.${
        ctx.systems.length
          ? ` With details spread across ${systemClause(ctx.systems, "email and spreadsheets")}, there's no single view of a supplier.`
          : ""
      } A simple onboarding portal and a scorecard built from your own transactions deal with both.`,
    blueprint: [
      {
        step: "Self-service onboarding",
        detail:
          "Suppliers enter their own details, bank information and documents through a guided form that checks them on entry.",
      },
      {
        step: "Expiry reminders",
        detail: "Certificates, insurance and contracts are tracked, with reminders to the supplier before they expire.",
      },
      {
        step: "Score on the record",
        detail: "On-time delivery, quality and price variance are calculated from your own transactions.",
      },
      {
        step: "Ready for reviews",
        detail: "Review packs with trends and open issues are prepared automatically.",
      },
    ],
    stack: ["Web portal or Power Apps", "Power Automate", "SQL / Dataverse", "Document AI", "Power BI"],
    outcomes: [
      { metric: "Complete records", label: "from a supplier's first day" },
      { metric: "Fewer surprises", label: "from expired certificates" },
      { metric: "Scorecards", label: "built from your own transactions" },
    ],
    followUp: "Bring your current supplier onboarding checklist to the first call.",
  },
  {
    id: "legal-compliance",
    title: "Contract and licence dates tracked, with an audit trail",
    packageId: "automate",
    keywords: [
      { term: "legal", weight: 3 },
      { term: "contract expir", weight: 3 },
      { term: "contract register", weight: 3 },
      { term: "trade licence", weight: 3 },
      { term: "trade license", weight: 3 },
      { term: "audit trail", weight: 3 },
      { term: "renewal date", weight: 3 },
      { term: "notice period", weight: 3 },
      { term: "power of attorney", weight: 3 },
      { term: "expiry", weight: 3 },
      { term: "expir", weight: 2 },
      { term: "licence", weight: 2 },
      { term: "license", weight: 2 },
      { term: "certificate", weight: 2 },
      { term: "compliance", weight: 2 },
      { term: "regulat", weight: 2 },
      { term: "audit", weight: 2 },
      { term: "contract renewal", weight: 2 },
      { term: "obligation", weight: 2 },
      { term: "nda", weight: 2 },
      { term: "contract", weight: 1 },
      { term: "policy", weight: 1 },
      { term: "insurance", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Contracts, licences and certificates each carry dates that matter, and they're usually tracked in a spreadsheet someone has to remember to check.${
        ctx.systems.length
          ? ` With documents spread across ${systemClause(ctx.systems, "several places")}, finding the current version takes time.`
          : ""
      }${volumeNote(
        ctx
      )} A register with automatic reminders and a record of who did what makes renewals routine and audits easier.`,
    blueprint: [
      {
        step: "Build the register",
        detail: "Contracts, licences and certificates go into one register with an owner, key dates and the current file.",
      },
      {
        step: "Remind ahead of time",
        detail: "Alerts go out before expiry and notice dates, with a follow-up if nobody acts.",
      },
      {
        step: "Keep an audit trail",
        detail: "Approvals, changes and renewals are logged automatically, with who did it and when.",
      },
      {
        step: "Find things quickly",
        detail: "Documents are filed consistently, and an AI assistant can find a clause or a date on request.",
      },
    ],
    stack: ["SharePoint", "Power Automate", "Outlook / Teams", "Document AI", "Power BI"],
    outcomes: [
      { metric: "Fewer missed", label: "renewal and notice dates" },
      { metric: "Audit-ready", label: "record of approvals and changes" },
      { metric: "One register", label: "instead of scattered files" },
    ],
    followUp: "Bring your current contract or licence list to the first call, in whatever form it's in.",
  },

  /* ── Sales & customer service ────────────────────────────── */
  {
    id: "sales-followups",
    title: "Follow-ups, renewals and customer updates that don't slip",
    packageId: "connect",
    keywords: [
      { term: "follow up", weight: 3 },
      { term: "follow-up", weight: 3 },
      { term: "followup", weight: 3 },
      { term: "sales team", weight: 3 },
      { term: "salespeople", weight: 3 },
      { term: "sales rep", weight: 3 },
      { term: "after-sales", weight: 3 },
      { term: "customer onboarding", weight: 3 },
      { term: "crm", weight: 2 },
      { term: "pipeline", weight: 2 },
      { term: "leads ", weight: 2 },
      { term: "new lead", weight: 2 },
      { term: "renewal", weight: 2 },
      { term: "subscription", weight: 2 },
      { term: "complaint", weight: 2 },
      { term: "account manager", weight: 2 },
      { term: "customer service", weight: 2 },
      { term: "hubspot", weight: 2 },
      { term: "salesforce", weight: 2 },
      { term: "zoho", weight: 1 },
      { term: "reminder", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Follow-ups slip when they depend on someone remembering: a quote nobody chased, a renewal noticed after it lapsed, a customer waiting for an update.${
        ctx.systems.length
          ? ` With customer data in ${systemClause(ctx.systems, "your CRM")}, the reminders can come from the data itself.`
          : ""
      }${volumeNote(
        ctx
      )} Automatic reminders, renewal alerts and status updates keep each customer moving without extra admin.`,
    blueprint: [
      {
        step: "Tidy the customer data",
        detail: "Contacts, deals and renewal dates are cleaned up and kept in one place, usually your CRM.",
      },
      {
        step: "Automate the reminders",
        detail: "Follow-ups, quote chasers and renewal alerts reach the right person at the right time.",
      },
      {
        step: "Update customers automatically",
        detail: "Order, case or renewal updates go out by email or WhatsApp from templates you approve.",
      },
      {
        step: "See the pipeline",
        detail: "A dashboard shows open deals, overdue follow-ups and upcoming renewals.",
      },
    ],
    stack: ["Your CRM", "Power Automate", "Outlook / WhatsApp", "Excel", "Power BI"],
    outcomes: [
      { metric: "Fewer missed", label: "follow-ups and renewals" },
      { metric: "Less admin", label: "for the sales team" },
      { metric: "One view", label: "of every open deal and renewal" },
    ],
    followUp: "Bring an export of your pipeline or customer list to the first call.",
  },
  {
    id: "quotation",
    title: "Quotes and RFQs prepared faster, with your pricing rules applied",
    packageId: "connect",
    keywords: [
      { term: "quotation", weight: 3 },
      { term: "quote", weight: 3 },
      { term: "rfq", weight: 3 },
      { term: "tender", weight: 3 },
      { term: "bid", weight: 2 },
      { term: "pricing", weight: 2 },
      { term: "price list", weight: 2 },
      { term: "proposal", weight: 2 },
      { term: "estimate", weight: 2 },
      { term: "costing", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Slow quotes lose deals, and most of the delay comes from collecting the inputs: reading the request, looking up costs in ${systemClause(
        ctx.systems,
        "spreadsheets"
      )}, checking stock and lead times, then formatting the document.${volumeNote(
        ctx
      )} Those inputs can be gathered automatically, leaving the final call to you.`,
    blueprint: [
      {
        step: "Read the request",
        detail: "Incoming RFQs from email, PDF or portals are matched to your catalogue, with unclear lines flagged.",
      },
      {
        step: "Gather the inputs",
        detail: "Cost, stock, lead time and freight are pulled into one costing sheet.",
      },
      {
        step: "Apply your pricing rules",
        detail: "Margins by customer and volume suggest a price, with the working shown so you can adjust it.",
      },
      {
        step: "Send and follow up",
        detail: "The quote is generated on approval, and follow-ups and win/loss are tracked.",
      },
    ],
    stack: ["Document AI", "Power Automate", "Excel pricing model", "CRM connector", "Power BI"],
    outcomes: [
      { metric: "Faster quotes", label: "with costs gathered automatically" },
      { metric: "More quotes", label: "sent by the same team" },
      { metric: "Tracked", label: "win/loss on every quote" },
    ],
    followUp: "Bring a few recent RFQs and your margin rules to the first call.",
  },
  {
    id: "ai-chatbot",
    title: "An AI assistant that answers routine questions from your own data",
    packageId: "ai-agents",
    keywords: [
      { term: "chatbot", weight: 3 },
      { term: "chat bot", weight: 3 },
      { term: "ai agent", weight: 3 },
      { term: "ai assistant", weight: 3 },
      { term: "customer support", weight: 3 },
      { term: "where is my order", weight: 3 },
      { term: "help desk", weight: 3 },
      { term: "helpdesk", weight: 3 },
      { term: "knowledge base", weight: 3 },
      { term: "same questions", weight: 3 },
      { term: "customer service", weight: 2 },
      { term: "inquiries", weight: 2 },
      { term: "enquiries", weight: 2 },
      { term: "answer questions", weight: 2 },
      { term: "ticket", weight: 2 },
      { term: "assistant", weight: 2 },
      { term: "faq", weight: 2 },
      { term: "ai ", weight: 2 },
      { term: "agent", weight: 1 },
      { term: "whatsapp", weight: 1 },
      { term: "respond", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `The questions reaching your team are often repetitive and answerable from data you already hold: order status, stock, lead times, documents, policies. Each one still needs a person to look something up in ${systemClause(
        ctx.systems,
        "a system"
      )} and type a reply.${volumeNote(
        ctx
      )} An assistant that answers from your records, and hands over to a person when it isn't sure, can deal with the routine ones.`,
    blueprint: [
      {
        step: "Connect your data",
        detail:
          "The assistant reads live order, stock and shipment data plus your documents, so answers come from the system of record.",
      },
      {
        step: "Stop it guessing",
        detail:
          "Every answer points to the record it came from. When the data doesn't support an answer, the question goes to a person.",
      },
      {
        step: "Put it where people ask",
        detail: "Website, WhatsApp, Teams or your portal, with sign-in so customers only see their own data.",
      },
      {
        step: "Improve from real use",
        detail: "Conversations are logged and reviewed, and weak answers become the next round of fixes.",
      },
    ],
    stack: ["Claude API", "Search over your data", "Order / stock API layer", "Web, WhatsApp or Teams", "Conversation logs"],
    outcomes: [
      { metric: "Routine questions", label: "answered without waiting for a person" },
      { metric: "Out of hours", label: "replies when your team is offline" },
      { metric: "Every answer", label: "logged and traceable to its source" },
    ],
    followUp:
      "Export a few hundred recent customer questions. They show quickly which ones an assistant can answer safely.",
  },

  /* ── Supply chain, logistics & operations ────────────────── */
  {
    id: "inventory",
    title: "Stock alerts that arrive before the stockout",
    packageId: "data-flow-reporting",
    keywords: [
      { term: "inventory", weight: 3 },
      { term: "stock out", weight: 3 },
      { term: "stockout", weight: 3 },
      { term: "stock level", weight: 3 },
      { term: "reorder", weight: 3 },
      { term: "safety stock", weight: 3 },
      { term: "replenish", weight: 3 },
      { term: "excess stock", weight: 2 },
      { term: "dead stock", weight: 2 },
      { term: "obsolete", weight: 2 },
      { term: "shortage", weight: 2 },
      { term: "run out", weight: 2 },
      { term: "min max", weight: 2 },
      { term: "min/max", weight: 2 },
      { term: "cycle count", weight: 2 },
      { term: "stock", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Reorder points are usually fixed while demand and lead times keep changing, so a min/max table set once a quarter is soon out of date.${
        ctx.systems.length
          ? ` The data is already in ${systemClause(ctx.systems, "your systems")}; it just isn't read often enough.`
          : ""
      }${volumeNote(
        ctx,
        "which is more than anyone can recalculate by hand"
      )} Recalculating every night, and sending alerts early enough to act on, deals with most of it.`,
    blueprint: [
      {
        step: "One stock picture",
        detail:
          "On-hand, on-order, in-transit and allocated stock from every location in one view, with mismatches flagged.",
      },
      {
        step: "Reorder points that move",
        detail: "Safety stock and reorder points recalculate from actual demand and supplier lead times.",
      },
      {
        step: "Alerts with a suggestion",
        detail: "Buyers get a morning summary of what to order, how much and from whom, with a draft PO ready.",
      },
      {
        step: "Slow stock made visible",
        detail: "A dashboard shows ageing and slow-moving stock, and the cash tied up in it.",
      },
    ],
    stack: ["Power Automate", "Python", "Excel planning tools", "Power BI", "ERP connector"],
    outcomes: [
      { metric: "Fewer stockouts", label: "because alerts arrive earlier" },
      { metric: "Less excess", label: "as reorder points follow real demand" },
      { metric: "Daily", label: "reorder points instead of quarterly" },
    ],
    followUp: "Bring 12 months of demand history and your current min/max table to the first call.",
  },
  {
    id: "forecasting",
    title: "A demand forecast your planners can trust",
    packageId: "data-flow-reporting",
    keywords: [
      { term: "forecast", weight: 3 },
      { term: "demand plan", weight: 3 },
      { term: "s&op", weight: 3 },
      { term: "sales and operations", weight: 3 },
      { term: "seasonality", weight: 3 },
      { term: "predict", weight: 2 },
      { term: "planning", weight: 2 },
      { term: "capacity plan", weight: 2 },
      { term: "mrp", weight: 2 },
      { term: "budget", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Forecasts often fail because the process is manual: someone exports history, builds a spreadsheet model, and the number is out of date by the planning meeting.${
        ctx.systems.length ? ` Your history is already in ${systemClause(ctx.systems, "your systems")}.` : ""
      } A baseline that refreshes on its own, with a clear place for planners' adjustments, is quicker to produce and easier to check.`,
    blueprint: [
      {
        step: "Build a baseline",
        detail: "Statistical models for trend and seasonality, tested against your own history so accuracy is measured.",
      },
      {
        step: "Keep planners in control",
        detail: "Planners adjust in an Excel-style grid, and every change is recorded with a reason.",
      },
      {
        step: "Agree one number",
        detail: "Sales, operations and finance views come together in one plan, with the assumptions visible.",
      },
      {
        step: "Use it downstream",
        detail: "The agreed forecast feeds replenishment and capacity planning directly.",
      },
    ],
    stack: ["Python", "Excel planner front end", "Power BI", "Power Automate", "ERP connector"],
    outcomes: [
      { metric: "Measured", label: "accuracy, tested on your own history" },
      { metric: "Fresh baseline", label: "before every planning meeting" },
      { metric: "One plan", label: "shared by sales, operations and finance" },
    ],
    followUp: "Bring 24 months of demand history to the first call, and we'll talk through how to test a forecast against it.",
  },
  {
    id: "logistics-tracking",
    title: "Shipment status that updates itself",
    packageId: "connect",
    keywords: [
      { term: "shipment", weight: 3 },
      { term: "freight", weight: 3 },
      { term: "carrier", weight: 3 },
      { term: "container", weight: 3 },
      { term: "bill of lading", weight: 3 },
      { term: "track and trace", weight: 3 },
      { term: "where is my shipment", weight: 3 },
      { term: " eta ", weight: 3 },
      { term: " etas ", weight: 3 },
      { term: "tracking", weight: 2 },
      { term: "logistics", weight: 2 },
      { term: "delivery", weight: 2 },
      { term: "deliveries", weight: 2 },
      { term: "transport", weight: 2 },
      { term: "last mile", weight: 2 },
      { term: "in transit", weight: 2 },
      { term: "forwarder", weight: 2 },
      { term: " port ", weight: 1 },
      { term: " ports ", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Someone usually spends part of each day logging into carrier and forwarder portals, copying ETAs into a tracker and answering "where is it?" emails.${
        ctx.systems.length
          ? ` With ${systemClause(ctx.systems, "several portals")} involved, that's a lot of manual checking.`
          : ""
      }${volumeNote(
        ctx
      )} The data is already in those portals; it needs collecting automatically and sending to whoever deals with delays.`,
    blueprint: [
      {
        step: "Collect from every carrier",
        detail: "Carrier APIs where they exist, EDI where it's set up, and portal or email reading where it isn't.",
      },
      {
        step: "Spot delays early",
        detail: "Predicted and promised dates are compared, so late shipments are flagged before anyone asks.",
      },
      {
        step: "Tell the right people",
        detail: "Your team gets exception alerts in Teams or email, and customers can get status updates automatically.",
      },
      {
        step: "Measure carriers",
        detail: "A scorecard tracks on-time performance and cost by carrier and lane.",
      },
    ],
    stack: ["Power Automate", "Carrier APIs / EDI", "Browser automation", "Power BI", "Email / WhatsApp"],
    outcomes: [
      { metric: "Less portal checking", label: "with status collected automatically" },
      { metric: "Earlier warning", label: "on shipments running late" },
      { metric: "Fewer", label: "“where is my order?” emails" },
    ],
    followUp:
      "List your main carriers and forwarders. We'll check which have usable APIs and which need another route.",
  },
  {
    id: "warehouse",
    title: "Warehouse work recorded as it happens",
    packageId: "web-business-apps",
    keywords: [
      { term: "warehouse", weight: 3 },
      { term: "picking", weight: 3 },
      { term: "receiving", weight: 3 },
      { term: "putaway", weight: 3 },
      { term: "barcode", weight: 3 },
      { term: "scanner", weight: 3 },
      { term: "rfid", weight: 3 },
      { term: "wms", weight: 3 },
      { term: "packing", weight: 2 },
      { term: "dispatch", weight: 2 },
      { term: "goods in", weight: 2 },
      { term: "stock count", weight: 2 },
      { term: "labour", weight: 1 },
      { term: "labor", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Warehouse waste is often about information: paper pick lists, counts written down and typed in later, and no clear view of the shift until it ends.${
        ctx.systems.length
          ? ` ${systemClause(ctx.systems, "Your systems")} hold part of the picture, but not in real time.`
          : ""
      } You rarely need to replace the WMS; closing the gaps around it is usually enough.`,
    blueprint: [
      {
        step: "Capture on the floor",
        detail: "Simple mobile apps for receiving, putaway, picking and counts, driven by barcodes.",
      },
      {
        step: "Stop the retyping",
        detail: "Scans post straight to the ERP or WMS, so stock figures are current.",
      },
      {
        step: "See the shift live",
        detail: "A board shows picks per hour and open work by zone, so supervisors can move people during the shift.",
      },
      {
        step: "Count without stopping",
        detail: "Cycle counts are scheduled by how fast items move, instead of one annual stocktake.",
      },
    ],
    stack: ["Mobile web app or Power Apps", "Barcode / RFID", "WMS and ERP connectors", "Power Automate", "Power BI"],
    outcomes: [
      { metric: "Current stock", label: "figures throughout the shift" },
      { metric: "Fewer errors", label: "from paper and retyping" },
      { metric: "Live view", label: "of the shift's progress" },
    ],
    followUp: "Walk us through one receiving-to-dispatch cycle on the first call.",
  },
  {
    id: "documents",
    title: "Trade documents read, checked and filed automatically",
    packageId: "ai-agents",
    keywords: [
      { term: "paperwork", weight: 3 },
      { term: "customs", weight: 3 },
      { term: "packing list", weight: 3 },
      { term: "certificate of origin", weight: 3 },
      { term: "bill of lading", weight: 3 },
      { term: "commercial invoice", weight: 3 },
      { term: "hs code", weight: 3 },
      { term: "compliance check", weight: 3 },
      { term: "declaration", weight: 2 },
      { term: "document", weight: 2 },
      { term: "scan", weight: 2 },
      { term: "filing", weight: 2 },
      { term: "manual review", weight: 2 },
      { term: "import", weight: 1 },
      { term: "export", weight: 1 },
      { term: "pdf", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Trade documents are usually checked by hand, and one field that doesn't match between the commercial invoice, packing list and bill of lading can hold a shipment.${
        ctx.systems.length
          ? ` Documents arriving through ${systemClause(ctx.systems, "email")} make that harder to keep consistent.`
          : ""
      } AI can read the whole set and cross-check it before submission, while a fix is still cheap.`,
    blueprint: [
      {
        step: "Read every document",
        detail: "Invoices, packing lists, bills of lading, certificates of origin and declarations, scans included.",
      },
      {
        step: "Cross-check the set",
        detail: "Values, weights, HS codes and quantities are compared across the file, and differences are flagged.",
      },
      {
        step: "Check the rules",
        detail: "HS-code checks and destination requirements run on every file.",
      },
      {
        step: "File it properly",
        detail: "Documents are named and filed to SharePoint with a record of who checked what.",
      },
    ],
    stack: ["Document AI", "Claude API", "Power Automate", "SharePoint", "Rule checks"],
    outcomes: [
      { metric: "Faster checks", label: "on every shipment file" },
      { metric: "Fewer holds", label: "caused by mismatched documents" },
      { metric: "Findable", label: "documents, filed with a record" },
    ],
    followUp: "Bring a sample shipment file (redacted is fine) to the first call.",
  },

  /* ── Data, reporting & Excel ─────────────────────────────── */
  {
    id: "master-data",
    title: "Master data you can trust: one code, one record",
    packageId: "data-flow-reporting",
    keywords: [
      { term: "master data", weight: 3 },
      { term: "data quality", weight: 3 },
      { term: "duplicate", weight: 3 },
      { term: "different format", weight: 3 },
      { term: "nothing matches", weight: 3 },
      { term: "data everywhere", weight: 3 },
      { term: "data is everywhere", weight: 3 },
      { term: "data clean", weight: 3 },
      { term: "clean data", weight: 3 },
      { term: "clean up", weight: 2 },
      { term: "cleans", weight: 3 },
      { term: "material master", weight: 3 },
      { term: "customer master", weight: 3 },
      { term: "vendor master", weight: 3 },
      { term: "single source of truth", weight: 3 },
      { term: "inconsistent", weight: 2 },
      { term: "doesn't match", weight: 2 },
      { term: "doesnt match", weight: 2 },
      { term: "don't match", weight: 2 },
      { term: "dont match", weight: 2 },
      { term: "mismatch", weight: 2 },
      { term: "scattered", weight: 2 },
      { term: "item code", weight: 2 },
      { term: "customer code", weight: 2 },
      { term: "supplier code", weight: 2 },
      { term: "naming", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `When the same customer, item or supplier exists under several codes and spellings, every report and integration inherits the mess.${
        ctx.systems.length
          ? ` With records spread across ${systemClause(ctx.systems, "several systems")}, nobody is sure which one is right.`
          : ""
      }${volumeNote(
        ctx
      )} A one-off clean-up helps; rules that stop the data drifting back are what make it last.`,
    blueprint: [
      {
        step: "Measure the problem",
        detail: "We profile your records to find duplicates, gaps and conflicting values, so you know how big it is.",
      },
      {
        step: "Clean and merge",
        detail: "Duplicates are matched and merged with rules you approve, keeping a record of every change.",
      },
      {
        step: "Agree the owner",
        detail: "Each field gets a source system and an owner, so it's clear which value wins.",
      },
      {
        step: "Check at entry",
        detail: "Validation and simple approval steps stop new bad data getting in.",
      },
    ],
    stack: ["Python", "SQL", "Power Query", "Power Automate", "ERP / CRM connectors"],
    outcomes: [
      { metric: "One record", label: "per customer, item or supplier" },
      { metric: "Reports agree", label: "because they read the same data" },
      { metric: "Stays clean", label: "with checks at the point of entry" },
    ],
    followUp: "Bring an export of the records you trust least to the first call.",
  },
  {
    id: "excel-rebuild",
    title: "Heavy, fragile Excel files rebuilt so they stay reliable",
    packageId: "data-flow-reporting",
    keywords: [
      { term: "formula", weight: 3 },
      { term: "vlookup", weight: 3 },
      { term: "xlookup", weight: 3 },
      { term: "index match", weight: 3 },
      { term: "nested if", weight: 3 },
      { term: "workbook", weight: 3 },
      { term: "heavy file", weight: 3 },
      { term: "heavy excel", weight: 3 },
      { term: "crash", weight: 3 },
      { term: "corrupt", weight: 3 },
      { term: "one person understands", weight: 3 },
      { term: "only one person", weight: 2 },
      { term: "freez", weight: 2 },
      { term: "unstable", weight: 2 },
      { term: "file size", weight: 2 },
      { term: "too big", weight: 2 },
      { term: "links break", weight: 2 },
      { term: "excel", weight: 2 },
      { term: "spreadsheet", weight: 2 },
      { term: "macro", weight: 2 },
      { term: "vba", weight: 2 },
      { term: "slow", weight: 1 },
      { term: "pivot", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Workbooks grow one formula at a time until they're slow to open, break easily, and only one person understands them.${volumeNote(
        ctx,
        "and every extra row makes the file heavier"
      )} Moving the data handling out of nested formulas into a proper data flow keeps the familiar Excel front end and removes most of the breakage.`,
    blueprint: [
      {
        step: "Map the workbook",
        detail: "We trace where the data comes from, which formulas matter and which are workarounds.",
      },
      {
        step: "Move the heavy lifting",
        detail: "Lookups and transformations move into Power Query, a database or VBA, so the file stops recalculating everything.",
      },
      {
        step: "Add checks",
        detail: "Validation rules catch missing or wrong data before it reaches the totals.",
      },
      {
        step: "Write it down",
        detail: "The rebuilt file is documented, so it no longer depends on one person.",
      },
    ],
    stack: ["Power Query", "Excel / VBA", "SQL", "Power Automate", "Power BI"],
    outcomes: [
      { metric: "Quicker files", label: "that open and recalculate without the wait" },
      { metric: "Fewer broken", label: "formulas and links" },
      { metric: "Documented", label: "so more than one person can run it" },
    ],
    followUp: "Bring the workbook, or a copy with dummy data, to the first call.",
  },
  {
    id: "reporting",
    title: "Reports that build themselves on schedule",
    packageId: "data-flow-reporting",
    keywords: [
      { term: "report", weight: 3 },
      { term: "dashboard", weight: 3 },
      { term: "consolidat", weight: 3 },
      { term: "same report", weight: 3 },
      { term: "monthly report", weight: 3 },
      { term: "weekly report", weight: 3 },
      { term: "management report", weight: 3 },
      { term: "board pack", weight: 3 },
      { term: "kpi", weight: 2 },
      { term: "compile", weight: 2 },
      { term: "rebuild", weight: 2 },
      { term: "bi ", weight: 2 },
      { term: "pivot", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Manual reporting costs more than the hours: decisions wait while the file is being built. Pulling exports from ${systemClause(
        ctx.systems,
        "several systems"
      )}, joining them and fixing the formatting is some of the most automatable work in any team.${volumeNote(
        ctx,
        "and that time comes back every cycle once it's automated"
      )} It's low-risk and easy to see, which makes it a good first project.`,
    blueprint: [
      {
        step: "Automate the exports",
        detail: "Scheduled flows pull from each source system, with an alert if a source fails.",
      },
      {
        step: "Clean and combine once",
        detail: "The joins, mappings and fixes your team does by hand become rules, with checks that flag odd numbers.",
      },
      {
        step: "Publish in the right format",
        detail: "Power BI for people who explore the data, a formatted Excel or PDF for people who want the file.",
      },
      {
        step: "Keep the Excel that works",
        detail: "Where a workbook is the right tool, we rebuild it properly instead of replacing it.",
      },
    ],
    stack: ["Power Automate", "Power Query", "Excel / VBA", "Power BI", "SQL"],
    outcomes: [
      { metric: "Less rework", label: "every reporting cycle" },
      { metric: "Ready on time", label: "before the meeting starts" },
      { metric: "No copy-paste", label: "errors between files" },
    ],
    followUp: "Bring one report you rebuild every week or month. It's usually the best place to start.",
  },
  {
    id: "manual-tasks",
    title: "Repetitive tasks turned into one-click workflows",
    packageId: "automate",
    keywords: [
      { term: "data entry", weight: 3 },
      { term: "copy paste", weight: 3 },
      { term: "copy and paste", weight: 3 },
      { term: "copy-paste", weight: 3 },
      { term: "copy-pasting", weight: 3 },
      { term: "copying and pasting", weight: 3 },
      { term: "repetitive", weight: 3 },
      { term: "same email", weight: 3 },
      { term: "email automation", weight: 3 },
      { term: "every single day", weight: 3 },
      { term: "renam", weight: 3 },
      { term: "manually", weight: 2 },
      { term: "by hand", weight: 2 },
      { term: "re-key", weight: 2 },
      { term: "rekey", weight: 2 },
      { term: "retyp", weight: 2 },
      { term: "re-typ", weight: 2 },
      { term: "download", weight: 2 },
      { term: "upload", weight: 2 },
      { term: "attachment", weight: 2 },
      { term: "send emails", weight: 2 },
      { term: "sending emails", weight: 2 },
      { term: "tedious", weight: 2 },
      { term: "routine task", weight: 2 },
      { term: "one click", weight: 2 },
      { term: "every day", weight: 1 },
      { term: "every morning", weight: 1 },
      { term: "folder", weight: 1 },
      { term: "pdf", weight: 1 },
      { term: "vba", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `When the same steps happen every day (open the file, copy the data, rename it, save it, update the tracker, send the email) they can usually run as one workflow inside ${systemClause(
        ctx.systems,
        "the tools you already use"
      )}.${volumeNote(
        ctx
      )} Your process stays the same, and a person only steps in when something looks wrong.`,
    blueprint: [
      {
        step: "Follow the task once",
        detail: "We watch the task with whoever does it, including the workarounds nobody wrote down.",
      },
      {
        step: "Automate the routine",
        detail: "Files are read, renamed and filed, data is entered and emails are sent by a workflow.",
      },
      {
        step: "Set aside the odd ones",
        detail: "Anything that doesn't fit the rules is put aside for a person, with the reason.",
      },
      {
        step: "Hand it over",
        detail: "You get a one-click or scheduled workflow, documented and running in your own environment.",
      },
    ],
    stack: ["Power Automate", "Excel / VBA", "Python", "Outlook", "SharePoint / OneDrive"],
    outcomes: [
      { metric: "One click", label: "or none, for scheduled tasks" },
      { metric: "Fewer slips", label: "from typing the same data twice" },
      { metric: "Time back", label: "for whoever does it now" },
    ],
    followUp: "Pick the task your team repeats most and walk us through it on the first call.",
  },

  /* ── Building, rescuing and running systems ──────────────── */
  {
    id: "project-rescue",
    title: "A stalled project assessed, fixed and taken live",
    packageId: "project-rescue",
    keywords: [
      { term: "stuck", weight: 3 },
      { term: "stalled", weight: 3 },
      { term: "half-built", weight: 3 },
      { term: "half built", weight: 3 },
      { term: "unfinished", weight: 3 },
      { term: "not finished", weight: 3 },
      { term: "never finished", weight: 3 },
      { term: "developer left", weight: 3 },
      { term: "freelancer left", weight: 3 },
      { term: "vendor left", weight: 3 },
      { term: "previous developer", weight: 3 },
      { term: "previous vendor", weight: 3 },
      { term: "abandoned", weight: 3 },
      { term: "can't deploy", weight: 3 },
      { term: "cant deploy", weight: 3 },
      { term: "cannot deploy", weight: 3 },
      { term: "won't deploy", weight: 3 },
      { term: "wont deploy", weight: 3 },
      { term: "throws errors", weight: 3 },
      { term: "nobody maintains", weight: 3 },
      { term: "no one maintains", weight: 3 },
      { term: "rescue", weight: 3 },
      { term: "take over", weight: 3 },
      { term: "takeover", weight: 3 },
      { term: "deploy", weight: 2 },
      { term: "keeps failing", weight: 2 },
      { term: "keeps breaking", weight: 2 },
      { term: "not working", weight: 2 },
      { term: "doesn't work", weight: 2 },
      { term: "doesnt work", weight: 2 },
      { term: "prototype", weight: 2 },
      { term: "broken", weight: 2 },
      { term: "bug", weight: 2 },
      { term: "source code", weight: 2 },
      { term: "error", weight: 1 },
      { term: "pending", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Projects usually stall for a handful of reasons: the developer or vendor left, the scope kept growing, or the build works on one machine and nowhere else.${
        ctx.systems.length ? ` We'd start with what's already built on ${systemClause(ctx.systems, "your stack")}.` : ""
      } What exists is usually worth assessing before anyone starts again. We work out why it stopped, fix what's broken, finish it and get it live.`,
    blueprint: [
      {
        step: "Assess",
        detail: "We review the code, the environment, the documents and what was promised, and tell you what state it's really in.",
      },
      {
        step: "Diagnose and fix",
        detail: "We find out why it fails or stalled, fix the errors and make it run reliably.",
      },
      {
        step: "Complete and improve",
        detail: "We build the missing parts and tidy up what would cause trouble later.",
      },
      {
        step: "Deploy and hand over",
        detail: "We take it live in your environment and hand over the source and documentation.",
      },
    ],
    stack: ["Code and environment review", "Your existing stack", "Testing", "Deployment", "Documentation"],
    outcomes: [
      { metric: "A clear view", label: "of what exists and what's missing" },
      { metric: "Live", label: "and running in your own environment" },
      { metric: "Yours", label: "code, access and documentation" },
    ],
    followUp: "Bring whatever exists: repository access, the original brief and any documentation.",
  },
  {
    id: "web-app",
    title: "A proper web app for work that has outgrown Excel",
    packageId: "web-business-apps",
    keywords: [
      { term: "outgrown", weight: 3 },
      { term: "outgrew", weight: 3 },
      { term: "web app", weight: 3 },
      { term: "web application", weight: 3 },
      { term: "internal tool", weight: 3 },
      { term: "customer portal", weight: 3 },
      { term: "employee portal", weight: 3 },
      { term: "approval system", weight: 3 },
      { term: "booking system", weight: 3 },
      { term: "tracking system", weight: 3 },
      { term: "order management", weight: 3 },
      { term: "proper system", weight: 3 },
      { term: "build a system", weight: 3 },
      { term: "build an app", weight: 3 },
      { term: "shared excel", weight: 3 },
      { term: "portal", weight: 2 },
      { term: "app ", weight: 2 },
      { term: "apps ", weight: 2 },
      { term: "application", weight: 2 },
      { term: "approval workflow", weight: 2 },
      { term: "database", weight: 2 },
      { term: "shared file", weight: 2 },
      { term: "same file", weight: 2 },
      { term: "multiple users", weight: 2 },
      { term: "access rights", weight: 2 },
      { term: "login", weight: 1 },
      { term: "search", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Shared spreadsheets work until several people need to edit, search and approve the same data at once. Then versions multiply and nobody is sure which file is current.${
        ctx.systems.length
          ? ` A purpose-built app can sit alongside ${systemClause(ctx.systems, "your current tools")} and read from them.`
          : ""
      } One web app with proper logins, a database and approval steps gives your team, or your customers, one place to work.`,
    blueprint: [
      {
        step: "Agree the workflow",
        detail: "Who does what, who approves, and what each person needs to see.",
      },
      {
        step: "Design the data",
        detail: "A proper database replaces the shared files, and your existing data is moved across.",
      },
      {
        step: "Build the app",
        detail: "A web app with logins, search, forms and approval steps that works on desktop and phone.",
      },
      {
        step: "Connect and launch",
        detail: "Links to Excel, email or your ERP where needed, then training and handover.",
      },
    ],
    stack: ["Web app", "SQL database", "Logins and roles", "Email / ERP connectors", "Dashboards"],
    outcomes: [
      { metric: "One version", label: "of the data, always current" },
      { metric: "Clear approvals", label: "with a record of who approved what" },
      { metric: "Access control", label: "so people see what they need" },
    ],
    followUp: "Bring the spreadsheets or forms the app would replace to the first call.",
  },
  {
    id: "custom-solution",
    title: "One solution for a problem that spans teams and systems",
    packageId: "custom-development",
    keywords: [
      { term: "multiple departments", weight: 3 },
      { term: "several departments", weight: 3 },
      { term: "different departments", weight: 3 },
      { term: "across departments", weight: 3 },
      { term: "cross-department", weight: 3 },
      { term: "company-wide", weight: 3 },
      { term: "company wide", weight: 3 },
      { term: "digital transformation", weight: 3 },
      { term: "custom solution", weight: 3 },
      { term: "custom system", weight: 3 },
      { term: "bespoke", weight: 3 },
      { term: "which technology", weight: 3 },
      { term: "which tool", weight: 2 },
      { term: "end-to-end", weight: 2 },
      { term: "end to end", weight: 2 },
      { term: "enterprise", weight: 2 },
      { term: "subsidiar", weight: 2 },
      { term: "group companies", weight: 2 },
      { term: "multiple systems", weight: 2 },
      { term: "several systems", weight: 2 },
      { term: "many systems", weight: 2 },
      { term: "complex", weight: 2 },
      { term: "full picture", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `When a problem crosses several departments and systems, fixing one piece at a time tends to move the bottleneck rather than remove it.${
        ctx.systems.length > 1
          ? ` With ${systemClause(ctx.systems, "several systems")} involved, the design matters as much as the build.`
          : ""
      } We look at the whole process first, then combine what's needed (automation, integration, a database, an app or an AI layer) into one solution.`,
    blueprint: [
      {
        step: "Understand the problem",
        detail: "Sessions with each team involved, to map the full process and where it breaks.",
      },
      {
        step: "Design the solution",
        detail: "One design covering systems, data and people, with a phased plan and costs.",
      },
      {
        step: "Build and integrate",
        detail: "Delivered in phases, each usable on its own, connected to the systems you keep.",
      },
      {
        step: "Deploy",
        detail: "Rolled out team by team, with training and monitoring after launch.",
      },
    ],
    stack: ["Integration layer", "Database", "Web app", "AI agents", "Dashboards"],
    outcomes: [
      { metric: "One design", label: "instead of disconnected fixes" },
      { metric: "Phased", label: "so each phase is useful on its own" },
      { metric: "Fits your stack", label: "and the tools you keep" },
    ],
    followUp: "Bring a rough map of the teams and systems involved to the first call.",
  },
  {
    id: "integration",
    title: "Systems that pass data to each other, with nobody in between",
    packageId: "connect",
    keywords: [
      { term: "integration", weight: 3 },
      { term: "integrate", weight: 3 },
      { term: "sync", weight: 3 },
      { term: "two systems", weight: 3 },
      { term: "different systems", weight: 3 },
      { term: "between systems", weight: 3 },
      { term: "talk to each other", weight: 3 },
      { term: "silo", weight: 3 },
      { term: "webhook", weight: 3 },
      { term: "api", weight: 2 },
      { term: "erp", weight: 2 },
      { term: "connect", weight: 2 },
      { term: "move data", weight: 2 },
      { term: "migrat", weight: 2 },
      { term: "edi ", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `When two systems don't share data, a person becomes the link between them, and that's where delays and typing errors come in.${
        ctx.systems.length > 1
          ? ` You've named ${systemClause(ctx.systems, "several systems")}, which is the kind of setup where a proper connection pays off.`
          : ""
      } Replacing systems is rarely necessary. A monitored sync, with clear rules about which system owns each field, usually does the job.`,
    blueprint: [
      {
        step: "Map the data",
        detail: "What each system holds, where the same record exists twice, and which system is the source for each field.",
      },
      {
        step: "Build the connection",
        detail: "APIs where they exist, EDI where it's standard, and file or browser automation where there's no other way in.",
      },
      {
        step: "Plan for failure",
        detail: "Retries and alerts that tell a named person what broke, so a failed sync never goes unnoticed.",
      },
      {
        step: "Keep it consistent",
        detail: "Duplicate checks and validation keep the connected data in step.",
      },
    ],
    stack: ["Power Automate", "APIs / webhooks", "Python", "SQL", "Monitoring and alerts"],
    outcomes: [
      { metric: "No retyping", label: "between connected systems" },
      { metric: "Same-day data", label: "instead of weekly uploads" },
      { metric: "Monitored", label: "every sync, with alerts" },
    ],
    followUp:
      "Tell us which systems need to share data and in which direction. That's the basis for a fixed quote.",
  },
  {
    id: "support",
    title: "Someone to look after your automations after launch",
    packageId: "support",
    keywords: [
      { term: "maintenance", weight: 3 },
      { term: "ongoing support", weight: 3 },
      { term: "support contract", weight: 3 },
      { term: "retainer", weight: 3 },
      { term: "after launch", weight: 3 },
      { term: "after go-live", weight: 3 },
      { term: "keep it running", weight: 3 },
      { term: "who maintains", weight: 3 },
      { term: "maintain", weight: 2 },
      { term: "monitoring", weight: 2 },
      { term: "enhancement", weight: 2 },
      { term: "new features", weight: 2 },
      { term: "already built", weight: 2 },
      { term: "monitor", weight: 1 },
      { term: "updates", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Automations and apps need looking after: systems update, files change format, and new requests keep coming.${
        ctx.systems.length
          ? ` With ${systemClause(ctx.systems, "several tools")} involved, a small change upstream can break things quietly.`
          : ""
      } Regular monitoring, plus a set amount of time each month, keeps things working and improving.`,
    blueprint: [
      {
        step: "Review what's running",
        detail: "We document what's in place, including anything built by others, and set up monitoring.",
      },
      {
        step: "Watch and fix",
        detail: "Failures raise an alert and get fixed, usually before users notice.",
      },
      {
        step: "Improve steadily",
        detail: "A monthly list of improvements and new features, agreed with you.",
      },
      {
        step: "Report monthly",
        detail: "A short report of what ran, what failed and what changed.",
      },
    ],
    stack: ["Monitoring and alerts", "Your existing tools", "Version control", "Documentation", "Monthly review"],
    outcomes: [
      { metric: "Fewer surprises", label: "from silent failures" },
      { metric: "Monthly", label: "improvements, agreed with you" },
      { metric: "One contact", label: "who knows your setup" },
    ],
    followUp: "Bring a list of what's running today and who built it.",
  },
  {
    id: "training",
    title: "Training your team to automate their own work",
    packageId: "training",
    keywords: [
      { term: "train", weight: 3 },
      { term: "teach", weight: 3 },
      { term: "workshop", weight: 3 },
      { term: "upskill", weight: 3 },
      { term: "do it ourselves", weight: 3 },
      { term: "learn", weight: 2 },
      { term: "training course", weight: 2 },
      { term: "self-sufficient", weight: 2 },
      { term: "in-house", weight: 1 },
    ],
    diagnosis: () =>
      "Teams that understand what's worth automating find quick wins on their own and keep improving after a project ends. Training works best on your own files and processes, so what people practise on is something they'll use the next day.",
    blueprint: [
      {
        step: "Spot the candidates",
        detail: "How to recognise tasks worth automating, and the ones that aren't.",
      },
      {
        step: "Prepare the data",
        detail: "Master data basics: consistent codes, clean lists and simple validation.",
      },
      {
        step: "Use the tools",
        detail: "Hands-on use of the automation tools you already have, in daily work.",
      },
      {
        step: "Practise on your own work",
        detail: "Sessions built around your own files, so the result is something you keep.",
      },
    ],
    stack: ["Excel / Power Query", "Power Automate", "Your own files", "Short guides", "Follow-up sessions"],
    outcomes: [
      { metric: "Quick wins", label: "your team can build themselves" },
      { metric: "A shared approach", label: "to spotting what's worth automating" },
      { metric: "Your own files", label: "used as the course material" },
    ],
    followUp: "Tell us who would attend and which tools they use day to day.",
  },
];

/* ───────────────────────── Fallback ───────────────────────── */

const FALLBACK: Omit<Playbook, "keywords"> = {
  id: "general",
  title: "Start with an Automation Audit",
  packageId: "automation-audit",
  diagnosis: (ctx) =>
    `Thanks, that's a start.${
      ctx.systems.length
        ? ` You're working across ${systemClause(ctx.systems, "several tools")}, which usually means the friction is in the handovers between them.`
        : ""
    } Most processes we see follow the same shape: information arrives in a messy form, a person tidies it up, and a system uses it. An Automation Audit looks at your files, systems and manual steps, and tells you what's worth automating first.`,
  blueprint: [
    {
      step: "Understand the process",
      detail: "A working session on one process, including the workarounds that aren't written down.",
    },
    {
      step: "Look at files and systems",
      detail: "Where the data comes from, where it goes and where it's typed in again.",
    },
    {
      step: "Find the bottlenecks",
      detail: "Where time and errors build up, measured with your own numbers.",
    },
    {
      step: "Recommend",
      detail: "What to automate, the time it should save and which technology fits, including what isn't worth automating.",
    },
  ],
  stack: ["Your existing tools", "Process walkthrough", "Written recommendation"],
  outcomes: [
    { metric: "A clear list", label: "of what's worth automating" },
    { metric: "Time saving", label: "estimated for each item" },
    { metric: "Straight advice", label: "including what to leave as it is" },
  ],
  followUp:
    "Add a little more detail in the form below, and we'll come to the first call with questions already prepared.",
};

/* ───────────────────────── Scoring ───────────────────────── */

/** Lower-cases, straightens apostrophes and pads with spaces so whole-word terms match at the edges. */
function normalise(input: string): string {
  return ` ${input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\w\s&/'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

const WORD_BOUNDARY = new Set([" ", "-", "/", "'"]);

/**
 * Finds `term` in `text` at the start of a word and returns the visitor's own
 * words it matched ("reconcil" → "reconciling"), or null.
 */
function matchAtWordStart(text: string, term: string): string | null {
  const needle = term.trimStart();
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at === -1) return null;
    if (at === 0 || WORD_BOUNDARY.has(text[at - 1])) {
      const end = text.indexOf(" ", at + needle.trimEnd().length);
      return text.slice(at, end === -1 ? undefined : end).trim();
    }
    from = at + 1;
  }
}

/** Acronyms the matcher sees lower-cased, restored for display ("hr" -> "HR"). */
const ACRONYMS = new Set(["hr", "erp", "crm", "wms", "tms", "edi", "api", "apis", "po", "pos", "rfq", "rfqs", "kpi", "kpis", "ap", "ar", "sap", "pdf", "csv", "vba", "etd", "eta", "sku", "skus", "ai"]);

function displaySignal(phrase: string): string {
  return phrase
    .split(" ")
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w))
    .join(" ");
}

export function generateSolution(rawInput: string): SolutionResult {
  const input = rawInput.trim();
  const text = normalise(input);

  const systems = detectSystems(text);
  const ctx: MatchContext = { systems, volumePhrase: detectVolume(input) };

  // Score every playbook; collect the phrases that drove each match.
  const scored = PLAYBOOKS.map((pb) => {
    let score = 0;
    const signals: string[] = [];

    for (const { term, weight } of pb.keywords) {
      const words = matchAtWordStart(text, term);
      if (words === null) continue;
      score += weight;
      // Keep the longest phrasing: "bank statements" covers "statements".
      if (!words || signals.some((s) => s.includes(words))) continue;
      for (let i = signals.length - 1; i >= 0; i--) {
        if (words.includes(signals[i])) signals.splice(i, 1);
      }
      signals.push(words);
    }

    return { pb, score, signals };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];

  // Below this, a match is coincidence rather than signal.
  const MIN_SCORE = 3;

  if (!input || input.length < 12 || !best || best.score < MIN_SCORE) {
    const confidence = 0.42;
    return {
      ...FALLBACK,
      diagnosis: FALLBACK.diagnosis(ctx),
      confidence,
      matchStrength: matchStrengthLabel(confidence),
      signals: [],
      systems,
    };
  }

  // Confidence: absolute strength, nudged by how clearly it beat the runner-up.
  const separation = runnerUp ? best.score - runnerUp.score : best.score;
  const raw = 0.55 + Math.min(best.score, 12) * 0.026 + Math.min(separation, 6) * 0.022;
  const confidence = Math.min(0.97, Number(raw.toFixed(2)));

  const { pb, signals } = best;

  return {
    id: pb.id,
    title: pb.title,
    packageId: pb.packageId,
    confidence,
    matchStrength: matchStrengthLabel(confidence),
    diagnosis: pb.diagnosis(ctx),
    blueprint: pb.blueprint,
    stack: pb.stack,
    outcomes: pb.outcomes,
    followUp: pb.followUp,
    signals: signals.slice(0, 5).map(displaySignal),
    systems,
  };
}

/** Plain-language strength, so the score is never shown as a precise number. */
export function matchStrengthLabel(confidence: number): string {
  if (confidence >= 0.8) return "Strong match";
  if (confidence >= 0.65) return "Good match";
  if (confidence >= 0.5) return "Partial match";
  return "General starting point";
}

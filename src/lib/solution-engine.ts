/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SCM SOLUTION ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Turns a free-text description of a supply-chain bottleneck into a scoped
 * solution outline: diagnosis, build blueprint, stack, expected outcomes.
 *
 * Deterministic and dependency-free — runs instantly, costs nothing, and works
 * offline. Weighted keyword scoring across domain playbooks, plus detection of
 * the systems and volume signals the visitor mentions so the reply quotes their
 * own context back to them.
 *
 * ── SWAPPING IN A REAL MODEL ────────────────────────────────────────────────
 * `generateSolution()` is the single seam. To back it with Claude instead:
 *   1. Create src/app/api/solution/route.ts that calls the Anthropic API and
 *      returns JSON matching the `SolutionResult` shape below.
 *   2. In PromptConsole.tsx, replace the `generateSolution(input)` call with a
 *      `fetch("/api/solution", …)`, keeping this function as the fallback for
 *      errors, rate limits, or a missing API key.
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

export type SolutionResult = {
  id: string;
  title: string;
  /** 0–1, drives the "match strength" meter in the UI. */
  confidence: number;
  diagnosis: string;
  blueprint: BlueprintStep[];
  stack: string[];
  outcomes: Outcome[];
  timeline: string;
  followUp: string;
  /** Phrases from the visitor's own input that drove the match. */
  signals: string[];
  /** Named systems detected in the input, echoed back for credibility. */
  systems: string[];
};

type Playbook = {
  id: string;
  title: string;
  /** Weight 3 = decisive domain term, 2 = strong, 1 = supporting. */
  keywords: { term: string; weight: number }[];
  diagnosis: (ctx: MatchContext) => string;
  blueprint: BlueprintStep[];
  stack: string[];
  outcomes: Outcome[];
  timeline: string;
  followUp: string;
};

type MatchContext = {
  systems: string[];
  hasVolume: boolean;
  volumePhrase: string | null;
  mentionsTeamSize: boolean;
  raw: string;
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
  { label: "Excel", patterns: [/\bexcel\b/, /\bspreadsheet/, /\bxlsx?\b/, /\bvba\b/, /\bmacros?\b/, /\bpivot/] },
  { label: "Google Sheets", patterns: [/\bgoogle sheets?\b/, /\bg ?sheets?\b/, /\bapps script\b/] },
  { label: "Outlook", patterns: [/\boutlook\b/, /\bexchange\b/] },
  { label: "Gmail", patterns: [/\bgmail\b/, /\bgoogle workspace\b/] },
  { label: "Microsoft Teams", patterns: [/\bteams\b/, /\bms teams\b/] },
  { label: "Slack", patterns: [/\bslack\b/] },
  { label: "WhatsApp", patterns: [/\bwhats ?app\b/, /\bwa business\b/] },
  { label: "SharePoint", patterns: [/\bsharepoint\b/, /\bonedrive\b/] },
  { label: "Power BI", patterns: [/\bpower ?bi\b/, /\bpowerbi\b/] },
  { label: "Tableau", patterns: [/\btableau\b/] },
  { label: "QuickBooks", patterns: [/\bquickbooks\b/, /\bqbo\b/] },
  { label: "Xero", patterns: [/\bxero\b/] },
  { label: "Shopify", patterns: [/\bshopify\b/, /\bwoocommerce\b/, /\bmagento\b/] },
  { label: "Salesforce", patterns: [/\bsalesforce\b/, /\bhubspot\b/] },
  { label: "EDI", patterns: [/\bedi\b/, /\bx12\b/, /\bedifact\b/, /\bansi 8\d{2}\b/] },
  { label: "WMS", patterns: [/\bwms\b/, /\bwarehouse management\b/] },
  { label: "TMS", patterns: [/\btms\b/, /\btransport management\b/] },
  { label: "3PL portal", patterns: [/\b3pl\b/, /\bthird[- ]party logistics\b/, /\bfreight forwarder\b/] },
  { label: "SQL database", patterns: [/\bsql\b/, /\bdatabase\b/, /\bpostgres\b/, /\bmysql\b/] },
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
  /(\d[\d,.]*)\s*(\+)?\s*(hours?|hrs?|days?|weeks?|people|staff|employees?|fte|orders?|invoices?|pos?|purchase orders?|lines?|skus?|shipments?|containers?|emails?|tickets?|quotes?|rfqs?|per day|per week|per month|a day|a week|a month|%|percent)/i;

function detectVolume(text: string): string | null {
  const match = text.match(VOLUME_PATTERN);
  return match ? match[0].trim() : null;
}

/* ───────────────────────── Playbooks ───────────────────────── */

/** Reads naturally whether we detected 0, 1, or several systems. */
function systemClause(systems: string[], fallback: string): string {
  if (systems.length === 0) return fallback;
  if (systems.length === 1) return systems[0];
  if (systems.length === 2) return `${systems[0]} and ${systems[1]}`;
  return `${systems.slice(0, -1).join(", ")}, and ${systems[systems.length - 1]}`;
}

const PLAYBOOKS: Playbook[] = [
  {
    id: "po-processing",
    title: "Purchase-order intake, automated end to end",
    keywords: [
      { term: "purchase order", weight: 3 },
      { term: "purchase requisition", weight: 3 },
      { term: "po processing", weight: 3 },
      { term: " po ", weight: 2 },
      { term: "requisition", weight: 2 },
      { term: "procurement", weight: 2 },
      { term: "buying", weight: 1 },
      { term: "approval", weight: 2 },
      { term: "approve", weight: 1 },
      { term: "raise order", weight: 2 },
      { term: "order entry", weight: 2 },
      { term: "sourcing", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Purchase-order intake is the classic supply-chain bottleneck: the work is high-volume, rule-driven, and almost never actually needs a human — but it still lands in someone's inbox. From what you've described, orders arrive in ${systemClause(
        ctx.systems,
        "email and spreadsheets"
      )}, get re-keyed by hand, then wait in an approval queue where they're invisible until someone chases them.${
        ctx.volumePhrase
          ? ` At ${ctx.volumePhrase}, that re-keying alone is a full role's worth of capacity.`
          : ""
      } Every one of those steps is automatable, and the approval chain is where you get the fastest visible win.`,
    blueprint: [
      {
        step: "Capture at the source",
        detail:
          "A Power Automate flow watches the shared mailbox and supplier portals, pulls each incoming PO or requisition, and extracts line items, quantities, pricing, and delivery dates with AI document intelligence — PDFs and scans included.",
      },
      {
        step: "Validate before it enters the system",
        detail:
          "Rules check the extracted data against your item master, contracted pricing, and budget limits. Clean orders pass straight through; only genuine exceptions route to a human with the discrepancy already highlighted.",
      },
      {
        step: "Route approvals with a clock on them",
        detail:
          "Approvals go out through Teams or Outlook with one-tap approve/reject, auto-escalation when they age past SLA, and a live status every requester can see — so nobody has to chase.",
      },
      {
        step: "Write back and close the loop",
        detail:
          "The approved order posts into your ERP, the supplier gets an automatic confirmation, and a Power BI board tracks cycle time, exception rate, and spend against contract.",
      },
    ],
    stack: ["Power Automate", "AI Builder / document AI", "Dataverse", "Power BI", "ERP connector"],
    outcomes: [
      { metric: "70–85%", label: "of orders pass through untouched" },
      { metric: "4 days → 6 hrs", label: "typical approval cycle time" },
      { metric: "~99%", label: "line-item accuracy vs. manual entry" },
    ],
    timeline: "4–6 weeks to production, first flow live in ~10 days",
    followUp:
      "Send us 20 real POs (redacted is fine) and your approval matrix — that's enough for us to price the build exactly.",
  },
  {
    id: "invoice-matching",
    title: "Three-way match and AP reconciliation without the keying",
    keywords: [
      { term: "invoice", weight: 3 },
      { term: "three-way match", weight: 3 },
      { term: "3-way match", weight: 3 },
      { term: "accounts payable", weight: 3 },
      { term: " ap ", weight: 2 },
      { term: "billing", weight: 2 },
      { term: "reconcil", weight: 2 },
      { term: "payment", weight: 1 },
      { term: "credit note", weight: 2 },
      { term: "statement", weight: 1 },
      { term: "goods receipt", weight: 2 },
      { term: "grn", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Invoice matching breaks down for a structural reason: the invoice, the PO, and the goods receipt live in three different places and three different formats, so a person becomes the integration layer. You've got that pattern here — documents landing in ${systemClause(
        ctx.systems,
        "email and shared folders"
      )} and someone reconciling them line by line.${
        ctx.volumePhrase
          ? ` At ${ctx.volumePhrase}, the error rate compounds faster than the team can catch it.`
          : ""
      } AI extraction plus a deterministic matching engine removes the keying entirely and leaves your team only the genuine disputes.`,
    blueprint: [
      {
        step: "Extract every document format",
        detail:
          "Document AI reads supplier invoices whether they arrive as PDF, scan, photo, or EDI — pulling header data and line items with confidence scores on every field.",
      },
      {
        step: "Match with tolerance rules you control",
        detail:
          "The engine matches invoice to PO to goods receipt at line level, applying your quantity and price tolerances, handling partial deliveries, freight, and multi-PO invoices.",
      },
      {
        step: "Work only the exceptions",
        detail:
          "Mismatches land in a queue that shows exactly which field disagrees and by how much, with a one-click supplier query email drafted and ready to send.",
      },
      {
        step: "Post and report",
        detail:
          "Matched invoices post to your finance system automatically, and a dashboard tracks touchless rate, days-to-pay, early-payment discounts captured, and disputes by supplier.",
      },
    ],
    stack: ["Document intelligence", "Power Automate", "Excel/VBA bridge", "ERP + finance connectors", "Power BI"],
    outcomes: [
      { metric: "80%+", label: "invoices matched touchless" },
      { metric: "60–75%", label: "reduction in AP processing cost" },
      { metric: "2–3%", label: "recovered via captured discounts" },
    ],
    timeline: "5–7 weeks, with the extraction layer proving out in week 2",
    followUp:
      "Share a month of invoices plus your tolerance rules and we'll benchmark the touchless rate before you commit to anything.",
  },
  {
    id: "inventory",
    title: "Inventory signals that reach you before the stockout",
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
      { term: "stock", weight: 1 },
      { term: "shortage", weight: 2 },
      { term: "min max", weight: 2 },
      { term: "cycle count", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Stockouts and excess are the same problem wearing two hats: your reorder points are static while demand and lead times are not. Most teams recalculate min/max once a quarter in a spreadsheet, so by week three the numbers are already wrong.${
        ctx.systems.length
          ? ` With data sitting in ${systemClause(ctx.systems, "your systems")}, the raw signal is there — it just isn't being read continuously.`
          : ""
      }${
        ctx.volumePhrase ? ` Across ${ctx.volumePhrase}, no team can do that by hand.` : ""
      } The fix is a nightly recalculation with alerts that arrive early enough to act on.`,
    blueprint: [
      {
        step: "Consolidate the stock picture",
        detail:
          "One pipeline pulls on-hand, on-order, in-transit, and allocated quantities from every location and system into a single reconciled view, flagging where the numbers disagree.",
      },
      {
        step: "Make reorder points dynamic",
        detail:
          "Safety stock and reorder points recalculate nightly from actual demand variability and supplier lead-time performance, segmented by ABC/XYZ class instead of one blanket rule.",
      },
      {
        step: "Alert with a recommendation attached",
        detail:
          "Buyers get a morning digest in Teams or email: what to order, how much, from whom, and what happens if they don't — plus a draft PO ready to release.",
      },
      {
        step: "Surface the money already on the shelf",
        detail:
          "A dashboard ages slow-moving and obsolete stock, quantifies the tied-up working capital, and ranks liquidation or transfer candidates.",
      },
    ],
    stack: ["Power Automate", "Python forecasting service", "Excel/VBA planner tools", "Power BI", "ERP connector"],
    outcomes: [
      { metric: "30–45%", label: "fewer stockout events" },
      { metric: "15–25%", label: "working capital released from excess" },
      { metric: "Daily", label: "reorder points, not quarterly" },
    ],
    timeline: "4–6 weeks, with the consolidated stock view live in week 2",
    followUp:
      "12 months of demand history plus your current min/max table lets us show the projected service-level lift before we build.",
  },
  {
    id: "forecasting",
    title: "Demand forecasting your planners actually trust",
    keywords: [
      { term: "forecast", weight: 3 },
      { term: "demand plan", weight: 3 },
      { term: "s&op", weight: 3 },
      { term: "sales and operations", weight: 3 },
      { term: "predict", weight: 2 },
      { term: "seasonality", weight: 3 },
      { term: "planning", weight: 2 },
      { term: "budget", weight: 1 },
      { term: "capacity plan", weight: 2 },
      { term: "mrp", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Forecasting fails in practice less because the maths is hard and more because the process is manual: a planner exports history, builds a spreadsheet model, and the number is stale before the S&OP meeting.${
        ctx.systems.length
          ? ` Your history is already in ${systemClause(ctx.systems, "your systems")} — the gap is the modelling and the cadence, not the data.`
          : ""
      } A statistical baseline that refreshes automatically, with a clear place for human overrides, beats an artisanal spreadsheet on both accuracy and speed — and it shows its working, which is what earns planner trust.`,
    blueprint: [
      {
        step: "Build the baseline",
        detail:
          "Ensemble models across your SKU base — seasonality, trend, promotional lift, and intermittent-demand handling for the long tail, backtested against your own history so accuracy is measured, not claimed.",
      },
      {
        step: "Keep the humans in the loop",
        detail:
          "Planners override at any level in a familiar Excel-style grid; every override is captured with a reason code so you can measure whether human judgment is adding or subtracting accuracy.",
      },
      {
        step: "Run consensus in one place",
        detail:
          "Sales, operations, and finance views reconcile into a single consensus plan, with variance-to-plan tracked and the assumptions behind each number visible.",
      },
      {
        step: "Push it downstream",
        detail:
          "The agreed forecast flows straight into replenishment and capacity planning, so the plan drives orders instead of sitting in a deck.",
      },
    ],
    stack: ["Python forecasting service", "Excel/VBA planner front-end", "Power BI", "Power Automate", "ERP connector"],
    outcomes: [
      { metric: "20–35%", label: "forecast error reduction (MAPE)" },
      { metric: "3 days → 3 hrs", label: "monthly planning cycle" },
      { metric: "Weekly", label: "refresh cadence, fully automatic" },
    ],
    timeline: "6–9 weeks including backtesting and planner onboarding",
    followUp:
      "Send 24 months of demand history and we'll backtest against your current forecast — you'll see the accuracy delta before signing anything.",
  },
  {
    id: "logistics-tracking",
    title: "Shipment visibility that updates itself",
    keywords: [
      { term: "shipment", weight: 3 },
      { term: "tracking", weight: 3 },
      { term: "freight", weight: 3 },
      { term: "logistics", weight: 2 },
      { term: "carrier", weight: 3 },
      { term: "eta", weight: 3 },
      { term: "delivery", weight: 2 },
      { term: "container", weight: 3 },
      { term: "customs", weight: 2 },
      { term: "bill of lading", weight: 3 },
      { term: "transport", weight: 2 },
      { term: "last mile", weight: 2 },
      { term: "in transit", weight: 2 },
      { term: "port", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `Shipment visibility is usually a people problem dressed as a data problem — someone spends their morning logging into carrier and forwarder portals, copying ETAs into a tracker, and answering "where is my order?" emails.${
        ctx.systems.length
          ? ` With ${systemClause(ctx.systems, "your portals and spreadsheets")} in the mix, that's a lot of manual polling.`
          : ""
      }${
        ctx.volumePhrase ? ` At ${ctx.volumePhrase} that's a permanent daily tax.` : ""
      } The data exists in those portals; it just needs to be collected automatically and pushed to the people who care about exceptions.`,
    blueprint: [
      {
        step: "Collect from every source",
        detail:
          "Carrier APIs where they exist, EDI where they're set up, and resilient scraping or email parsing where they aren't — normalised into one shipment record per order.",
      },
      {
        step: "Detect delays before they surprise you",
        detail:
          "Predicted-vs-promised ETA comparison flags at-risk shipments early, with severity based on what's on the container and who's waiting for it.",
      },
      {
        step: "Notify the right people automatically",
        detail:
          "Internal teams get exception alerts in Teams or Slack; customers get proactive status updates by email or WhatsApp — before they think to ask.",
      },
      {
        step: "Hold carriers to the numbers",
        detail:
          "A scorecard tracks on-time performance, dwell, and cost per lane by carrier, giving you evidence at contract renewal.",
      },
    ],
    stack: ["Power Automate", "Carrier API + EDI integration", "AI status agent", "Power BI", "WhatsApp / email"],
    outcomes: [
      { metric: "90%", label: "less manual portal checking" },
      { metric: "2–4 days", label: "earlier delay detection" },
      { metric: "−60%", label: "\"where is my order?\" inbound" },
    ],
    timeline: "5–8 weeks depending on how many carriers are in scope",
    followUp:
      "List your top carriers and forwarders — we'll confirm which have clean APIs and which need a parsing layer, then price accordingly.",
  },
  {
    id: "ai-chatbot",
    title: "An AI agent that answers order and stock questions",
    keywords: [
      { term: "chatbot", weight: 3 },
      { term: "chat bot", weight: 3 },
      { term: "customer service", weight: 3 },
      { term: "customer support", weight: 3 },
      { term: "inquiries", weight: 2 },
      { term: "enquiries", weight: 2 },
      { term: "answer questions", weight: 2 },
      { term: "where is my order", weight: 3 },
      { term: "help desk", weight: 3 },
      { term: "helpdesk", weight: 3 },
      { term: "ticket", weight: 2 },
      { term: "assistant", weight: 2 },
      { term: "agent", weight: 1 },
      { term: "faq", weight: 2 },
      { term: "whatsapp", weight: 2 },
      { term: "respond", weight: 1 },
    ],
    diagnosis: (ctx) =>
      `The questions hitting your team are repetitive and answerable from data you already hold — order status, stock availability, lead times, documents, pricing. What makes them expensive is that each one requires a human to look something up in ${systemClause(
        ctx.systems,
        "a system"
      )} and type a reply.${
        ctx.volumePhrase ? ` At ${ctx.volumePhrase}, that's the majority of a support role.` : ""
      } A retrieval-grounded AI agent handles that tier directly, and — critically — hands off cleanly instead of inventing an answer when it isn't sure.`,
    blueprint: [
      {
        step: "Ground it in your real data",
        detail:
          "The agent connects to live order, inventory, and shipment data plus your product and policy documents, so answers reflect the system of record rather than a stale training set.",
      },
      {
        step: "Constrain it so it can't bluff",
        detail:
          "Retrieval-augmented generation with strict grounding rules, confidence thresholds, and citation of the underlying record — when it doesn't know, it escalates with full context attached instead of guessing.",
      },
      {
        step: "Deploy where people already are",
        detail:
          "Website widget, WhatsApp, Teams, or embedded in your customer portal — same brain, one deployment, with authentication so customers only see their own data.",
      },
      {
        step: "Improve it with evidence",
        detail:
          "Every conversation is logged and analysed: deflection rate, escalation reasons, and the questions it handled badly become the next iteration's fixes.",
      },
    ],
    stack: ["Claude API", "RAG + vector search", "Order/inventory API layer", "WhatsApp / web / Teams", "Analytics"],
    outcomes: [
      { metric: "55–70%", label: "of routine questions deflected" },
      { metric: "Instant", label: "response, around the clock" },
      { metric: "100%", label: "of conversations logged and auditable" },
    ],
    timeline: "4–7 weeks, pilot on one channel in ~3 weeks",
    followUp:
      "Export 200 recent customer questions and we'll show you exactly what proportion the agent can safely take.",
  },
  {
    id: "reporting",
    title: "Reporting that builds itself every morning",
    keywords: [
      { term: "report", weight: 3 },
      { term: "dashboard", weight: 3 },
      { term: "excel", weight: 2 },
      { term: "spreadsheet", weight: 3 },
      { term: "manual data entry", weight: 3 },
      { term: "data entry", weight: 3 },
      { term: "copy paste", weight: 3 },
      { term: "copy and paste", weight: 3 },
      { term: "consolidat", weight: 3 },
      { term: "vlookup", weight: 3 },
      { term: "pivot", weight: 2 },
      { term: "kpi", weight: 2 },
      { term: "macro", weight: 2 },
      { term: "vba", weight: 3 },
      { term: "monthly report", weight: 3 },
      { term: "compile", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Manual reporting has a hidden second cost: the hours are visible, but the decisions delayed while everyone waits for the file are not. The pattern you're describing — pulling exports from ${systemClause(
        ctx.systems,
        "several systems"
      )}, stitching them together, fixing the formatting — is the single most automatable thing in a supply-chain team.${
        ctx.volumePhrase ? ` You mentioned ${ctx.volumePhrase}; that's recurring capacity you get back permanently.` : ""
      } And because it's low-risk and highly visible, it's the best possible first project.`,
    blueprint: [
      {
        step: "Automate the extracts",
        detail:
          "Scheduled flows pull from every source system on a fixed cadence, with retry logic and a failure alert so nobody discovers a broken report in a meeting.",
      },
      {
        step: "Clean and reconcile in one pass",
        detail:
          "Transformation logic handles the joins, mappings, and edge cases your team currently fixes by hand — plus validation rules that flag anomalies instead of silently publishing them.",
      },
      {
        step: "Publish in the format each audience wants",
        detail:
          "Power BI for the people who explore, a formatted Excel or PDF pack for the people who want the file, delivered to inbox or Teams on schedule.",
      },
      {
        step: "Keep the Excel that works",
        detail:
          "Where a well-built workbook is the right tool, we rebuild the VBA properly — fast, documented, error-handled — rather than replacing something your team already trusts.",
      },
    ],
    stack: ["Power Automate", "Power Query", "Excel VBA", "Power BI", "SQL / Dataverse"],
    outcomes: [
      { metric: "8–20 hrs", label: "returned per person, per week" },
      { metric: "6am", label: "reports ready before anyone logs in" },
      { metric: "Zero", label: "copy-paste transcription errors" },
    ],
    timeline: "2–4 weeks — usually the fastest visible win available",
    followUp:
      "Send one report you rebuild every week. We'll automate it as a fixed-price pilot so you can judge us on delivered work.",
  },
  {
    id: "supplier-management",
    title: "Supplier onboarding and performance, systematised",
    keywords: [
      { term: "supplier", weight: 3 },
      { term: "vendor", weight: 3 },
      { term: "onboarding", weight: 3 },
      { term: "scorecard", weight: 3 },
      { term: "supplier performance", weight: 3 },
      { term: "compliance", weight: 2 },
      { term: "certificate", weight: 2 },
      { term: "audit", weight: 2 },
      { term: "contract", weight: 2 },
      { term: "qualification", weight: 2 },
      { term: "due diligence", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Supplier management degrades quietly. Onboarding lives in email threads, certificates expire without anyone noticing, and performance is judged on the last thing that went wrong rather than the record.${
        ctx.systems.length
          ? ` With data spread across ${systemClause(ctx.systems, "email and spreadsheets")}, there's no single place to see a supplier's true standing.`
          : ""
      } Both halves — intake and ongoing performance — are workflow problems with well-understood solutions.`,
    blueprint: [
      {
        step: "Make onboarding self-service",
        detail:
          "Suppliers submit their own details, banking, certifications, and documents through a guided portal, with validation at entry so incomplete records never reach your team.",
      },
      {
        step: "Never miss an expiry",
        detail:
          "Certificates, insurance, and contract renewals are tracked with automatic reminders to the supplier ahead of expiry — and escalation to you if they don't respond.",
      },
      {
        step: "Score on the record, not the anecdote",
        detail:
          "On-time delivery, quality acceptance, price variance, and responsiveness calculate automatically from transactional data into a scorecard both sides can see.",
      },
      {
        step: "Arrive at reviews prepared",
        detail:
          "Quarterly business review packs generate themselves, with trends, open issues, and the negotiating position already laid out.",
      },
    ],
    stack: ["Power Apps portal", "Power Automate", "Dataverse", "Document AI", "Power BI"],
    outcomes: [
      { metric: "10 days → 2", label: "supplier onboarding time" },
      { metric: "100%", label: "certificate compliance, continuously" },
      { metric: "Automatic", label: "scorecards, zero manual prep" },
    ],
    timeline: "6–8 weeks for portal plus scorecards",
    followUp:
      "Share your current onboarding checklist and we'll map it to a portal flow in the first call.",
  },
  {
    id: "warehouse",
    title: "Warehouse operations, instrumented",
    keywords: [
      { term: "warehouse", weight: 3 },
      { term: "picking", weight: 3 },
      { term: "packing", weight: 3 },
      { term: "receiving", weight: 3 },
      { term: "putaway", weight: 3 },
      { term: "barcode", weight: 3 },
      { term: "scanner", weight: 3 },
      { term: "rfid", weight: 3 },
      { term: "wms", weight: 3 },
      { term: "labour", weight: 2 },
      { term: "labor", weight: 2 },
      { term: "dispatch", weight: 2 },
      { term: "goods in", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Warehouse work is physical, but the waste is usually informational — paper pick lists, counts recorded then re-keyed, and no reliable picture of throughput until after the shift.${
        ctx.systems.length ? ` ${systemClause(ctx.systems, "Your systems")} hold part of the picture, but not in real time.` : ""
      } You rarely need to replace the WMS to fix this; you need to close the gaps around it and get the data flowing while the work is happening.`,
    blueprint: [
      {
        step: "Capture on the floor",
        detail:
          "Mobile apps for receiving, putaway, picking, and cycle counts — barcode-driven, usable on a cheap Android device, and functional when the Wi-Fi drops.",
      },
      {
        step: "Eliminate the re-keying",
        detail:
          "Scans post directly to the ERP or WMS in real time, so on-hand quantities are current instead of end-of-shift approximations.",
      },
      {
        step: "See throughput as it happens",
        detail:
          "A live board shows orders picked per hour, open work by zone, and where the bottleneck is right now — so supervisors reallocate during the shift, not after it.",
      },
      {
        step: "Count without stopping",
        detail:
          "Cycle counting is scheduled by ABC velocity and variance history, replacing the annual full-stop stocktake.",
      },
    ],
    stack: ["Power Apps mobile", "Power Automate", "Barcode / RFID integration", "WMS + ERP connectors", "Power BI"],
    outcomes: [
      { metric: "25–40%", label: "faster pick cycle" },
      { metric: "99.5%+", label: "inventory record accuracy" },
      { metric: "Real time", label: "stock positions, not end-of-day" },
    ],
    timeline: "6–10 weeks depending on device rollout",
    followUp:
      "Walk us through one receiving-to-dispatch cycle on a call and we'll identify the highest-value capture point.",
  },
  {
    id: "quotation",
    title: "Quotes and RFQs answered in hours, not days",
    keywords: [
      { term: "quotation", weight: 3 },
      { term: "quote", weight: 3 },
      { term: "rfq", weight: 3 },
      { term: "tender", weight: 3 },
      { term: "bid", weight: 2 },
      { term: "pricing", weight: 2 },
      { term: "proposal", weight: 2 },
      { term: "estimate", weight: 2 },
      { term: "costing", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `Quote turnaround is usually where deals are lost, and the delay is almost never the pricing decision — it's assembling the inputs. Someone reads the RFQ, looks up costs in ${systemClause(
        ctx.systems,
        "spreadsheets"
      )}, checks stock and lead time, applies margin rules from memory, then formats a document.${
        ctx.volumePhrase ? ` Multiply that by ${ctx.volumePhrase} and the queue never clears.` : ""
      } Every input is retrievable automatically; the judgment call at the end is the only part that needs you.`,
    blueprint: [
      {
        step: "Read the request automatically",
        detail:
          "AI parses incoming RFQs — email, PDF, or portal — and maps requested items to your catalogue, flagging anything ambiguous rather than guessing.",
      },
      {
        step: "Assemble the inputs instantly",
        detail:
          "Current cost, stock position, supplier lead time, freight, and duty are pulled together into a single costing sheet in seconds.",
      },
      {
        step: "Apply your pricing logic",
        detail:
          "Margin rules by customer tier, volume break, and product family calculate a recommended price — with the reasoning shown so a human can override with confidence.",
      },
      {
        step: "Send and track",
        detail:
          "A branded quote generates and sends on approval, then tracks opens, follow-ups, and win/loss so your pricing improves with every cycle.",
      },
    ],
    stack: ["Document AI", "Power Automate", "Excel/VBA pricing engine", "CRM connector", "Power BI"],
    outcomes: [
      { metric: "2 days → 2 hrs", label: "average quote turnaround" },
      { metric: "3×", label: "quote volume at the same headcount" },
      { metric: "Tracked", label: "win/loss on every quote sent" },
    ],
    timeline: "5–7 weeks including pricing-rule capture",
    followUp:
      "Share 10 recent RFQs and your margin rules — we'll demo the parsing on your own documents.",
  },
  {
    id: "integration",
    title: "Systems that talk to each other without a human relay",
    keywords: [
      { term: "integration", weight: 3 },
      { term: "integrate", weight: 3 },
      { term: "api", weight: 2 },
      { term: "sync", weight: 3 },
      { term: "two systems", weight: 3 },
      { term: "different systems", weight: 3 },
      { term: "erp", weight: 2 },
      { term: "migrate", weight: 2 },
      { term: "connect", weight: 2 },
      { term: "silo", weight: 3 },
      { term: "master data", weight: 3 },
      { term: "duplicate", weight: 2 },
      { term: "single source of truth", weight: 3 },
      { term: "edi", weight: 2 },
    ],
    diagnosis: (ctx) =>
      `When two systems don't talk, a person becomes the integration layer — and people are slow, expensive, and inconsistent at it. ${
        ctx.systems.length > 1
          ? `You've named ${systemClause(ctx.systems, "several systems")}, which is exactly the shape of problem where a proper sync layer pays for itself quickly.`
          : "The re-keying between systems is where errors enter and where the delay compounds."
      } The right answer is rarely a rip-and-replace: it's a reliable, monitored sync with clear ownership of which system wins on each field.`,
    blueprint: [
      {
        step: "Map the data honestly",
        detail:
          "We document what each system holds, where the same entity exists twice, and which system is authoritative per field — the step most integrations skip and later regret.",
      },
      {
        step: "Build the sync layer",
        detail:
          "APIs where available, EDI where it's the standard, database or file-based bridges where it isn't — with idempotent writes so a retry never duplicates a record.",
      },
      {
        step: "Handle failure like it's normal",
        detail:
          "Retries, dead-letter queues, and alerting that tells a named person what broke and what to do about it — because silent integration failure is worse than manual entry.",
      },
      {
        step: "Govern the master data",
        detail:
          "Deduplication, validation at entry, and a change-approval flow so the clean-up you pay for once doesn't decay over the following year.",
      },
    ],
    stack: ["Power Automate", "Azure Functions / Logic Apps", "REST + EDI connectors", "SQL / Dataverse", "Monitoring"],
    outcomes: [
      { metric: "Zero", label: "manual re-keying between systems" },
      { metric: "Near real time", label: "instead of overnight batch" },
      { metric: "Monitored", label: "every sync, with alerting" },
    ],
    timeline: "5–9 weeks depending on system count and API maturity",
    followUp:
      "Tell us which systems need to talk and in which direction — we'll return an integration map and a fixed price.",
  },
  {
    id: "documents",
    title: "Trade documents read, checked, and filed automatically",
    keywords: [
      { term: "document", weight: 2 },
      { term: "paperwork", weight: 3 },
      { term: "customs", weight: 3 },
      { term: "packing list", weight: 3 },
      { term: "certificate of origin", weight: 3 },
      { term: "bill of lading", weight: 3 },
      { term: "declaration", weight: 3 },
      { term: "import", weight: 2 },
      { term: "export", weight: 2 },
      { term: "scan", weight: 2 },
      { term: "pdf", weight: 2 },
      { term: "filing", weight: 2 },
      { term: "manual review", weight: 2 },
      { term: "compliance check", weight: 3 },
    ],
    diagnosis: (ctx) =>
      `Trade documentation is high-volume, high-consequence, and almost entirely manual — which is the worst possible combination. A single mismatched field between the commercial invoice, packing list, and bill of lading means a held container and demurrage charges.${
        ctx.systems.length ? ` Documents arriving through ${systemClause(ctx.systems, "email")} make consistency checking even harder.` : ""
      } Document AI reads all of it and cross-checks in seconds, catching the discrepancy while it's still cheap to fix.`,
    blueprint: [
      {
        step: "Read every document type",
        detail:
          "Commercial invoices, packing lists, bills of lading, certificates of origin, and customs declarations — extracted with per-field confidence scores, including scans and photos.",
      },
      {
        step: "Cross-check the whole set",
        detail:
          "Values, weights, HS codes, quantities, and party details are compared across every document in the shipment file, and anything inconsistent is flagged before submission.",
      },
      {
        step: "Validate against the rules",
        detail:
          "HS-code sanity checks, restricted-party screening, and destination-specific documentary requirements run automatically on every file.",
      },
      {
        step: "File it so it's findable",
        detail:
          "Documents are named, indexed, and filed to SharePoint with a full audit trail — retrievable in seconds when an authority asks.",
      },
    ],
    stack: ["Document intelligence", "Claude API", "Power Automate", "SharePoint", "Compliance rule engine"],
    outcomes: [
      { metric: "95%+", label: "field-level extraction accuracy" },
      { metric: "Minutes", label: "to check a full shipment file" },
      { metric: "Fewer", label: "held shipments and demurrage charges" },
    ],
    timeline: "5–7 weeks per document family",
    followUp:
      "Send a sample shipment file and we'll run extraction on it as a free proof of concept.",
  },
];

/* ───────────────────────── Fallback ───────────────────────── */

const FALLBACK: Omit<Playbook, "keywords"> = {
  id: "general",
  title: "A scoped automation plan for your operation",
  diagnosis: (ctx) =>
    `Thanks — that gives us a starting point.${
      ctx.systems.length
        ? ` You're working across ${systemClause(ctx.systems, "several tools")}, which usually means the friction sits in the handoffs between them rather than inside any one system.`
        : ""
    } Almost every supply-chain process we're brought into follows the same shape: information arrives in an unstructured form, a person converts it into a structured form, and a system consumes it. That middle step is what we remove. The fastest way to get you a real answer is a short call where we walk one process end to end — most teams can name their worst one immediately.`,
  blueprint: [
    {
      step: "Map the process as it truly runs",
      detail:
        "A 45-minute working session on one process, documenting every touch, handoff, and workaround — including the ones that aren't in the official SOP.",
    },
    {
      step: "Quantify what it actually costs",
      detail:
        "Hours per week, error rate, and delay cost, so the business case is built on your numbers rather than an industry benchmark.",
    },
    {
      step: "Pick the fastest visible win",
      detail:
        "We start with the automation that pays back quickest and is most visible internally — that's what earns budget and goodwill for the next one.",
    },
    {
      step: "Build, measure, expand",
      detail:
        "Ship the first automation in weeks, measure it against the baseline, then extend into the adjacent processes using the same foundation.",
    },
  ],
  stack: ["Power Automate", "Excel VBA", "Claude API", "Power BI", "Custom integrations"],
  outcomes: [
    { metric: "45 min", label: "to a concrete, costed plan" },
    { metric: "2–4 weeks", label: "to a first working automation" },
    { metric: "Fixed price", label: "on the pilot, no open-ended retainer" },
  ],
  timeline: "First call this week, pilot scoped within days",
  followUp:
    "Fill in the form below with a bit more detail about the process and we'll come to the call with a draft plan already sketched.",
};

/* ───────────────────────── Scoring ───────────────────────── */

/** Pads the text so `" po "`-style keywords match at string boundaries. */
function normalise(input: string): string {
  return ` ${input.toLowerCase().replace(/[^\w\s&/-]/g, " ").replace(/\s+/g, " ").trim()} `;
}

export function generateSolution(rawInput: string): SolutionResult {
  const input = rawInput.trim();
  const text = normalise(input);

  const systems = detectSystems(text);
  const volumePhrase = detectVolume(input);

  const ctx: MatchContext = {
    systems,
    hasVolume: Boolean(volumePhrase),
    volumePhrase,
    mentionsTeamSize: /\b(team|staff|people|headcount|fte)\b/.test(text),
    raw: input,
  };

  // Score every playbook; collect the phrases that drove each match.
  const scored = PLAYBOOKS.map((pb) => {
    let score = 0;
    const signals: string[] = [];

    for (const { term, weight } of pb.keywords) {
      if (text.includes(term)) {
        score += weight;
        const clean = term.trim();
        if (!signals.includes(clean)) signals.push(clean);
      }
    }

    return { pb, score, signals };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];

  // Below this, a match is coincidence rather than signal.
  const MIN_SCORE = 3;

  if (!input || input.length < 12 || !best || best.score < MIN_SCORE) {
    return {
      ...FALLBACK,
      diagnosis: FALLBACK.diagnosis(ctx),
      confidence: 0.42,
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
    confidence,
    diagnosis: pb.diagnosis(ctx),
    blueprint: pb.blueprint,
    stack: pb.stack,
    outcomes: pb.outcomes,
    timeline: pb.timeline,
    followUp: pb.followUp,
    signals: signals.slice(0, 5),
    systems,
  };
}

/** Starter prompts shown under the hero input. Kept short so the chips wrap tidily. */
export const SAMPLE_PROMPTS = [
  "200+ purchase orders re-keyed by hand every week in SAP",
  "Three days a month rebuilding the same inventory report",
  "Customers keep emailing to ask where their shipment is",
  "Invoice matching against POs and GRNs eats our AP team",
] as const;

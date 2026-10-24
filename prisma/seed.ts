/**
 * Demo data for local development ONLY.
 *
 * Refuses to run against anything but a localhost database, so a stray
 * `npm run db:seed` with production credentials can never pollute real CRM
 * data with invented clients. Every lead it creates is tagged source = "demo",
 * and everything else it creates hangs off those leads, so a re-run replaces
 * the previous demo set cleanly.
 *
 * Runs as plain Node (type stripping, via --env-file), so it can't import
 * "server-only" or "@/" modules. The few app rules it needs are restated here:
 * calendar dates are stored at 12:00 UTC on the Dubai calendar day
 * (src/lib/admin/time.ts), and document numbers run per Dubai calendar year
 * (src/lib/admin/numbering.ts).
 *
 * The story it tells: clients in every dashboard status (New, Quotation sent,
 * Invoice sent, Goal, Cancel) with owners, priorities, tags and activities
 * (overdue, due today, planned and done); a cancelled deal; a long-running won
 * engagement with paid invoices; a deal won this month whose accepted
 * quotation generated a Service Agreement, now out for signature with its
 * deposit invoice; and a year of expenses, some booked to those two projects.
 *
 * Demo expenses are the ones with no "recorded by" admin (createdById null).
 * Expenses entered in the app always have one, so a re-run keeps them, except
 * those booked to a demo client, which go with it (leadId is SetNull, so they
 * would otherwise turn into running costs).
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("Refusing to seed: DATABASE_URL is not a localhost database.");
  process.exit(1);
}

const db = new PrismaClient();

const DAY_MS = 86_400_000;
/** An instant `days` ago; `minutes` orders events logged on the same day. */
const ago = (days: number, minutes = 0) => new Date(Date.now() - days * DAY_MS + minutes * 60_000);
const aed = (n: number) => Math.round(n * 100);

// ─── Business clock (Asia/Dubai) ─────────────────────────────────────────────

const [YEAR, MONTH, DATE] = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .split("-")
  .map(Number);

/** The Dubai calendar day `offset` days from today, stored at 12:00 UTC. */
const day = (offset: number) => new Date(Date.UTC(YEAR, MONTH - 1, DATE + offset, 12));
/** The same day as "YYYY-MM-DD", for SOW milestones. */
const dayKey = (offset: number) => day(offset).toISOString().slice(0, 10);

// ─── Demo pipeline ───────────────────────────────────────────────────────────

type Stage = "NEW" | "PROPOSAL" | "INVOICED" | "WON" | "LOST";
type ActivityKind = "CALL" | "EMAIL" | "MEETING" | "TODO" | "FOLLOW_UP";

/** The dashboard's names for the statuses (src/lib/admin/labels.ts). */
const STAGE_LABEL: Record<Stage, string> = {
  NEW: "New",
  PROPOSAL: "Quotation sent",
  INVOICED: "Invoice sent",
  WON: "Goal",
  LOST: "Cancel",
};
const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  TODO: "To-do",
  FOLLOW_UP: "Follow-up",
};

type DemoActivity = {
  type: ActivityKind;
  summary: string;
  /** Due date, in days from today (negative = in the past). */
  due: number;
  note?: string;
  done?: { daysAgo: number; feedback: string };
};

type DemoLead = {
  key: string;
  name: string;
  company: string | null;
  size: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  services: string[];
  budget: string | null;
  msg: string | null;
  /** Came in through the website form. False: a card added by hand while approaching a client. */
  web: boolean;
  status: Stage;
  /** Days since the lead came in. */
  days: number;
  value: number | null;
  title: string;
  priority: number;
  tags: string[];
  probability?: number;
  /** Expected close date, in days from today. */
  close?: number;
  wonDaysAgo?: number;
  lost?: { daysAgo: number; from: Stage; reason: string; note: string };
  /** Stage history: [days ago, from, to]. */
  moves?: [number, Stage, Stage][];
  notes?: [number, string][];
  activities?: DemoActivity[];
};

const LEADS: DemoLead[] = [
  {
    key: "palmgate", name: "Rashid Al Suwaidi", company: "Palmgate Distribution", size: "201–1000 employees",
    industry: "Wholesale & distribution", city: "Dubai", country: "United Arab Emirates",
    services: ["Package 3: Data Flow & Reporting", "Package 1: Automate"], budget: "$15,000 – $50,000",
    msg: "Warehouse KPIs are compiled by hand from WMS exports every Monday. We want live dashboards and alerts when picking falls behind.",
    web: true, status: "WON", days: 150, value: 120000, title: "Warehouse KPI dashboards", priority: 2,
    tags: ["Power BI", "Retainer"], close: -128, wonDaysAgo: 128,
    moves: [[135, "NEW", "PROPOSAL"]],
    notes: [[20, "Phase 3 alerts are in UAT. Rashid asked about a support retainer after handover."]],
    activities: [
      { type: "MEETING", summary: "Monthly steering meeting", due: -14, done: { daysAgo: 14, feedback: "On track. UAT sign-off expected next week." } },
      { type: "MEETING", summary: "Monthly steering meeting", due: 16 },
    ],
  },
  {
    key: "gulfline", name: "Omar Haddad", company: "Gulfline Logistics", size: "201–1000 employees",
    industry: "Logistics & 3PL", city: "Dubai", country: "United Arab Emirates",
    services: ["Package 1: Automate", "Package 4: AI Agents & Intelligent Solutions"], budget: "$50,000 – $150,000",
    msg: "We re-key roughly 400 bills of lading a week into our TMS. Two people spend most of their day on it.",
    web: true, status: "WON", days: 34, value: 180000, title: "B/L intake automation", priority: 3,
    tags: ["Document AI", "TMS"], close: -6, wonDaysAgo: 6,
    moves: [[12, "NEW", "PROPOSAL"]],
    notes: [
      [16, "Discovery call: ~400 B/Ls a week re-keyed into the TMS by two coordinators. Exceptions are the real pain, not the happy path."],
      [9, "Final scope review with Omar and their ops lead. Exception queue stays in phase 1; the customs module is out of scope."],
    ],
    activities: [
      { type: "MEETING", summary: "Final scope review", due: -9, done: { daysAgo: 9, feedback: "Scope agreed. Omar will sign once legal has read the agreement." } },
      { type: "FOLLOW_UP", summary: "Chase signature on the service agreement", due: 2 },
    ],
  },
  {
    key: "crescent", name: "Priya Raman", company: "Crescent Pharma Distribution", size: "51–200 employees",
    industry: "Pharmaceutical & healthcare", city: "Abu Dhabi", country: "United Arab Emirates",
    services: ["Package 3: Data Flow & Reporting"], budget: "$15,000 – $50,000",
    msg: "Stockouts on fast movers and expiry write-offs on the slow ones. Planning lives in twelve linked workbooks.",
    web: true, status: "PROPOSAL", days: 21, value: 95000, title: "Demand forecasting & planning dashboards", priority: 2,
    tags: ["Forecasting", "Power BI"], probability: 70, close: 14,
    moves: [[3, "NEW", "PROPOSAL"]],
    notes: [[5, "Priya wants the forecast to cover the 300 fastest movers first; slow movers in a second phase."]],
    activities: [
      { type: "CALL", summary: "Qualification call", due: -10, done: { daysAgo: 10, feedback: "Budget confirmed for Q4. Their COO makes the call." } },
      { type: "MEETING", summary: "Walk the COO through the proposal", due: 0, note: "Bring the stockout baseline from their last two quarters." },
    ],
  },
  {
    key: "northwind", name: "Daniel Okafor", company: "Northwind Freight", size: "11–50 employees",
    industry: "Freight forwarding", city: "Sharjah", country: "United Arab Emirates",
    services: ["Package 4: AI Agents & Intelligent Solutions"], budget: "$15,000 – $50,000",
    msg: "Customers email all day asking where their shipment is. We want WhatsApp answers from our tracking data.",
    // Invoiced for a paid scoping workshop before the build is quoted.
    web: true, status: "INVOICED", days: 14, value: 60000, title: "WhatsApp shipment status agent", priority: 2,
    tags: ["Chatbot", "WhatsApp"], close: 30,
    notes: [[7, "Tracking data is available over REST. Need their rate limits before we scope the agent."]],
    activities: [
      { type: "EMAIL", summary: "Send the discovery summary", due: -7, done: { daysAgo: 7, feedback: "Sent. Daniel forwarded it to their IT lead." } },
      { type: "EMAIL", summary: "Send the tracking API questionnaire", due: -2 },
    ],
  },
  {
    key: "alnoor", name: "Sara Al Mansoori", company: "Al Noor Retail Group", size: "1000+ employees",
    industry: "Retail & e-commerce", city: "Dubai", country: "United Arab Emirates",
    services: ["Package 2: Connect", "Package 1: Automate"], budget: "$150,000+",
    msg: "Our ERP, WMS and Shopify do not talk. Orders are copied between them by hand every morning.",
    web: true, status: "NEW", days: 6, value: 420000, title: "ERP, WMS & Shopify order sync", priority: 3,
    tags: ["Integration", "EDI", "Enterprise"], probability: 25, close: 60,
    notes: [[5, "Intro call: orders re-keyed across three systems every morning. Their CIO is sponsoring the project."]],
    activities: [
      { type: "FOLLOW_UP", summary: "Send the mutual NDA", due: -4 },
      { type: "CALL", summary: "Discovery call with their IT lead", due: 3 },
    ],
  },
  {
    key: "oasis", name: "Noura Al Falasi", company: "Oasis Coldline Storage", size: null,
    industry: "Cold chain & storage", city: "Dubai", country: "United Arab Emirates",
    services: [], budget: null, msg: null,
    web: false, status: "NEW", days: 9, value: 45000, title: "Cold-room temperature alerts", priority: 1,
    tags: ["Outbound", "IoT"], close: 40,
    notes: [[9, "Met Noura at a logistics meetup. Temperature excursions are logged by hand twice a day; she's keen on automatic alerts. Need her direct email to send a one-pager."]],
    activities: [{ type: "CALL", summary: "Call for the right contact details", due: 1 }],
  },
  {
    key: "meridian", name: "Aisha Rahman", company: "Meridian Electronics", size: "11–50 employees",
    industry: "Electronics", city: "Dubai", country: "United Arab Emirates",
    services: ["Package 4: AI Agents & Intelligent Solutions"], budget: "Need guidance on budget",
    msg: "Exploring an AI assistant inside our ERP for quote drafting.",
    web: true, status: "NEW", days: 3, value: null, title: "ERP quoting copilot", priority: 1,
    tags: ["Copilot"],
    activities: [{ type: "CALL", summary: "Intro call", due: 5 }],
  },
  {
    key: "liam", name: "Liam Chen", company: null, size: null, industry: null, city: "Singapore", country: "Singapore",
    services: ["Package 1: Automate"], budget: "Under $5,000",
    msg: "I run procurement for a small distributor and my costing workbook crashes every month-end.",
    web: true, status: "NEW", days: 1, value: null, title: "Costing workbook rebuild", priority: 0,
    tags: ["Excel"],
    activities: [{ type: "TODO", summary: "Reply with the Excel health-check offer", due: 0 }],
  },
  {
    key: "atlas", name: "Fatima Zahra", company: "Atlas Food Supply", size: "51–200 employees",
    industry: "Food & beverage", city: "Riyadh", country: "Saudi Arabia",
    services: ["Package 4: AI Agents & Intelligent Solutions", "Package 3: Data Flow & Reporting"], budget: "$5,000 – $15,000",
    msg: "Supplier invoices arrive as scanned PDFs and we match them against POs manually.",
    web: true, status: "NEW", days: 0, value: null, title: "Supplier invoice matching", priority: 1,
    tags: ["Document AI"],
  },
  {
    key: "vela", name: "Marco Bellini", company: "Vela Industrial", size: "201–1000 employees",
    industry: "Construction & industrial", city: "Doha", country: "Qatar",
    services: ["Package 1: Automate"], budget: "$15,000 – $50,000",
    msg: "Portal data collection from twelve supplier sites.",
    web: true, status: "LOST", days: 44, value: 70000, title: "Supplier portal data collection", priority: 1,
    tags: ["RPA"], close: -20,
    moves: [[27, "NEW", "PROPOSAL"]],
    lost: {
      daysAgo: 20,
      from: "PROPOSAL",
      reason: "Handled in-house",
      note: "Their IT team will build it with the RPA licences they already own. Worth a check-in next quarter.",
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Line = { description: string; quantity: number; unitPriceFils: number };

const subtotalOf = (lines: Line[]) => lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceFils), 0);
const vatOf = (fils: number, vatBps = 500) => Math.round((fils * vatBps) / 10_000);
const withPositions = (lines: Line[]) => lines.map((l, position) => ({ ...l, position }));

/**
 * Sequential "Q-2026-0001"-style numbers for the demo documents, skipping any
 * number a real (non-demo) document already holds in this database.
 */
function numberSeries(prefix: string, taken: { number: string }[]) {
  const used = new Set(taken.map((t) => t.number));
  let n = 0;
  return {
    next(): string {
      let number: string;
      do {
        number = `${prefix}-${YEAR}-${String(++n).padStart(4, "0")}`;
      } while (used.has(number));
      return number;
    },
    /** Highest sequence number handed out. */
    last: () => n,
  };
}

/** Moves a document counter up to `value`, never down: real documents may already be numbered past it. */
async function raiseCounter(kind: "quote" | "invoice" | "agreement", value: number) {
  const key = `${kind}-${YEAR}`;
  const current = (await db.counter.findUnique({ where: { key } }))?.value ?? 0;
  if (value > current) await db.counter.upsert({ where: { key }, create: { key, value }, update: { value } });
}

async function main() {
  // ── Clear the previous demo set ──────────────────────────────────────────
  const demo = { source: "demo" };
  await db.$transaction([
    db.expense.deleteMany({ where: { OR: [{ createdById: null }, { lead: demo }] } }),
    db.task.deleteMany({ where: { project: { lead: demo } } }),
    db.lineItem.deleteMany({ where: { OR: [{ quote: { lead: demo } }, { invoice: { lead: demo } }] } }),
    db.invoice.deleteMany({ where: { lead: demo } }),
    // Deleting a lead only detaches its agreements (leadId is SetNull), so
    // they go explicitly, and before the leads they are found through.
    db.agreement.deleteMany({ where: { OR: [{ lead: demo }, { quote: { lead: demo } }] } }),
    db.quote.deleteMany({ where: { lead: demo } }),
    db.project.deleteMany({ where: { lead: demo } }),
    db.activity.deleteMany({ where: { lead: demo } }),
    db.note.deleteMany({ where: { lead: demo } }),
    db.lead.deleteMany({ where: demo }),
  ]);

  // Owners: spread the demo leads over the existing admin accounts, if any.
  const admins = await db.adminUser.findMany({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const ownerOf = new Map(LEADS.map((l, i) => [l.key, admins.length ? admins[i % admins.length].id : null]));

  // Kanban order: newest first within each column, 1024 apart.
  const sortOrder = new Map<string, number>();
  for (const stage of Object.keys(STAGE_LABEL) as Stage[]) {
    LEADS.filter((l) => l.status === stage)
      .sort((a, b) => a.days - b.days)
      .forEach((l, i) => sortOrder.set(l.key, i * 1024));
  }

  // ── Leads, activities and their timelines ────────────────────────────────
  const ids: Record<string, string> = {};
  const timeline: { leadId: string; kind: "NOTE" | "EVENT"; body: string; createdAt: Date; authorId: string | null }[] = [];
  const activities: {
    leadId: string;
    type: ActivityKind;
    summary: string;
    note: string | null;
    dueDate: Date;
    doneAt: Date | null;
    feedback: string | null;
    assigneeId: string | null;
    createdAt: Date;
  }[] = [];

  for (const l of LEADS) {
    const owner = ownerOf.get(l.key) ?? null;
    const first = l.name.split(" ")[0].toLowerCase();
    const lead = await db.lead.create({
      data: {
        source: "demo",
        createdAt: ago(l.days),
        status: l.status,
        title: l.title,
        clientType: l.company ? "COMPANY" : "INDIVIDUAL",
        fullName: l.name,
        // A card added by hand may start with nothing but a name and a note.
        email: l.web ? `${first}@example.com` : null,
        phone: l.web ? "+971 50 000 0000" : null,
        country: l.country,
        city: l.city,
        contactPreference: l.web ? "Email" : null,
        companyName: l.company,
        companySize: l.size,
        industry: l.industry,
        services: l.services,
        timeline: l.web ? "This quarter" : null,
        budget: l.budget,
        message: l.msg,
        estimatedValueFils: l.value === null ? null : aed(l.value),
        priority: l.priority,
        probability: l.probability ?? null,
        expectedCloseDate: l.close === undefined ? null : day(l.close),
        tags: l.tags,
        sortOrder: sortOrder.get(l.key) ?? 0,
        wonAt: l.wonDaysAgo === undefined ? null : ago(l.wonDaysAgo),
        lostAt: l.lost ? ago(l.lost.daysAgo) : null,
        lostReason: l.lost?.reason ?? null,
        lostNote: l.lost?.note ?? null,
        stageBeforeLost: l.lost?.from ?? null,
        ownerId: owner,
      },
      select: { id: true },
    });
    ids[l.key] = lead.id;

    const event = (daysAgo: number, body: string, authorId: string | null = owner, minutes = 0) =>
      timeline.push({ leadId: lead.id, kind: "EVENT", body, createdAt: ago(daysAgo, minutes), authorId });

    if (l.web) event(l.days, "Enquiry received via the website form.", null);
    else event(l.days, `Opportunity created manually as ${STAGE_LABEL[l.status]}.`);
    for (const [daysAgo, from, to] of l.moves ?? []) {
      event(daysAgo, `Status changed from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]}.`);
    }
    if (l.lost) {
      event(l.lost.daysAgo, `Status changed from ${STAGE_LABEL[l.lost.from]} to ${STAGE_LABEL.LOST}.\n${l.lost.note}`);
    }
    for (const [daysAgo, body] of l.notes ?? []) {
      timeline.push({ leadId: lead.id, kind: "NOTE", body, createdAt: ago(daysAgo, 30), authorId: owner });
    }

    for (const a of l.activities ?? []) {
      activities.push({
        leadId: lead.id,
        type: a.type,
        summary: a.summary,
        note: a.note ?? null,
        dueDate: day(a.due),
        doneAt: a.done ? ago(a.done.daysAgo, 45) : null,
        feedback: a.done?.feedback ?? null,
        assigneeId: owner,
        // Scheduled a couple of days ahead of the due date, never before the lead existed.
        createdAt: ago(Math.min(l.days, Math.max(-a.due, 0) + 2)),
      });
      if (a.done) {
        const label = ACTIVITY_LABEL[a.type];
        event(a.done.daysAgo, `${label} done: ${a.summary}.\nFeedback: ${a.done.feedback}`, owner, 45);
      }
    }
  }

  // ── Documents ────────────────────────────────────────────────────────────
  const prefixed = (prefix: string) => ({ number: { startsWith: `${prefix}-${YEAR}-` } });
  const [takenQuotes, takenInvoices, takenAgreements] = await Promise.all([
    db.quote.findMany({ where: prefixed("Q"), select: { number: true } }),
    db.invoice.findMany({ where: prefixed("INV"), select: { number: true } }),
    db.agreement.findMany({ where: prefixed("SA"), select: { number: true } }),
  ]);
  const quoteNo = numberSeries("Q", takenQuotes);
  const invoiceNo = numberSeries("INV", takenInvoices);
  const agreementNo = numberSeries("SA", takenAgreements);
  let quoteCount = 0;
  let invoiceCount = 0;

  // Long-running engagement, won months ago: accepted quote -> project in
  // progress -> phased invoices, three paid (for the revenue chart), one open.
  // It predates service agreements in the dashboard, so it has none.
  const palmgate = ids.palmgate;
  const palmgateOwner = ownerOf.get("palmgate") ?? null;
  const palmgateClient = { clientName: "Rashid Al Suwaidi", clientEmail: "rashid@example.com", clientCompany: "Palmgate Distribution" };
  const palmgateQuote = await db.quote.create({
    data: {
      number: quoteNo.next(), leadId: palmgate, status: "ACCEPTED", issueDate: day(-135), validUntil: day(-105), ...palmgateClient,
      items: { create: withPositions([
        { description: "Data model & KPI definitions", quantity: 1, unitPriceFils: aed(30000) },
        { description: "Power BI warehouse dashboards (6 reports)", quantity: 1, unitPriceFils: aed(60000) },
        { description: "Power Automate exception alerts", quantity: 1, unitPriceFils: aed(30000) },
      ]) },
    },
  });
  quoteCount++;
  timeline.push(
    { leadId: palmgate, kind: "EVENT", body: `Quotation ${palmgateQuote.number} accepted.`, createdAt: ago(128), authorId: palmgateOwner },
    { leadId: palmgate, kind: "EVENT", body: `Stage changed from Quotation sent to Won — quotation ${palmgateQuote.number} accepted.`, createdAt: ago(128, 1), authorId: palmgateOwner },
  );
  const palmgateProject = await db.project.create({
    data: {
      name: "Warehouse KPI dashboards & alerts", leadId: palmgate, status: "IN_PROGRESS",
      description: "Live warehouse KPIs from the WMS, with Power Automate alerts when picking falls behind.",
      startDate: day(-120), dueDate: day(20), valueFils: aed(120000),
      tasks: { create: [
        { title: "KPI definitions workshop", status: "DONE", position: 0 },
        { title: "Data model on the WMS extract", status: "DONE", position: 1 },
        { title: "Inventory & picking dashboards", status: "DONE", position: 2 },
        { title: "Exception alerts in Power Automate", status: "DOING", position: 3, dueDate: day(4) },
        { title: "UAT and handover", status: "TODO", position: 4, dueDate: day(15) },
      ] },
    },
  });
  const palmgateInvoices = [
    { status: "PAID", issue: -118, due: -104, paid: 106, text: "Phase 1 — data model & KPI definitions", quote: true },
    { status: "PAID", issue: -75, due: -61, paid: 63, text: "Phase 2 — warehouse dashboards (first half)" },
    { status: "PAID", issue: -28, due: -14, paid: 16, text: "Phase 2 — warehouse dashboards (second half)" },
    { status: "SENT", issue: -9, due: 5, text: "Phase 3 — exception alerts" },
  ] as const;
  for (const inv of palmgateInvoices) {
    await db.invoice.create({
      data: {
        number: invoiceNo.next(), leadId: palmgate, projectId: palmgateProject.id, status: inv.status,
        quoteId: "quote" in inv ? palmgateQuote.id : null,
        issueDate: day(inv.issue), dueDate: day(inv.due), paidAt: "paid" in inv ? ago(inv.paid) : null, ...palmgateClient,
        items: { create: withPositions([{ description: inv.text, quantity: 1, unitPriceFils: aed(30000) }]) },
      },
    });
    invoiceCount++;
  }

  // Won this month: accepted quote -> Service Agreement (sent, awaiting
  // signature) -> deposit invoice for stage 1 of its payment schedule, and the
  // project it will run as, still in planning.
  const gulfline = ids.gulfline;
  const gulflineOwner = ownerOf.get("gulfline") ?? null;
  const gulflineClient = { clientName: "Omar Haddad", clientEmail: "omar@example.com", clientCompany: "Gulfline Logistics" };
  const gulflineLines: Line[] = [
    { description: "Process mapping & baseline of the B/L intake", quantity: 1, unitPriceFils: aed(15000) },
    { description: "Document AI extraction build for bills of lading", quantity: 1, unitPriceFils: aed(120000) },
    { description: "TMS integration and write-back (days)", quantity: 15, unitPriceFils: aed(3000) },
  ];
  const gulflineQuote = await db.quote.create({
    data: {
      number: quoteNo.next(), leadId: gulfline, status: "ACCEPTED", issueDate: day(-12), validUntil: day(18), ...gulflineClient,
      items: { create: withPositions(gulflineLines) },
    },
  });
  quoteCount++;
  const gulflineProject = await db.project.create({
    data: {
      name: "B/L intake automation", leadId: gulfline, status: "PLANNING",
      description: "Document AI extraction of B/Ls into the TMS, with an exception queue for low-confidence fields.",
      startDate: day(7), dueDate: day(60), valueFils: aed(180000),
      tasks: { create: [
        { title: "Kick-off and system access", status: "TODO", position: 0, dueDate: day(7) },
        { title: "Extraction model on 200 sample B/Ls", status: "TODO", position: 1, dueDate: day(21) },
        { title: "TMS write-back integration", status: "TODO", position: 2, dueDate: day(40) },
        { title: "Exception queue UI", status: "TODO", position: 3, dueDate: day(50) },
        { title: "UAT with the operations team", status: "TODO", position: 4, dueDate: day(57) },
      ] },
    },
  });

  const subtotalFils = subtotalOf(gulflineLines);
  const depositPct = 50;
  // Stored total = what the stage invoices add up to (VAT rounded per stage),
  // matching scheduleTotals() in src/lib/admin/agreement-terms.ts.
  const stageSubtotals = [
    Math.round((subtotalFils * depositPct) / 100),
    Math.round((subtotalFils * 25) / 100),
  ];
  stageSubtotals.push(subtotalFils - stageSubtotals[0] - stageSubtotals[1]);
  const agreementTotalFils = subtotalFils + stageSubtotals.reduce((sum, s) => sum + vatOf(s), 0);
  const agreement = await db.agreement.create({
    data: {
      number: agreementNo.next(),
      status: "SENT",
      effectiveDate: day(-6),
      sentAt: ago(5),
      ...gulflineClient,
      currency: "AED",
      subtotalFils,
      vatBps: 500,
      totalFils: agreementTotalFils,
      depositPct,
      midpointPct: 25,
      finalPct: 25,
      midpointMilestone: "TMS integration sign-off",
      projectName: gulflineProject.name,
      background: "Gulfline re-keys roughly 400 bills of lading a week into its TMS; two coordinators spend most of their day on it, and exceptions are chased by email.",
      scope: gulflineLines.map((l) => l.description),
      packageRef: "Package 1: Automate + Package 4: AI Agents & Intelligent Solutions",
      deliverables: [
        "Document AI extraction of bills of lading into the TMS",
        "Exception queue for low-confidence fields, with one-click correction",
        "Setup guide and handover documentation",
        "One training session (30 minutes) for the operations team",
      ],
      outOfScope: [
        "Automation of any system or process not listed in the Scope of Work — can be added as a separate change request",
        "The customs declaration module",
        "Ongoing maintenance after the warranty period — covered under a separate support arrangement",
      ],
      assumptions: [
        "Client will provide access to the TMS test environment and 200 sample bills of lading within 3 business days of signing",
        "Client will designate one point of contact for feedback and approvals",
        "The TMS import format will not change materially during the project",
      ],
      milestones: [
        { label: "Project start (after deposit received)", date: dayKey(7) },
        { label: "Extraction model on 200 sample B/Ls", date: dayKey(21) },
        { label: "TMS integration sign-off", date: dayKey(40) },
        { label: "Client review & feedback", date: dayKey(50) },
        { label: "Final delivery", date: dayKey(60) },
      ],
      leadId: gulfline,
      quoteId: gulflineQuote.id,
      projectId: gulflineProject.id,
    },
  });
  // Worded like the agreement page's "Create invoice" for a payment stage.
  const deposit = await db.invoice.create({
    data: {
      number: invoiceNo.next(), leadId: gulfline, projectId: gulflineProject.id, status: "SENT",
      agreementId: agreement.id, installment: "DEPOSIT",
      // Due on the agreement's payment terms (14 days).
      issueDate: day(-5), dueDate: day(9), ...gulflineClient,
      notes: `Payment due upon signing, before any work begins, as per Section 2 of Service Agreement ${agreement.number}.`,
      items: { create: withPositions([{
        description: `Deposit (${depositPct}%) — Service Agreement ${agreement.number}: ${agreement.projectName}`,
        quantity: 1,
        unitPriceFils: Math.round((subtotalFils * depositPct) / 100),
      }]) },
    },
  });
  invoiceCount++;
  const q = gulflineQuote.number;
  timeline.push(
    { leadId: gulfline, kind: "EVENT", body: `Quotation ${q} accepted.`, createdAt: ago(6), authorId: gulflineOwner },
    { leadId: gulfline, kind: "EVENT", body: `Stage changed from Quotation sent to Won — quotation ${q} accepted.`, createdAt: ago(6, 1), authorId: gulflineOwner },
    { leadId: gulfline, kind: "EVENT", body: `Service agreement ${agreement.number} generated from quotation ${q}.`, createdAt: ago(6, 2), authorId: gulflineOwner },
    { leadId: gulfline, kind: "EVENT", body: `Project “${gulflineProject.name}” created from service agreement ${agreement.number}.`, createdAt: ago(6, 3), authorId: gulflineOwner },
    { leadId: gulfline, kind: "EVENT", body: `Service agreement ${agreement.number} sent for signature.`, createdAt: ago(5), authorId: gulflineOwner },
    { leadId: gulfline, kind: "EVENT", body: `Invoice ${deposit.number} created for the deposit (${depositPct}%) of service agreement ${agreement.number}.`, createdAt: ago(5, 1), authorId: gulflineOwner },
  );

  // Proposal stage: a sent quote.
  await db.quote.create({
    data: {
      number: quoteNo.next(), leadId: ids.crescent, status: "SENT", issueDate: day(-3), validUntil: day(27),
      clientName: "Priya Raman", clientEmail: "priya@example.com", clientCompany: "Crescent Pharma Distribution",
      items: { create: withPositions([
        { description: "Demand forecasting service", quantity: 1, unitPriceFils: aed(65000) },
        { description: "Power BI planning dashboards", quantity: 1, unitPriceFils: aed(30000) },
      ]) },
    },
  });
  quoteCount++;

  // Invoice sent: a paid scoping workshop, billed before the build is quoted.
  const workshop = await db.invoice.create({
    data: {
      number: invoiceNo.next(), leadId: ids.northwind, status: "SENT", issueDate: day(-7), dueDate: day(7),
      clientName: "Daniel Okafor", clientEmail: "daniel@example.com", clientCompany: "Northwind Freight",
      items: { create: withPositions([{ description: "Scoping workshop and tracking API review", quantity: 1, unitPriceFils: aed(7500) }]) },
    },
  });
  invoiceCount++;
  timeline.push({
    leadId: ids.northwind, kind: "EVENT", createdAt: ago(7),
    body: `Status changed from New to Invoice sent — invoice ${workshop.number} sent.`, authorId: ownerOf.get("northwind") ?? null,
  });

  // An overdue invoice from an earlier engagement with the client since lost, for the finance view.
  await db.invoice.create({
    data: {
      number: invoiceNo.next(), leadId: ids.vela, status: "OVERDUE", issueDate: day(-60), dueDate: day(-30),
      clientName: "Marco Bellini", clientEmail: "marco@example.com", clientCompany: "Vela Industrial",
      items: { create: withPositions([{ description: "Portal automation discovery", quantity: 4, unitPriceFils: aed(3500) }]) },
    },
  });
  invoiceCount++;

  await db.activity.createMany({ data: activities });
  await db.note.createMany({ data: timeline });

  // ── Expenses: a year of running costs, and costs booked to two projects ──
  // [days ago, AED, category key (src/lib/admin/expenses.ts), description, paid to, project]
  const costs: [number, number, string, string, string | null, string | null][] = [
    ...Array.from({ length: 12 }, (_, m): [number, number, string, string, string | null, string | null] =>
      [m * 30 + 3, 1250, "software", "Office suite and email, 5 seats", "Software subscription", null]),
    ...Array.from({ length: 12 }, (_, m): [number, number, string, string, string | null, string | null] =>
      [m * 30 + 9, 3500, "office", "Coworking desks, Dubai", "Coworking space", null]),
    [210, 12500, "licences", "Trade licence renewal", "Free zone authority", null],
    [150, 2400, "hosting", "Cloud hosting credits", "Cloud provider", null],
    [58, 850, "marketing", "LinkedIn campaign: logistics decision makers", "LinkedIn", null],
    [33, 1890, "equipment", "Monitor and laptop dock", "Electronics store", null],
    [12, 450, "bank", "Bank charges, quarterly", "Bank", null],
    [118, 6000, "contractors", "Freelance Power BI developer: data model", "Freelance developer", "palmgate"],
    [70, 9000, "contractors", "Freelance Power BI developer: dashboards", "Freelance developer", "palmgate"],
    [20, 1500, "software", "Power BI Pro licences, 3 months", "Software subscription", "palmgate"],
    [4, 2200, "software", "Document AI test credits", "Cloud provider", "gulfline"],
    [2, 180, "travel", "Taxi to the client's Jebel Ali site", null, "gulfline"],
  ];
  await db.expense.createMany({
    data: costs.map(([daysAgo, amount, category, description, vendor, project]) => ({
      date: day(-daysAgo),
      createdAt: ago(daysAgo),
      amountFils: aed(amount),
      category,
      description,
      vendor,
      leadId: project ? ids[project] : null,
    })),
  });

  // Keep the live counters ahead of every number the seed used.
  await raiseCounter("quote", quoteNo.last());
  await raiseCounter("invoice", invoiceNo.last());
  await raiseCounter("agreement", agreementNo.last());

  console.log(
    `Seeded ${LEADS.length} demo leads (${activities.length} activities, ${timeline.length} timeline entries), ` +
      `${quoteCount} quotes, ${invoiceCount} invoices, 1 service agreement (${agreement.number}), 2 projects, ` +
      `${costs.length} expenses. ` +
      (admins.length
        ? `Leads are owned by ${admins.length} admin ${admins.length === 1 ? "account" : "accounts"}.`
        : "No admin accounts yet, so the leads have no owner."),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

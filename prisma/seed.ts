/**
 * Demo data for local development ONLY.
 *
 * Refuses to run against anything but a localhost database, so a stray
 * `npm run db:seed` with production credentials can never pollute real CRM
 * data with invented clients. Every record it creates is tagged
 * source = "demo" so it is easy to find and delete.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("Refusing to seed: DATABASE_URL is not a localhost database.");
  process.exit(1);
}

const db = new PrismaClient();
const day = 86_400_000;
const ago = (n: number) => new Date(Date.now() - n * day);
const ahead = (n: number) => new Date(Date.now() + n * day);
const aed = (n: number) => Math.round(n * 100);

const LEADS = [
  { name: "Omar Haddad", company: "Gulfline Logistics", size: "201–1000 employees", industry: "Logistics & 3PL", city: "Dubai", country: "United Arab Emirates", services: ["Power Automate / Power Platform", "Document intelligence"], budget: "$50,000 – $150,000", status: "WON", days: 58, value: 180000, msg: "We re-key roughly 400 bills of lading a week into our TMS. Two people spend most of their day on it." },
  { name: "Priya Raman", company: "Crescent Pharma Distribution", size: "51–200 employees", industry: "Pharmaceutical & healthcare", city: "Abu Dhabi", country: "United Arab Emirates", services: ["Forecasting & analytics", "Dashboards & reporting"], budget: "$15,000 – $50,000", status: "PROPOSAL", days: 21, value: 95000, msg: "Stockouts on fast movers and expiry write-offs on the slow ones. Planning lives in twelve linked workbooks." },
  { name: "Daniel Okafor", company: "Northwind Freight", size: "11–50 employees", industry: "Freight forwarding", city: "Sharjah", country: "United Arab Emirates", services: ["AI chatbot / support agent"], budget: "$15,000 – $50,000", status: "QUALIFIED", days: 14, value: 60000, msg: "Customers email all day asking where their shipment is. We want WhatsApp answers from our tracking data." },
  { name: "Sara Al Mansoori", company: "Al Noor Retail Group", size: "1000+ employees", industry: "Retail & e-commerce", city: "Dubai", country: "United Arab Emirates", services: ["System integration & EDI", "Power Automate / Power Platform"], budget: "$150,000+", status: "CONTACTED", days: 6, value: 420000, msg: "Our ERP, WMS and Shopify do not talk. Orders are copied between them by hand every morning." },
  { name: "Liam Chen", company: null, size: null, industry: null, city: "Singapore", country: "Singapore", services: ["Excel & VBA engineering"], budget: "Under $5,000", status: "NEW", days: 1, value: null, msg: "I run procurement for a small distributor and my costing workbook crashes every month-end." },
  { name: "Fatima Zahra", company: "Atlas Food Supply", size: "51–200 employees", industry: "Food & beverage", city: "Riyadh", country: "Saudi Arabia", services: ["Document intelligence", "Dashboards & reporting"], budget: "$5,000 – $15,000", status: "NEW", days: 0, value: null, msg: "Supplier invoices arrive as scanned PDFs and we match them against POs manually." },
  { name: "Marco Bellini", company: "Vela Industrial", size: "201–1000 employees", industry: "Construction & industrial", city: "Doha", country: "Qatar", services: ["Process & workflow automation"], budget: "$15,000 – $50,000", status: "LOST", days: 44, value: 70000, msg: "Portal data collection from twelve supplier sites." },
  { name: "Aisha Rahman", company: "Meridian Electronics", size: "11–50 employees", industry: "Electronics", city: "Dubai", country: "United Arab Emirates", services: ["Embedded AI copilot"], budget: "Need guidance on budget", status: "NEW", days: 3, value: null, msg: "Exploring an AI assistant inside our ERP for quote drafting." },
] as const;

async function main() {
  await db.$transaction([
    db.task.deleteMany({ where: { project: { lead: { source: "demo" } } } }),
    db.lineItem.deleteMany({ where: { OR: [{ quote: { lead: { source: "demo" } } }, { invoice: { lead: { source: "demo" } } }] } }),
    db.invoice.deleteMany({ where: { lead: { source: "demo" } } }),
    db.quote.deleteMany({ where: { lead: { source: "demo" } } }),
    db.project.deleteMany({ where: { lead: { source: "demo" } } }),
    db.note.deleteMany({ where: { lead: { source: "demo" } } }),
    db.lead.deleteMany({ where: { source: "demo" } }),
  ]);

  const leads: Record<string, string> = {};
  for (const l of LEADS) {
    const created = await db.lead.create({
      data: {
        source: "demo",
        createdAt: ago(l.days),
        status: l.status,
        clientType: l.company ? "COMPANY" : "INDIVIDUAL",
        fullName: l.name,
        email: `${l.name.split(" ")[0].toLowerCase()}@example.com`,
        phone: "+971 50 000 0000",
        country: l.country,
        city: l.city,
        contactPreference: "Email",
        companyName: l.company,
        companySize: l.size,
        industry: l.industry,
        services: [...l.services],
        timeline: "This quarter",
        budget: l.budget,
        message: l.msg,
        estimatedValueFils: l.value === null ? null : aed(l.value),
        notes: l.status !== "NEW" ? { create: [{ body: "Discovery call booked — walked through the current process.", createdAt: ago(Math.max(l.days - 2, 0)) }] } : undefined,
      },
    });
    leads[l.name] = created.id;
  }

  let q = 0, inv = 0;
  const qn = () => `Q-${new Date().getFullYear()}-${String(++q).padStart(4, "0")}`;
  const invn = () => `INV-${new Date().getFullYear()}-${String(++inv).padStart(4, "0")}`;

  // Won deal: accepted quote -> project -> two invoices (one paid, one open)
  const omar = leads["Omar Haddad"];
  const project = await db.project.create({
    data: {
      name: "Bill of lading intake automation", leadId: omar, status: "IN_PROGRESS",
      description: "Document AI extraction of B/Ls into the TMS with exception queue.",
      startDate: ago(40), dueDate: ahead(20), valueFils: aed(180000),
      tasks: { create: [
        { title: "Process mapping session", status: "DONE", position: 0 },
        { title: "Extraction model on 200 sample B/Ls", status: "DONE", position: 1 },
        { title: "TMS write-back integration", status: "DOING", position: 2, dueDate: ahead(5) },
        { title: "Exception queue UI", status: "TODO", position: 3, dueDate: ahead(12) },
        { title: "UAT with operations team", status: "TODO", position: 4, dueDate: ahead(18) },
      ] },
    },
  });
  const quote = await db.quote.create({
    data: {
      number: qn(), leadId: omar, status: "ACCEPTED", issueDate: ago(50), validUntil: ago(20),
      clientName: "Omar Haddad", clientEmail: "omar@example.com", clientCompany: "Gulfline Logistics",
      items: { create: [
        { description: "Process mapping & baseline", quantity: 1, unitPriceFils: aed(15000), position: 0 },
        { description: "Document AI extraction build", quantity: 1, unitPriceFils: aed(120000), position: 1 },
        { description: "TMS integration (days)", quantity: 15, unitPriceFils: aed(3000), position: 2 },
      ] },
    },
  });
  await db.invoice.create({
    data: {
      number: invn(), leadId: omar, quoteId: quote.id, projectId: project.id, status: "PAID",
      issueDate: ago(38), dueDate: ago(8), paidAt: ago(10),
      clientName: "Omar Haddad", clientEmail: "omar@example.com", clientCompany: "Gulfline Logistics",
      items: { create: [{ description: "Deposit — 50% of project fee", quantity: 1, unitPriceFils: aed(90000), position: 0 }] },
    },
  });
  await db.invoice.create({
    data: {
      number: invn(), leadId: omar, projectId: project.id, status: "SENT", issueDate: ago(4), dueDate: ahead(26),
      clientName: "Omar Haddad", clientEmail: "omar@example.com", clientCompany: "Gulfline Logistics",
      items: { create: [{ description: "Milestone 2 — integration complete", quantity: 1, unitPriceFils: aed(54000), position: 0 }] },
    },
  });

  // Proposal stage: a sent quote
  const priya = leads["Priya Raman"];
  await db.quote.create({
    data: {
      number: qn(), leadId: priya, status: "SENT", issueDate: ago(3), validUntil: ahead(27),
      clientName: "Priya Raman", clientEmail: "priya@example.com", clientCompany: "Crescent Pharma Distribution",
      items: { create: [
        { description: "Demand forecasting service", quantity: 1, unitPriceFils: aed(65000), position: 0 },
        { description: "Power BI planning dashboards", quantity: 1, unitPriceFils: aed(30000), position: 1 },
      ] },
    },
  });

  // An overdue invoice from an earlier engagement, for the finance view
  await db.invoice.create({
    data: {
      number: invn(), leadId: leads["Marco Bellini"], status: "OVERDUE", issueDate: ago(60), dueDate: ago(30),
      clientName: "Marco Bellini", clientEmail: "marco@example.com", clientCompany: "Vela Industrial",
      items: { create: [{ description: "Portal automation discovery", quantity: 4, unitPriceFils: aed(3500), position: 0 }] },
    },
  });

  // A second project in planning
  await db.project.create({
    data: {
      name: "WhatsApp shipment status agent", leadId: leads["Daniel Okafor"], status: "PLANNING",
      startDate: ahead(7), dueDate: ahead(45), valueFils: aed(60000),
      tasks: { create: [
        { title: "Agree data access to tracking API", status: "TODO", position: 0 },
        { title: "Draft conversation flows", status: "TODO", position: 1 },
      ] },
    },
  });

  // Keep the live counters ahead of the numbers the seed consumed.
  const year = new Date().getFullYear();
  await db.counter.upsert({ where: { key: `quote-${year}` }, create: { key: `quote-${year}`, value: q }, update: { value: q } });
  await db.counter.upsert({ where: { key: `invoice-${year}` }, create: { key: `invoice-${year}`, value: inv }, update: { value: inv } });

  console.log(`Seeded ${LEADS.length} demo leads, ${q} quotes, ${inv} invoices, 2 projects.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());

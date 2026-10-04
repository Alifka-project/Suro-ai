/**
 * FAQ content. Rendered by the FAQ section and published as FAQPage
 * structured data, so the visible answers and what search engines read are
 * the same text. Plain strings only — no markup — for that reason.
 */
export type FaqItem = { q: string; a: string };

export const FAQS: FaqItem[] = [
  {
    q: "Where do I start if I'm not sure what to automate?",
    a: "With an Automation Audit (package 0). We go through your files, systems and manual steps, then tell you where the bottlenecks are, what's worth automating, the time it should save and which technology fits. If the honest answer is that something isn't worth automating, we say so.",
  },
  {
    q: "Do you only work with supply chain teams?",
    a: "No. Our background is in supply chain and logistics, and the same problems show up everywhere: repetitive manual work, scattered data and fragile spreadsheets. We work with finance, procurement, HR, sales, legal, manufacturing and management teams as well.",
  },
  {
    q: "How is the price decided?",
    a: "We price by scope. After the first session we send a fixed price for a defined build. What moves it: how many systems are involved, whether they have usable APIs, data volume, how many exception rules exist, and whether you need us in your security review. That's why the form asks about company size and systems.",
  },
  {
    q: "Is my task too small for you?",
    a: "No. One repetitive task, such as renaming and filing invoices or sending the same email every day, is a sensible first project. That's package 1, Automate. If a tool you already have can do the job without us, we'll tell you.",
  },
  {
    q: "Do we have to change the tools we use?",
    a: "Not for packages 1 to 3. We work inside the Excel, Outlook, SharePoint, OneDrive, ERP and CRM you already have. A new tool only comes in when you ask for one (package 5) or when the problem really needs it, and we explain why first.",
  },
  {
    q: "We're not on Microsoft. Does that rule you out?",
    a: "No. A lot of our work runs on Microsoft 365 and Power Platform because that's what most clients already use, but we build in Python, SQL and web technologies just as often. Google Workspace, Odoo, NetSuite or your own stack: the approach doesn't change.",
  },
  {
    q: "Can you take over a project another developer started?",
    a: "Yes. That's Project Rescue & Recovery (package 6). We assess what exists, find out why it's stuck, fix it, finish it and deploy it, whether the previous developer left, the vendor didn't deliver or the prototype never worked properly.",
  },
  {
    q: "How do you stop an AI assistant inventing answers?",
    a: "It answers only from your data. Every response is based on a record retrieved from your systems, with a link back to the source. When the data doesn't support an answer, it says so and passes the question to a person instead of guessing.",
  },
  {
    q: "What happens after handover?",
    a: "You get documentation, the source and a walkthrough with whoever will maintain it. We build on your own accounts and licences wherever possible, so you're not locked in to us. If you want us to keep monitoring and improving it, Support & Continuous Improvement (package 8) is available as a monthly retainer.",
  },
  {
    q: "Do you work with individuals and small teams?",
    a: "Yes. The form has an individual option for that reason. A one-person business buried in spreadsheet work is a good project, and it's priced differently from an enterprise rollout.",
  },
];

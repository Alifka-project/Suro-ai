/**
 * FAQ content: the five questions people ask most. Rendered by the FAQ
 * section and published as FAQPage structured data, so the visible answers
 * and what search engines read are the same text. Plain strings only — no
 * markup — for that reason. Pricing is left to the first conversation, so it
 * isn't answered here.
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
    q: "Is my task too small for you?",
    a: "No. One repetitive task, such as renaming and filing invoices or sending the same email every day, is a sensible first project. That's package 1, Automate. If a tool you already have can do the job without us, we'll tell you.",
  },
  {
    q: "Do we have to change the tools we use?",
    a: "Not for packages 1 to 3. We work inside the Excel, Outlook, SharePoint, OneDrive, ERP and CRM you already have. A new tool only comes in when you ask for one (package 5) or when the problem really needs it, and we explain why first.",
  },
  {
    q: "What happens after handover?",
    a: "You get documentation, the source and a walkthrough with whoever will maintain it. We build on your own accounts and licences wherever possible, so you're not locked in to us. If you want us to keep monitoring and improving it, that's Support & Continuous Improvement (package 8).",
  },
];

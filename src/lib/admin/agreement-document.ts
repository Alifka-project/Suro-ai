/**
 * The Service Agreement + Statement of Work as a document model: numbered
 * sections of paragraphs, bullet lists, a timeline table and signature
 * blocks. The printable web page and the .docx download both render THIS
 * model, so the two can never say different things.
 *
 * Wording follows SULOAI's service agreement template, with the template's
 * placeholders filled from the agreement record and its clause numbering
 * corrected (the template skipped from 10 to 12).
 *
 * Pure — safe in Server and Client Components.
 */
import { BUSINESS } from "./business";
import { formatMoney, formatVat } from "./money";
import { dateInputToDate, formatBusinessDate } from "./time";
import {
  bpsToPercentText,
  installmentPlan,
  parseMilestones,
  scheduleTotals,
  type ScheduleTerms,
} from "./agreement-terms";

/** A run of text. `placeholder` marks a gap still to be filled in the draft. */
export type Run = { text: string; bold?: boolean; placeholder?: boolean };
export type Paragraph = Run[];

export type Block =
  | { kind: "paragraph"; runs: Paragraph }
  | { kind: "bullets"; items: BulletItem[] }
  | { kind: "details"; rows: { label: string; value: Paragraph }[] }
  | { kind: "table"; head: [string, string]; rows: [string, string][] }
  | { kind: "signatures"; parties: SignatureParty[] };

/** Level 1 items are nested under the level 0 item before them. */
export type BulletItem = { runs: Paragraph; level: 0 | 1 };

export type SignatureParty = { role: string; organisation: string; printName?: string };

export type DocSection = { number: number | null; title: string; blocks: Block[] };

export type DocPart = {
  title: string;
  /** Shown under the title, e.g. "SA-2026-0001". */
  reference: string;
  sections: DocSection[];
};

export type AgreementDocument = {
  agreement: DocPart;
  sow: DocPart;
  /** The effective date as printed, e.g. "28 Sept 2026". */
  dateLabel: string;
  fileName: string;
};

/**
 * What the document needs from an Agreement row (plus its quote number, if any).
 * The fee total is worked out from the payment schedule (see scheduleTotals),
 * so the contract always states exactly what its stage invoices add up to.
 */
export type AgreementDocInput = ScheduleTerms & {
  number: string;
  effectiveDate: Date | string;
  clientName: string;
  clientCompany: string | null;
  currency: string;
  invoiceDueDays: number;
  lateFeeBps: number;
  feedbackDays: number;
  warrantyDays: number;
  terminationNoticeDays: number;
  projectName: string;
  background: string;
  scope: string[];
  packageRef: string | null;
  deliverables: string[];
  outOfScope: string[];
  assumptions: string[];
  milestones: unknown;
  quoteNumber?: string | null;
};

const t = (text: string, extra?: Omit<Run, "text">): Run => ({ text, ...extra });
const b = (text: string): Run => ({ text, bold: true });
const todo = (text: string): Run => ({ text: `[${text}]`, placeholder: true });
const para = (...runs: Run[]): Block => ({ kind: "paragraph", runs });
const bullets = (items: Paragraph[], level: 0 | 1 = 0): Block => ({
  kind: "bullets",
  items: items.map((runs) => ({ runs, level })),
});
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** "Gulfline Logistics (represented by Omar Haddad)", or just the person for an individual. */
export function clientParty(a: { clientName: string; clientCompany: string | null }): string {
  const company = a.clientCompany?.trim();
  return company ? `${company} (represented by ${a.clientName})` : a.clientName;
}

function listOrTodo(items: string[], what: string): Block {
  return items.length ? bullets(items.map((i) => [t(i)])) : para(todo(`Add ${what}`));
}

export function buildAgreementDocument(a: AgreementDocInput): AgreementDocument {
  const money = (fils: number) => formatMoney(fils, a.currency);
  const effective = formatBusinessDate(a.effectiveDate);
  const party = clientParty(a);
  const shortClient = a.clientCompany?.trim() || a.clientName;
  const plan = installmentPlan(a);
  const totals = scheduleTotals(a);
  const hasVat = a.vatBps > 0;

  const feeRuns: Run[] = hasVat
    ? [
        b("Total project fee: "),
        t(`${money(totals.subtotalFils)} excluding VAT (VAT ${formatVat(a.vatBps)}: ${money(totals.vatFils)}; total ${money(totals.totalFils)})`),
      ]
    : [b("Total project fee: "), t(money(totals.totalFils))];

  const scheduleItems: Paragraph[] = plan.map((line) => [
    b(`${line.pct}%`),
    t(` (${money(line.subtotalFils)}${hasVat ? " + VAT" : ""}) ${line.due}`),
  ]);

  const paymentBullets: BulletItem[] = [
    { runs: feeRuns, level: 0 },
    { runs: [b("Payment schedule:")], level: 0 },
    ...scheduleItems.map((runs) => ({ runs, level: 1 as const })),
    { runs: [t(`Invoices are due within ${days(a.invoiceDueDays)} of issue.`)], level: 0 },
    ...(a.lateFeeBps > 0
      ? [
          {
            runs: [
              t(`Late payments incur a ${bpsToPercentText(a.lateFeeBps)}% monthly late fee, calculated on the overdue amount.`),
            ],
            level: 0 as const,
          },
        ]
      : []),
    {
      runs: [
        t(
          "Service Provider may suspend all work, and withhold delivery of any files, code, or credentials, until overdue payment is settled in full.",
        ),
      ],
      level: 0,
    },
  ];

  const agreement: DocPart = {
    title: "Service Agreement",
    reference: a.number,
    sections: [
      {
        number: null,
        title: "Parties",
        blocks: [
          para(
            t("This Service Agreement (“Agreement”) is made between "),
            b(BUSINESS.name),
            t(` of ${BUSINESS.addressLines.join(", ")} (“Service Provider”), and `),
            b(party),
            t(" (“Client”), effective as of "),
            b(effective),
            t("."),
          ),
        ],
      },
      {
        number: 1,
        title: "Scope of Work",
        blocks: [
          para(
            t(
              `Service Provider agrees to deliver the services described in the attached Statement of Work (“SOW”) for “${a.projectName}”, dated ${effective}`,
            ),
            t(a.quoteNumber ? ` and priced in Quotation ${a.quoteNumber}` : ""),
            t(
              ", which forms part of this Agreement. Any work not explicitly listed in the SOW is considered out of scope.",
            ),
          ),
        ],
      },
      { number: 2, title: "Fees & Payment Terms", blocks: [{ kind: "bullets", items: paymentBullets }] },
      {
        number: 3,
        title: "Client Responsibilities",
        blocks: [
          para(
            t(
              `Client agrees to provide timely access to necessary systems, data, and personnel, and to provide feedback and approvals within ${a.feedbackDays} business ${a.feedbackDays === 1 ? "day" : "days"} of request. Delays caused by the Client extend the project timeline accordingly and do not constitute a breach by the Service Provider.`,
            ),
          ),
        ],
      },
      {
        number: 4,
        title: "Change Requests",
        blocks: [
          para(
            t(
              "Any request to change scope, add features, or revise completed work outside the original SOW will be quoted separately and requires written approval before work begins.",
            ),
          ),
        ],
      },
      {
        number: 5,
        title: "Intellectual Property",
        blocks: [
          para(
            t(
              "Upon full and final payment, ownership of custom deliverables (code, workflows, and documents created specifically for this project) transfers to the Client. Until full payment is received, all deliverables remain the property of the Service Provider. Service Provider retains the right to reuse general methods, frameworks, and non-client-specific components in future work for other clients.",
            ),
          ),
        ],
      },
      {
        number: 6,
        title: "Confidentiality",
        blocks: [
          para(
            t(
              "Both parties agree to keep confidential any non-public business, technical, or financial information shared during the engagement, and not to disclose it to third parties without written consent, except as required by law.",
            ),
          ),
        ],
      },
      {
        number: 7,
        title: "Warranties & Disclaimers",
        blocks: [
          para(
            t(
              `Service Provider will perform services with reasonable skill and care. Service Provider does not guarantee that automation will be free of all errors indefinitely, particularly where errors result from changes made by the Client or third-party systems outside Service Provider’s control. Any post-delivery bug fixes related to Service Provider’s own error are covered for ${days(a.warrantyDays)} after delivery at no extra charge (“warranty period”); issues after that are billed under a separate support arrangement.`,
            ),
          ),
        ],
      },
      {
        number: 8,
        title: "Limitation of Liability",
        blocks: [
          para(
            t(
              "Service Provider’s total liability under this Agreement shall not exceed the total fees paid by the Client for the specific service giving rise to the claim. Service Provider is not liable for indirect, incidental, or consequential damages, including lost profits or business interruption.",
            ),
          ),
        ],
      },
      {
        number: 9,
        title: "Termination",
        blocks: [
          para(
            t(
              `Either party may terminate this Agreement with ${days(a.terminationNoticeDays)}’ written notice. If the Client terminates before completion, the Client must pay for all work completed up to the termination date. If the Service Provider terminates, any deposit for undelivered work will be refunded on a pro-rata basis.`,
            ),
          ),
        ],
      },
      {
        number: 10,
        title: "Force Majeure",
        blocks: [
          para(
            t(
              "Neither party is liable for delays or failure to perform due to circumstances beyond their reasonable control (e.g. natural disasters, government action, internet or infrastructure outages).",
            ),
          ),
        ],
      },
      {
        number: 11,
        title: "Entire Agreement",
        blocks: [
          para(
            t(
              "This Agreement, together with the SOW, constitutes the entire agreement between the parties and supersedes all prior discussions or agreements, written or oral.",
            ),
          ),
        ],
      },
      {
        number: null,
        title: "Signatures",
        blocks: [
          {
            kind: "signatures",
            parties: [
              { role: "Service Provider", organisation: BUSINESS.name },
              { role: "Client", organisation: shortClient, printName: a.clientName },
            ],
          },
        ],
      },
    ],
  };

  const milestones = parseMilestones(a.milestones);

  const sow: DocPart = {
    title: "Statement of Work",
    reference: `${a.number} · SOW`,
    sections: [
      {
        number: null,
        title: "Overview",
        blocks: [
          {
            kind: "details",
            rows: [
              { label: "Client", value: [t(party)] },
              { label: "Project name", value: [t(a.projectName)] },
              { label: "Date", value: [t(effective)] },
              { label: "Prepared by", value: [t(BUSINESS.name)] },
              {
                label: "Linked agreement",
                value: [
                  t(
                    `This SOW is governed by Service Agreement ${a.number} dated ${effective} between ${BUSINESS.name} and ${shortClient}.`,
                  ),
                ],
              },
            ],
          },
        ],
      },
      {
        number: 1,
        title: "Background / Problem Statement",
        blocks: a.background.trim()
          ? a.background
              .trim()
              .split(/\n{2,}/)
              .map((p) => para(t(p.replace(/\s*\n\s*/g, " "))))
          : [para(todo("Describe the Client’s current situation and the cost of it — time, errors, risk"))],
      },
      {
        number: 2,
        title: "Scope of Work",
        blocks: [
          listOrTodo(a.scope, "the tasks SULOAI will build or deliver"),
          ...(a.packageRef?.trim() ? [para(b("Package reference: "), t(a.packageRef.trim()))] : []),
        ],
      },
      { number: 3, title: "Deliverables", blocks: [listOrTodo(a.deliverables, "what the Client receives at the end")] },
      { number: 4, title: "Out of Scope", blocks: [listOrTodo(a.outOfScope, "what is not included")] },
      {
        number: 5,
        title: "Client Responsibilities / Assumptions",
        blocks: [listOrTodo(a.assumptions, "what is needed from the Client and what is assumed")],
      },
      {
        number: 6,
        title: "Timeline",
        blocks: milestones.length
          ? [
              {
                kind: "table",
                head: ["Milestone", "Target date"],
                rows: milestones.map((m) => {
                  const date = m.date ? dateInputToDate(m.date) : null;
                  return [m.label, date ? formatBusinessDate(date) : "To be confirmed"];
                }),
              },
            ]
          : [para(todo("Add the project milestones and target dates"))],
      },
      {
        number: 7,
        title: "Fees",
        blocks: [
          para(...feeRuns),
          para(b("Payment schedule: "), t("as per Section 2 of the Service Agreement.")),
        ],
      },
      {
        number: 8,
        title: "Sign-off",
        blocks: [
          {
            kind: "signatures",
            parties: [
              { role: "Service Provider", organisation: BUSINESS.name },
              { role: "Client", organisation: shortClient, printName: a.clientName },
            ],
          },
        ],
      },
    ],
  };

  const slug = shortClient
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);

  return {
    agreement,
    sow,
    dateLabel: effective,
    fileName: `${a.number}${slug ? `-${slug}` : ""}-Service-Agreement.docx`,
  };
}

/** Plain text of a paragraph, for accessibility labels and tests. */
export function runsToText(runs: Paragraph): string {
  return runs.map((r) => r.text).join("");
}

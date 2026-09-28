/** Plain, serializable shapes passed between billing Server and Client Components. */

export type DocumentKind = "quote" | "invoice";

/** A follow-up link shown with an action's notice, e.g. the generated agreement. */
export type NoticeLink = { label: string; href: string };

/**
 * Result of a status / delete / convert action. Undefined before the first
 * submit. `notice` is a success message worth reading ("Service agreement
 * SA-… generated · opportunity marked Won"), with optional follow-up links.
 */
export type ActionState = { error?: string; notice?: string; links?: NoticeLink[] } | undefined;

export type EditorItemInput = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export type EditorField =
  | "clientName"
  | "clientEmail"
  | "clientCompany"
  | "issueDate"
  | "validUntil"
  | "dueDate"
  | "vat"
  | "notes"
  | "items"
  | "leadId"
  | "projectId";

export type EditorState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<EditorField, string>>;
      itemErrors?: Record<number, Partial<Record<keyof EditorItemInput, string>>>;
    }
  | undefined;

export type LeadOption = {
  id: string;
  name: string;
  /** Optional in the CRM: a card for a client being approached may have no email yet. */
  email: string | null;
  company: string | null;
  /** The admin's CRM estimate, shown in the editor as a pricing reference. */
  estimatedValueFils: number | null;
};

export type ProjectOption = {
  id: string;
  name: string;
  leadId: string | null;
  clientLabel: string | null;
};

export type EditorInitial = {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  issueDate: string;
  /** Valid-until for quotes, due date for invoices ("YYYY-MM-DD"). */
  secondDate: string;
  vatPercent: string;
  notes: string;
  items: EditorItemInput[];
  leadId: string;
  projectId: string;
};

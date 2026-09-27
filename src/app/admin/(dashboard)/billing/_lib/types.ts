/** Plain, serializable shapes passed between billing Server and Client Components. */

export type DocumentKind = "quote" | "invoice";

/** Result of a status / delete / convert action. Undefined before the first submit. */
export type ActionState = { error?: string } | undefined;

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
  email: string;
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

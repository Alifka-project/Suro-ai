/**
 * Shapes shared by the agreement editor (client) and its Server Action. Types
 * only — a "use server" file may export nothing but async functions.
 */

/** One row of the SOW timeline editor. `date` is "YYYY-MM-DD" or "" (to be confirmed). */
export type MilestoneInput = { label: string; date: string };

/** Raw form strings, exactly as the admin typed them. */
export type AgreementFormValues = {
  effectiveDate: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  depositPct: string;
  midpointPct: string;
  finalPct: string;
  midpointMilestone: string;
  invoiceDueDays: string;
  /** Monthly late fee as a percentage, e.g. "2" or "1.5". */
  lateFee: string;
  feedbackDays: string;
  warrantyDays: string;
  terminationNoticeDays: string;
  projectName: string;
  packageRef: string;
  background: string;
  /** Textareas: one item per line. */
  scope: string;
  deliverables: string;
  outOfScope: string;
  assumptions: string;
  milestones: MilestoneInput[];
};

/** Form fields plus "schedule", the three percentages taken together. */
export type AgreementField = keyof AgreementFormValues | "schedule";

export type AgreementEditorState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<AgreementField, string>>;
      /** Timeline row errors, by the row's position when the form was submitted. */
      milestoneErrors?: Record<number, Partial<Record<keyof MilestoneInput, string>>>;
      /**
       * Set when the save was refused because the agreement changed after the
       * editor opened (e.g. refreshed from its quotation). Saving again with
       * this version overwrites those changes deliberately.
       */
      version?: string;
    }
  | undefined;

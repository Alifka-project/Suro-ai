/**
 * Shapes shared between the projects Server Actions and the client forms that
 * call them. Types only — a "use server" file may export nothing but async
 * functions, so these live here instead of in actions.ts.
 */

export type LeadOption = { id: string; label: string };

/** Raw form strings, echoed back so a failed submit never wipes the user's input. */
export type ProjectFormValues = {
  name: string;
  description: string;
  leadId: string;
  status: string;
  startDate: string;
  dueDate: string;
  value: string;
};

export type ProjectFormField = keyof ProjectFormValues;
export type ProjectFormErrors = Partial<Record<ProjectFormField, string>>;

/**
 * Set when saving would move a project with linked invoices to a different
 * client. The form then asks for an explicit confirmation before resubmitting.
 */
export type ClientChangeWarning = { invoiceCount: number; billedTo: string };

export type ProjectFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      errors: ProjectFormErrors;
      values: ProjectFormValues;
      submittedAt: number;
      /** Edit form only: the project version the next save is checked against. */
      version?: string;
      clientChange?: ClientChangeWarning;
    }
  | { status: "success"; message: string; values: ProjectFormValues; submittedAt: number; version?: string };

export type TaskFormValues = { title: string; dueDate: string };
export type TaskFormErrors = Partial<Record<keyof TaskFormValues, string>>;

export type TaskFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      errors: TaskFormErrors;
      values: TaskFormValues;
      submittedAt: number;
    }
  | { status: "success"; submittedAt: number };

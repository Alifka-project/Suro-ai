"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, Save } from "lucide-react";
import { Button, Card, CardHeader, Field, cn, fieldMessageId, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { MAX_TAGS } from "@/lib/admin/pipeline";
import { updateLeadDetails } from "../../actions";
import { FormMessage } from "../../_components/FormMessage";
import { seed, withEcho, type EchoState } from "../../_components/OppFormState";

/** The opportunity's editable fields, as the strings the form inputs start from. */
export type DetailsValues = {
  title: string;
  fullName: string;
  clientType: "COMPANY" | "INDIVIDUAL";
  companyName: string;
  role: string;
  industry: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  value: string;
  probability: string;
  expectedCloseDate: string;
  tags: string;
  ownerId: string;
};

type Member = { id: string; name: string };

const detailsWithEcho = withEcho(updateLeadDetails);

/**
 * Odoo's opportunity form: a read view (rendered on the server and passed in)
 * with an Edit button that swaps in the form. A successful save returns to
 * the read view, which the revalidation has already refreshed.
 *
 * The form also carries the lead's `version` (its updatedAt). The server
 * refuses a save if the lead changed after that version, so a form opened
 * earlier can't silently write its stale values over a newer change.
 */
export function DetailsCard({
  leadId,
  version,
  values,
  team,
  inactiveOwner,
  stageProbability,
  probabilityHint,
  readView,
}: {
  leadId: string;
  /** The lead's updatedAt as an ISO string: the version `values` were read at. */
  version: string;
  values: DetailsValues;
  /** Active admins, for the salesperson picker. */
  team: Member[];
  /** The current salesperson when their account is deactivated (so the picker can still show them). */
  inactiveOwner: Member | null;
  stageProbability: number;
  probabilityHint: string;
  readView: ReactNode;
}) {
  const [state, formAction] = useActionState(detailsWithEcho, null);
  const [editing, setEditing] = useState(false);
  // The result already on screen when the form was last opened: a failed
  // attempt from an earlier, cancelled edit must not re-seed or flag the
  // fields of a fresh one. (Compared by identity — every attempt returns a new object.)
  const [staleState, setStaleState] = useState<EchoState>(null);
  // After leaving the form, the Edit button takes focus back (autoFocus on remount).
  const [returnFocus, setReturnFocus] = useState(false);

  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setEditing(false);
      setReturnFocus(true);
    }
  }

  function stopEditing() {
    setEditing(false);
    setReturnFocus(true);
  }

  return (
    <Card>
      <CardHeader
        title="Opportunity"
        subtitle={editing ? "Opportunity, contact and company details." : "Revenue, probability, salesperson and contact."}
        action={
          !editing && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              autoFocus={returnFocus}
              onClick={() => {
                setStaleState(state);
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          )
        }
      />
      {editing ? (
        <DetailsForm
          key={state?.at ?? 0}
          leadId={leadId}
          version={version}
          values={values}
          team={team}
          inactiveOwner={inactiveOwner}
          stageProbability={stageProbability}
          probabilityHint={probabilityHint}
          state={state !== staleState ? state : null}
          formAction={formAction}
          onCancel={stopEditing}
        />
      ) : (
        readView
      )}
      {/* The confirmation belongs to the last save; editing again retires it. */}
      <FormMessage state={!editing && state?.ok && state !== staleState ? state : null} />
    </Card>
  );
}

function DetailsForm({
  leadId,
  version,
  values,
  team,
  inactiveOwner,
  stageProbability,
  probabilityHint,
  state,
  formAction,
  onCancel,
}: {
  leadId: string;
  version: string;
  values: DetailsValues;
  team: Member[];
  inactiveOwner: Member | null;
  stageProbability: number;
  probabilityHint: string;
  state: EchoState;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const v = (name: keyof DetailsValues) => seed(state, name, values[name]);
  // The version the fields were loaded at, captured as they mount: a later
  // refresh of the page (a newer version in props) must not quietly bless
  // edits started from older values. After a refused save it is the version
  // the server sent back, so saving again overwrites deliberately; after any
  // other failure, the one this edit started from.
  const [fieldsVersion] = useState(() => failed?.version ?? seed(state, "version", version));

  // On open, start at the first field; after a failed save, at the first field to fix.
  useEffect(() => {
    const form = formRef.current;
    const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>("input:not([type=hidden])");
    target?.focus();
  }, []);

  /** Props shared by every text input: id, name, saved/echoed value, error wiring. */
  const input = (name: keyof DetailsValues) => ({
    id: `opp-${name}`,
    name,
    defaultValue: v(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldMessageId(`opp-${name}`),
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="space-y-6"
      noValidate
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="version" value={fieldsVersion} />

      <FormSection legend="Opportunity">
        <Field label="Opportunity name" htmlFor="opp-title" error={errors.title} className="sm:col-span-2">
          <input {...input("title")} type="text" maxLength={160} autoComplete="off" placeholder="e.g. B/L intake automation" className={inputClass} />
        </Field>
        <Field label="Expected revenue" htmlFor="opp-value" hint="In AED, before VAT." error={errors.value}>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[0.68rem] font-medium tracking-[0.08em] text-ink-550"
            >
              AED
            </span>
            <input
              {...input("value")}
              type="text"
              inputMode="decimal"
              maxLength={32}
              autoComplete="off"
              placeholder="45,000"
              className={cn(inputClass, "pl-12 tabular-nums")}
            />
          </div>
        </Field>
        <Field label="Probability" htmlFor="opp-probability" hint={probabilityHint} error={errors.probability}>
          <div className="relative">
            <input
              {...input("probability")}
              type="text"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              placeholder={String(stageProbability)}
              className={cn(inputClass, "pr-9 tabular-nums")}
            />
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.82rem] text-ink-550">
              %
            </span>
          </div>
        </Field>
        <Field label="Expected close date" htmlFor="opp-expectedCloseDate" error={errors.expectedCloseDate}>
          <input {...input("expectedCloseDate")} type="date" className={inputClass} />
        </Field>
        <Field label="Salesperson" htmlFor="opp-ownerId" error={errors.ownerId}>
          <select {...input("ownerId")} className={cn(inputClass, "cursor-pointer")}>
            <option value="">No salesperson</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            {inactiveOwner && (
              <option value={inactiveOwner.id}>{inactiveOwner.name} (deactivated)</option>
            )}
          </select>
        </Field>
        <Field
          label="Tags"
          htmlFor="opp-tags"
          hint={`Separate with commas, up to ${MAX_TAGS}. For example: Power Automate, urgent`}
          error={errors.tags}
          className="sm:col-span-2"
        >
          <input {...input("tags")} type="text" maxLength={300} autoComplete="off" className={inputClass} />
        </Field>
      </FormSection>

      <FormSection legend="Contact">
        <Field label="Contact name" htmlFor="opp-fullName" error={errors.fullName}>
          <input {...input("fullName")} type="text" required maxLength={120} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Job title" htmlFor="opp-role" error={errors.role}>
          <input {...input("role")} type="text" maxLength={120} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="opp-email" error={errors.email}>
          <input {...input("email")} type="email" maxLength={254} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="opp-phone" hint="International format (+971…) enables WhatsApp." error={errors.phone}>
          <input {...input("phone")} type="tel" maxLength={40} autoComplete="off" className={inputClass} />
        </Field>
      </FormSection>

      <FormSection legend="Company">
        <Field label="Client type" htmlFor="opp-clientType" error={errors.clientType}>
          <select {...input("clientType")} className={cn(inputClass, "cursor-pointer")}>
            <option value="COMPANY">Company</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </Field>
        <Field label="Company name" htmlFor="opp-companyName" error={errors.companyName}>
          <input {...input("companyName")} type="text" maxLength={160} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Industry" htmlFor="opp-industry" error={errors.industry}>
          <input {...input("industry")} type="text" maxLength={120} autoComplete="off" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" htmlFor="opp-city" error={errors.city}>
            <input {...input("city")} type="text" maxLength={120} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Country" htmlFor="opp-country" error={errors.country}>
            <input {...input("country")} type="text" maxLength={120} autoComplete="off" className={inputClass} />
          </Field>
        </div>
      </FormSection>

      {failed && (
        <p role="alert" className="text-[0.78rem] text-red-600">
          {failed.message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving">
          <Save className="h-4 w-4" aria-hidden="true" />
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

function FormSection({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-mono text-[0.64rem] font-medium uppercase tracking-[0.14em] text-ink-550">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

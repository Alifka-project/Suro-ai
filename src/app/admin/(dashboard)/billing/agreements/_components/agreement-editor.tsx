"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, LoaderCircle, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  buttonClass,
  cn,
  fieldMessageId,
  inputClass,
  textareaClass,
} from "@/components/admin/ui";
import { MAX_MILESTONES, installmentPlan, percentagesProblem } from "@/lib/admin/agreement-terms";
import { formatMoney, formatVat } from "@/lib/admin/money";
import { updateAgreement } from "../actions";
import { MAX_LIST_ITEMS, TERM_BOUNDS, parseLateFeeToBps, parseWholeNumber, readList } from "../_lib/parse";
import type { AgreementField, AgreementFormValues, MilestoneInput } from "../_lib/types";

type TextValues = Omit<AgreementFormValues, "milestones">;
type TextField = keyof TextValues;
type Row = MilestoneInput & { key: string };
type RowErrors = Partial<Record<keyof MilestoneInput, string>>;

const invalidClass = "border-red-300 focus:border-red-400 focus:ring-red-400/15";
const ADD_MILESTONE_ID = "add-milestone";

function newKey() {
  return `milestone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A small uppercase sub-heading inside a card. */
function Subheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 mt-6 border-t border-ink-100 pt-5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] text-ink-500">
      {children}
    </h3>
  );
}

/**
 * Service agreement editor (drafts only). Every field is controlled state, so
 * a failed save never wipes what the admin typed, and the payment schedule
 * preview uses the same maths the server saves and prints with. The Server
 * Action re-validates everything regardless of what this component checked.
 */
export function AgreementEditor({
  agreementId,
  version,
  initial,
  subtotalFils,
  vatBps,
  currency,
  quoteNumber,
  cancelHref,
}: {
  agreementId: string;
  /** updatedAt as the editor opened it; saves are compare-and-set against it. */
  version: string;
  initial: AgreementFormValues;
  subtotalFils: number;
  vatBps: number;
  currency: string;
  quoteNumber: string | null;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(updateAgreement, undefined);

  const { milestones: initialMilestones, ...initialText } = initial;
  const [values, setValues] = useState<TextValues>(initialText);
  const [rows, setRows] = useState<Row[]>(() =>
    initialMilestones.map((m, i) => ({ ...m, key: `milestone-initial-${i}` })),
  );

  // A save refused as stale hands back the current version: the next save
  // then overwrites deliberately. Adopted during render (not in an effect),
  // and kept across later validation errors, which carry no version.
  const [activeVersion, setActiveVersion] = useState(version);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.version) setActiveVersion(state.version);
  }

  // Synchronous latch: `pending` only flips on the next render.
  const submitting = useRef(false);
  useEffect(() => {
    if (!pending) submitting.current = false;
  }, [pending]);

  // Timeline errors come back by position; remember which row sat where.
  const [submittedKeys, setSubmittedKeys] = useState<readonly string[]>([]);

  const fieldErrors: Partial<Record<AgreementField, string>> = state?.fieldErrors ?? {};
  const rowErrorsByKey = new Map<string, RowErrors>();
  for (const [index, errors] of Object.entries(state?.milestoneErrors ?? {})) {
    const key = submittedKeys[Number(index)];
    if (key && errors) rowErrorsByKey.set(key, errors);
  }

  function update(name: TextField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  // ── Live payment schedule ──────────────────────────────────────────────────
  const deposit = parseWholeNumber(values.depositPct, 0, 100);
  const midpoint = parseWholeNumber(values.midpointPct, 0, 100);
  const final = parseWholeNumber(values.finalPct, 0, 100);
  const pctValid = deposit !== null && midpoint !== null && final !== null;
  const pctSum = (deposit ?? 0) + (midpoint ?? 0) + (final ?? 0);
  const scheduleProblem = pctValid ? percentagesProblem(deposit, midpoint, final) : "Each percentage must be a whole number from 0 to 100.";
  const plan = pctValid
    ? installmentPlan({
        subtotalFils,
        vatBps,
        depositPct: deposit,
        midpointPct: midpoint,
        finalPct: final,
        midpointMilestone: values.midpointMilestone,
      })
    : [];
  const lateFeeBps = parseLateFeeToBps(values.lateFee);
  const money = (fils: number) => formatMoney(fils, currency);

  // ── Timeline rows ──────────────────────────────────────────────────────────
  // Reordering or removing a row moves or unmounts the focused button, which
  // drops focus to <body>. The handler records the id that should hold focus
  // next and the layout effect moves it there once the rows are committed.
  const pendingFocus = useRef<string | null>(null);
  const [rowAnnouncement, setRowAnnouncement] = useState("");
  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    document.getElementById(id)?.focus();
  }, [rows]);

  function updateRow(key: string, patch: Partial<MilestoneInput>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((current) => (current.length >= MAX_MILESTONES ? current : [...current, { key: newKey(), label: "", date: "" }]));
  }
  function removeRow(key: string) {
    const index = rows.findIndex((r) => r.key === key);
    if (index === -1) return;
    const neighbour = rows[index + 1] ?? rows[index - 1];
    pendingFocus.current = neighbour ? `${neighbour.key}-label` : ADD_MILESTONE_ID;
    setRows(rows.filter((r) => r.key !== key));
    setRowAnnouncement(`Milestone ${index + 1} removed. ${rows.length - 1} of ${MAX_MILESTONES} left.`);
  }
  function moveRow(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    // Stay on the pressed button; at either end it is now disabled, so take
    // the opposite one.
    const pressed = by === -1 ? "up" : "down";
    const opposite = by === -1 ? "down" : "up";
    const atEnd = target === 0 || target === rows.length - 1;
    pendingFocus.current = `${rows[index].key}-${atEnd ? opposite : pressed}`;
    setRows(next);
    const label = rows[index].label.trim();
    setRowAnnouncement(`${label ? `“${label}”` : "Milestone"} moved to position ${target + 1} of ${rows.length}.`);
  }

  // Submitting through startTransition (rather than <form action>) skips
  // React's automatic form reset, and the latch blocks a second submit.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitting.current) return;
    submitting.current = true;
    const formData = new FormData(event.currentTarget);
    setSubmittedKeys(rows.map((r) => r.key));
    startTransition(() => formAction(formData));
  }

  const milestonesJson = JSON.stringify(rows.map((r) => ({ label: r.label, date: r.date })));

  const listHint = (name: "scope" | "deliverables" | "outOfScope" | "assumptions", lead: string) =>
    `${lead} One item per line · ${readList(values[name]).items.length} of ${MAX_LIST_ITEMS}.`;
  const range = ({ min, max }: { min: number; max: number }) => `${min}–${max}`;

  const hints: Partial<Record<TextField, string>> = {
    effectiveDate: "The date the agreement and SOW take effect.",
    clientName: "Printed as the Client's representative.",
    clientCompany: "Optional. Leave empty for an individual client.",
    clientEmail: "Optional. Used on the stage invoices, not printed on the agreement.",
    midpointMilestone: "The milestone payment is “due upon …” this.",
    invoiceDueDays: `Days the client has to pay each invoice (${range(TERM_BOUNDS.invoiceDueDays)}).`,
    lateFee: lateFeeBps === 0 ? "0% leaves the late-fee sentence out." : "Monthly, on the overdue amount (0–10%).",
    feedbackDays: `Section 3: business days for the Client's feedback (${range(TERM_BOUNDS.feedbackDays)}).`,
    warrantyDays: `Section 7: days of free fixes after delivery (${range(TERM_BOUNDS.warrantyDays)}).`,
    terminationNoticeDays: `Section 9: days of written notice (${range(TERM_BOUNDS.terminationNoticeDays)}).`,
    projectName: "Named in Section 1 and at the top of the SOW.",
    packageRef: "Optional, e.g. the service package the client picked.",
    background: "Optional. Separate paragraphs with a blank line.",
    scope: listHint("scope", "What SULOAI will build or deliver."),
    deliverables: listHint("deliverables", "What the Client receives."),
    outOfScope: listHint("outOfScope", "What is not included."),
    assumptions: listHint("assumptions", "What is needed from the Client."),
  };

  /**
   * The message line under a field: its error, else its hint. Errors go
   * through Field's hint slot (not `error`) so they are read on focus rather
   * than each becoming its own alert beside the banner that announces the
   * failure. Field gives the line the id fieldMessageId(name).
   */
  function message(name: TextField) {
    const error = fieldErrors[name];
    const content: ReactNode = error ? <span className="text-red-600">{error}</span> : hints[name];
    return { hint: content, describedBy: content ? fieldMessageId(name) : undefined, invalid: Boolean(error) };
  }

  /** Props shared by every control bound to `values`. */
  function bind(name: TextField, className?: string, base: string = inputClass) {
    const m = message(name);
    return {
      id: name,
      name,
      value: values[name],
      onChange: (e: { target: { value: string } }) => update(name, e.target.value),
      className: cn(base, className, m.invalid && invalidClass),
      "aria-invalid": m.invalid ? true : undefined,
      "aria-describedby": m.describedBy,
    };
  }

  const pctInput = (name: "depositPct" | "midpointPct" | "finalPct", label: string) => (
    <div className="min-w-0">
      <label htmlFor={name} className="mb-1.5 block text-[0.78rem] font-semibold text-ink-700">
        {label}
      </label>
      <div className="relative">
        <input
          {...bind(name, cn("pr-8 tabular-nums", fieldErrors.schedule && invalidClass))}
          inputMode="numeric"
          maxLength={3}
          aria-invalid={fieldErrors[name] || fieldErrors.schedule ? true : undefined}
          // The running total below explains any problem with the three together.
          aria-describedby={cn(fieldErrors[name] && fieldMessageId(name), "schedule-total")}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.85rem] text-ink-500">%</span>
      </div>
      {fieldErrors[name] && (
        <p id={fieldMessageId(name)} className="mt-1 text-[0.72rem] text-red-600">
          {fieldErrors[name]}
        </p>
      )}
    </div>
  );

  const scheduleOk = scheduleProblem === null;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="id" value={agreementId} />
      <input type="hidden" name="version" value={activeVersion} />
      <input type="hidden" name="milestones" value={milestonesJson} />

      <div className="min-w-0 space-y-6">
        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-[0.85rem] text-red-700"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{state.error}</span>
          </div>
        )}

        {/* ── Parties & date ─────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Parties & date"
            subtitle={
              quoteNumber
                ? `Copied from quotation ${quoteNumber}. “Refresh from quotation” on the agreement page copies client and price again.`
                : "The Client as named in the agreement."
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Effective date" htmlFor="effectiveDate" hint={message("effectiveDate").hint}>
              <input {...bind("effectiveDate")} type="date" required />
            </Field>
            <Field label="Client name" htmlFor="clientName" hint={message("clientName").hint}>
              <input {...bind("clientName")} autoComplete="off" maxLength={160} required />
            </Field>
            <Field label="Company" htmlFor="clientCompany" hint={message("clientCompany").hint}>
              <input {...bind("clientCompany")} autoComplete="off" maxLength={160} />
            </Field>
            <Field label="Client email" htmlFor="clientEmail" hint={message("clientEmail").hint}>
              <input {...bind("clientEmail")} type="email" inputMode="email" autoComplete="off" maxLength={254} />
            </Field>
          </div>
        </Card>

        {/* ── Payment terms ──────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Payment terms"
            subtitle={`Section 2. The fee comes from the quotation: ${money(subtotalFils)} excl. VAT. The final stage takes any rounding.`}
          />
          <fieldset>
            <legend className="sr-only">Payment schedule percentages</legend>
            <div className="grid grid-cols-3 gap-3">
              {pctInput("depositPct", "Deposit")}
              {pctInput("midpointPct", "Milestone")}
              {pctInput("finalPct", "Final")}
            </div>
            <p
              id="schedule-total"
              aria-live="polite"
              className={cn(
                "mt-2 flex items-start gap-1.5 text-[0.76rem]",
                scheduleOk ? "text-mint-ink" : "text-red-600",
              )}
            >
              {scheduleOk ? (
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>
                <span className="font-semibold tabular-nums">Total {pctValid ? `${pctSum}%` : "—"}</span>
                {scheduleOk ? " · adds up to 100%." : ` · ${scheduleProblem}`}
              </span>
            </p>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Milestone payment due upon" htmlFor="midpointMilestone" hint={message("midpointMilestone").hint} className="sm:col-span-2">
              <input {...bind("midpointMilestone")} maxLength={120} placeholder="mid-point delivery" />
            </Field>
            <Field label="Invoice due within (days)" htmlFor="invoiceDueDays" hint={message("invoiceDueDays").hint}>
              <input {...bind("invoiceDueDays", "tabular-nums")} inputMode="numeric" maxLength={3} />
            </Field>
            <Field label="Late fee (% per month)" htmlFor="lateFee" hint={message("lateFee").hint}>
              <div className="relative">
                <input {...bind("lateFee", "pr-8 tabular-nums")} inputMode="decimal" maxLength={6} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.85rem] text-ink-500">%</span>
              </div>
            </Field>
          </div>

          <Subheading>Other terms</Subheading>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Feedback (business days)" htmlFor="feedbackDays" hint={message("feedbackDays").hint}>
              <input {...bind("feedbackDays", "tabular-nums")} inputMode="numeric" maxLength={3} />
            </Field>
            <Field label="Warranty (days)" htmlFor="warrantyDays" hint={message("warrantyDays").hint}>
              <input {...bind("warrantyDays", "tabular-nums")} inputMode="numeric" maxLength={3} />
            </Field>
            <Field label="Termination notice (days)" htmlFor="terminationNoticeDays" hint={message("terminationNoticeDays").hint}>
              <input {...bind("terminationNoticeDays", "tabular-nums")} inputMode="numeric" maxLength={3} />
            </Field>
          </div>
        </Card>

        {/* ── Statement of work ──────────────────────────────── */}
        <Card>
          <CardHeader title="Statement of work" subtitle="Printed as the SOW, on its own pages after the agreement." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" htmlFor="projectName" hint={message("projectName").hint}>
              <input {...bind("projectName")} maxLength={160} required />
            </Field>
            <Field label="Package reference" htmlFor="packageRef" hint={message("packageRef").hint}>
              <input {...bind("packageRef")} maxLength={200} />
            </Field>
            <Field label="Background / problem statement" htmlFor="background" hint={message("background").hint} className="sm:col-span-2">
              <textarea {...bind("background", "min-h-28", textareaClass)} rows={5} maxLength={4000} />
            </Field>
            {(
              [
                ["scope", "Scope of work"],
                ["deliverables", "Deliverables"],
                ["outOfScope", "Out of scope"],
                ["assumptions", "Client responsibilities / assumptions"],
              ] as const
            ).map(([name, label]) => (
              <Field key={name} label={label} htmlFor={name} hint={message(name).hint} className="sm:col-span-2">
                <textarea {...bind(name, "min-h-24", textareaClass)} rows={name === "scope" ? 5 : 4} />
              </Field>
            ))}
          </div>
        </Card>

        {/* ── Timeline ───────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Timeline"
            subtitle="SOW Section 6. Leave a date empty to print “To be confirmed”. Empty rows are ignored."
          />
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-[0.8rem] text-ink-500">
              No milestones. The SOW will ask for them as a placeholder.
            </p>
          ) : (
            <ol className="space-y-3">
              {rows.map((row, index) => {
                const errors = rowErrorsByKey.get(row.key) ?? {};
                const n = index + 1;
                const errorId = (name: keyof MilestoneInput) => `${row.key}-${name}-error`;
                return (
                  <li
                    key={row.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-[minmax(0,1fr)_10.5rem_auto] sm:items-start"
                  >
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <label htmlFor={`${row.key}-label`} className="mb-1 block text-[0.72rem] font-semibold text-ink-600">
                        Milestone {n}
                      </label>
                      <input
                        id={`${row.key}-label`}
                        value={row.label}
                        onChange={(e) => updateRow(row.key, { label: e.target.value })}
                        maxLength={200}
                        placeholder="e.g. First working draft / demo"
                        className={cn(inputClass, errors.label && invalidClass)}
                        aria-invalid={errors.label ? true : undefined}
                        aria-describedby={errors.label ? errorId("label") : undefined}
                      />
                      {errors.label && (
                        <p id={errorId("label")} className="mt-1 text-[0.72rem] text-red-600">
                          {errors.label}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label htmlFor={`${row.key}-date`} className="mb-1 block text-[0.72rem] font-semibold text-ink-600">
                        Target date <span className="font-normal text-ink-500">(optional)</span>
                      </label>
                      <input
                        id={`${row.key}-date`}
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.key, { date: e.target.value })}
                        className={cn(inputClass, errors.date && invalidClass)}
                        aria-invalid={errors.date ? true : undefined}
                        aria-describedby={errors.date ? errorId("date") : undefined}
                      />
                      {errors.date && (
                        <p id={errorId("date")} className="mt-1 text-[0.72rem] text-red-600">
                          {errors.date}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end gap-1 self-end sm:pt-[1.4rem]">
                      <button
                        type="button"
                        id={`${row.key}-up`}
                        onClick={() => moveRow(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move milestone ${n} up`}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        id={`${row.key}-down`}
                        onClick={() => moveRow(index, 1)}
                        disabled={index === rows.length - 1}
                        aria-label={`Move milestone ${n} down`}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove milestone ${n}`}
                        className="inline-flex h-10 w-9 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {fieldErrors.milestones && <p className="mt-3 text-[0.76rem] text-red-600">{fieldErrors.milestones}</p>}
          <p role="status" aria-live="polite" className="sr-only">
            {rowAnnouncement}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <Button
              type="button"
              id={ADD_MILESTONE_ID}
              variant="secondary"
              size="sm"
              onClick={addRow}
              disabled={rows.length >= MAX_MILESTONES}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add milestone
            </Button>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-500">
              {rows.length} of {MAX_MILESTONES}
            </span>
          </div>
        </Card>
      </div>

      {/* ── Sidebar: live schedule + save ─────────────────────── */}
      <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <Card className="overflow-hidden" padded={false}>
          <div aria-hidden="true" className="h-1 bg-linear-to-r from-abyss-600 via-aqua-500 to-lilac-400" />
          <div className="p-5">
            <h2 className="font-display text-[0.98rem] font-bold text-ink-900">Payment schedule</h2>
            <p className="mt-0.5 text-[0.76rem] text-ink-500">
              As printed in Section 2{vatBps > 0 ? `, VAT ${formatVat(vatBps)} per stage` : ""}.
            </p>

            {plan.length > 0 && scheduleOk ? (
              <table className="mt-4 w-full text-[0.82rem]">
                <caption className="sr-only">Payment schedule preview</caption>
                <thead>
                  <tr className="border-b border-ink-100 text-left font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-500">
                    <th scope="col" className="pb-2 font-medium">
                      Stage
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Incl. VAT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((line) => (
                    <tr key={line.installment} className="border-b border-ink-100/70 align-top">
                      <th scope="row" className="py-2 pr-2 text-left font-normal">
                        <span className="block font-semibold text-ink-800">
                          {line.label} · <span className="tabular-nums">{line.pct}%</span>
                        </span>
                        <span className="block text-[0.72rem] leading-snug text-ink-500">{line.due}</span>
                      </th>
                      <td className="whitespace-nowrap py-2 text-right font-medium tabular-nums text-ink-900">
                        {money(line.totalFils)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="pt-2.5 text-left font-semibold text-ink-900">
                      Total
                    </th>
                    <td className="whitespace-nowrap pt-2.5 text-right font-display text-[1.05rem] font-bold tabular-nums text-ink-900">
                      {money(plan.reduce((sum, l) => sum + l.totalFils, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="mt-4 rounded-lg bg-red-50/70 px-3 py-2.5 text-[0.76rem] text-red-700">
                Fix the percentages to preview the schedule.
              </p>
            )}

            {/* Mirrors the banner at the top, which may be scrolled out of view. */}
            {state?.error && (
              <p aria-hidden="true" className="mt-4 flex items-start gap-1.5 text-[0.76rem] text-red-600">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {state.error}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <Button type="submit" disabled={pending} aria-disabled={pending}>
                {pending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving
                  </>
                ) : (
                  "Save agreement"
                )}
              </Button>
              <Link href={cancelHref} className={buttonClass("ghost")}>
                Cancel
              </Link>
            </div>
            <p className="mt-3 text-center text-[0.72rem] text-ink-500">
              Stays a draft until you mark it as sent for signature.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}

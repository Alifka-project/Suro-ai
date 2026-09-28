"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Plus, Trash2 } from "lucide-react";
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
import { DEFAULT_CURRENCY, documentTotals, formatMoney, formatVat, lineTotalFils } from "@/lib/admin/money";
import { IS_VAT_REGISTERED } from "@/lib/admin/business";
import { saveInvoice, saveQuote } from "../actions";
import { MAX_LINE_ITEMS, parseQuantity, parseUnitPriceFils, parseVatPercentToBps } from "../_lib/parse";
import type {
  DocumentKind,
  EditorField,
  EditorInitial,
  EditorItemInput,
  LeadOption,
  ProjectOption,
} from "../_lib/types";

type Row = EditorItemInput & { key: string };
type ItemErrors = Partial<Record<keyof EditorItemInput, string>>;

const invalidClass = "border-red-300 focus:border-red-400 focus:ring-red-400/15";

/**
 * Line-item columns. Applied through a container query on the line-items card
 * rather than a viewport breakpoint: next to the sidebar on a laptop the card
 * is far narrower than the screen, and the fixed tracks (24rem + gaps) would
 * squeeze the description to nothing. Below 42rem of card width each item
 * stacks as a small two-column block instead.
 */
const ITEM_GRID = "@2xl:grid-cols-[minmax(10rem,1fr)_5rem_8rem_8.5rem_2.5rem]";

function newKey() {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Shared quote / invoice editor. Everything is controlled state so a failed
 * server validation never wipes what the admin typed; the Server Action
 * re-validates every field regardless of what this component checked.
 */
export function DocumentEditor({
  kind,
  documentId,
  initial,
  leads,
  projects = [],
  cancelHref,
  submitLabel,
}: {
  kind: DocumentKind;
  /** Present when editing an existing draft. */
  documentId?: string;
  initial: EditorInitial;
  leads: LeadOption[];
  projects?: ProjectOption[];
  cancelHref: string;
  submitLabel: string;
}) {
  const isQuote = kind === "quote";
  const [state, formAction, pending] = useActionState(isQuote ? saveQuote : saveInvoice, undefined);

  const [leadId, setLeadId] = useState(initial.leadId);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [clientName, setClientName] = useState(initial.clientName);
  const [clientEmail, setClientEmail] = useState(initial.clientEmail);
  const [clientCompany, setClientCompany] = useState(initial.clientCompany);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [secondDate, setSecondDate] = useState(initial.secondDate);
  const [vat, setVat] = useState(initial.vatPercent);
  const [notes, setNotes] = useState(initial.notes);
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.items.length ? initial.items : [{ description: "", quantity: "1", unitPrice: "" }]).map((item, i) => ({
      ...item,
      key: `row-initial-${i}`,
    })),
  );

  // Synchronous latch: `pending` only flips on the next render, so a fast
  // double click could otherwise create two documents with two numbers.
  const submitting = useRef(false);
  useEffect(() => {
    if (!pending) submitting.current = false;
  }, [pending]);

  // The server reports line-item errors by position. Remembering which row sat
  // at each position when the form was submitted keeps every message on its
  // own row when rows are added or removed afterwards.
  const [submittedKeys, setSubmittedKeys] = useState<readonly string[]>([]);
  // Set when picking a lead unlinks a project that belongs to another client.
  const [clearedProject, setClearedProject] = useState<string | null>(null);

  const fieldErrors = state?.fieldErrors ?? {};
  const itemErrorsByKey = new Map<string, ItemErrors>();
  for (const [index, errors] of Object.entries(state?.itemErrors ?? {})) {
    const key = submittedKeys[Number(index)];
    if (key && errors) itemErrorsByKey.set(key, errors);
  }
  const secondName = isQuote ? "validUntil" : "dueDate";

  /**
   * Error (or hint) text for a field. Field gives its message line the id
   * fieldMessageId(htmlFor), and the input points aria-describedby at it, so
   * assistive tech announces why a field is invalid. `name` is always the
   * field's htmlFor. Errors go through the hint slot (not Field's `error`)
   * so they are read on focus, as before, instead of each one becoming its
   * own role="alert" next to the banner that already announces the failure.
   */
  function message(name: EditorField, hint?: ReactNode, hintClass?: string) {
    const error = fieldErrors[name];
    const content = error ? (
      <span className="text-red-600">{error}</span>
    ) : hint && hintClass ? (
      <span className={hintClass}>{hint}</span>
    ) : (
      hint
    );
    return { hint: content, describedBy: content ? fieldMessageId(name) : undefined };
  }

  // Live totals use the same parsers and money maths as the server.
  const vatBps = parseVatPercentToBps(vat);
  const lines = rows.map((r) => ({
    quantity: parseQuantity(r.quantity) ?? 0,
    unitPriceFils: parseUnitPriceFils(r.unitPrice) ?? 0,
  }));
  const totals = documentTotals(lines, vatBps ?? 0);

  function fillFromLead(id: string) {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      setClientName(lead.name);
      setClientEmail(lead.email ?? "");
      setClientCompany(lead.company ?? "");
    }
  }

  // An invoice for a project is always billed to that project's client (the
  // server enforces this too), so the lead and project pickers stay in step.
  function applyLead(id: string) {
    fillFromLead(id);
    const project = projects.find((p) => p.id === projectId);
    if (project?.leadId && project.leadId !== id) {
      setProjectId("");
      setClearedProject(project.name);
    } else {
      setClearedProject(null);
    }
  }

  function applyProject(id: string) {
    setProjectId(id);
    setClearedProject(null);
    const project = projects.find((p) => p.id === id);
    if (project?.leadId && project.leadId !== leadId) fillFromLead(project.leadId);
  }

  function updateRow(key: string, patch: Partial<EditorItemInput>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((current) =>
      current.length >= MAX_LINE_ITEMS ? current : [...current, { key: newKey(), description: "", quantity: "1", unitPrice: "" }],
    );
  }

  function removeRow(key: string) {
    setRows((current) => (current.length <= 1 ? current : current.filter((r) => r.key !== key)));
  }

  // Submitting through startTransition (rather than <form action>) skips
  // React's automatic form reset, and `pending` blocks a second submit.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitting.current) return;
    submitting.current = true;
    const formData = new FormData(event.currentTarget);
    setSubmittedKeys(rows.map((r) => r.key));
    startTransition(() => formAction(formData));
  }

  const itemsJson = JSON.stringify(
    rows.map((r) => ({ description: r.description, quantity: r.quantity, unitPrice: r.unitPrice })),
  );

  const leadOptionLabel = (l: LeadOption) => (l.company ? `${l.name} — ${l.company}` : l.name);
  const selectedLead = leadId ? leads.find((l) => l.id === leadId) : undefined;
  const estimateFils = selectedLead?.estimatedValueFils ?? null;
  const selectedProject = projectId ? projects.find((p) => p.id === projectId) : undefined;

  const leadMsg = message(
    "leadId",
    selectedProject?.leadId
      ? "Set by the project. Picking another lead unlinks the project."
      : "Picking a lead fills in the client details.",
  );
  const projectMsg = clearedProject
    ? message("projectId", `${clearedProject} was unlinked: it belongs to a different client.`, "text-amber-700")
    : message(
        "projectId",
        selectedProject?.leadId
          ? "Invoices for a project are billed to its client."
          : projects.length
            ? "Optional — ties this invoice to a delivery project."
            : "No projects yet.",
      );
  const clientNameMsg = message("clientName");
  const clientEmailMsg = message("clientEmail");
  const companyMsg = message("clientCompany", "Optional");
  const notesMsg = message("notes");
  const issueDateMsg = message("issueDate");
  const secondDateMsg = message(secondName, isQuote ? "Usually 30 days after issue." : "Payment terms: 30 days by default.");
  // Only a VAT-registered business (one with a TRN) may charge VAT in the UAE.
  const vatMsg = message(
    "vat",
    !IS_VAT_REGISTERED && vatBps !== 0
      ? "No TRN is set in business.ts. Only VAT-registered businesses may charge VAT — use 0 until you register."
      : "UAE standard rate is 5%. Use 0 for zero-rated work.",
  );

  return (
    // The sidebar only sits beside the form from xl up; below that it would
    // leave the form too narrow, so it stacks underneath.
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="id" value={documentId ?? ""} />
      <input type="hidden" name="items" value={itemsJson} />

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

        {/* ── Client ─────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Client"
            subtitle="Printed in the bill-to block. Saved as a snapshot, so later CRM edits don't change this document."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Linked lead (CRM)"
              htmlFor="leadId"
              hint={leadMsg.hint}
              className={isQuote ? "sm:col-span-2" : undefined}
            >
              <select
                id="leadId"
                name="leadId"
                value={leadId}
                onChange={(e) => applyLead(e.target.value)}
                className={cn(inputClass, "pr-8", fieldErrors.leadId && invalidClass)}
                aria-invalid={fieldErrors.leadId ? true : undefined}
                aria-describedby={leadMsg.describedBy}
              >
                <option value="">Not linked to a lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {leadOptionLabel(l)}
                  </option>
                ))}
              </select>
            </Field>

            {!isQuote && (
              <Field label="Project" htmlFor="projectId" hint={projectMsg.hint}>
                <select
                  id="projectId"
                  name="projectId"
                  value={projectId}
                  onChange={(e) => applyProject(e.target.value)}
                  className={cn(inputClass, "pr-8", fieldErrors.projectId && invalidClass)}
                  aria-invalid={fieldErrors.projectId ? true : undefined}
                  aria-describedby={projectMsg.describedBy}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.clientLabel ? `${p.name} (${p.clientLabel})` : p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Client name" htmlFor="clientName" hint={clientNameMsg.hint}>
              <input
                id="clientName"
                name="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                autoComplete="off"
                maxLength={160}
                required
                className={cn(inputClass, fieldErrors.clientName && invalidClass)}
                aria-invalid={fieldErrors.clientName ? true : undefined}
                aria-describedby={clientNameMsg.describedBy}
              />
            </Field>
            <Field label="Client email" htmlFor="clientEmail" hint={clientEmailMsg.hint}>
              <input
                id="clientEmail"
                name="clientEmail"
                type="email"
                inputMode="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                autoComplete="off"
                maxLength={254}
                required
                className={cn(inputClass, fieldErrors.clientEmail && invalidClass)}
                aria-invalid={fieldErrors.clientEmail ? true : undefined}
                aria-describedby={clientEmailMsg.describedBy}
              />
            </Field>
            <Field label="Company" htmlFor="clientCompany" hint={companyMsg.hint} className="sm:col-span-2">
              <input
                id="clientCompany"
                name="clientCompany"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                autoComplete="off"
                maxLength={160}
                className={cn(inputClass, fieldErrors.clientCompany && invalidClass)}
                aria-invalid={fieldErrors.clientCompany ? true : undefined}
                aria-describedby={companyMsg.describedBy}
              />
            </Field>
          </div>
        </Card>

        {/* ── Line items ─────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Line items"
            subtitle={`Prices in ${DEFAULT_CURRENCY}, excluding VAT. Quantities can be fractional, e.g. 1.5 days.`}
          />

          <div className="@container">
            <div
              aria-hidden="true"
              className={cn(
                "hidden gap-3 border-b border-ink-100 pb-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-500 @2xl:grid",
                ITEM_GRID,
              )}
            >
              <span>Description</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            <ol className="space-y-3 @2xl:mt-3">
              {rows.map((row, index) => {
                const errors = itemErrorsByKey.get(row.key) ?? {};
                const amount = lineTotalFils(lines[index]);
                const n = index + 1;
                const errorId = (name: keyof EditorItemInput) => `${row.key}-${name}-error`;
                return (
                  <li
                    key={row.key}
                    className={cn(
                      "grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-ink-100 p-3 @2xl:items-start @2xl:rounded-none @2xl:border-0 @2xl:p-0",
                      ITEM_GRID,
                    )}
                  >
                    <div className="col-span-2 min-w-0 @2xl:col-span-1">
                      <label
                        htmlFor={`${row.key}-description`}
                        className="mb-1 block text-[0.72rem] font-semibold text-ink-600 @2xl:sr-only"
                      >
                        Item {n} description
                      </label>
                      <input
                        id={`${row.key}-description`}
                        value={row.description}
                        onChange={(e) => updateRow(row.key, { description: e.target.value })}
                        placeholder="e.g. Power Automate flow build"
                        maxLength={500}
                        className={cn(inputClass, errors.description && invalidClass)}
                        aria-invalid={errors.description ? true : undefined}
                        aria-describedby={errors.description ? errorId("description") : undefined}
                      />
                      {errors.description && (
                        <p id={errorId("description")} className="mt-1 text-[0.72rem] text-red-600">
                          {errors.description}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor={`${row.key}-quantity`}
                        className="mb-1 block text-[0.72rem] font-semibold text-ink-600 @2xl:sr-only"
                      >
                        Item {n} quantity
                      </label>
                      <input
                        id={`${row.key}-quantity`}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        inputMode="decimal"
                        className={cn(inputClass, "tabular-nums", errors.quantity && invalidClass)}
                        aria-invalid={errors.quantity ? true : undefined}
                        aria-describedby={errors.quantity ? errorId("quantity") : undefined}
                      />
                      {errors.quantity && (
                        <p id={errorId("quantity")} className="mt-1 text-[0.72rem] text-red-600">
                          {errors.quantity}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor={`${row.key}-price`}
                        className="mb-1 block text-[0.72rem] font-semibold text-ink-600 @2xl:sr-only"
                      >
                        Item {n} unit price ({DEFAULT_CURRENCY})
                      </label>
                      <input
                        id={`${row.key}-price`}
                        value={row.unitPrice}
                        onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                        inputMode="decimal"
                        placeholder="0.00"
                        className={cn(inputClass, "tabular-nums", errors.unitPrice && invalidClass)}
                        aria-invalid={errors.unitPrice ? true : undefined}
                        aria-describedby={errors.unitPrice ? errorId("unitPrice") : undefined}
                      />
                      {errors.unitPrice && (
                        <p id={errorId("unitPrice")} className="mt-1 text-[0.72rem] text-red-600">
                          {errors.unitPrice}
                        </p>
                      )}
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-2 @2xl:block @2xl:h-10 @2xl:pt-2.5 @2xl:text-right">
                      <span className="text-[0.72rem] font-semibold text-ink-600 @2xl:hidden">Amount</span>
                      <span className="whitespace-nowrap text-[0.88rem] font-semibold tabular-nums text-ink-900">
                        {formatMoney(amount)}
                      </span>
                    </div>

                    <div className="flex justify-end @2xl:block">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length <= 1}
                        aria-label={`Remove item ${n}`}
                        title={rows.length <= 1 ? "A document needs at least one line item" : "Remove line"}
                        className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-xl text-[0.78rem] font-medium text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 @max-2xl:w-auto @max-2xl:px-3"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="@2xl:hidden">Remove</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {fieldErrors.items && <p className="mt-3 text-[0.76rem] text-red-600">{fieldErrors.items}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" size="sm" onClick={addRow} disabled={rows.length >= MAX_LINE_ITEMS}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add line item
            </Button>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-500">
              {rows.length} {rows.length === 1 ? "line" : "lines"}
            </span>
          </div>
        </Card>

        {/* ── Notes ──────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Notes" subtitle="Optional. Printed on the document — scope, assumptions, or payment milestones." />
          <Field label="Notes" htmlFor="notes" hint={notesMsg.hint} className="[&>label]:sr-only">
            <textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={4000}
              className={cn(textareaClass, "min-h-24", fieldErrors.notes && invalidClass)}
              aria-invalid={fieldErrors.notes ? true : undefined}
              aria-describedby={notesMsg.describedBy}
            />
          </Field>
        </Card>
      </div>

      {/* ── Sidebar: dates, VAT, totals, submit ─────────────── */}
      <div className="grid min-w-0 content-start gap-6 md:grid-cols-2 xl:sticky xl:top-6 xl:grid-cols-1 xl:self-start">
        <Card>
          <CardHeader title="Details" />
          <div className="space-y-4">
            <Field label="Issue date" htmlFor="issueDate" hint={issueDateMsg.hint}>
              <input
                id="issueDate"
                name="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className={cn(inputClass, fieldErrors.issueDate && invalidClass)}
                aria-invalid={fieldErrors.issueDate ? true : undefined}
                aria-describedby={issueDateMsg.describedBy}
              />
            </Field>
            <Field label={isQuote ? "Valid until" : "Due date"} htmlFor={secondName} hint={secondDateMsg.hint}>
              <input
                id={secondName}
                name={secondName}
                type="date"
                value={secondDate}
                min={issueDate || undefined}
                onChange={(e) => setSecondDate(e.target.value)}
                required
                className={cn(inputClass, fieldErrors[secondName] && invalidClass)}
                aria-invalid={fieldErrors[secondName] ? true : undefined}
                aria-describedby={secondDateMsg.describedBy}
              />
            </Field>
            <Field label="VAT rate" htmlFor="vat" hint={vatMsg.hint}>
              <div className="relative">
                <input
                  id="vat"
                  name="vat"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                  inputMode="decimal"
                  className={cn(inputClass, "pr-9 tabular-nums", fieldErrors.vat && invalidClass)}
                  aria-invalid={fieldErrors.vat ? true : undefined}
                  aria-describedby={vatMsg.describedBy}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.85rem] text-ink-500">
                  %
                </span>
              </div>
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden" padded={false}>
          <div aria-hidden="true" className="h-1 bg-linear-to-r from-abyss-600 via-aqua-500 to-lilac-400" />
          <div className="p-5">
            <h2 className="font-display text-[0.98rem] font-bold text-ink-900">Summary</h2>
            <dl className="mt-4 space-y-2.5 text-[0.85rem]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">Subtotal</dt>
                <dd className="font-medium tabular-nums text-ink-800">{formatMoney(totals.subtotalFils)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">VAT {vatBps === null ? "" : `(${formatVat(vatBps)})`}</dt>
                <dd className="font-medium tabular-nums text-ink-800">
                  {vatBps === null ? <span className="text-red-600">Check rate</span> : formatMoney(totals.vatFils)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="font-display text-[1.25rem] font-bold tabular-nums text-ink-900">
                  {formatMoney(totals.totalFils)}
                </dd>
              </div>
            </dl>

            {estimateFils !== null && (
              <p className="mt-3 rounded-lg bg-haze px-3 py-2 text-[0.75rem] text-ink-600">
                CRM estimate for this lead:{" "}
                <span className="font-semibold tabular-nums text-ink-800">{formatMoney(estimateFils)}</span>
              </p>
            )}

            {/* Totals are deliberately not a live region: they change on every keystroke.
                The banner at the top (role="alert") is what gets announced; this mirrors it
                visually, since the banner is off-screen on long forms. */}
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
                  submitLabel
                )}
              </Button>
              <Link href={cancelHref} className={buttonClass("ghost")}>
                Cancel
              </Link>
            </div>
            <p className="mt-3 text-center text-[0.72rem] text-ink-500">
              Saved as a draft. You can review it before marking it as sent.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}

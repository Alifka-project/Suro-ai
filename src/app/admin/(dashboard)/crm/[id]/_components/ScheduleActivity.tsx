"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { ActivityType } from "@prisma/client";
import { Button, Field, cn, fieldMessageId, inputClass, textareaClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { ACTIVITY_TYPE, ACTIVITY_TYPES } from "@/lib/admin/pipeline";
import { addDaysToDateInput } from "@/lib/admin/time";
import { scheduleActivity } from "../../actions";
import { ActivityTypeIcon } from "../../_components/ActivityTypeIcon";
import { FormMessage } from "../../_components/FormMessage";
import { seed, withEcho, type EchoState } from "../../_components/OppFormState";

const scheduleWithEcho = withEcho(scheduleActivity);

const PLACEHOLDER: Record<ActivityType, string> = {
  CALL: "Discuss the proposal",
  EMAIL: "Send the case study",
  MEETING: "Discovery workshop",
  TODO: "Prepare the process map",
  FOLLOW_UP: "Check in on the decision",
};

/** Quick picks, as day offsets from today on the business clock. */
const QUICK_DATES = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
] as const;

const VISIBLE_FIELDS = ["type", "summary", "dueDate", "assigneeId", "note"] as const;

/**
 * "Schedule activity" (Odoo's activity popup): type, summary, due date with
 * quick picks, assignee (you by default) and a note. Collapsed to a button
 * until needed; the result message stays after the form closes.
 *
 * `today` is the business-clock date from the server, so the quick picks
 * follow Dubai's calendar whatever zone the browser is in.
 */
export function ScheduleActivity({
  leadId,
  team,
  meId,
  today,
}: {
  leadId: string;
  team: { id: string; name: string }[];
  meId: string;
  today: string;
}) {
  const [state, formAction] = useActionState(scheduleWithEcho, null);
  const [open, setOpen] = useState(false);
  // The result on screen when the form was last opened: a failed attempt from
  // before a Cancel is not carried into a fresh form (compared by identity).
  const [staleState, setStaleState] = useState<EchoState>(null);
  // Once the form closes, the toggle button takes focus back (autoFocus on remount).
  const [returnFocus, setReturnFocus] = useState(false);

  // Close the form once an activity is scheduled (render-time sync, not an effect).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setOpen(false);
      setReturnFocus(true);
    }
  }

  function close() {
    setOpen(false);
    setReturnFocus(true);
  }

  return (
    <div>
      {open ? (
        <ScheduleForm
          key={state?.at ?? 0}
          leadId={leadId}
          team={team}
          meId={meId}
          today={today}
          state={state !== staleState ? state : null}
          formAction={formAction}
          onCancel={close}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          autoFocus={returnFocus}
          onClick={() => {
            setStaleState(state);
            setOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Schedule activity
        </Button>
      )}
      {/* The confirmation belongs to the last attempt; opening the form again retires it. */}
      <FormMessage state={!open && state?.ok && state !== staleState ? state : null} />
    </div>
  );
}

function ScheduleForm({
  leadId,
  team,
  meId,
  today,
  state,
  formAction,
  onCancel,
}: {
  leadId: string;
  team: { id: string; name: string }[];
  meId: string;
  today: string;
  state: EchoState;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  // Anything not tied to a visible field (a vanished lead, a server error) is shown at the bottom.
  const firstInvalid = VISIBLE_FIELDS.find((k) => errors[k]);
  const generalError = failed && !firstInvalid ? failed.message : null;
  // Start on the summary, or after a failed attempt on the first field to fix.
  const focusField = firstInvalid && firstInvalid !== "type" ? firstInvalid : "summary";
  const initialType = seed(state, "type", "CALL");
  const [type, setType] = useState<ActivityType>(
    (ACTIVITY_TYPES as readonly string[]).includes(initialType) ? (initialType as ActivityType) : "CALL",
  );
  const [due, setDue] = useState(seed(state, "dueDate", today));
  const assigneeDefault = seed(state, "assigneeId", team.some((m) => m.id === meId) ? meId : "");

  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      aria-labelledby="schedule-title"
      className="space-y-4 rounded-2xl border border-ink-100 bg-canvas/70 p-4"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <p id="schedule-title" className="font-display text-[0.9rem] font-bold text-ink-900">
        Schedule an activity
      </p>

      <fieldset>
        <legend className="mb-1.5 block text-[0.78rem] font-semibold text-ink-700">Type</legend>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TYPES.map((t) => (
            <label key={t} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="peer sr-only"
              />
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[0.78rem] font-semibold text-ink-600 transition-colors peer-checked:border-ink-900 peer-checked:bg-ink-900 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-azure-500 hover:border-ink-300">
                <ActivityTypeIcon type={t} className="h-3.5 w-3.5" />
                {ACTIVITY_TYPE[t].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Summary"
        htmlFor="activity-summary"
        hint={`Optional. Defaults to "${ACTIVITY_TYPE[type].label}".`}
        error={errors.summary}
      >
        <input
          id="activity-summary"
          name="summary"
          type="text"
          maxLength={200}
          autoFocus={focusField === "summary"}
          autoComplete="off"
          defaultValue={seed(state, "summary", "")}
          placeholder={PLACEHOLDER[type]}
          aria-invalid={errors.summary ? true : undefined}
          aria-describedby={fieldMessageId("activity-summary")}
          className={inputClass}
        />
      </Field>

      <Field label="Due date" htmlFor="activity-due" error={errors.dueDate}>
        <input
          id="activity-due"
          name="dueDate"
          type="date"
          required
          autoFocus={focusField === "dueDate"}
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-invalid={errors.dueDate ? true : undefined}
          aria-describedby={fieldMessageId("activity-due")}
          className={cn(inputClass, "sm:max-w-[13rem]")}
        />
        <div role="group" aria-label="Quick dates" className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_DATES.map(({ label, days }) => {
            const value = addDaysToDateInput(today, days);
            const active = due === value;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => setDue(value)}
                className={cn(
                  "h-7 rounded-lg px-2.5 text-[0.74rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azure-500",
                  active ? "bg-abyss-600 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:text-ink-900 hover:ring-ink-300",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Assigned to" htmlFor="activity-assignee" error={errors.assigneeId}>
        <select
          id="activity-assignee"
          name="assigneeId"
          autoFocus={focusField === "assigneeId"}
          defaultValue={assigneeDefault}
          aria-invalid={errors.assigneeId ? true : undefined}
          aria-describedby={fieldMessageId("activity-assignee")}
          className={cn(inputClass, "cursor-pointer")}
        >
          <option value="">Unassigned</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === meId ? `${m.name} (me)` : m.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Note" htmlFor="activity-note" hint="Optional." error={errors.note}>
        <textarea
          id="activity-note"
          name="note"
          rows={2}
          maxLength={2000}
          autoFocus={focusField === "note"}
          defaultValue={seed(state, "note", "")}
          placeholder="Anything to prepare or remember"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={fieldMessageId("activity-note")}
          className={cn(textareaClass, "min-h-[4.25rem] resize-y")}
        />
      </Field>

      {generalError && (
        <p role="alert" className="text-[0.76rem] text-red-600">
          {generalError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton size="sm" pendingLabel="Scheduling">
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Schedule
        </SubmitButton>
      </div>
    </form>
  );
}

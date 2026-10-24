"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { LeadStatus } from "@prisma/client";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { CLIENT_STATUSES, LEAD_STATUS, TONE_DOT, isClientStatus, type ClientStatus, type Tone } from "@/lib/admin/labels";
import { useClientStatus } from "./StatusProvider";

/** Tinted field per status tone. Text colours are the AA-safe shades used by the badges. */
const FIELD_TONE: Record<Tone, { field: string; text: string }> = {
  neutral: { field: "bg-ink-100/80 ring-ink-200", text: "text-ink-700" },
  blue: { field: "bg-azure-500/10 ring-azure-500/30", text: "text-abyss-600" },
  aqua: { field: "bg-aqua-500/10 ring-aqua-500/30", text: "text-aqua-ink" },
  mint: { field: "bg-mint-500/15 ring-mint-600/35", text: "text-mint-ink" },
  lilac: { field: "bg-lilac-500/15 ring-lilac-500/35", text: "text-lilac-ink" },
  blush: { field: "bg-blush-500/15 ring-blush-500/35", text: "text-blush-ink" },
  amber: { field: "bg-amber-400/15 ring-amber-400/40", text: "text-amber-700" },
  red: { field: "bg-red-500/10 ring-red-500/30", text: "text-red-600" },
};

/**
 * A native select, tinted like the status badge, that changes the client's
 * status (optimistically; the toast reports the result).
 *
 * A pick from the open list (mouse, touch, or Enter in the list) saves straight
 * away. A closed select also changes on arrow keys, Home/End, Page Up/Down and
 * typed letters, firing `change` on every step (Chrome, Edge and Firefox on
 * Windows and Linux; typeahead everywhere). Saving each step would write
 * statuses nobody chose, so those changes are held as an unsaved draft until
 * Enter (or leaving the field); Escape drops it.
 *
 * While a change is in flight the select is marked aria-disabled and ignores
 * further changes, rather than being `disabled`: disabling the focused control
 * would throw keyboard focus back to the top of the page.
 */
export function StatusSelect({
  leadId,
  name,
  status,
  size = "table",
}: {
  leadId: string;
  name: string;
  /** The status the server rendered. */
  status: LeadStatus;
  size?: "table" | "card";
}) {
  const { shownStatus, isPending, changeStatus } = useClientStatus();
  const shown = shownStatus(leadId, status);
  const pending = isPending(leadId);
  const hintId = useId();

  // The status picked with the keyboard on the closed select, not saved yet.
  const [draft, setDraft] = useState<ClientStatus | null>(null);
  // Drop a draft that no longer means anything: a save started (an Undo from
  // the toast, say), or the saved status caught up with it (render-time sync).
  const stale = draft !== null && (pending || draft === shown);
  if (stale) setDraft(null);
  const unsaved = stale ? null : draft;
  const value = unsaved ?? shown;
  const meta = LEAD_STATUS[value];
  // A CRM-only stage (none should be left) still shows as itself instead of
  // the select silently displaying the first option.
  const options: readonly LeadStatus[] = isClientStatus(shown) ? CLIENT_STATUSES : [...CLIENT_STATUSES, shown];

  // True from a key event until the end of its task. A `change` the key causes
  // on the closed select arrives in that same task (arrow keys from keydown,
  // typeahead from keypress); a pick from the open list arrives in a later one.
  const keyStep = useRef(false);
  const markKeyStep = () => {
    keyStep.current = true;
    window.setTimeout(() => {
      keyStep.current = false;
    }, 0);
  };

  const commit = () => {
    setDraft(null);
    if (unsaved !== null) changeStatus({ leadId, name, from: shown, to: unsaved });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "Enter") {
      if (unsaved !== null) {
        // Also stops Linux from opening the list on Return.
        e.preventDefault();
        commit();
      }
      return;
    }
    if (e.key === "Escape") {
      if (draft !== null) {
        e.preventDefault();
        setDraft(null);
      }
      return;
    }
    if (e.key === "Tab" || e.metaKey || e.ctrlKey) return;
    markKeyStep();
  };

  return (
    <div className={cn("min-w-0", size === "card" ? "w-full" : "w-full max-w-[9.5rem]")}>
      <div className="relative min-w-0">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full",
            size === "card" ? "left-3.5" : "left-2.5",
            TONE_DOT[meta.tone],
          )}
        />
        <select
          data-status-select={leadId}
          value={value}
          aria-label={`Status for ${name}`}
          aria-describedby={hintId}
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          title={pending ? "Saving…" : unsaved !== null ? "Not saved yet. Press Enter to save, Esc to cancel." : meta.hint}
          onKeyDown={onKeyDown}
          onKeyPress={(e) => {
            // Typeahead ("g" for Goal) changes the select from keypress, not keydown.
            if (e.key !== "Enter") markKeyStep();
          }}
          onChange={(e) => {
            const to = e.target.value;
            if (pending) return;
            // Back to the saved status, even a CRM-only one: nothing to save.
            if (to === shown) {
              setDraft(null);
              return;
            }
            if (!isClientStatus(to)) return;
            if (keyStep.current) {
              setDraft(to);
              return;
            }
            setDraft(null);
            changeStatus({ leadId, name, from: shown, to });
          }}
          onBlur={() => {
            // Leaving the field saves what it shows. Not when the whole window
            // lost focus (switching apps): the draft is still there on return.
            if (unsaved !== null && document.hasFocus()) commit();
          }}
          className={cn(
            "w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg font-semibold ring-1 ring-inset transition-[background-color,box-shadow,opacity]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500",
            size === "card"
              ? "h-10 pl-[1.9rem] pr-8 text-base sm:text-[0.86rem]"
              : "h-8 pl-6 pr-6 text-[0.78rem]",
            FIELD_TONE[meta.tone].field,
            FIELD_TONE[meta.tone].text,
            pending && "cursor-progress",
          )}
        >
          {options.map((s) => (
            // Explicit colours: some platforms paint the option list with the select's tint.
            <option key={s} value={s} className="bg-white text-ink-900">
              {LEAD_STATUS[s].label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 opacity-80",
            size === "card" ? "right-3" : "right-2",
            FIELD_TONE[meta.tone].text,
          )}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </div>
      <span id={hintId} className="sr-only">
        With the keyboard, choose a status and press Enter to save it.
      </span>
      {unsaved !== null && (
        <p aria-hidden="true" className="mt-1 text-[0.7rem] font-medium leading-tight text-ink-550">
          Not saved · press Enter
        </p>
      )}
    </div>
  );
}

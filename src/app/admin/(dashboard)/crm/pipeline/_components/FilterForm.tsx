"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { buttonClass, cn, inputClass } from "@/components/admin/ui";
import { OWNER_ME, OWNER_UNASSIGNED, pipelineHref, type PipelineFilters } from "../_lib/filters";

/**
 * The search box and salesperson picker: one GET form, so the filters live in
 * the URL. It stays mounted across filter changes (no key), so the control in
 * use keeps the focus; the fields are controlled and re-seed from the URL when
 * something else changes it (a chip, Clear, back/forward).
 *
 * The picker applies itself only when chosen with a pointer. A keyboard change
 * (arrowing through a closed select changes it on Windows and Linux) waits for
 * Apply, so browsing the list never reloads the board under the user.
 */
export function FilterForm({
  filters,
  team,
  meId,
}: {
  filters: PipelineFilters;
  team: { id: string; name: string }[];
  meId: string;
}) {
  const { q, owner, activity } = filters;
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const pickedByPointer = useRef(false);

  const [query, setQuery] = useState(q);
  const [ownerValue, setOwnerValue] = useState(owner);
  // Render-time sync with the URL (not an effect): only when the applied filters change.
  const [applied, setApplied] = useState({ q, owner });
  if (applied.q !== q || applied.owner !== owner) {
    setApplied({ q, owner });
    setQuery(q);
    setOwnerValue(owner);
  }

  const unapplied = query.trim() !== q || ownerValue !== owner;

  function clearSearch() {
    setQuery("");
    // The button disappears with the text; the search box takes the focus.
    searchRef.current?.focus();
    if (q) router.push(pipelineHref({ owner, activity }), { scroll: false });
  }

  return (
    <Form
      action="/admin/crm/pipeline"
      scroll={false}
      role="search"
      aria-label="Filter the pipeline"
      className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl"
    >
      {activity && <input type="hidden" name="activity" value={activity} />}
      <div className="relative min-w-0 flex-1">
        <label htmlFor="pipeline-search" className="sr-only">
          Search opportunities by name, contact, company or email
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          id="pipeline-search"
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
          autoComplete="off"
          placeholder="Search name, company or email"
          className={cn(inputClass, "pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none")}
        />
        {(query || q) && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <label htmlFor="pipeline-owner" className="sr-only">
        Salesperson
      </label>
      <select
        id="pipeline-owner"
        name="owner"
        value={ownerValue}
        onPointerDown={() => {
          pickedByPointer.current = true;
        }}
        onKeyDown={() => {
          pickedByPointer.current = false;
        }}
        onChange={(event) => {
          setOwnerValue(event.target.value);
          if (pickedByPointer.current) event.currentTarget.form?.requestSubmit();
        }}
        className={cn(inputClass, "cursor-pointer sm:w-52 sm:shrink-0")}
      >
        <option value="">Every salesperson</option>
        <option value={OWNER_ME}>My opportunities</option>
        <option value={OWNER_UNASSIGNED}>Unassigned</option>
        {team.length > 0 && (
          <optgroup label="Team">
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.id === meId ? " (you)" : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {/* Highlighted while the fields hold changes that aren't applied yet. */}
      <button type="submit" className={cn(buttonClass(unapplied ? "primary" : "secondary"), "sm:shrink-0")}>
        Apply
      </button>
    </Form>
  );
}

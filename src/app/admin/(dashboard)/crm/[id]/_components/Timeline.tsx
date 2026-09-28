import { History, Inbox, StickyNote } from "lucide-react";
import type { NoteKind } from "@prisma/client";
import { Card, CardHeader } from "@/components/admin/ui";
import { formatDateTime, initials, timeAgo } from "@/lib/admin/labels";
import { DeleteNoteButton } from "../../_components/DeleteNoteButton";
import { NoteForm } from "../../_components/NoteForm";
import { plural } from "../../_lib/helpers";

type Entry = {
  id: string;
  createdAt: Date;
  kind: NoteKind;
  body: string;
  author: { name: string } | null;
};

/**
 * Odoo's chatter: "Log note" on top, then one reverse-chronological timeline
 * of the notes admins wrote and the events the system recorded (stage moves,
 * won / lost, quotations accepted, agreements generated, activities done).
 * Notes can be deleted; events are the audit trail and cannot.
 *
 * `origin` is the moment the opportunity arrived when no event records it
 * (a lead from before arrivals were logged), drawn as the oldest entry.
 */
export function Timeline({
  leadId,
  entries,
  origin,
}: {
  leadId: string;
  entries: Entry[];
  origin: { at: Date; text: string } | null;
}) {
  const notes = entries.filter((e) => e.kind === "NOTE").length;
  const events = entries.length - notes;

  return (
    <Card>
      <CardHeader
        title="Timeline"
        subtitle={
          entries.length > 0
            ? `${plural(notes, "note")} · ${plural(events, "event")}, newest first`
            : "Log calls, meetings and decisions so the whole history lives here."
        }
      />
      <NoteForm leadId={leadId} />

      {(entries.length > 0 || origin) && (
        <ol className="relative mt-6 space-y-4 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-ink-100">
          {entries.map((entry) =>
            entry.kind === "NOTE" ? (
              <li key={entry.id} className="relative flex gap-3">
                <span
                  aria-hidden="true"
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-abyss-600 to-aqua-500 text-[0.66rem] font-bold text-white ring-4 ring-white"
                >
                  {entry.author ? initials(entry.author.name) : <StickyNote className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-ink-100 bg-canvas/70 px-3.5 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-[0.8rem]">
                      <span className="font-semibold text-ink-900">{entry.author?.name ?? "An admin"}</span>{" "}
                      <span className="text-ink-550">logged a note</span>
                    </p>
                    <Stamp at={entry.createdAt} />
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[0.86rem] leading-relaxed text-ink-800">
                    {entry.body}
                  </p>
                  <div className="-mb-1 mt-1 flex justify-end">
                    <DeleteNoteButton leadId={leadId} noteId={entry.id} noteLabel={formatDateTime(entry.createdAt)} />
                  </div>
                </div>
              </li>
            ) : (
              <li key={entry.id} className="relative flex gap-3">
                <span
                  aria-hidden="true"
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-500 ring-1 ring-ink-200"
                >
                  <History className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="whitespace-pre-wrap break-words text-[0.83rem] leading-relaxed text-ink-700">{entry.body}</p>
                  <p className="mt-0.5 text-[0.72rem] text-ink-550">
                    <span className="font-medium text-ink-600">{entry.author?.name ?? "System"}</span>
                    <span aria-hidden="true"> · </span>
                    <Stamp at={entry.createdAt} inline />
                  </p>
                </div>
              </li>
            ),
          )}
          {origin && (
            <li className="relative flex gap-3">
              <span
                aria-hidden="true"
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-abyss-600 ring-1 ring-azure-300"
              >
                <Inbox className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[0.83rem] leading-relaxed text-ink-700">{origin.text}</p>
                <p className="mt-0.5 text-[0.72rem] text-ink-550">
                  <Stamp at={origin.at} inline />
                </p>
              </div>
            </li>
          )}
        </ol>
      )}
    </Card>
  );
}

/** "3 hours ago · 28 Sept 2026, 14:05" on the business clock. */
function Stamp({ at, inline = false }: { at: Date; inline?: boolean }) {
  const exact = formatDateTime(at);
  return (
    <span className={inline ? undefined : "text-[0.72rem] text-ink-550"}>
      <time dateTime={at.toISOString()} title={exact}>
        {timeAgo(at)}
      </time>
      <span aria-hidden="true"> · </span>
      <span className="whitespace-nowrap">{exact}</span>
    </span>
  );
}

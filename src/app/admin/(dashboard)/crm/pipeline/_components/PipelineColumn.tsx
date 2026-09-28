"use client";

import Link from "next/link";
import { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowRight, Plus, X } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { TONE_DOT, type Tone } from "@/lib/admin/labels";
import { formatMoney, formatMoneyCompact } from "@/lib/admin/money";
import { isOpenStage, type BoardStage } from "@/lib/admin/pipeline";
import { crmHref } from "../../_lib/helpers";
import { activityCounts, type ActivityCounts, type FocusRequest, type PipelineCard } from "../_lib/board";
import { ACTIVITY_LEGEND } from "./ActivityIndicator";
import { useComposer } from "./composer";
import { SortableCard } from "./PipelineCard";
import { QuickCreateForm } from "./QuickCreateForm";

export const COLUMN_PREFIX = "column:";

export function columnDroppableId(stage: BoardStage): string {
  return `${COLUMN_PREFIX}${stage}`;
}

/**
 * One stage of the board. Counts and sums cover the whole stage: the cards
 * shown here (live, so they follow a drag) plus any past the per-column cap,
 * which the server counted but didn't send.
 */
export function PipelineColumn({
  stage,
  label,
  tone,
  cards,
  hidden,
  q,
  isDropTarget,
  focusRequest,
  onFocused,
  onMove,
  onError,
}: {
  stage: BoardStage;
  label: string;
  tone: Tone;
  cards: PipelineCard[];
  hidden: { count: number; valueFils: number };
  /** The board's search, carried over to the Leads list so it shows the same cards. */
  q: string;
  /** The dragged card is currently over this column. */
  isDropTarget: boolean;
  focusRequest: FocusRequest | null;
  onFocused: () => void;
  onMove: (card: PipelineCard, toStage: BoardStage) => void;
  onError: (message: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: columnDroppableId(stage), data: { type: "column", stage } });
  const { composer, openComposer, closeComposer } = useComposer();
  const addRef = useRef<HTMLButtonElement>(null);

  const slug = stage.toLowerCase();
  const headingId = `pipeline-${slug}-heading`;
  const composerId = `pipeline-${slug}-composer`;
  const composerOpen = composer?.stage === stage;
  const canCreate = isOpenStage(stage);

  const count = cards.length + hidden.count;
  const valueFils = cards.reduce((sum, c) => sum + (c.valueFils ?? 0), 0) + hidden.valueFils;

  function close() {
    closeComposer();
    addRef.current?.focus();
  }

  return (
    <li className="flex w-[17.5rem] shrink-0 snap-start">
      <section
        ref={setNodeRef}
        aria-labelledby={headingId}
        className={cn(
          "flex w-full flex-col rounded-2xl border p-2.5 transition-colors",
          isDropTarget
            ? "border-azure-400 bg-azure-400/10 ring-4 ring-azure-400/15"
            : stage === "WON"
              ? "border-mint-600/25 bg-mint-500/10"
              : "border-ink-100 bg-ink-100/45",
        )}
      >
        <header className="px-1.5 pb-2.5 pt-1">
          <div className="flex min-h-7 items-center gap-2">
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])} />
            <h2 id={headingId} className="truncate font-display text-[0.9rem] font-bold text-ink-900">
              {label}
            </h2>
            <span className="rounded-full bg-white px-1.5 py-px text-[0.68rem] font-semibold tabular-nums text-ink-600 ring-1 ring-ink-100">
              {count}
              <span className="sr-only"> {count === 1 ? "opportunity" : "opportunities"}</span>
            </span>
            <span
              className="ml-auto shrink-0 text-[0.76rem] font-semibold tabular-nums text-ink-700"
              title={`Expected revenue: ${formatMoney(valueFils)}`}
            >
              <span aria-hidden="true">{formatMoneyCompact(valueFils)}</span>
              <span className="sr-only">Expected revenue {formatMoney(valueFils)}</span>
            </span>
            {canCreate && (
              <button
                ref={addRef}
                type="button"
                aria-expanded={composerOpen}
                aria-controls={composerOpen ? composerId : undefined}
                aria-label={`New opportunity in ${label}`}
                title={composerOpen ? "Close the new card" : `Add to ${label}`}
                onClick={() => (composerOpen ? close() : openComposer(stage))}
                className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-white hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400"
              >
                {composerOpen ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          <ActivityBar counts={activityCounts(cards)} capped={hidden.count > 0} />
        </header>

        {composerOpen && isOpenStage(stage) && (
          <QuickCreateForm id={composerId} stage={stage} stageLabel={label} nonce={composer.nonce} onClose={close} />
        )}

        <SortableContext id={stage} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="relative flex min-h-28 flex-1 flex-col">
            <ol aria-labelledby={headingId} className="flex flex-col gap-2">
              {cards.map((card) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  focusToken={focusRequest?.cardId === card.id ? focusRequest.nonce : null}
                  onFocused={onFocused}
                  onMove={onMove}
                  onError={onError}
                />
              ))}
            </ol>
            {cards.length === 0 && (
              <p
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border border-dashed px-4 text-center text-[0.76rem] text-ink-550",
                  isDropTarget ? "border-azure-400" : "border-ink-200 bg-white/50",
                )}
              >
                {hidden.count > 0
                  ? "No cards loaded"
                  : stage === "WON"
                    ? "Drop a deal here to win it"
                    : "No opportunities at this stage"}
              </p>
            )}
          </div>
        </SortableContext>

        {hidden.count > 0 && (
          <p className="mt-2 px-1.5 text-[0.72rem] leading-snug text-ink-550">
            Showing the first {cards.length} of {count}.{" "}
            <Link
              href={crmHref({ status: stage, q })}
              className="inline-flex items-center gap-0.5 font-semibold text-abyss-600 hover:underline"
            >
              See all in Leads
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </p>
        )}
      </section>
    </li>
  );
}

/**
 * Odoo's column progress bar: one segment per activity state, sized by how
 * many cards are in it. role="img" + a label give it a text equivalent.
 */
function ActivityBar({ counts, capped }: { counts: ActivityCounts; capped: boolean }) {
  const total = counts.overdue + counts.today + counts.planned + counts.none;
  const text =
    total === 0
      ? "No opportunities"
      : `Activities${capped ? " on the cards shown" : ""}: ${counts.overdue} overdue, ${counts.today} due today, ${counts.planned} planned, ${counts.none} with none`;
  return (
    <div
      role="img"
      aria-label={text}
      title={text}
      className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-ink-200/60"
    >
      {ACTIVITY_LEGEND.map(({ key, dot }) =>
        counts[key] > 0 ? <span key={key} className={dot} style={{ flex: `${counts[key]} 1 0%` }} /> : null,
      )}
    </div>
  );
}

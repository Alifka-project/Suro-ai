"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, FileSignature, FlaskConical, Globe, GripVertical, Loader2, PenLine } from "lucide-react";
import { Badge, cn } from "@/components/admin/ui";
import { LEAD_STATUS, TONE_DOT } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/admin/money";
import { BOARD_STAGES, tagTone, type BoardStage } from "@/lib/admin/pipeline";
import type { PipelineCard as Card } from "../_lib/board";
import { ActivityIndicator } from "./ActivityIndicator";
import { OwnerAvatar } from "./OwnerAvatar";
import { PriorityStars, PriorityStarsStatic } from "./PriorityStars";

/**
 * A pipeline card. The whole card is a drag surface for mouse, pen and touch
 * (touch after a short press, so swiping still scrolls the board); keyboard
 * users pick it up with the grip button. The title is the real link to the
 * opportunity, stretched over the card with ::after, so the card needs no
 * nested interactive elements. Controls and tooltip-bearing bits sit above
 * that overlay (`relative z-10`); the controls also carry data-no-drag so
 * pressing them never starts a drag.
 */
export function SortableCard({
  card,
  focusToken,
  onFocused,
  onMove,
  onError,
}: {
  card: Card;
  /**
   * Set while the board wants this card's Move button focused: after a Move
   * menu move (the card remounts in its new column, or back in the old one if
   * the save fails) or when the reopen dialog closes. A new value asks again.
   */
  focusToken: number | null;
  /** The request above was met; the board clears it so a later remount can't steal focus. */
  onFocused: () => void;
  onMove: (card: Card, toStage: BoardStage) => void;
  onError: (message: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
    // A card whose move is still saving can't be picked up again yet.
    disabled: { draggable: !!card.saving, droppable: false },
    attributes: { roleDescription: "draggable opportunity" },
  });
  const [moveOpen, setMoveOpen] = useState(false);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Runs on mount too, so a card that remounts in another column picks the request up there.
  useEffect(() => {
    if (focusToken !== null) moveButtonRef.current?.focus();
  }, [focusToken]);

  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  function closePanel(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    setMoveOpen(false);
    moveButtonRef.current?.focus();
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...listeners}
      aria-busy={card.saving || undefined}
      className={cn(
        // select-none + no touch callout: a long press picks the card up
        // instead of selecting text or opening the link preview.
        "group relative touch-manipulation select-none rounded-xl border p-3 transition-[border-color,box-shadow] [-webkit-touch-callout:none]",
        // The card's own slot while its preview is being dragged.
        isDragging
          ? "border-dashed border-azure-300 bg-white/60 opacity-50"
          : "border-ink-100 bg-white shadow-[0_1px_2px_rgb(7_38_60/0.04)] hover:border-azure-300 hover:shadow-[0_10px_22px_-14px_rgb(7_38_60/0.35)]",
      )}
    >
      <CardFace
        card={card}
        title={
          <Link
            href={`/admin/crm/${card.id}`}
            draggable={false}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-azure-400 group-hover:text-abyss-600"
          >
            {card.title}
          </Link>
        }
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            aria-label={`Drag ${card.title}`}
            className="relative z-10 -mr-1.5 -mt-1 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400 active:cursor-grabbing aria-disabled:cursor-default"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        }
        stars={<PriorityStars leadId={card.id} title={card.title} priority={card.priority} onError={onError} />}
        agreement={
          card.agreement && (
            <Link
              href={`/admin/billing/agreements/${card.agreement.id}`}
              draggable={false}
              className="relative z-10 mt-2.5 flex items-center gap-1.5 rounded-lg bg-mint-500/15 px-2 py-1.5 text-[0.72rem] font-semibold text-mint-ink ring-1 ring-inset ring-mint-600/25 transition-colors hover:bg-mint-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400"
            >
              <FileSignature className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Agreement {card.agreement.number}</span>
              <span className="ml-auto shrink-0 font-medium">{card.agreement.statusLabel}</span>
            </Link>
          )
        }
        move={
          // aria-disabled, not disabled, while the move saves: the card has
          // just remounted in its new column and this button holds the focus
          // (a disabled button can't take it, and focus would fall to <body>).
          <button
            ref={moveButtonRef}
            type="button"
            data-no-drag=""
            aria-expanded={moveOpen}
            aria-controls={panelId}
            aria-disabled={card.saving || undefined}
            aria-label={`Move ${card.title} to another stage`}
            title={card.saving ? "Saving the move" : "Move to another stage"}
            onFocus={focusToken !== null ? onFocused : undefined}
            onClick={() => {
              if (!card.saving) setMoveOpen((open) => !open);
            }}
            className={cn(
              "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent",
              moveOpen ? "bg-ink-100 text-ink-800" : "text-ink-500",
            )}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        }
      />

      {moveOpen && (
        <div
          id={panelId}
          role="group"
          aria-label={`Move ${card.title} to`}
          data-no-drag=""
          onKeyDown={closePanel}
          className="relative z-10 mt-2 rounded-lg bg-haze p-2"
        >
          <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-550">Move to</p>
          <ul className="flex flex-wrap gap-1">
            {BOARD_STAGES.map((stage) => {
              const current = stage === card.stage;
              return (
                <li key={stage}>
                  <button
                    type="button"
                    disabled={current}
                    aria-current={current ? "true" : undefined}
                    onClick={() => {
                      setMoveOpen(false);
                      onMove(card, stage);
                    }}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.72rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400",
                      current
                        ? "cursor-default border-ink-900 bg-ink-900 text-white"
                        : "border-ink-200 bg-white text-ink-700 hover:border-azure-300 hover:text-ink-900",
                    )}
                  >
                    <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[LEAD_STATUS[stage].tone])} />
                    {LEAD_STATUS[stage].label}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[0.68rem] leading-snug text-ink-550">
            {card.stage === "WON"
              ? "Moving it out of Won reopens the deal; you'll be asked to confirm."
              : "Won generates the quotation and service agreement."}
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * What follows the pointer while dragging: the same card, without controls.
 * Hidden from assistive tech — the drag is narrated by the announcements.
 */
export function CardPreview({ card }: { card: Card }) {
  return (
    <div
      aria-hidden="true"
      className="cursor-grabbing select-none rounded-xl border border-azure-300 bg-white p-3 shadow-[0_22px_40px_-18px_rgb(7_38_60/0.55)] ring-4 ring-azure-400/15 motion-safe:rotate-[1.5deg]"
    >
      <CardFace
        card={card}
        title={card.title}
        handle={
          <span className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-ink-500">
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </span>
        }
        stars={<PriorityStarsStatic priority={card.priority} />}
        agreement={
          card.agreement && (
            <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-mint-500/15 px-2 py-1.5 text-[0.72rem] font-semibold text-mint-ink">
              <FileSignature className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Agreement {card.agreement.number}</span>
            </p>
          )
        }
      />
    </div>
  );
}

function CardFace({
  card,
  title,
  handle,
  stars,
  agreement,
  move,
}: {
  card: Card;
  title: ReactNode;
  handle: ReactNode;
  stars: ReactNode;
  agreement: ReactNode;
  move?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-[0.86rem] font-semibold leading-snug text-ink-900 [overflow-wrap:anywhere]">
          {title}
        </h3>
        {handle}
      </div>
      {card.subtitle && <p className="mt-0.5 truncate text-[0.76rem] text-ink-550">{card.subtitle}</p>}

      <div className="mt-2 flex items-center justify-between gap-2">
        {card.valueFils !== null ? (
          <p className="truncate text-[0.82rem] font-semibold tabular-nums text-ink-800">{formatMoney(card.valueFils)}</p>
        ) : (
          <p className="text-[0.76rem] text-ink-550">No expected revenue</p>
        )}
        <SourceMarker source={card.source} label={card.sourceLabel} />
      </div>

      {card.tags.length > 0 && (
        <ul aria-label="Tags" className="mt-2 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <li key={tag} className="max-w-full">
              <Badge tone={tagTone(tag)}>{tag}</Badge>
            </li>
          ))}
        </ul>
      )}

      {agreement}

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-ink-100 pt-2">
        {stars}
        <ActivityIndicator activity={card.activity} />
        <span className="flex-1" />
        {card.saving && (
          <span className="inline-flex items-center text-ink-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span className="sr-only">Saving</span>
          </span>
        )}
        {move}
        <OwnerAvatar owner={card.owner} className="relative z-10" />
      </div>
    </>
  );
}

const SOURCE_ICON = { website: Globe, manual: PenLine, demo: FlaskConical } as const;
const SOURCE_SHORT: Record<string, string> = { website: "Web", manual: "Manual", demo: "Demo" };

function SourceMarker({ source, label }: { source: string; label: string }) {
  const Icon = SOURCE_ICON[source as keyof typeof SOURCE_ICON] ?? Globe;
  return (
    <span
      title={`Source: ${label}`}
      className="relative z-10 inline-flex shrink-0 items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-550"
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span aria-hidden="true">{SOURCE_SHORT[source] ?? source}</span>
      <span className="sr-only">Source: {label}</span>
    </span>
  );
}

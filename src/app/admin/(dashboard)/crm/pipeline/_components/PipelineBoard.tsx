"use client";

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
  type PointerSensorOptions,
  type TouchSensorOptions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { cn } from "@/components/admin/ui";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { BOARD_STAGES, isBoardStage, type BoardStage } from "@/lib/admin/pipeline";
import { moveLead } from "../../actions";
import {
  applyMove,
  boardFromColumns,
  findCard,
  findStage,
  placeCard,
  positionOf,
  type Board,
  type BoardMove,
  type CardPosition,
  type FocusRequest,
  type PipelineCard,
  type PipelineColumnData,
} from "../_lib/board";
import { BoardToast, type BoardNotice } from "./BoardToast";
import { CardPreview } from "./PipelineCard";
import { COLUMN_PREFIX, PipelineColumn } from "./PipelineColumn";
import { ReopenDialog } from "./ReopenDialog";

// ─── Sensors ─────────────────────────────────────────────────────────────────

/** Controls marked data-no-drag (stars, the Move menu) never start a drag. */
function isDragExempt(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-no-drag]") !== null;
}

/**
 * Mouse and pen. Touch is left to the long-press sensor below: a pointer
 * sensor would also fire for fingers and turn every swipe across the board
 * into a drag instead of a scroll.
 */
class MouseAndPenSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === "touch") return false;
        if (isDragExempt(event.target)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

class LongPressSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent: event }: ReactTouchEvent, { onActivation }: TouchSensorOptions) => {
        if (event.touches.length > 1 || isDragExempt(event.target)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

// ─── Collision detection ─────────────────────────────────────────────────────

function isColumnId(id: UniqueIdentifier): boolean {
  return String(id).startsWith(COLUMN_PREFIX);
}

function stageOfColumnId(id: UniqueIdentifier): BoardStage | null {
  const stage = String(id).slice(COLUMN_PREFIX.length);
  return isBoardStage(stage) ? stage : null;
}

/**
 * Cards win over the column they sit in. Over a column's empty space the
 * nearest card in that column is the target, so dropping below the last card
 * lands at the bottom; an empty column is a target in its own right. Pointer
 * position first (mouse, touch), rectangle overlap as the fallback (keyboard).
 */
const detectCollisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  const hits = underPointer.length > 0 ? underPointer : rectIntersection(args);
  const card = hits.find((h) => !isColumnId(h.id));
  if (card) return [card];
  const column = hits.find((h) => isColumnId(h.id));
  if (!column) return [];
  const stage = stageOfColumnId(column.id);
  const cardsInColumn = args.droppableContainers.filter(
    (c) => !isColumnId(c.id) && c.data.current?.sortable?.containerId === stage,
  );
  return cardsInColumn.length > 0 ? closestCenter({ ...args, droppableContainers: cardsInColumn }) : [column];
};

/** Columns change size as cards move between them; measure continuously while dragging. */
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

const INSTRUCTIONS = {
  draggable:
    "To move this opportunity, press Space or Enter to pick it up, use the arrow keys to move it between cards and stages, then press Space or Enter to drop it, or Escape to cancel. The Move button on each card does the same without dragging.",
};

// ─── Board ───────────────────────────────────────────────────────────────────

type DragState = { id: string; board: Board; origin: CardPosition };

/** A move out of Won, held until the reopen dialog is answered. */
type PendingReopen = { move: BoardMove; title: string; pastCap: boolean };

type CommitOptions = {
  /** Move the focus to the card in its new column (a Move menu or dialog move, not a drag). */
  focus?: boolean;
  /** The card lands below the cards a capped column shows, so it leaves the board once saved. */
  pastCap?: boolean;
};

/**
 * The Odoo-style kanban. State model:
 *
 * - The server's columns are the source of truth. useOptimistic layers moves
 *   that are still saving on top of them and drops each layer when its save
 *   finishes — by then the revalidated columns have arrived, so the board
 *   resyncs to the server on its own (no effect copying props into state),
 *   and a failed save simply falls back to where the card was.
 * - While a drag is in progress, `drag.board` is a scratch copy that follows
 *   the pointer across columns; it is discarded on drop or cancel. The drag
 *   handlers keep the latest copy in a ref too, so a drop that arrives before
 *   React has re-rendered the last move still sees it.
 * - A move out of Won (dropped or from the Move menu) waits in `reopen` until
 *   the confirmation dialog is answered; the card stays in Won meanwhile.
 * - Moves made without dragging hand the focus to the moved card through
 *   `focusRequest`; the card clears the request once it has taken the focus.
 */
export function PipelineBoard({ columns, q }: { columns: PipelineColumnData[]; q: string }) {
  const serverBoard = useMemo(() => boardFromColumns(columns), [columns]);
  const [optimisticBoard, addOptimisticMove] = useOptimistic(serverBoard, applyMove);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [notice, setNotice] = useState<BoardNotice | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [reopen, setReopen] = useState<PendingReopen | null>(null);
  const [, startTransition] = useTransition();

  const board = drag?.board ?? optimisticBoard;
  const activeCard = drag ? findCard(drag.board, drag.id) : null;
  const dropStage = drag ? findStage(drag.board, drag.id) : null;

  /** Cards past each column's cap: counted by the server, never on screen, never moved. */
  const hidden = useMemo(() => {
    const out = {} as Record<BoardStage, { count: number; valueFils: number }>;
    for (const col of columns) {
      const shownValue = col.cards.reduce((sum, c) => sum + (c.valueFils ?? 0), 0);
      out[col.stage] = {
        count: Math.max(0, col.total - col.cards.length),
        valueFils: Math.max(0, col.totalValueFils - shownValue),
      };
    }
    return out;
  }, [columns]);

  const sensors = useSensors(
    useSensor(MouseAndPenSensor, { activationConstraint: { distance: 6 } }),
    useSensor(LongPressSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Only called from event handlers: the ref is never read during render. */
  function setDrag(next: DragState | null) {
    dragRef.current = next;
    setDragState(next);
  }

  const dismissNotice = useCallback(() => setNotice(null), []);
  const showError = useCallback((message: string) => setNotice({ id: Date.now(), ok: false, message }), []);
  const requestFocus = useCallback(
    (cardId: string) => setFocusRequest((r) => ({ cardId, nonce: (r?.nonce ?? 0) + 1 })),
    [],
  );
  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  /** Saves a move: shows it at once, then reports the server's answer. */
  function commit(move: BoardMove, fromStage: BoardStage, { focus = false, pastCap = false }: CommitOptions = {}) {
    setNotice(null);
    // Rendered with the optimistic move, so the card takes the focus as it mounts in its new column.
    if (focus) requestFocus(move.cardId);
    startTransition(async () => {
      addOptimisticMove(move);
      let result: Awaited<ReturnType<typeof moveLead>>;
      try {
        result = await moveLead({
          leadId: move.cardId,
          toStage: move.toStage,
          beforeId: move.beforeId,
          afterId: move.afterId,
        });
      } catch {
        // Network failure: the optimistic move unwinds with the transition.
        result = { ok: false, message: "Could not reach the server. Check your connection and try again." };
      }
      const shown = pastCap && result.ok ? columns.find((c) => c.stage === move.toStage)?.cards.length : undefined;
      // Committed together with the server's board (or the unwound move).
      startTransition(() => {
        setNotice({
          id: Date.now(),
          ok: result.ok,
          message:
            shown === undefined
              ? result.message
              : `${result.message} It now sits past the first ${shown} cards shown in this stage, so it is off the board but still in Leads.`,
          links:
            shown !== undefined && !result.links?.length
              ? [{ label: "Open the opportunity", href: `/admin/crm/${move.cardId}` }]
              : result.links,
          won: result.ok && move.toStage === "WON" && fromStage !== "WON",
        });
        // A failed save puts the card back where it was: it remounts there, so ask again.
        if (focus && !result.ok) requestFocus(move.cardId);
      });
    });
  }

  /** The Move menu on a card: straight to the top of the chosen column. */
  function moveViaMenu(card: PipelineCard, toStage: BoardStage) {
    if (card.stage === toStage) return;
    const move: BoardMove = { cardId: card.id, toStage, beforeId: null, afterId: null };
    // Leaving Won reopens the deal: confirm first, as the opportunity page does.
    if (card.stage === "WON") {
      setReopen({ move, title: card.title, pastCap: false });
      return;
    }
    commit(move, card.stage, { focus: true });
  }

  /** The reopen dialog's answer. Either way the focus goes back to the card, not to <body>. */
  function closeReopen(confirmed: boolean) {
    const pending = reopen;
    setReopen(null);
    if (!pending) return;
    if (confirmed) commit(pending.move, "WON", { focus: true, pastCap: pending.pastCap });
    else requestFocus(pending.move.cardId);
  }

  function stageOf(over: Over, b: Board): BoardStage | null {
    return isColumnId(over.id) ? stageOfColumnId(over.id) : findStage(b, String(over.id));
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    const origin = positionOf(optimisticBoard, id);
    if (!origin) return;
    setFocusRequest(null);
    setDrag({ id, board: optimisticBoard, origin });
  }

  /** Crossing into another column: move the card there so the column opens a gap for it. */
  function handleDragOver({ active, over }: DragOverEvent) {
    const d = dragRef.current;
    if (!d || !over) return;
    const fromStage = findStage(d.board, d.id);
    const toStage = stageOf(over, d.board);
    if (!fromStage || !toStage || fromStage === toStage) return;

    const target = d.board[toStage];
    const overIndex = isColumnId(over.id) ? -1 : target.findIndex((c) => c.id === over.id);
    const dragged = active.rect.current.translated;
    const belowOver = dragged !== null && dragged.top > over.rect.top + over.rect.height / 2;
    const index = overIndex >= 0 ? overIndex + (belowOver ? 1 : 0) : target.length;
    setDrag({ ...d, board: placeCard(d.board, d.id, toStage, index) });
  }

  function handleDragEnd({ over }: DragEndEvent) {
    const current = dragRef.current;
    setDrag(null);
    if (!current) return;

    let finalBoard = current.board;
    const stage = findStage(finalBoard, current.id);
    if (!stage) return;
    // Reordering within a column happens on drop (sortable only animates it while dragging).
    if (over && !isColumnId(over.id) && over.id !== current.id) {
      const list = finalBoard[stage];
      const from = list.findIndex((c) => c.id === current.id);
      const to = list.findIndex((c) => c.id === over.id);
      if (from >= 0 && to >= 0) finalBoard = { ...finalBoard, [stage]: arrayMove(list, from, to) };
    }

    const position = positionOf(finalBoard, current.id);
    if (!position) return;
    const { origin } = current;
    if (
      position.stage === origin.stage &&
      position.beforeId === origin.beforeId &&
      position.afterId === origin.afterId
    ) {
      return;
    }

    // Below the last card of a capped column, the card's real neighbour underneath
    // is the first one not loaded. Name it, or the server would place the card
    // somewhere among the unloaded cards. Coming from another column, the card
    // then sits just past the cap, so it leaves the board once saved.
    const column = columns.find((c) => c.stage === position.stage);
    const atCappedBottom = position.beforeId !== null && position.afterId === null && !!column?.firstHiddenId;
    const move: BoardMove = {
      cardId: current.id,
      toStage: position.stage,
      beforeId: position.beforeId,
      afterId: atCappedBottom ? (column?.firstHiddenId ?? null) : position.afterId,
    };
    const pastCap = atCappedBottom && finalBoard[position.stage].length > (column?.cards.length ?? 0);

    // Leaving Won reopens the deal: confirm first. The card stays in Won meanwhile.
    if (origin.stage === "WON" && position.stage !== "WON") {
      setReopen({ move, title: findCard(finalBoard, current.id)?.title ?? "This opportunity", pastCap });
      return;
    }
    commit(move, origin.stage, { pastCap });
  }

  // Screen-reader narration of a drag, in terms of opportunities and stages.
  const titleOf = (id: UniqueIdentifier) => findCard(board, String(id))?.title ?? "The opportunity";
  const stageLabel = (stage: BoardStage | null) => (stage ? LEAD_STATUS[stage].label : "no stage");
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${titleOf(active.id)} in ${stageLabel(findStage(board, String(active.id)))}.`,
    onDragOver: ({ active, over }) => {
      if (!over) return `${titleOf(active.id)} is no longer over a stage.`;
      const next = !isColumnId(over.id) && over.id !== active.id ? `, next to ${titleOf(over.id)}` : "";
      return `${titleOf(active.id)} is over ${stageLabel(stageOf(over, board))}${next}.`;
    },
    onDragEnd: ({ active }) =>
      `${titleOf(active.id)} was dropped in ${stageLabel(findStage(board, String(active.id)))}.`,
    onDragCancel: ({ active }) =>
      `Move cancelled. ${titleOf(active.id)} stays in ${stageLabel(drag?.origin.stage ?? null)}.`,
  };

  return (
    <>
      <DndContext
        // A fixed id keeps dnd-kit's generated aria-describedby ids identical
        // on the server and the client (no hydration mismatch).
        id="crm-pipeline-board"
        sensors={sensors}
        collisionDetection={detectCollisions}
        measuring={MEASURING}
        accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        {/* The board scrolls sideways inside itself, so the page never overflows
            on a phone; there it snaps a column at a time (not mid-drag, where
            snapping would fight the auto-scroll). */}
        <div
          className={cn(
            // relative: the containing block for absolutely positioned descendants
            // (sr-only text), so they're clipped here instead of widening the page.
            "relative -mx-4 overflow-x-auto scroll-px-4 px-4 pb-4 pt-1 sm:mx-0 sm:px-0",
            drag ? "snap-none" : "snap-x snap-mandatory sm:snap-none",
          )}
        >
          <ol aria-label="Pipeline stages" className="flex w-max items-stretch gap-3">
            {BOARD_STAGES.map((stage) => {
              const column = columns.find((c) => c.stage === stage);
              return (
                <PipelineColumn
                  key={stage}
                  stage={stage}
                  label={column?.label ?? LEAD_STATUS[stage].label}
                  tone={column?.tone ?? LEAD_STATUS[stage].tone}
                  cards={board[stage]}
                  hidden={hidden[stage] ?? { count: 0, valueFils: 0 }}
                  q={q}
                  isDropTarget={dropStage === stage}
                  focusRequest={focusRequest}
                  onFocused={clearFocusRequest}
                  onMove={moveViaMenu}
                  onError={showError}
                />
              );
            })}
          </ol>
        </div>
        <DragOverlay>{activeCard ? <CardPreview card={activeCard} /> : null}</DragOverlay>
      </DndContext>

      <BoardToast notice={notice} onDismiss={dismissNotice} />

      {reopen && (
        <ReopenDialog
          title={reopen.title}
          stageLabel={LEAD_STATUS[reopen.move.toStage].label}
          onClose={closeReopen}
        />
      )}
    </>
  );
}

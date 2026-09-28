import type { Tone } from "@/lib/admin/labels";
import { BOARD_STAGES, type ActivityState, type BoardStage } from "@/lib/admin/pipeline";
import type { ActivityBrief } from "../../_lib/helpers";

/*
 * The pipeline board's client-side model. Pure — the page builds it on the
 * server, the board reorders it optimistically in the browser. Everything
 * here is plain serialisable data: dates and activity states are resolved on
 * the server (on the Dubai clock), so the client never re-derives "today" and
 * hydration can't disagree about it.
 */

export type PipelineCard = {
  id: string;
  stage: BoardStage;
  /** leadTitle(): opportunity name, else company, else contact. */
  title: string;
  /** Company and contact, minus whichever is already the title. */
  subtitle: string | null;
  valueFils: number | null;
  priority: number;
  tags: string[];
  source: string;
  sourceLabel: string;
  owner: { id: string; name: string } | null;
  /** The next (earliest-due) open activity; its state is the card's worst. */
  activity: (ActivityBrief & { openCount: number }) | null;
  /** Won cards: the service agreement generated for the deal. */
  agreement: { id: string; number: string; statusLabel: string } | null;
  /** Set while a move is being saved (optimistic state only). */
  saving?: boolean;
};

export type PipelineColumnData = {
  stage: BoardStage;
  label: string;
  tone: Tone;
  /** Opportunities in this stage matching the filters, including any past the cap. */
  total: number;
  totalValueFils: number;
  /** The first cards of the stage, in board order (capped). */
  cards: PipelineCard[];
  /**
   * The first card past the cap, when there is one: the real neighbour below
   * the last card shown, so a drop at the bottom of a capped column lands
   * between the two instead of somewhere among the cards that aren't loaded.
   */
  firstHiddenId: string | null;
};

export type Board = Record<BoardStage, PipelineCard[]>;

/** A card placed in a stage between two neighbours (both null = top of the column). */
export type BoardMove = {
  cardId: string;
  toStage: BoardStage;
  beforeId: string | null;
  afterId: string | null;
};

export type CardPosition = { stage: BoardStage; beforeId: string | null; afterId: string | null };

/** "Focus this card's Move button." A fresh nonce repeats the request for the same card. */
export type FocusRequest = { cardId: string; nonce: number };

export function boardFromColumns(columns: readonly PipelineColumnData[]): Board {
  const board = emptyBoard();
  for (const column of columns) board[column.stage] = column.cards;
  return board;
}

function emptyBoard(): Board {
  return Object.fromEntries(BOARD_STAGES.map((s) => [s, [] as PipelineCard[]])) as Board;
}

export function findStage(board: Board, cardId: string): BoardStage | null {
  for (const stage of BOARD_STAGES) {
    if (board[stage].some((c) => c.id === cardId)) return stage;
  }
  return null;
}

export function findCard(board: Board, cardId: string): PipelineCard | null {
  for (const stage of BOARD_STAGES) {
    const card = board[stage].find((c) => c.id === cardId);
    if (card) return card;
  }
  return null;
}

/** Where a card sits: its stage and the cards directly above and below it. */
export function positionOf(board: Board, cardId: string): CardPosition | null {
  const stage = findStage(board, cardId);
  if (!stage) return null;
  const list = board[stage];
  const i = list.findIndex((c) => c.id === cardId);
  return { stage, beforeId: list[i - 1]?.id ?? null, afterId: list[i + 1]?.id ?? null };
}

/**
 * Takes a card out of its column and inserts it into `toStage` at `index`
 * (clamped). Used while dragging, where the drop index is already known.
 */
export function placeCard(board: Board, cardId: string, toStage: BoardStage, index: number): Board {
  const card = findCard(board, cardId);
  if (!card) return board;
  const next = { ...board };
  for (const stage of BOARD_STAGES) {
    if (next[stage].some((c) => c.id === cardId)) next[stage] = next[stage].filter((c) => c.id !== cardId);
  }
  const target = next[toStage];
  const at = Math.max(0, Math.min(index, target.length));
  next[toStage] = [...target.slice(0, at), { ...card, stage: toStage }, ...target.slice(at)];
  return next;
}

/**
 * Applies a saved-or-saving move by its neighbours rather than an index, so it
 * still lands sensibly if the column changed underneath it (another admin, a
 * refresh). The moved card is flagged `saving` for as long as the optimistic
 * state lives. This is the useOptimistic reducer.
 */
export function applyMove(board: Board, move: BoardMove): Board {
  const card = findCard(board, move.cardId);
  if (!card) return board;
  const without = board[move.toStage].filter((c) => c.id !== move.cardId);
  let index = 0;
  const afterBefore = move.beforeId ? without.findIndex((c) => c.id === move.beforeId) : -1;
  if (afterBefore >= 0) index = afterBefore + 1;
  else if (move.afterId) index = Math.max(0, without.findIndex((c) => c.id === move.afterId));
  const moved = placeCard(board, move.cardId, move.toStage, index);
  return { ...moved, [move.toStage]: moved[move.toStage].map((c) => (c.id === move.cardId ? { ...c, saving: true } : c)) };
}

export type ActivityCounts = Record<ActivityState | "none", number>;

/** How many cards are in each activity state — the column's progress bar. */
export function activityCounts(cards: readonly PipelineCard[]): ActivityCounts {
  const counts: ActivityCounts = { overdue: 0, today: 0, planned: 0, none: 0 };
  for (const card of cards) counts[card.activity?.state ?? "none"] += 1;
  return counts;
}

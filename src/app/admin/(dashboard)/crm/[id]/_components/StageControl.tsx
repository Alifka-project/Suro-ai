"use client";

import {
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { LeadStatus } from "@prisma/client";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  FilePlus2,
  Loader2,
  RotateCcw,
  ThumbsDown,
  Trophy,
  X,
} from "lucide-react";
import { Button, Field, LinkButton, cn, fieldMessageId, inputClass, textareaClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { LEAD_STATUS } from "@/lib/admin/labels";
import { BOARD_STAGES, LOST_REASONS, type BoardStage, type OpenStage } from "@/lib/admin/pipeline";
import { markLost, markWon, moveLead, restoreLead } from "../../actions";
import { seed, withEcho, type EchoState } from "../../_components/OppFormState";
import type { WinPlan } from "../_lib/win-plan";

/*
 * The opportunity's status strip, Odoo style: "Mark won" / "Mark lost" on the
 * left, the stage bar on the right, and below it whatever the outcome needs —
 * the won confirmation, the lost dialog, the Won / Lost banner.
 *
 * Every result (stage move, won, lost, restore) lands in ONE live region that
 * stays mounted while the lead changes state underneath it, so the message
 * and its links survive the revalidation that follows each action. The last
 * result to arrive is the one shown.
 */

type ResultLink = { label: string; href: string };
type Flash = { ok: boolean; message: string; links?: ResultLink[] };
type Panel = { kind: "won" } | { kind: "lost" } | { kind: "reopen"; stage: OpenStage } | null;

export type WonInfo = { date: string | null; links: ResultLink[] };
export type LostInfo = { date: string | null; reason: string | null; note: string | null; restoreTo: string };

const lostWithEcho = withEcho(markLost);

export function StageControl({
  leadId,
  status,
  winPlan,
  won,
  lost,
}: {
  leadId: string;
  status: LeadStatus;
  winPlan: WinPlan;
  won: WonInfo | null;
  lost: LostInfo | null;
}) {
  const [shownStatus, setShownStatus] = useOptimistic(status);
  const [moving, startMove] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [wonState, wonAction] = useActionState(markWon, null);
  const [lostState, lostAction] = useActionState(lostWithEcho, null);
  const [restoreState, restoreAction] = useActionState(restoreLead, null);
  // The message on screen: the result that ARRIVED last, replaced by each new
  // one and cleared by Dismiss. Never ordered by the results' `at` stamps —
  // won / lost / restore carry the server's clock, which the browser's may
  // not match.
  const [flash, setFlash] = useState<Flash | null>(null);
  // Results already on screen when the current panel opened: a failure from an
  // earlier, closed attempt stays out of it (compared by identity).
  const [stale, setStale] = useState<{ won: typeof wonState; lost: typeof lostState }>({ won: null, lost: null });
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // After won / lost / restore succeeds the button that was pressed is gone
  // (its panel closed, or the banner around it was replaced), so focus moves
  // to what replaced it rather than dropping to the top of the document.
  const [focusRequest, setFocusRequest] = useState<{ to: "outcome" | "flash" } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLHeadingElement>(null);

  // Take each action's result as it arrives (render-time sync, not an effect).
  // Won / lost failures stay inside their open panel, next to the form.
  const [seenWon, setSeenWon] = useState(wonState);
  if (wonState !== seenWon) {
    setSeenWon(wonState);
    if (wonState?.ok) {
      setPanel(null);
      setFlash(wonState);
      setFocusRequest({ to: "outcome" });
    }
  }
  const [seenLost, setSeenLost] = useState(lostState);
  if (lostState !== seenLost) {
    setSeenLost(lostState);
    if (lostState?.ok) {
      setPanel(null);
      setFlash(lostState);
      setFocusRequest({ to: "outcome" });
    }
  }
  const [seenRestore, setSeenRestore] = useState(restoreState);
  if (restoreState !== seenRestore) {
    setSeenRestore(restoreState);
    if (restoreState) {
      setFlash(restoreState);
      // The Lost banner, and its Restore button, go once the lead reopens.
      if (restoreState.ok) setFocusRequest({ to: "flash" });
    }
  }

  useEffect(() => {
    if (!focusRequest) return;
    // The new Won / Lost banner once the refreshed lead is here; the message otherwise.
    const target = (focusRequest.to === "outcome" ? outcomeRef.current : null) ?? flashRef.current;
    target?.focus();
  }, [focusRequest]);

  const isOpen = status !== "WON" && status !== "LOST";

  function openPanel(next: Exclude<Panel, null>, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setStale({ won: wonState, lost: lostState });
    setPanel(next);
  }

  const wonFailure = wonState && !wonState.ok && wonState !== stale.won ? wonState : null;
  const lostAttempt = lostState !== stale.lost ? lostState : null;

  function returnFocus() {
    const trigger = returnFocusRef.current;
    // The trigger may only be focusable again after the panel unmounts.
    requestAnimationFrame(() => trigger?.focus());
  }

  function closePanel() {
    setPanel(null);
    returnFocus();
  }

  function dismissFlash() {
    setFlash(null);
    // The Dismiss button goes with the message: keep focus in the strip, on the
    // Won / Lost banner or else the current stage.
    const target = outcomeRef.current ?? stripRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    target?.focus();
  }

  /**
   * `from` is the stage this page shows. If the lead has left it meanwhile
   * (won in Billing, moved in another tab) the server refuses the move and
   * refreshes the page, and the stage bar falls back with the message.
   */
  function commitMove(stage: OpenStage, from: BoardStage) {
    setPanel(null);
    startMove(async () => {
      setShownStatus(stage);
      let result: Flash;
      try {
        result = await moveLead({ leadId, fromStage: from, toStage: stage });
      } catch {
        result = { ok: false, message: "Could not reach the server. Check your connection and try again." };
      }
      startMove(() => setFlash(result));
    });
  }

  function selectStage(stage: BoardStage, trigger: HTMLElement) {
    if (moving || status === "LOST" || stage === status) return;
    if (stage === "WON") return openPanel({ kind: "won" }, trigger);
    // Leaving Won reopens the deal: worth a confirmation, unlike a move between open stages.
    if (status === "WON") return openPanel({ kind: "reopen", stage }, trigger);
    commitMove(stage, status);
  }

  return (
    <section aria-label="Stage and outcome" className="mb-5 space-y-3">
      <div
        ref={stripRef}
        className="rounded-2xl border border-ink-100 bg-white p-3 shadow-[0_1px_2px_rgb(7_38_60/0.04)] sm:p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {isOpen && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={moving}
                aria-expanded={panel?.kind === "won"}
                aria-controls={panel?.kind === "won" ? "won-panel" : undefined}
                onClick={(e) => openPanel({ kind: "won" }, e.currentTarget)}
              >
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Mark won
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={moving}
                aria-expanded={panel?.kind === "lost"}
                aria-controls={panel?.kind === "lost" ? "lost-panel" : undefined}
                onClick={(e) => openPanel({ kind: "lost" }, e.currentTarget)}
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                Mark lost
              </Button>
            </div>
          )}
          <StageBar
            current={shownStatus}
            lost={status === "LOST"}
            pendingStage={moving ? shownStatus : null}
            onSelect={selectStage}
          />
        </div>

        {panel?.kind === "won" && (
          <PanelShell
            id="won-panel"
            tone="mint"
            title={status === "WON" ? "Generate the deal paperwork?" : "Mark this opportunity as won?"}
            onClose={closePanel}
          >
            <p className="text-[0.8rem] text-ink-600">Here is exactly what will happen:</p>
            <ol className="mt-2.5 space-y-2">
              {winPlan.steps.map((step, i) => (
                <li key={step} className="flex gap-2.5 text-[0.84rem] leading-snug text-ink-800">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[0.68rem] font-bold tabular-nums text-mint-ink ring-1 ring-mint-600/40"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-px [overflow-wrap:anywhere]">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[0.76rem] text-ink-550">
              Each step is logged on the timeline. A generated agreement starts as a draft you can review and edit before
              sending it to the client.
            </p>
            <form action={wonAction} className="mt-4 flex flex-wrap justify-end gap-2">
              <input type="hidden" name="leadId" value={leadId} />
              <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              <SubmitButton size="sm" pendingLabel="Working">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                {status === "WON" ? "Generate paperwork" : "Mark as won"}
              </SubmitButton>
            </form>
            {wonFailure && <InlineError>{wonFailure.message}</InlineError>}
          </PanelShell>
        )}

        {panel?.kind === "lost" && (
          <PanelShell id="lost-panel" tone="red" title="Mark this opportunity as lost" onClose={closePanel}>
            <p className="mb-4 text-[0.8rem] text-ink-600">
              It leaves the pipeline board and its activities drop off the planner. You can restore it at any time.
            </p>
            <LostForm key={lostAttempt?.at ?? 0} leadId={leadId} state={lostAttempt} formAction={lostAction} onCancel={closePanel} />
          </PanelShell>
        )}

        {panel?.kind === "reopen" && (
          <PanelShell
            id="reopen-panel"
            tone="neutral"
            title={`Reopen the deal in ${LEAD_STATUS[panel.stage].label}?`}
            onClose={closePanel}
          >
            <p className="text-[0.84rem] leading-relaxed text-ink-700">
              The opportunity leaves Won and its win date is cleared. Quotations, service agreements and invoices already
              generated are kept as they are.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  // The panel only opens on a Won deal: if it was reopened meanwhile, the move is refused.
                  commitMove(panel.stage, "WON");
                  // Back to the stage segment that opened this, which stays focusable while it moves.
                  returnFocus();
                }}
              >
                Reopen in {LEAD_STATUS[panel.stage].label}
              </Button>
            </div>
          </PanelShell>
        )}

        <div aria-live="polite">
          {flash && (
            <div
              ref={flashRef}
              tabIndex={-1}
              className={cn(
                "mt-3 flex items-start gap-3 rounded-xl border px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500",
                flash.ok ? "border-mint-600/30 bg-mint-200/30" : "border-red-200 bg-red-50",
              )}
            >
              {flash.ok ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-ink" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[0.85rem] font-medium leading-snug [overflow-wrap:anywhere]",
                    flash.ok ? "text-ink-900" : "text-red-700",
                  )}
                >
                  {flash.message}
                </p>
                {flash.links && flash.links.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {flash.links.map((link) => (
                      <LinkButton key={link.href} href={link.href} variant="secondary" size="sm">
                        {link.label}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </LinkButton>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={dismissFlash}
                aria-label="Dismiss message"
                className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-white hover:text-ink-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {status === "WON" && won && (
        <div className="flex flex-col gap-3 rounded-2xl border border-mint-600/35 bg-linear-to-r from-mint-200/60 via-mint-200/25 to-white p-4 sm:flex-row sm:items-start">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint-ink text-white">
            <Trophy className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              ref={outcomeRef}
              tabIndex={-1}
              className="rounded-md font-display text-[0.98rem] font-bold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500"
            >
              Deal won{won.date ? ` on ${won.date}` : ""}
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-ink-600">
              {won.links.length > 0
                ? "The paperwork generated for this deal:"
                : winPlan.hasWork
                  ? "The service agreement has not been generated yet."
                  : "Add a quotation to generate the service agreement."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {won.links.map((link) => (
                <LinkButton key={link.href} href={link.href} variant="secondary" size="sm">
                  {link.label}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </LinkButton>
              ))}
              {winPlan.hasWork ? (
                <Button
                  type="button"
                  size="sm"
                  aria-expanded={panel?.kind === "won"}
                  aria-controls={panel?.kind === "won" ? "won-panel" : undefined}
                  onClick={(e) => openPanel({ kind: "won" }, e.currentTarget)}
                >
                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate paperwork
                </Button>
              ) : (
                won.links.length === 0 && (
                  <LinkButton href={`/admin/billing/quotes/new?leadId=${leadId}`} size="sm">
                    <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                    New quotation
                  </LinkButton>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {status === "LOST" && lost && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-start">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              ref={outcomeRef}
              tabIndex={-1}
              className="rounded-md font-display text-[0.98rem] font-bold text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500"
            >
              Lost{lost.date ? ` on ${lost.date}` : ""}
            </h2>
            <p className="mt-0.5 text-[0.84rem] text-ink-800 [overflow-wrap:anywhere]">
              <span className="text-ink-600">Reason: </span>
              <span className="font-semibold">{lost.reason ?? "Not recorded"}</span>
            </p>
            {lost.note && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/80 px-3 py-2 text-[0.82rem] leading-relaxed text-ink-700 [overflow-wrap:anywhere]">
                {lost.note}
              </p>
            )}
            <p className="mt-2 text-[0.76rem] text-ink-600">Off the pipeline board. Its activities are hidden from the planner.</p>
          </div>
          <form action={restoreAction} className="sm:shrink-0">
            <input type="hidden" name="leadId" value={leadId} />
            <SubmitButton variant="secondary" size="sm" pendingLabel="Restoring" className="w-full sm:w-auto">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore to {lost.restoreTo}
            </SubmitButton>
          </form>
        </div>
      )}
    </section>
  );
}

// ─── Stage bar ───────────────────────────────────────────────────────────────

/** Chevron segments: a point on the right, a notch on the left (first and last are flat on the outside). */
const CHEVRON: Record<"first" | "middle" | "last", CSSProperties> = {
  first: { clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)" },
  middle: { clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)" },
  last: { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)" },
};

function StageBar({
  current,
  lost,
  pendingStage,
  onSelect,
}: {
  current: LeadStatus;
  lost: boolean;
  pendingStage: LeadStatus | null;
  onSelect: (stage: BoardStage, trigger: HTMLElement) => void;
}) {
  const index = lost ? -1 : (BOARD_STAGES as readonly string[]).indexOf(current);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // On a narrow phone the bar scrolls sideways; keep the current stage in view.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>('[aria-current="step"]');
    if (scroller && el && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollLeft = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
    }
  }, [current]);

  return (
    <div ref={scrollerRef} className="relative -m-1 overflow-x-auto p-1 lg:ml-auto lg:max-w-[40rem] lg:flex-1">
      <ol aria-label="Pipeline stage" className="flex min-w-max">
        {BOARD_STAGES.map((stage, i) => {
          const isCurrent = i === index;
          const done = i < index;
          const pending = pendingStage === stage;
          const position = i === 0 ? "first" : i === BOARD_STAGES.length - 1 ? "last" : "middle";
          const wonStage = stage === "WON";
          return (
            <li key={stage} className={cn("flex flex-auto", i > 0 && "-ml-2")}>
              {/* The current stage and every stage mid-move are aria-disabled, not
                  disabled: the segment just pressed keeps keyboard focus through
                  the move instead of dropping it (onSelect ignores them). */}
              <button
                type="button"
                disabled={lost}
                aria-disabled={!lost && (isCurrent || pendingStage !== null) ? true : undefined}
                aria-current={isCurrent ? "step" : undefined}
                onClick={(e) => onSelect(stage, e.currentTarget)}
                className="group relative flex flex-auto rounded-lg focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-500 disabled:cursor-default aria-disabled:cursor-default"
              >
                <span
                  style={CHEVRON[position]}
                  className={cn(
                    "flex h-9 flex-auto items-center justify-center gap-1 whitespace-nowrap text-[0.74rem] font-semibold transition-colors sm:text-[0.78rem]",
                    // The text clears the 10px notch on the left and the 10px point on the right.
                    position === "first" ? "rounded-l-lg pl-3" : "pl-3.5",
                    position === "last" ? "rounded-r-lg pr-3" : "pr-3.5",
                    lost
                      ? "bg-ink-100 text-ink-500"
                      : isCurrent
                        ? wonStage
                          ? "bg-mint-ink text-white"
                          : "bg-linear-to-r from-abyss-700 to-abyss-500 text-white"
                        : done
                          ? "bg-azure-500/12 text-abyss-600 group-hover:bg-azure-500/20"
                          : wonStage
                            ? "bg-mint-200/60 text-[#23675c] group-hover:bg-mint-200"
                            : "bg-ink-100 text-ink-600 group-hover:bg-ink-200/80 group-hover:text-ink-900",
                  )}
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
                  ) : done ? (
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : wonStage && !lost ? (
                    <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : null}
                  {LEAD_STATUS[stage].label}
                  {isCurrent && <span className="sr-only"> (current stage)</span>}
                  {done && <span className="sr-only"> (completed)</span>}
                  {pending && <span className="sr-only"> (moving)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {lost && <p className="sr-only">Stages are locked while the opportunity is lost. Restore it to move it.</p>}
    </div>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────

const PANEL_TONE = {
  mint: "border-mint-600/35 bg-mint-200/25",
  red: "border-red-200 bg-red-50/60",
  neutral: "border-ink-200 bg-canvas",
} as const;

function PanelShell({
  id,
  tone,
  title,
  onClose,
  children,
}: {
  id: string;
  tone: keyof typeof PANEL_TONE;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel when it opens, so keyboard and screen-reader
  // users land on the explanation rather than behind it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={cn("mt-4 rounded-2xl border p-4 sm:p-5", PANEL_TONE[tone])}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2
          ref={headingRef}
          id={`${id}-title`}
          tabIndex={-1}
          className="font-display text-[0.98rem] font-bold text-ink-900 focus:outline-none"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-white hover:text-ink-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  );
}

function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 flex items-start gap-1.5 text-[0.78rem] text-red-600">
      <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

const OTHER_REASON = "__other";

function LostForm({
  leadId,
  state,
  formAction,
  onCancel,
}: {
  leadId: string;
  state: EchoState;
  formAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const failed = state && !state.ok ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const [choice, setChoice] = useState(seed(state, "reason", ""));
  const fieldError = errors.reason || errors.customReason || errors.note;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lost reason" htmlFor="lost-reason" error={errors.reason}>
          <select
            id="lost-reason"
            name="reason"
            required
            autoFocus={Boolean(errors.reason)}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={fieldMessageId("lost-reason")}
            className={cn(inputClass, "cursor-pointer")}
          >
            <option value="" disabled>
              Choose a reason…
            </option>
            {LOST_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
            <option value={OTHER_REASON}>Other…</option>
          </select>
        </Field>
        {choice === OTHER_REASON && (
          <Field label="Describe the reason" htmlFor="lost-custom" error={errors.customReason}>
            <input
              id="lost-custom"
              name="customReason"
              type="text"
              required
              maxLength={120}
              autoFocus
              autoComplete="off"
              defaultValue={seed(state, "customReason", "")}
              aria-invalid={errors.customReason ? true : undefined}
              aria-describedby={fieldMessageId("lost-custom")}
              className={inputClass}
            />
          </Field>
        )}
      </div>
      <Field label="Closing note" htmlFor="lost-note" hint="Optional. Saved on the timeline." error={errors.note}>
        <textarea
          id="lost-note"
          name="note"
          rows={3}
          maxLength={2000}
          autoFocus={Boolean(errors.note)}
          defaultValue={seed(state, "note", "")}
          placeholder="What did we learn? Anything to try next time?"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={fieldMessageId("lost-note")}
          className={cn(textareaClass, "min-h-[5rem] resize-y")}
        />
      </Field>
      {failed && !fieldError && <InlineError>{failed.message}</InlineError>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton variant="dangerSolid" size="sm" pendingLabel="Saving">
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
          Mark as lost
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CircleAlert, CornerDownLeft, Loader2, RefreshCw } from "lucide-react";
// Type-only: the engine itself is loaded on demand (see loadEngine below).
import type { SolutionResult } from "@/lib/solution-engine";
import { packageById } from "@/lib/packages";
import { announceContactIntent, CONTACT_HREF } from "@/lib/contact-intent";
import { SECTION_IDS } from "@/lib/site";
import { easeOutExpo } from "@/lib/motion";

type Phase = "idle" | "thinking" | "answered";

/**
 * Starter prompts under the input: one each from finance, HR, procurement and
 * a stuck project. Each one should land on a playbook in solution-engine.ts,
 * so check them against its keywords when either side changes. They live here,
 * not in the engine, so rendering them doesn't pull the engine into the hero.
 */
const SAMPLE_PROMPTS = [
  "Month-end close takes a week of reconciling bank statements",
  "We track visa renewals in a spreadsheet and keep missing dates",
  "200+ purchase orders re-keyed by hand into SAP every week",
  "Our developer left and the half-built app won't deploy",
] as const;

/** Shortest pause before an answer, so it reads as a reply rather than a flicker. */
const MIN_THINKING_MS = 350;

type Engine = { generateSolution: (input: string) => SolutionResult };
let enginePromise: Promise<Engine> | null = null;

/**
 * The playbook copy in solution-engine.ts is large and only needed once a
 * visitor asks for a suggestion, so it's fetched then (or a little earlier,
 * when the input gets focus) instead of in the hero's initial JavaScript. A
 * failed load is forgotten so the next attempt retries.
 */
function loadEngine(): Promise<Engine> {
  enginePromise ??= import("@/lib/solution-engine").catch((error: unknown) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}

function prefetchEngine() {
  loadEngine().catch(() => {
    // A real attempt will retry and report the error.
  });
}

/**
 * Reveals text character by character; instant when reduced motion is on.
 *
 * rAF is paused in backgrounded tabs, so a safety timeout snaps to the full
 * string once the animation should have finished. Without it, a visitor who
 * switches tabs mid-reveal returns to a permanently half-written sentence.
 */
function useTypewriter(text: string, active: boolean, cps = 260) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    let start: number | null = null;

    const tick = (t: number) => {
      if (start === null) start = t;
      const chars = Math.floor(((t - start) / 1000) * cps);
      if (chars >= text.length) {
        setShown(text);
        return;
      }
      setShown(text.slice(0, chars));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    const safety = setTimeout(
      () => setShown(text),
      (text.length / cps) * 1000 + 900
    );

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(safety);
    };
  }, [text, active, cps, reduced]);

  // Derived rather than reset via setState in the effect: inactive means empty,
  // and reduced motion means the whole string, immediately.
  if (!active) return "";
  if (reduced) return text;
  return shown;
}

/** A plain left click; modified clicks open a new tab and shouldn't touch this page's form. */
function isPlainClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function PromptConsole() {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SolutionResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  /** False until the first question: the server-rendered sample prompts must
      not start hidden waiting for an entrance animation. */
  const [hasRun, setHasRun] = useState(false);
  /** Drives the blueprint/outcomes/CTA reveal on a timer rather than on the
      typewriter, so substantive content is never hostage to a decoration. */
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  /** Same array for the component's lifetime, so the unmount cleanup sees every timer. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Bumped by every run and reset; a slower, older run checks it and stands down. */
  const runId = useRef(0);
  const reduced = useReducedMotion();

  const typedDiagnosis = useTypewriter(
    result?.diagnosis ?? "",
    phase === "answered"
  );
  const diagnosisComplete =
    !result || typedDiagnosis.length >= result.diagnosis.length;
  const pkg = result ? packageById(result.packageId) : undefined;

  useEffect(() => {
    const t = timers.current;
    const runs = runId;
    return () => {
      t.forEach(clearTimeout);
      runs.current += 1;
    };
  }, []);

  const run = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || phase === "thinking") return;

      const id = ++runId.current;
      timers.current.forEach(clearTimeout);
      timers.current.length = 0;

      setHasRun(true);
      setLoadFailed(false);
      setPhase("thinking");
      setResult(null);
      setExpanded(false);

      const pause = new Promise<void>((resolve) =>
        setTimeout(resolve, reduced ? 0 : MIN_THINKING_MS)
      );

      let engine: Engine;
      try {
        [engine] = await Promise.all([loadEngine(), pause]);
      } catch {
        if (id !== runId.current) return;
        setLoadFailed(true);
        setPhase("idle");
        return;
      }
      if (id !== runId.current) return;

      setResult(engine.generateSolution(trimmed));
      setPhase("answered");
      timers.current.push(
        setTimeout(() => setExpanded(true), reduced ? 60 : 1100)
      );
    },
    [phase, reduced]
  );

  /**
   * Grow the textarea to fit its content instead of reserving a fixed three
   * rows. A CSS min-height holds the floor so the empty state still reads as an
   * input, and it caps out before the console can push the CTA off-screen.
   */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [value]);

  // Bring the answer into view on mobile, where it renders below the fold.
  useEffect(() => {
    if (phase !== "answered" || !resultRef.current) return;
    if (window.innerWidth >= 1024) return;
    const t = setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }, 120);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  function reset() {
    runId.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current.length = 0;
    setPhase("idle");
    setResult(null);
    setExpanded(false);
    setLoadFailed(false);
    setValue("");
    textareaRef.current?.focus();
  }

  // One short sentence for screen readers instead of announcing every
  // character of the typewriter. A failed load is announced by its own alert.
  const status =
    phase === "thinking"
      ? "Working out a suggestion."
      : phase === "answered" && result
        ? `Suggestion ready: ${result.title}.${pkg ? ` Recommended: ${pkg.formLabel}.` : ""}`
        : "";

  return (
    <div className="relative w-full">
      <p role="status" className="sr-only">
        {status}
      </p>

      {/* ── Input console ─────────────────────────────────────────────── */}
      <motion.div
        layout={!reduced}
        transition={{ duration: 0.5, ease: easeOutExpo }}
        className="relative overflow-hidden rounded-[1.75rem] glass-strong p-1.5 sm:rounded-[2rem]"
      >
        {/* Slow gradient sweep along the console edge (stilled by the
            reduced-motion rule in globals.css) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-70 sm:rounded-[2rem]"
          style={{
            padding: "1.5px",
            background:
              "linear-gradient(115deg, rgb(7 102 163 / 0.55), rgb(65 176 204 / 0.5) 30%, rgb(142 209 196 / 0.5) 52%, rgb(181 171 230 / 0.55) 74%, rgb(253 156 194 / 0.6))",
            backgroundSize: "220% 100%",
            animation: "gradient-pan 9s ease-in-out infinite",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* The textarea itself is borderless, so keyboard focus is shown on
            this panel instead. */}
        <div className="relative rounded-[1.4rem] bg-white/70 p-4 ring-1 ring-transparent transition-shadow duration-200 has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-azure-500 sm:rounded-[1.65rem] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">
              <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-mint-600 animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-600" />
              </span>
              SULOAI Solution Engine
            </span>
            <span className="hidden font-mono text-[0.65rem] text-ink-550 sm:block">
              free · no sign-up
            </span>
          </div>

          <label htmlFor="problem-input" className="sr-only">
            Describe a task or process that slows your team down
          </label>
          <textarea
            id="problem-input"
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={prefetchEngine}
            onKeyDown={(e) => {
              // Not while an IME is composing: Enter there confirms a character.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void run(value);
              }
            }}
            rows={1}
            maxLength={900}
            placeholder="Describe a task or process that slows your team down…"
            className="mt-2.5 block max-h-[190px] min-h-[3.9rem] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[1rem] leading-relaxed text-ink-900 outline-none placeholder:text-ink-550 sm:min-h-[3.4rem] sm:text-[1.05rem]"
          />

          {/* The hint must be able to shrink and the buttons must not. A
              nowrap hint plus a nowrap button exceeded this row between roughly
              1024px and 1180px — where the two-column hero is active but the
              console column is at its narrowest — and pushed the CTA out past
              the card's clipped edge. */}
          <div className="mt-3 flex flex-col gap-3 border-t border-ink-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            {phase === "idle" && (
              <p className="hidden min-w-0 flex-1 items-center gap-1.5 font-mono text-[0.68rem] text-ink-550 sm:flex">
                <CornerDownLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Enter to send</span>
              </p>
            )}

            {/* ml-auto, not justify-between alone: once the hint is dropped in
                the answered state this becomes the only flex child, and
                justify-between would park it on the left. */}
            <div className="flex shrink-0 items-center gap-2 sm:ml-auto sm:justify-end">
              {phase === "answered" && (
                <button
                  type="button"
                  onClick={reset}
                  className="btn-ghost !px-4 !py-2.5 text-sm"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  New question
                </button>
              )}
              <button
                type="button"
                onClick={() => void run(value)}
                onPointerEnter={prefetchEngine}
                disabled={value.trim().length < 3 || phase === "thinking"}
                className="btn-primary w-full !py-3 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                {phase === "thinking" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Working on it
                  </>
                ) : (
                  <>
                    Suggest a solution
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {loadFailed && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-blush-300 bg-blush-200/40 p-3.5 text-[0.85rem] text-ink-800"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
          The suggestion didn&apos;t load. Check your connection and try again.
        </p>
      )}

      {/* ── Sample prompts ────────────────────────────────────────────── */}
      {/* Server-rendered and visible from the first paint (`initial={false}`);
          it only animates when it returns after a "New question". The
          `reduced` check is safe here because that only happens client-side. */}
      {phase === "idle" && (
        <motion.div
          initial={hasRun ? { opacity: 0, y: reduced ? 0 : 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: easeOutExpo }}
          className="mt-4"
        >
          <p
            id="sample-prompts-label"
            className="mb-2.5 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-550"
          >
            Or try one of these
          </p>
          {/* `relative` keeps this rail the containing block for anything
              positioned inside it, so it can never widen the page. On phones
              it scrolls sideways, which clips vertically too: the top padding
              (cancelled by the negative margin) leaves room for the chips'
              focus outline and hover lift. */}
          <ul
            aria-labelledby="sample-prompts-label"
            className="relative -mx-4 -mt-1.5 flex gap-2 overflow-x-auto px-4 pb-2 pt-1.5 no-scrollbar sm:mx-0 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:pt-0"
          >
            {SAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt} className="shrink-0 sm:shrink">
                <button
                  type="button"
                  onPointerEnter={prefetchEngine}
                  onFocus={prefetchEngine}
                  onClick={() => {
                    setValue(prompt);
                    void run(prompt);
                  }}
                  className="rounded-full border border-ink-200/80 bg-white/60 px-3.5 py-2 text-left text-[0.8rem] text-ink-600 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-aqua-400 hover:bg-white hover:text-ink-900"
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* ── Output ────────────────────────────────────────────────────── */}
      {/* The working line has no exit animation and the answer doesn't wait
          for it: it unmounts the moment the answer mounts, so the answer never
          jumps up into its place, and a frozen rAF (backgrounded tab) can't
          strand the user on an empty console. */}
      {/* scroll-mt adds to the page's scroll-padding-top, which already clears the fixed nav. */}
      <div ref={resultRef} className="scroll-mt-3">
        {phase === "thinking" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="mt-4 flex items-center gap-2.5 px-1 font-mono text-[0.8rem] text-ink-700"
          >
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-azure-500"
              aria-hidden="true"
            />
            Matching your description to a package
          </motion.p>
        )}

        <AnimatePresence>
          {phase === "answered" && result && (
            <motion.article
              key="answer"
              initial={{ opacity: 0, y: reduced ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -10 }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              aria-labelledby="solution-title"
              className="mt-4 overflow-hidden rounded-[1.75rem] glass-strong sm:rounded-[2rem]"
            >
              {/* Header: what it is, which package, how close the match is */}
              <div className="relative overflow-hidden border-b border-ink-100 p-5 sm:p-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lilac-400 opacity-25 blur-[70px]"
                />
                <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <span className="eyebrow">Suggested approach</span>
                    {/* h2: the answer sits directly under the hero's h1. */}
                    <h2
                      id="solution-title"
                      className="mt-1.5 text-[1.15rem] font-bold leading-snug text-ink-900 sm:text-[1.4rem]"
                    >
                      {result.title}
                    </h2>
                    {pkg && (
                      <p className="mt-2.5 inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-azure-300/60 bg-white/70 px-3 py-1.5 text-[0.82rem] leading-snug">
                        <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-abyss-600">
                          Package {pkg.number}
                        </span>
                        <span className="font-semibold text-ink-900">{pkg.name}</span>
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 rounded-full border border-ink-200/80 bg-white/70 px-2.5 py-1 font-mono text-[0.68rem] text-ink-700">
                    {result.matchStrength}
                  </p>
                </div>

                {(result.signals.length > 0 || result.systems.length > 0) && (
                  <div className="relative mt-3.5">
                    <p className="sr-only">Picked up from your description:</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {result.systems.map((s) => (
                        <li
                          key={s}
                          className="rounded-md bg-azure-500/10 px-2 py-1 font-mono text-[0.68rem] text-abyss-600"
                        >
                          {s}
                        </li>
                      ))}
                      {result.signals.map((s) => (
                        <li
                          key={s}
                          className="rounded-md bg-ink-100 px-2 py-1 font-mono text-[0.68rem] text-ink-600"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Diagnosis — typed out for sighted users, read in full by
                  screen readers. */}
              <div className="p-5 sm:p-6">
                <p className="text-[0.95rem] leading-relaxed text-ink-700 sm:text-base">
                  <span aria-hidden="true">
                    {typedDiagnosis}
                    {!diagnosisComplete && (
                      <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-azure-500 animate-caret" />
                    )}
                  </span>
                  <span className="sr-only">{result.diagnosis}</span>
                </p>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: easeOutExpo }}
                    >
                      {/* Blueprint */}
                      <div className="mt-6">
                        <h3 className="eyebrow">How we&apos;d build it</h3>
                        <ol className="mt-3 space-y-3">
                          {result.blueprint.map((item, i) => (
                            <motion.li
                              key={item.step}
                              initial={{ opacity: 0, x: reduced ? 0 : -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: reduced ? 0 : 0.1 + i * 0.1,
                                duration: 0.5,
                                ease: easeOutExpo,
                              }}
                              className="flex gap-3"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-abyss-600 to-azure-500 font-mono text-[0.7rem] font-medium text-white"
                              >
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[0.9rem] font-semibold text-ink-900">
                                  {item.step}
                                </p>
                                <p className="mt-0.5 text-[0.87rem] leading-relaxed text-ink-600">
                                  {item.detail}
                                </p>
                              </div>
                            </motion.li>
                          ))}
                        </ol>
                      </div>

                      {/* Outcomes */}
                      <div className="mt-6">
                        <h3 className="eyebrow">What usually changes</h3>
                        <ul className="mt-3 grid grid-cols-1 gap-2.5 xs:grid-cols-3">
                          {result.outcomes.map((o, i) => (
                            <motion.li
                              key={o.label}
                              initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                delay: reduced ? 0 : 0.45 + i * 0.09,
                                duration: 0.5,
                                ease: easeOutExpo,
                              }}
                              className="min-w-0 rounded-2xl border border-ink-100 bg-linear-to-b from-white to-haze/70 p-3.5"
                            >
                              <p className="font-display text-[1rem] font-bold leading-tight text-abyss-600">
                                {o.metric}
                              </p>
                              <p className="mt-1 text-[0.78rem] leading-snug text-ink-600">
                                {o.label}
                              </p>
                            </motion.li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[0.72rem] leading-snug text-ink-550">
                          Results depend on your volumes, systems and data
                          quality.
                        </p>
                      </div>

                      {/* Tools and building blocks. Timing and price come
                          from the written scope, so none is shown here. */}
                      {result.stack.length > 0 && (
                        <div className="mt-5">
                          <h3 className="sr-only">What it involves</h3>
                          <ul className="flex flex-wrap items-center gap-1.5">
                            {result.stack.map((s) => (
                              <li
                                key={s}
                                className="rounded-full border border-ink-200/70 bg-white/70 px-2.5 py-1 text-[0.72rem] text-ink-600"
                              >
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Next step */}
                      <div className="mt-6 rounded-2xl bg-linear-to-br from-abyss-600 via-azure-500 to-lilac-500 p-[1px]">
                        <div className="rounded-[calc(1rem-1px)] bg-white/95 p-4 backdrop-blur-sm sm:p-5">
                          <p className="text-[0.9rem] leading-relaxed text-ink-700">
                            <span className="font-semibold text-ink-900">
                              This is an outline.
                            </span>{" "}
                            The price comes after we&apos;ve looked at your
                            process.{" "}
                            {result.followUp}
                          </p>
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <a
                              href={CONTACT_HREF}
                              onClick={(e) => {
                                if (!isPlainClick(e)) return;
                                announceContactIntent({
                                  kind: "message",
                                  packageLabel: pkg?.formLabel,
                                });
                              }}
                              className="btn-primary w-full whitespace-normal text-center sm:w-auto"
                            >
                              {pkg ? `Talk to us about ${pkg.name}` : "Talk to us"}
                              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                            </a>
                            <a
                              href={`#${SECTION_IDS.services}`}
                              className="text-center text-[0.85rem] font-semibold text-abyss-600 underline decoration-abyss-600/30 underline-offset-4 transition-colors hover:decoration-abyss-600 sm:text-left"
                            >
                              Compare all packages
                            </a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.article>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CornerDownLeft,
  Loader2,
  RefreshCw,
  Sparkles,
  Check,
} from "lucide-react";
import {
  generateSolution,
  SAMPLE_PROMPTS,
  type SolutionResult,
} from "@/lib/solution-engine";
import { easeOutExpo } from "@/lib/motion";

type Phase = "idle" | "thinking" | "answered";

const THINKING_STEPS = [
  "Parsing your description",
  "Matching against 12 supply-chain playbooks",
  "Detecting systems and volume signals",
  "Drafting the solution outline",
];

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

export function PromptConsole() {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SolutionResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  /** Drives the blueprint/outcomes/CTA reveal on a timer rather than on the
      typewriter, so substantive content is never hostage to a decoration. */
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduced = useReducedMotion();

  const typedDiagnosis = useTypewriter(
    result?.diagnosis ?? "",
    phase === "answered"
  );
  const diagnosisComplete =
    !result || typedDiagnosis.length >= result.diagnosis.length;

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const run = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < 3 || phase === "thinking") return;

      timers.current.forEach(clearTimeout);
      timers.current = [];

      setPhase("thinking");
      setStepIndex(0);
      setResult(null);
      setExpanded(false);

      // Staged "analysis" beats — short enough to feel fast, long enough to read.
      const stepDelay = reduced ? 60 : 380;
      THINKING_STEPS.forEach((_, i) => {
        if (i === 0) return;
        timers.current.push(
          setTimeout(() => setStepIndex(i), stepDelay * i)
        );
      });

      const answerAt = reduced ? 200 : stepDelay * THINKING_STEPS.length + 240;

      timers.current.push(
        setTimeout(() => {
          setResult(generateSolution(trimmed));
          setPhase("answered");
        }, answerAt)
      );

      timers.current.push(
        setTimeout(() => setExpanded(true), answerAt + (reduced ? 60 : 1100))
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
    timers.current.forEach(clearTimeout);
    setPhase("idle");
    setResult(null);
    setExpanded(false);
    setValue("");
    textareaRef.current?.focus();
  }

  return (
    <div className="relative w-full">
      {/* ── Input console ─────────────────────────────────────────────── */}
      <motion.div
        layout={!reduced}
        transition={{ duration: 0.5, ease: easeOutExpo }}
        className="relative overflow-hidden rounded-[1.75rem] glass-strong p-1.5 sm:rounded-[2rem]"
      >
        {/* Slow gradient sweep along the console edge */}
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

        <div className="relative rounded-[1.4rem] bg-white/70 p-4 sm:rounded-[1.65rem] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-mint-600 animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-600" />
              </span>
              Suro Solution Engine
            </span>
            <span className="hidden font-mono text-[0.65rem] text-ink-400 sm:block">
              free · no signup
            </span>
          </div>

          <label htmlFor="scm-problem" className="sr-only">
            Describe your supply chain bottleneck
          </label>
          <textarea
            id="scm-problem"
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(value);
              }
            }}
            rows={1}
            maxLength={900}
            placeholder="Describe the bottleneck slowing your supply chain down…"
            className="mt-2.5 block max-h-[190px] min-h-[3.9rem] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[1rem] leading-relaxed text-ink-900 outline-none placeholder:text-ink-400 sm:min-h-[3.4rem] sm:text-[1.05rem]"
          />

          {/* The hint must be able to shrink and the buttons must not. A
              nowrap hint plus a nowrap button exceeded this row between roughly
              1024px and 1180px — where the two-column hero is active but the
              console column is at its narrowest — and pushed the CTA out past
              the card's clipped edge.

              The hint stays short deliberately: max-w-6xl caps this row at
              ~509px, and the button takes 199px of it, so a longer string could
              not fit at any viewport width without ellipsizing. "Enter submits"
              is the non-obvious half anyway — Shift+Enter is the convention
              people already reach for. */}
          <div className="mt-3 flex flex-col gap-3 border-t border-ink-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            {phase === "idle" && (
              <p className="hidden min-w-0 flex-1 items-center gap-1.5 font-mono text-[0.68rem] text-ink-400 sm:flex">
                <CornerDownLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Enter to analyse</span>
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
                onClick={() => run(value)}
                disabled={value.trim().length < 3 || phase === "thinking"}
                className="btn-primary w-full !py-3 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                {phase === "thinking" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Analysing
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Get my solution
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Sample prompts ────────────────────────────────────────────── */}
      {phase === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: easeOutExpo }}
          className="mt-4"
        >
          <p className="mb-2.5 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-400">
            Or start from a common one
          </p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {SAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setValue(prompt);
                  run(prompt);
                }}
                className="shrink-0 rounded-full border border-ink-200/80 bg-white/60 px-3.5 py-2 text-left text-[0.8rem] text-ink-600 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-aqua-400 hover:bg-white hover:text-ink-900 sm:shrink sm:whitespace-normal"
              >
                {prompt}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Output ────────────────────────────────────────────────────── */}
      {/* Two independent presence blocks rather than one `mode="wait"` swap:
          with mode="wait" the answer can only mount after the thinking panel
          finishes exiting, so a frozen rAF (backgrounded tab) would strand the
          user on an empty console. */}
      <div ref={resultRef} aria-live="polite" className="scroll-mt-24">
        <AnimatePresence>
          {phase === "thinking" && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: easeOutExpo }}
              className="mt-4 rounded-3xl glass p-5 sm:p-6"
            >
              <ul className="space-y-2.5">
                {THINKING_STEPS.map((step, i) => {
                  const done = i < stepIndex;
                  const current = i === stepIndex;
                  return (
                    <li
                      key={step}
                      className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                        done || current
                          ? "text-ink-700 opacity-100"
                          : "text-ink-400 opacity-40"
                      }`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {done ? (
                          <Check
                            className="h-4 w-4 text-mint-600"
                            aria-hidden="true"
                          />
                        ) : current ? (
                          <Loader2
                            className="h-4 w-4 animate-spin text-azure-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                        )}
                      </span>
                      <span className="font-mono text-[0.8rem]">{step}</span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "answered" && result && (
            <motion.article
              key="answer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              className="mt-4 overflow-hidden rounded-[1.75rem] glass-strong sm:rounded-[2rem]"
            >
              {/* Header: match + confidence */}
              <div className="relative overflow-hidden border-b border-ink-100 p-5 sm:p-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lilac-400 opacity-25 blur-[70px]"
                />
                <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <span className="eyebrow">Recommended approach</span>
                    <h3 className="mt-1.5 text-[1.15rem] font-bold leading-snug text-ink-900 sm:text-[1.4rem]">
                      {result.title}
                    </h3>
                  </div>

                  <div className="shrink-0">
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">
                      Match strength
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.confidence * 100}%` }}
                          transition={{
                            duration: 1,
                            delay: 0.2,
                            ease: easeOutExpo,
                          }}
                          className="h-full rounded-full bg-linear-to-r from-azure-500 via-aqua-500 to-mint-500"
                        />
                      </div>
                      <span className="font-mono text-xs font-medium text-ink-700">
                        {Math.round(result.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {(result.signals.length > 0 || result.systems.length > 0) && (
                  <div className="relative mt-3.5 flex flex-wrap gap-1.5">
                    {result.systems.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-azure-500/10 px-2 py-1 font-mono text-[0.68rem] text-abyss-600"
                      >
                        {s}
                      </span>
                    ))}
                    {result.signals.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-ink-100 px-2 py-1 font-mono text-[0.68rem] text-ink-500"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Diagnosis */}
              <div className="p-5 sm:p-6">
                <p className="text-[0.95rem] leading-relaxed text-ink-700 sm:text-base">
                  {typedDiagnosis}
                  {!diagnosisComplete && (
                    <span
                      aria-hidden="true"
                      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-azure-500 animate-caret"
                    />
                  )}
                </p>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: easeOutExpo }}
                    >
                      {/* Blueprint */}
                      <div className="mt-6">
                        <p className="eyebrow">How we&apos;d build it</p>
                        <ol className="mt-3 space-y-3">
                          {result.blueprint.map((item, i) => (
                            <motion.li
                              key={item.step}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: 0.1 + i * 0.1,
                                duration: 0.5,
                                ease: easeOutExpo,
                              }}
                              className="flex gap-3"
                            >
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-azure-500 to-aqua-500 font-mono text-[0.7rem] font-medium text-white">
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
                      <div className="mt-6 grid grid-cols-1 gap-2.5 xs:grid-cols-3">
                        {result.outcomes.map((o, i) => (
                          <motion.div
                            key={o.label}
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: 0.45 + i * 0.09,
                              duration: 0.5,
                              ease: easeOutExpo,
                            }}
                            className="rounded-2xl border border-ink-100 bg-linear-to-b from-white to-haze/70 p-3.5"
                          >
                            <p className="font-display text-[1.05rem] font-bold leading-tight text-gradient">
                              {o.metric}
                            </p>
                            <p className="mt-1 text-[0.78rem] leading-snug text-ink-500">
                              {o.label}
                            </p>
                          </motion.div>
                        ))}
                      </div>

                      {/* Stack + timeline */}
                      <div className="mt-5 flex flex-wrap items-center gap-1.5">
                        {result.stack.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-ink-200/70 bg-white/70 px-2.5 py-1 text-[0.72rem] text-ink-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 font-mono text-[0.75rem] text-ink-500">
                        Typical delivery — {result.timeline}
                      </p>

                      {/* Conversion step */}
                      <div className="mt-6 rounded-2xl bg-linear-to-br from-abyss-600 via-azure-500 to-lilac-500 p-[1px]">
                        <div className="rounded-[calc(1rem-1px)] bg-white/92 p-4 backdrop-blur-sm sm:p-5">
                          <p className="text-[0.9rem] leading-relaxed text-ink-700">
                            <span className="font-semibold text-ink-900">
                              This is the outline, not the estimate.
                            </span>{" "}
                            {result.followUp}
                          </p>
                          <a href="#contact" className="btn-primary mt-4 w-full sm:w-auto">
                            Get my detailed proposal
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </a>
                          <p className="mt-2.5 font-mono text-[0.68rem] text-ink-400">
                            Reply within one business day · No obligation
                          </p>
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

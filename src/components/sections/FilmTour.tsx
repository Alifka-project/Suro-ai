"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowDown, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Orb } from "@/components/ui/AuroraField";
import { Reveal } from "@/components/ui/Reveal";
import { easeOutExpo } from "@/lib/motion";
import { FILMS } from "@/lib/films";
import { SECTION_IDS } from "@/lib/site";

const COUNT = FILMS.length;
/** With two or more films the section pins, and scrolling moves through them. */
const PINNED = COUNT > 1;
/** Scroll distance each film gets while the section is pinned, in small-viewport heights. */
const STEP_SVH = 70;

const pad = (n: number) => String(n).padStart(2, "0");

/** The film a scroll progress (0–1 across the pinned stretch) lands on. */
const filmAt = (progress: number) =>
  Math.min(COUNT - 1, Math.max(0, Math.floor(progress * COUNT)));

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The OS reduced-motion setting. The server snapshot is "motion allowed", so
 * hydration matches the server HTML and the real value applies right after.
 */
function useReducedMotionSetting() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * "See what we build": short films, one at a time. With two or more films
 * the section is a tall scroll track with a sticky, screen-high stage inside
 * it, so the page holds still while the visitor scrolls from one film to the
 * next and moves on after the last. Scrolling stays native (no wheel or touch
 * hijacking): the track's scroll progress picks the film, and each film plays
 * from the start when it is reached, muted.
 *
 * Every title and caption is in the HTML whichever film is showing. Films
 * play only while the section is on screen and start loading a screen
 * before it. With reduced motion nothing plays by itself: the stills show,
 * with a play button. The toggles meet WCAG 2.2.2 (pause, stop, hide).
 */
export function FilmTour() {
  if (COUNT === 0) return null;
  return <Tour />;
}

function Tour() {
  const trackRef = useRef<HTMLElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const reduce = useReducedMotionSetting();

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => setActive(filmAt(p)));

  /** The section covers the middle of the screen: films may play. */
  const inView = useInView(trackRef, { margin: "-30% 0px -30% 0px" });
  /** Within a screen of the viewport: start loading. */
  const near = useInView(trackRef, { margin: "100% 0px 100% 0px", once: true });

  // The visitor's own play/pause choice. Until they make one, films play by
  // themselves unless reduced motion is on.
  const [choice, setChoice] = useState<"play" | "pause" | null>(null);
  const autoplay = choice === null ? !reduce : choice === "play";
  const [muted, setMuted] = useState(true);
  /** The browser refused to start a film (iOS Low Power Mode, for one). */
  const [blocked, setBlocked] = useState(false);
  const [playingFilm, setPlayingFilm] = useState<number | null>(null);
  const [endedFilm, setEndedFilm] = useState<number | null>(null);
  const [failed, setFailed] = useState<readonly number[]>([]);

  const film = FILMS[active];
  const playing = playingFilm === active;
  const ended = endedFilm === active;
  const broken = failed.includes(active);
  const showPlay = !broken && !playing && (blocked || !autoplay);

  // Sound follows the toggle on every film, so the next one starts the same way.
  useEffect(() => {
    for (const v of videos.current) if (v) v.muted = muted;
  }, [muted]);

  // Each film starts from the top when the visitor reaches it.
  const shown = useRef(active);
  useEffect(() => {
    if (shown.current === active) return;
    shown.current = active;
    const v = videos.current[active];
    if (v && v.currentTime > 0) v.currentTime = 0;
  }, [active]);

  // Play the film on screen; every other one stays paused. A film that has
  // finished holds its last frame until it is reached again or replayed.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (v && i !== active && !v.paused) v.pause();
    });
    const v = videos.current[active];
    if (!v) return;
    if (!inView || !autoplay || broken) {
      if (!v.paused) v.pause();
      return;
    }
    if (v.ended) return;
    v.play().then(
      () => setBlocked(false),
      (error: unknown) => {
        // AbortError just means a pause() overtook the play() — scrolling on.
        if (!(error instanceof DOMException) || error.name !== "NotAllowedError") return;
        if (!v.muted) {
          // Sound was on, but this play() isn't a click, so carry on silently.
          v.muted = true;
          setMuted(true);
          v.play().catch(() => setBlocked(true));
        } else {
          setBlocked(true);
        }
      },
    );
  }, [active, inView, autoplay, broken]);

  function play() {
    setChoice("play");
    setBlocked(false);
    const v = videos.current[active];
    if (!v) return;
    if (v.ended) v.currentTime = 0;
    // Called inside the click, which is what lets a blocked film start.
    v.play().catch(() => setBlocked(true));
  }

  function pause() {
    setChoice("pause");
    videos.current[active]?.pause();
  }

  function toggleSound() {
    const next = !muted;
    // Set on the playing film inside the click: browsers only allow sound
    // that a click turned on.
    const v = videos.current[active];
    if (v) v.muted = next;
    setMuted(next);
  }

  /** Scrolls to a film's stretch of the track; on the current film, plays it again. */
  function goTo(i: number) {
    if (i === active) {
      play();
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const span = track.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + ((i + 0.04) / COUNT) * span,
      behavior: reduce ? "instant" : "smooth",
    });
  }

  const last = active === COUNT - 1;

  return (
    <section
      ref={trackRef}
      id={SECTION_IDS.films}
      aria-labelledby="films-heading"
      data-film-track=""
      className="relative bg-canvas"
      style={PINNED ? { height: `calc(100svh + ${COUNT * STEP_SVH}svh)` } : undefined}
    >
      <div
        data-film-stage=""
        className={`${PINNED ? "sticky top-0" : "relative"} h-[100svh] overflow-hidden`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 grid-field opacity-40 mask-fade-b" />
          <Orb className="-left-28 top-20" color="bg-aqua-400" size="h-80 w-80" opacity={0.26} />
          <Orb
            className="-right-24 bottom-4"
            color="bg-lilac-400"
            size="h-80 w-80"
            opacity={0.24}
            delay="-6s"
          />
        </div>

        {/* One centred column: heading, the film, then the film list. The
            column is an inline-size container, so the film's box can be
            capped at a 16:9 of the column's width and the whole group sits
            in the middle of tall screens instead of spreading out. */}
        <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-4 pb-5 pt-[5.75rem] [container-type:inline-size] sm:px-6 sm:pb-8 lg:px-8 lg:pt-24 [@media(max-height:500px)]:pt-[5.25rem]">
          {/* On very short screens (a phone on its side) the heading leaves
              the screen to the film but stays in the page for screen readers. */}
          <Reveal className="text-center [@media(max-height:500px)]:sr-only">
            <p className="eyebrow justify-center">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-r from-aqua-500 to-blush-500"
              />
              See it in action
            </p>
            <h2
              id="films-heading"
              className="mt-3 text-[clamp(1.6rem,4.6vw,2.75rem)] font-bold leading-[1.08]"
            >
              See what we <span className="text-gradient">build</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink-600 sm:text-[1.02rem] [@media(max-height:640px)]:hidden lg:[@media(max-height:880px)]:hidden">
              Short films of a delivery control tower we built.
              {PINNED && " Keep scrolling and each one plays in turn."}
            </p>
          </Reveal>

          {/* ── The film. The frame takes the largest 16:9 box that fits the
              space left over, so the whole stage fits one screen at any
              size (container query units: cqw/cqh). ─────────────────── */}
          <div className="mt-4 flex max-h-[calc(100cqw*9/16)] min-h-0 flex-1 items-center justify-center [container-type:size] sm:mt-6">
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: reduce ? 0 : 0.9, ease: easeOutExpo }}
              className="aspect-video w-[min(100cqw,calc(100cqh*16/9))] rounded-[1.1rem] bg-white p-1 shadow-[0_30px_70px_-32px_rgb(7_38_60_/_0.42),0_4px_14px_-6px_rgb(7_38_60_/_0.14)] ring-1 ring-ink-100 sm:rounded-[1.6rem] sm:p-1.5"
            >
              <div className="relative h-full w-full overflow-hidden rounded-[0.85rem] bg-canvas sm:rounded-[1.25rem]">
                {FILMS.map((f, i) => (
                  <video
                    key={f.id}
                    ref={(el) => {
                      videos.current[i] = el;
                    }}
                    aria-hidden="true"
                    tabIndex={-1}
                    muted
                    playsInline
                    disablePictureInPicture
                    disableRemotePlayback
                    poster={f.poster}
                    preload={
                      // The film on show loads from a screen away; the one
                      // after it only once the section is in view, so the
                      // page's first load isn't spent on films not yet seen.
                      i === active
                        ? near
                          ? autoplay
                            ? "auto"
                            : "metadata"
                          : "none"
                        : i === active + 1 && inView && autoplay
                          ? "auto"
                          : "none"
                    }
                    onPlay={() => {
                      setPlayingFilm(i);
                      setEndedFilm((cur) => (cur === i ? null : cur));
                    }}
                    onPause={() => setPlayingFilm((cur) => (cur === i ? null : cur))}
                    onEnded={() => setEndedFilm(i)}
                    className={`absolute inset-0 h-full w-full object-cover transition-[opacity,scale] duration-700 ease-out-expo ${
                      i === active ? "scale-100 opacity-100" : "scale-[1.035] opacity-0"
                    }`}
                  >
                    {f.srcSmall && (
                      <source src={f.srcSmall} type="video/mp4" media="(max-width: 767px)" />
                    )}
                    {/* A source that fails reports on itself, not on the
                        video, and the browser moves on to the next one, so
                        the last source failing means the film can't play. */}
                    <source
                      src={f.src}
                      type="video/mp4"
                      onError={() => setFailed((cur) => (cur.includes(i) ? cur : [...cur, i]))}
                    />
                  </video>
                ))}

                {showPlay && (
                  <button
                    type="button"
                    onClick={play}
                    aria-label={`Play the film: ${film.title}`}
                    className="group/play absolute inset-0 flex items-center justify-center bg-ink-900/10 transition-colors duration-500 hover:bg-ink-900/20"
                  >
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full glass-strong transition-transform duration-300 ease-out-expo group-hover/play:scale-110 sm:h-18 sm:w-18">
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-white/60 motion-safe:animate-pulse-ring"
                      />
                      <Play className="relative ml-0.5 h-5 w-5 fill-ink-900 text-ink-900 sm:h-6 sm:w-6" aria-hidden="true" />
                    </span>
                  </button>
                )}

                {!broken && (
                  <div
                    data-film-controls=""
                    className="absolute bottom-2 right-2 flex gap-2 sm:bottom-3.5 sm:right-3.5"
                  >
                    {film.sound && (
                      <FrameButton
                        onClick={toggleSound}
                        label={muted ? "Turn the sound on" : "Turn the sound off"}
                      >
                        {muted ? (
                          <VolumeX className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Volume2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </FrameButton>
                    )}
                    <FrameButton
                      onClick={playing ? pause : play}
                      label={playing ? "Pause the film" : ended ? "Play the film again" : "Play the film"}
                    >
                      {playing ? (
                        <Pause className="h-4 w-4" aria-hidden="true" />
                      ) : ended ? (
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Play className="ml-px h-4 w-4" aria-hidden="true" />
                      )}
                    </FrameButton>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Desktop: the films side by side, each with its progress ── */}
          {PINNED && (
            <ol
              className="mt-6 hidden gap-6 lg:grid"
              style={{ gridTemplateColumns: `repeat(${COUNT}, minmax(0, 1fr))` }}
            >
              {FILMS.map((f, i) => {
                const current = i === active;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={current ? "true" : undefined}
                      className="group block w-full rounded-lg pb-1 text-left"
                    >
                      <span className="relative block h-[3px] overflow-hidden rounded-full bg-ink-200/70">
                        <FilmProgress progress={scrollYProgress} index={i} axis="x" />
                      </span>
                      <span className="mt-3.5 flex items-baseline gap-2.5">
                        <span className="font-mono text-[0.7rem] tracking-[0.1em] text-ink-500">
                          {pad(i + 1)}
                        </span>
                        <span
                          className={`font-display text-[1rem] font-semibold leading-snug transition-colors duration-300 ease-out-expo ${
                            current ? "text-ink-900" : "text-ink-550 group-hover:text-ink-900"
                          }`}
                        >
                          {f.title}
                        </span>
                      </span>
                      <span
                        className={`mt-1 block text-[0.9rem] leading-relaxed transition-colors duration-300 ease-out-expo [@media(max-height:820px)]:hidden ${
                          current ? "text-ink-600" : "text-ink-550"
                        }`}
                      >
                        {f.caption}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {PINNED && (
            <ScrollHint
              last={last}
              className="mt-5 hidden justify-center lg:[@media(min-height:821px)]:flex"
            />
          )}

          {/* ── Phones and tablets: progress, then the current caption ── */}
          {PINNED && (
            <div className="mt-4 min-w-0 sm:mt-6 lg:hidden">
              <div className="mx-auto flex max-w-xl gap-1.5">
                {FILMS.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === active ? "true" : undefined}
                    aria-label={`Film ${i + 1} of ${COUNT}: ${f.title}`}
                    className="flex-1 py-2"
                  >
                    <span className="relative block h-1 overflow-hidden rounded-full bg-ink-200/70">
                      <FilmProgress progress={scrollYProgress} index={i} axis="x" />
                    </span>
                  </button>
                ))}
              </div>

              {/* Every caption sits in the same grid cell, so the block is as
                  tall as the longest one and switching never shifts the page. */}
              <div className="mx-auto mt-1 grid max-w-xl text-center">
                {FILMS.map((f, i) => (
                  <div
                    key={f.id}
                    aria-hidden={i !== active}
                    className={`[grid-area:1/1] transition-[opacity,translate] duration-500 ease-out-expo ${
                      i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1.5 opacity-0"
                    }`}
                  >
                    <p className="font-display text-[1.02rem] font-semibold leading-snug text-ink-900">
                      <span className="mr-2 font-mono text-[0.68rem] font-normal tracking-[0.1em] text-ink-500">
                        {pad(i + 1)}/{pad(COUNT)}
                      </span>
                      {f.title}
                    </p>
                    <p className="mt-1 text-[0.88rem] leading-snug text-ink-600 [@media(max-height:560px)]:hidden">
                      {f.caption}
                    </p>
                  </div>
                ))}
              </div>

              <ScrollHint last={last} className="mt-2.5 flex justify-center [@media(max-height:560px)]:hidden" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Fills as the visitor scrolls through one film's stretch of the track. */
function FilmProgress({
  progress,
  index,
  axis,
}: {
  progress: MotionValue<number>;
  index: number;
  axis: "x" | "y";
}) {
  const fill = useTransform(progress, [index / COUNT, (index + 1) / COUNT], [0, 1]);
  return (
    <motion.span
      aria-hidden="true"
      style={axis === "x" ? { scaleX: fill } : { scaleY: fill }}
      className={`absolute inset-0 rounded-full from-abyss-600 via-aqua-500 to-lilac-400 ${
        axis === "x" ? "origin-left bg-linear-to-r" : "origin-top bg-linear-to-b"
      }`}
    />
  );
}

function FrameButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-800 glass transition-transform duration-300 ease-out-expo hover:scale-110 active:scale-95 sm:h-10 sm:w-10"
    >
      {children}
    </button>
  );
}

/** Tells the visitor the page is waiting on their scroll, not stuck. */
function ScrollHint({ last, className = "" }: { last: boolean; className?: string }) {
  return (
    <p
      aria-hidden="true"
      className={`items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-500 ${className}`}
    >
      <ArrowDown className="h-3 w-3 motion-safe:animate-bounce" />
      {last ? "Scroll on to continue" : "Scroll for the next film"}
    </p>
  );
}

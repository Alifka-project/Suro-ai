"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, FileVideo } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo } from "@/lib/motion";

/**
 * Drop your film at public/media/intro.mp4 (plus an optional poster at
 * public/media/intro-poster.jpg) and it plays here. Until then the frame shows
 * an on-brand placeholder rather than a broken player.
 */
const VIDEO_SRC = "/media/intro.mp4";
const POSTER_SRC = "/media/intro-poster.jpg";

const CREDENTIALS = [
  { value: "9 yrs", label: "in supply chain operations" },
  { value: "120+", label: "processes automated" },
  { value: "4.5 hrs", label: "given back per person, weekly" },
];

export function IntroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [posterMissing, setPosterMissing] = useState(true);
  const reduced = useReducedMotion();

  /**
   * A HEAD request decides whether the media exists, rather than waiting on a
   * media `error` event — those don't fire consistently across browsers when a
   * source 404s, which left the player as a blank grey box. This flips to the
   * real player the moment the file is dropped into public/media.
   */
  useEffect(() => {
    let cancelled = false;

    const probe = async (url: string) => {
      try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store" });
        return res.ok;
      } catch {
        return false;
      }
    };

    void (async () => {
      const [video, poster] = await Promise.all([
        probe(VIDEO_SRC),
        probe(POSTER_SRC),
      ]);
      if (cancelled) return;
      setUnavailable(!video);
      setPosterMissing(!poster);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggle() {
    const v = videoRef.current;
    if (!v || unavailable) return;
    if (v.paused) {
      void v.play().then(() => setPlaying(true)).catch(() => setUnavailable(true));
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <section
      id="intro"
      className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <Orb
        className="-left-24 top-10 hidden lg:block"
        color="bg-mint-400"
        size="h-80 w-80"
        opacity={0.3}
      />
      <Orb
        className="-right-20 bottom-0"
        color="bg-lilac-400"
        size="h-72 w-72"
        opacity={0.28}
        delay="-5s"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ── Copy ─────────────────────────────────────────────────── */}
          <div className="order-1">
            <Reveal>
              <span className="eyebrow">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-linear-to-r from-aqua-500 to-blush-500"
                />
                Who we are
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h2 className="mt-4 text-[clamp(1.9rem,5.4vw,3.2rem)] font-bold leading-[1.08]">
                Supply chain people who{" "}
                <span className="text-gradient">learned to build</span>.
              </h2>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 text-[1rem] leading-relaxed text-ink-600 sm:text-[1.08rem]">
                Most automation vendors need six weeks to understand your
                process. We&apos;ve run it. We know what a three-way match is,
                why the Friday cut-off matters, and that the spreadsheet
                everyone complains about is load-bearing.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <p className="mt-4 text-[1rem] leading-relaxed text-ink-600 sm:text-[1.08rem]">
                That&apos;s the whole difference. We build in Power Automate,
                Excel VBA, and applied AI — but the value isn&apos;t the tool,
                it&apos;s that we scope the right thing on the first call
                instead of the fourth.
              </p>
            </Reveal>

            <RevealGroup
              className="mt-8 grid grid-cols-3 gap-3 border-t border-ink-100 pt-6"
              gap={0.1}
            >
              {CREDENTIALS.map((c) => (
                <RevealItem key={c.label}>
                  <p className="font-display text-[1.35rem] font-bold leading-none text-gradient sm:text-[1.7rem]">
                    {c.value}
                  </p>
                  <p className="mt-1.5 text-[0.74rem] leading-snug text-ink-500 sm:text-[0.8rem]">
                    {c.label}
                  </p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>

          {/* ── Video ────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: easeOutExpo }}
            className="order-2 relative"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-5 -z-10 rounded-[2.5rem] bg-linear-to-br from-azure-400/25 via-mint-400/20 to-blush-400/25 blur-2xl"
            />

            <div className="group relative aspect-video overflow-hidden rounded-[1.5rem] glass-strong sm:rounded-[2rem]">
              {!unavailable ? (
                <>
                  {/* Poster fallback wash, painted under the video while there
                      is no poster image of your own */}
                  {posterMissing && !playing && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-linear-to-br from-abyss-600 via-azure-500 to-lilac-500"
                    />
                  )}

                  {/* `src` goes on the element itself, not a <source> child:
                      a failing <source> fires its own error event that does not
                      reach the video's onError, so the placeholder would never
                      appear when the file is missing. */}
                  <video
                    ref={videoRef}
                    src={VIDEO_SRC}
                    className="relative h-full w-full object-cover"
                    poster={posterMissing ? undefined : POSTER_SRC}
                    playsInline
                    muted={muted}
                    preload="metadata"
                    onError={() => setUnavailable(true)}
                    onEnded={() => setPlaying(false)}
                    onPause={() => setPlaying(false)}
                    onPlay={() => setPlaying(true)}
                  />

                  {/* Play / pause */}
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? "Pause the video" : "Play the video"}
                    className="absolute inset-0 flex items-center justify-center bg-ink-900/10 transition-colors duration-500 hover:bg-ink-900/20"
                  >
                    <span
                      className={`relative flex h-16 w-16 items-center justify-center rounded-full glass-strong transition-all duration-500 sm:h-20 sm:w-20 ${
                        playing
                          ? "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                          : "scale-100 opacity-100"
                      }`}
                    >
                      {!playing && !reduced && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full bg-white/60 animate-pulse-ring"
                        />
                      )}
                      {playing ? (
                        <Pause
                          className="relative h-6 w-6 text-ink-900"
                          aria-hidden="true"
                        />
                      ) : (
                        <Play
                          className="relative ml-1 h-6 w-6 fill-ink-900 text-ink-900"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </button>

                  {/* Mute toggle */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute the video" : "Mute the video"}
                    className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full glass transition-transform duration-300 hover:scale-110"
                  >
                    {muted ? (
                      <VolumeX className="h-4 w-4 text-ink-800" aria-hidden="true" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-ink-800" aria-hidden="true" />
                    )}
                  </button>
                </>
              ) : (
                /* Placeholder — shown until an actual film exists */
                <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-linear-to-br from-abyss-600 via-azure-500 to-lilac-500 p-6 text-center">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 grid-field opacity-25 animate-drift"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-14 -right-10 h-48 w-48 rounded-full bg-blush-400 opacity-45 blur-3xl animate-float"
                  />
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                    <FileVideo className="h-6 w-6 text-white" aria-hidden="true" />
                  </span>
                  <p className="relative mt-4 font-display text-base font-semibold text-white">
                    Your intro film goes here
                  </p>
                  <p className="relative mt-1.5 max-w-xs font-mono text-[0.7rem] leading-relaxed text-white/80">
                    Drop an MP4 at public/media/intro.mp4 — the player picks it
                    up automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Caption strip */}
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-400">
                90 seconds · What we actually do
              </p>
              <span className="hidden items-center gap-1.5 text-[0.72rem] text-ink-400 sm:flex">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-mint-600"
                />
                No sales pitch
              </span>
            </div>
          </motion.div>
        </div>
      </div>

    </section>
  );
}

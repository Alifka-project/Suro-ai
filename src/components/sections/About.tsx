"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MotionConfig, motion } from "framer-motion";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Orb } from "@/components/ui/AuroraField";
import { easeOutExpo, fadeUp, inView, stagger } from "@/lib/motion";
import { BRAND, PROFILE, SECTION_IDS, VALUE_PILLARS } from "@/lib/site";

/**
 * Drop the intro film at public/media/intro.mp4 (plus an optional poster at
 * public/media/intro-poster.jpg) and it plays here. Until then the frame shows
 * a brand panel instead of an empty player.
 */
const VIDEO_SRC = "/media/intro.mp4";
const POSTER_SRC = "/media/intro-poster.jpg";

/** Whether the film (and its poster) exist; null while the browser is still checking. */
type FilmFiles = { video: boolean; poster: boolean };

/**
 * `hasFilm` / `hasPoster` are optional. When the page knows (for example from
 * a server-side check of public/media), passing them skips the browser probe
 * and its 404 request when no film exists. When omitted, the browser checks.
 */
export function About({ hasFilm, hasPoster }: { hasFilm?: boolean; hasPoster?: boolean } = {}) {
  return (
    <section
      id={SECTION_IDS.about}
      className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
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

      <MotionConfig reducedMotion="user">
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* ── Copy ─────────────────────────────────────────────── */}
            <div className="min-w-0">
              <SectionHeading
                align="left"
                eyebrow={`About ${BRAND.name}`}
                title={
                  <>
                    Who you&apos;ll <span className="text-gradient">work with</span>
                  </>
                }
                lede="Our background is in supply chain and logistics. We now work across the whole business, from finance and HR to sales and legal."
              />

              {/* Credentials: exactly the figures the client publishes, and the
                  only place on the page they appear as a list. dt comes first
                  in the DOM (label, then value) and is flipped visually so the
                  number leads. */}
              <motion.dl
                variants={stagger(0.1)}
                initial="hidden"
                whileInView="show"
                viewport={inView}
                className="mt-8 grid gap-4 border-t border-ink-100 pt-6 sm:grid-cols-3 sm:gap-5"
              >
                {PROFILE.credentials.map((c) => (
                  <motion.div
                    key={c.label}
                    variants={fadeUp}
                    className="flex min-w-0 flex-row-reverse items-baseline justify-end gap-3 sm:flex-col-reverse sm:items-start sm:gap-1.5"
                  >
                    <dt className="text-[0.84rem] leading-snug text-ink-600 sm:text-[0.8rem]">
                      {c.label}
                    </dt>
                    <dd className="min-w-[3.75rem] font-display text-[1.6rem] font-bold leading-none text-gradient sm:min-w-0 sm:text-[1.9rem]">
                      {c.value}
                    </dd>
                  </motion.div>
                ))}
              </motion.dl>
            </div>

            {/* ── Film ─────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, ease: easeOutExpo }}
              className="relative min-w-0"
            >
              <IntroFilm hasFilm={hasFilm} hasPoster={hasPoster} />
            </motion.div>
          </div>
        </div>
      </MotionConfig>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function IntroFilm({ hasFilm, hasPoster }: { hasFilm?: boolean; hasPoster?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [probed, setProbed] = useState<FilmFiles | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const known: FilmFiles | null =
    hasFilm === undefined ? probed : { video: hasFilm, poster: hasFilm && Boolean(hasPoster) };
  // Only a confirmed file mounts the player; checking, missing or a playback
  // error all show the brand panel. The server HTML therefore never points
  // crawlers or visitors at a video that may not exist.
  const ready = Boolean(known?.video) && !failed;
  const posterReady = Boolean(known?.poster);

  /**
   * A HEAD request decides whether the film exists, rather than waiting on a
   * media `error` event — those don't fire consistently across browsers when
   * a source 404s. The poster is only probed once the film is confirmed.
   */
  useEffect(() => {
    if (hasFilm !== undefined) return;
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
      const video = await probe(VIDEO_SRC);
      const poster = video ? await probe(POSTER_SRC) : false;
      if (!cancelled) setProbed({ video, poster });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasFilm]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v
        .play()
        .then(() => setPlaying(true))
        .catch(() => setFailed(true));
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
    <div className="group relative aspect-video overflow-hidden rounded-[1.5rem] glass-strong sm:rounded-[2rem]">
      {ready ? (
        <>
          {/* Brand wash under the video while there is no poster image */}
          {!posterReady && !playing && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-br from-abyss-600 via-azure-500 to-lilac-500"
            />
          )}

          {/* `src` on the element itself, not a <source> child: a failing
              <source> fires its own error event that never reaches onError. */}
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={posterReady ? POSTER_SRC : undefined}
            aria-label={`${BRAND.name} introduction`}
            className="relative h-full w-full object-cover"
            playsInline
            muted={muted}
            preload="metadata"
            onError={() => setFailed(true)}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />

          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause the introduction video" : "Play the introduction video"}
            className="absolute inset-0 flex items-center justify-center bg-ink-900/10 transition-colors duration-500 hover:bg-ink-900/20"
          >
            <span
              className={`relative flex h-16 w-16 items-center justify-center rounded-full glass-strong transition-all duration-500 sm:h-20 sm:w-20 ${
                playing
                  ? "scale-90 opacity-0 group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100"
                  : "scale-100 opacity-100"
              }`}
            >
              {!playing && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-white/60 motion-safe:animate-pulse-ring"
                />
              )}
              {playing ? (
                <Pause className="relative h-6 w-6 text-ink-900" aria-hidden="true" />
              ) : (
                <Play className="relative ml-1 h-6 w-6 fill-ink-900 text-ink-900" aria-hidden="true" />
              )}
            </span>
          </button>

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
        <BrandPanel />
      )}
    </div>
  );
}

/** Shown in the frame until a film exists: the mark, the name and the three pillars. */
function BrandPanel() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-canvas p-6 text-center"
    >
      <div className="absolute inset-0 grid-field opacity-50" />

      <Image
        src="/brand/suloai-mark.png"
        alt=""
        width={226}
        height={240}
        sizes="80px"
        className="relative h-14 w-auto drop-shadow-[0_14px_22px_rgb(7_38_60_/_0.18)] sm:h-20"
      />
      <p className="relative mt-3 font-display text-[1.1rem] font-bold tracking-[0.02em] text-ink-900 sm:text-[1.3rem]">
        SULO<span className="text-gradient">AI</span>
      </p>
      <ul className="relative mt-3 flex flex-wrap justify-center gap-1.5 sm:mt-4">
        {VALUE_PILLARS.map((p) => (
          <li
            key={p.key}
            className="rounded-full bg-white/75 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-600 ring-1 ring-ink-100 sm:px-3 sm:text-[0.66rem]"
          >
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

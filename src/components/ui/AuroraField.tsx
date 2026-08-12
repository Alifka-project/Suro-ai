"use client";

/**
 * The signature surface: aurora blobs drifting behind a grain + grid overlay.
 * Purely decorative, GPU-composited (transform/opacity only), and frozen by the
 * reduced-motion block in globals.css.
 *
 * The blobs carry the brand palette, so they are deliberately saturated — a
 * light theme still needs the colour to read. `intensity` scales them down for
 * mid-page sections where the aurora should whisper instead of sing.
 */
export function AuroraField({
  intensity = 1,
  grid = true,
  featherTop = false,
  className = "",
}: {
  intensity?: number;
  grid?: boolean;
  /** Fade the top edge — only wanted where a section meets another aurora field. */
  featherTop?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden grain ${className}`}
    >
      {/* Base bed */}
      <div className="absolute inset-0 bg-canvas" />

      {/* Full-cover palette wash. The blobs below are anchored to the top and
          bottom edges, so a tall section (the hero once an answer renders, for
          instance) would show a dead white band through the middle without
          this. A gradient scales to any height. */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.55 * intensity,
          backgroundImage:
            "linear-gradient(165deg, rgb(105 194 220 / 0.55) 0%, rgb(150 217 210 / 0.5) 22%, rgb(255 255 255 / 0.25) 46%, rgb(181 171 230 / 0.45) 72%, rgb(253 156 194 / 0.55) 100%)",
        }}
      />

      {/* Aurora blobs. The light hues (aqua/mint/lilac/blush) carry the colour
          at high opacity; the deep blue stays restrained and mostly off-canvas
          so body text never has to sit on a dark field. */}
      <div
        className="absolute -left-[22%] -top-[28%] h-[52vh] w-[80vw] rounded-full bg-abyss-600 blur-[70px] animate-aurora will-change-transform sm:w-[52vh]"
        style={{ opacity: 0.24 * intensity }}
      />
      <div
        className="absolute -right-[12%] -top-[10%] h-[54vh] w-[72vw] rounded-full bg-aqua-400 blur-[65px] animate-aurora-slow will-change-transform sm:w-[60vh]"
        style={{ opacity: 0.72 * intensity }}
      />
      <div
        className="absolute left-[14%] top-[6%] h-[46vh] w-[64vw] rounded-full bg-mint-400 blur-[70px] animate-float-slow will-change-transform sm:w-[50vh]"
        style={{ opacity: 0.62 * intensity }}
      />
      <div
        className="absolute -bottom-[14%] -left-[10%] h-[54vh] w-[76vw] rounded-full bg-lilac-500 blur-[70px] animate-aurora will-change-transform sm:w-[58vh]"
        style={{ opacity: 0.7 * intensity, animationDelay: "-8s" }}
      />
      <div
        className="absolute -bottom-[16%] right-[-8%] h-[52vh] w-[74vw] rounded-full bg-blush-500 blur-[65px] animate-aurora-slow will-change-transform sm:w-[56vh]"
        style={{ opacity: 0.75 * intensity, animationDelay: "-14s" }}
      />
      <div
        className="absolute bottom-[14%] left-[34%] hidden h-[40vh] w-[40vh] rounded-full bg-azure-400 blur-[75px] animate-float will-change-transform lg:block"
        style={{ opacity: 0.45 * intensity, animationDelay: "-4s" }}
      />

      {/* Thin milky veil — just enough to lift text contrast without bleaching
          the palette back out */}
      <div className="absolute inset-0 bg-white/20" />

      {/* Hairline grid */}
      {grid && (
        <div
          className="absolute inset-0 grid-field animate-drift mask-fade-b"
          style={{ opacity: 0.45 * intensity }}
        />
      )}

      {featherTop && (
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-canvas to-transparent" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-canvas to-transparent" />
    </div>
  );
}

/** A single drifting orb, for accenting individual cards or sections. */
export function Orb({
  className = "",
  color = "bg-aqua-400",
  size = "h-64 w-64",
  opacity = 0.35,
  delay = "0s",
}: {
  className?: string;
  color?: string;
  size?: string;
  opacity?: number;
  delay?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-[70px] animate-float will-change-transform ${color} ${size} ${className}`}
      style={{ opacity, animationDelay: delay }}
    />
  );
}

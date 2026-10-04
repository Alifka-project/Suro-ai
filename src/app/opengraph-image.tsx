import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND, CONTACT } from "@/lib/site";

/**
 * The link-preview image (1200×630) for the site. twitter-image.tsx reuses
 * it. Generated once at build time and served as a static PNG.
 */

export const alt = `${BRAND.name}: ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Palette from globals.css @theme. */
const INK_900 = "#06253c";
const INK_600 = "#2c6288";
const CANVAS = "#f7fafc";
/** The site's text-gradient, kept to its darker half so the words stay readable. */
const ACCENT_GRADIENT = "linear-gradient(100deg, #0766a3 0%, #2673c4 40%, #2f9bb8 75%, #9b8ad4 100%)";
const BRAND_GRADIENT = "linear-gradient(90deg, #0766a3 0%, #3686d5 26%, #41b0cc 48%, #c3a3e1 72%, #fd9cc2 100%)";

/**
 * Full-bleed layers, each fading to transparent well inside the frame (a
 * smaller box would show its edges once rendered).
 */
const COLOUR_FIELDS = [
  "radial-gradient(circle at 88% 6%, rgba(195, 163, 225, 0.55) 0%, rgba(195, 163, 225, 0) 45%)",
  "radial-gradient(circle at 4% 100%, rgba(65, 176, 204, 0.42) 0%, rgba(65, 176, 204, 0) 50%)",
  "radial-gradient(circle at 72% 104%, rgba(253, 156, 194, 0.38) 0%, rgba(253, 156, 194, 0) 42%)",
  "radial-gradient(circle at 36% -8%, rgba(32, 103, 165, 0.18) 0%, rgba(32, 103, 165, 0) 38%)",
];

const DESCRIPTOR = `${BRAND.descriptor} · ${CONTACT.city}`;

/** The tagline split at its dash, so the second clause can carry the accent. */
const [TAGLINE_LEAD, TAGLINE_REST] = (() => {
  const parts = BRAND.tagline.split(" — ");
  return parts.length === 2 ? [`${parts[0]} —`, parts[1]] : [BRAND.tagline, ""];
})();

type FontWeight = 500 | 700;
type LoadedFont = { name: string; data: ArrayBuffer; weight: FontWeight; style: "normal" };

/**
 * The SULOAI face is Saira under another name, but only its .woff2 files are
 * in the repo and the image renderer can't read woff2. So: a .ttf of the brand
 * face if one is added next to the woff2 files, otherwise Saira from Google
 * Fonts (subset to the characters drawn here), otherwise the renderer's
 * built-in sans. A missing font never fails the build.
 */
async function loadFont(weight: FontWeight, text: string): Promise<LoadedFont | null> {
  const file = weight === 700 ? "SULOAI-Bold.ttf" : "SULOAI-Medium.ttf";
  const local = await readFile(join(process.cwd(), "src/app/fonts", file)).catch(() => null);
  if (local) return { name: "SULOAI", data: Uint8Array.from(local).buffer, weight, style: "normal" };

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Saira:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await fetch(cssUrl, { cache: "force-cache", signal: AbortSignal.timeout(8000) }).then((r) =>
      r.ok ? r.text() : "",
    );
    const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;
    const res = await fetch(fontUrl, { cache: "force-cache", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return { name: "SULOAI", data: await res.arrayBuffer(), weight, style: "normal" };
  } catch {
    return null;
  }
}

export default async function Image() {
  const [mark, ...fonts] = await Promise.all([
    readFile(join(process.cwd(), "public/brand/suloai-mark.png"), "base64"),
    loadFont(700, `${BRAND.name}${BRAND.tagline}`),
    loadFont(500, DESCRIPTOR),
  ]);
  const markSrc = `data:image/png;base64,${mark}`;
  const loaded = fonts.filter((f): f is LoadedFont => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          padding: "64px 80px 76px",
          backgroundColor: CANVAS,
          color: INK_900,
          fontFamily: "SULOAI",
        }}
      >
        {/* Soft colour fields, as in the site's aurora background. */}
        {COLOUR_FIELDS.map((backgroundImage) => (
          <div
            key={backgroundImage}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, display: "flex", backgroundImage }}
          />
        ))}

        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={markSrc} width={66} height={70} alt="" />
          <div style={{ display: "flex", marginLeft: 20, fontSize: 46, fontWeight: 700, letterSpacing: 5 }}>
            {BRAND.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
            {TAGLINE_LEAD}
          </div>
          {TAGLINE_REST ? (
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontSize: 66,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: -1,
                backgroundImage: ACCENT_GRADIENT,
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {TAGLINE_REST}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: INK_600 }}>{DESCRIPTOR}</div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 14,
            display: "flex",
            backgroundImage: BRAND_GRADIENT,
          }}
        />
      </div>
    ),
    {
      ...size,
      // Leaving `fonts` unset keeps the renderer's built-in font; an empty list would fail.
      ...(loaded.length > 0 ? { fonts: loaded } : {}),
    },
  );
}

import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/site";
import { SEO_DESCRIPTION } from "@/components/seo/StructuredData";

/**
 * /manifest.webmanifest. Colours match the page canvas and the viewport
 * theme colour in app/layout.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.descriptor}`,
    short_name: BRAND.name,
    description: SEO_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en",
    background_color: "#f7fafc",
    theme_color: "#f7fafc",
    icons: [
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/brand/suloai-mark-square.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

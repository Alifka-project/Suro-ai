import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { BRAND, SITE_URL } from "@/lib/site";
import { SEO_DESCRIPTION, SEO_TITLE, SHARE_DESCRIPTION } from "@/components/seo/StructuredData";
import "./globals.css";

/**
 * The SULOAI brand face, self-hosted. Based on Saira (SIL OFL) and renamed by
 * the brand's designer — see fonts/SULOAI-FONT-README.txt. next/font/local
 * inlines the @font-face and preloads it, so there's no flash of fallback text
 * and no layout shift when it swaps in.
 */
const suloai = localFont({
  variable: "--font-suloai",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  src: [
    { path: "./fonts/SULOAI-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/SULOAI-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/SULOAI-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/SULOAI-Bold.woff2", weight: "700", style: "normal" },
  ],
});

/** Kept for the mono eyebrows and data labels — SULOAI has no monospace cut. */
const jetbrains = JetBrains_Mono({
  variable: "--font-mono-jet",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * Site-wide metadata. URLs are relative and resolve against SITE_URL
 * (src/lib/site.ts), which follows NEXT_PUBLIC_SITE_URL or the Vercel
 * production domain. The share image comes from app/opengraph-image.tsx and
 * app/twitter-image.tsx; the favicon and touch icon from app/icon.png and
 * app/apple-icon.png.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SEO_TITLE,
    template: `%s · ${BRAND.name}`,
  },
  description: SEO_DESCRIPTION,
  applicationName: BRAND.name,
  keywords: [
    "business process automation Dubai",
    "business automation UAE",
    "workflow automation",
    "Excel automation",
    "VBA automation",
    "Power Automate consultant",
    "data integration",
    "systems integration",
    "automated reporting and dashboards",
    "AI agents for business",
    "AI assistants",
    "custom web applications",
    "project rescue",
    "automation audit",
  ],
  authors: [{ name: BRAND.name, url: SITE_URL }],
  creator: BRAND.name,
  publisher: BRAND.name,
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: BRAND.name,
    locale: "en_AE",
    title: SEO_TITLE,
    description: SHARE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SHARE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f7fafc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${suloai.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-900 focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

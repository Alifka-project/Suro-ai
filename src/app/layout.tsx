import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
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

const SITE = "https://suloai.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "SULOAI — Automation & AI for Supply Chain",
    template: "%s · SULOAI",
  },
  description:
    "We build Power Automate flows, Excel VBA tooling, and applied AI — chatbots, embedded copilots, document intelligence — for supply chain and logistics teams. Describe your bottleneck and get a solution outline in seconds.",
  applicationName: "SULOAI",
  keywords: [
    "supply chain automation",
    "Power Automate consulting",
    "Excel VBA automation",
    "AI chatbot for logistics",
    "SCM AI solutions",
    "procurement automation",
    "warehouse automation",
    "document intelligence",
  ],
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "SULOAI",
    title: "SULOAI — Automation & AI for Supply Chain",
    description:
      "Power Automate, Excel VBA, and applied AI built for supply chain teams. Describe your bottleneck, get a solution outline in seconds.",
    images: [
      { url: "/brand/suloai-lockup.png", width: 916, height: 838, alt: "SULOAI" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SULOAI — Automation & AI for Supply Chain",
    description:
      "Power Automate, Excel VBA, and applied AI built for supply chain teams.",
    images: ["/brand/suloai-lockup.png"],
  },
  robots: { index: true, follow: true },
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

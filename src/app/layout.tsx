import type { Metadata, Viewport } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-jet",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE = "https://suro.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Suro AI — Automation & AI for Supply Chain",
    template: "%s · Suro AI",
  },
  description:
    "We build Power Automate flows, Excel VBA tooling, and applied AI — chatbots, embedded copilots, document intelligence — for supply chain and logistics teams. Describe your bottleneck and get a solution outline in seconds.",
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
    siteName: "Suro AI",
    title: "Suro AI — Automation & AI for Supply Chain",
    description:
      "Power Automate, Excel VBA, and applied AI built for supply chain teams. Describe your bottleneck, get a solution outline in seconds.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Suro AI — Automation & AI for Supply Chain",
    description:
      "Power Automate, Excel VBA, and applied AI built for supply chain teams.",
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
      className={`${sora.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
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

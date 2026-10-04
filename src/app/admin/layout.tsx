import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · SULOAI Admin" },
  // Belt and braces with the X-Robots-Tag header set in proxy.ts.
  robots: { index: false, follow: false, nocache: true },
  // Don't inherit the home page's canonical link and share card.
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-surface min-h-dvh bg-canvas print:min-h-0 print:bg-white">{children}</div>;
}

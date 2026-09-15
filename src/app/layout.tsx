import type { Metadata, Viewport } from "next";
import { PwaRuntime } from "@/components/pwa-runtime";
import "./globals.css";
import "./mobile-pharmacy-fixes.css";

const iconVersion = "tr1-brand-20260915";

export const metadata: Metadata = {
  title: "TR1 Pharma",
  applicationName: "TR1 Pharma",
  description:
    "TR1 Pharma — exécution commerciale terrain pour les marques qui se développent en pharmacie.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TR1 Pharma",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      {
        url: `/pwa/icon/192?v=${iconVersion}`,
        sizes: "192x192",
        type: "image/svg+xml",
      },
    ],
    shortcut: [
      {
        url: `/pwa/icon/192?v=${iconVersion}`,
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: `/pwa/icon/180?v=${iconVersion}`,
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1d31",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        {children}
        <PwaRuntime />
      </body>
    </html>
  );
}

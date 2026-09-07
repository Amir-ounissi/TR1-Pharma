import type { Metadata, Viewport } from "next";
import { PwaRuntime } from "@/components/pwa-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "TR1 Pharma",
  applicationName: "TR1 Pharma",
  description:
    "TR1 Pharma est une plateforme SaaS de pilotage commercial et d’exécution terrain dédiée aux marques qui se développent en pharmacie.",
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
    apple: [
      {
        url: "/pwa/icon/180",
        sizes: "180x180",
        type: "image/png",
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
  themeColor: "#0b1e32",
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

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TR1 Pharma",
  description: "Plateforme sécurisée de pilotage commercial en pharmacie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

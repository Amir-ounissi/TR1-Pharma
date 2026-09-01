import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TR1 Pharma",
  description: "TR1 Pharma est une plateforme SaaS de pilotage commercial et d’exécution terrain dédiée aux marques qui se développent en pharmacie.",
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

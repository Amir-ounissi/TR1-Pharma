import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TR1 PHARMA",
  description: "Partenaire commercial multimarque des pharmacies, du sell-in au sell-out.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body className="min-h-screen antialiased">{children}</body></html>;
}

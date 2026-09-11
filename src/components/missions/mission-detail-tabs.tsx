"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MissionDetailTabs({ missionId }: { missionId: string }) {
  const pathname = usePathname();
  const invoicePath = `/dashboard/missions/${missionId}/invoice`;
  const invoiceActive = pathname === invoicePath;

  return (
    <nav
      aria-label="Navigation de la mission"
      className="flex w-fit gap-1 rounded-xl border bg-muted/30 p-1"
    >
      <Link
        href={`/dashboard/missions/${missionId}`}
        aria-current={!invoiceActive ? "page" : undefined}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
          !invoiceActive
            ? "bg-background text-[var(--tr1-navy)] shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Mission
      </Link>
      <Link
        href={invoicePath}
        aria-current={invoiceActive ? "page" : undefined}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
          invoiceActive
            ? "bg-background text-[var(--tr1-navy)] shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Facturation
      </Link>
    </nav>
  );
}

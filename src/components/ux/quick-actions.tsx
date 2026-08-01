import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function QuickActions({ actions, className }: { actions: { href: string; label: string; description: string; icon: LucideIcon }[]; className?: string }) {
  return (
    <section aria-label="Actions rapides" className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {actions.map((action) => (
        <Link className="group flex min-h-20 items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-[0_1px_2px_rgb(14_26_43/0.03)] transition hover:-translate-y-0.5 hover:border-[var(--tr1-orange)]/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={action.href} key={action.href}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--tr1-navy)] text-white transition-colors group-hover:bg-[var(--tr1-orange)]"><action.icon className="size-4" /></span>
          <span><span className="block text-sm font-semibold">{action.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{action.description}</span></span>
        </Link>
      ))}
    </section>
  );
}

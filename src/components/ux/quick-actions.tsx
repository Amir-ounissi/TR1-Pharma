import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function QuickActions({ actions, className }: { actions: { href: string; label: string; description: string; icon: LucideIcon }[]; className?: string }) {
  return (
    <section aria-label="Actions rapides" className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {actions.map((action) => (
        <Link className="group flex min-h-20 items-center gap-3 rounded-[0.45rem] border border-[var(--tr1-line)] bg-card px-4 py-3 transition hover:border-[var(--tr1-orange)]/55 hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={action.href} key={action.href}>
          <span className="grid size-9 shrink-0 place-items-center rounded-[0.35rem] border border-[var(--tr1-line-strong)] bg-transparent text-[var(--tr1-navy)] transition-colors group-hover:border-[var(--tr1-orange)] group-hover:text-[var(--tr1-orange)]"><action.icon className="size-4" /></span>
          <span><span className="block font-mono text-[0.68rem] font-black uppercase tracking-[-0.02em]">{action.label}</span><span className="mt-1 block text-[0.68rem] text-muted-foreground">{action.description}</span></span>
        </Link>
      ))}
    </section>
  );
}

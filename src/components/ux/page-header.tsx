import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions, tone = "light", className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; tone?: "light" | "dark"; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-5 border-b border-[var(--tr1-line-strong)] pb-5 sm:flex-row sm:items-end sm:justify-between", className)} data-tone={tone}>
      <div className="min-w-0">
        {eyebrow && <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.17em] text-[var(--tr1-orange)]">{eyebrow}</p>}
        <h1 className="mt-1 font-mono text-2xl font-black uppercase tracking-[-0.055em] text-[var(--tr1-navy)] sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

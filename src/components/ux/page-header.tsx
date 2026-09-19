import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions, tone = "light", className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; tone?: "light" | "dark"; className?: string }) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-[var(--tr1-line)] pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      data-slot="page-header"
      data-tone={tone}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.025em] text-[var(--tr1-orange)]">{eyebrow}</p> : null}
        <h1 className="mt-1.5 max-w-4xl text-[1.8rem] font-bold leading-[1.06] tracking-[-0.035em] text-[var(--tr1-navy)] sm:text-[2.15rem]">{title}</h1>
        {description ? <p className="mt-2.5 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

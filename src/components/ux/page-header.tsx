import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions, tone = "light", className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; tone?: "light" | "dark"; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-5 rounded-2xl px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7", tone === "dark" ? "bg-[var(--tr1-navy)] text-[var(--tr1-ivory)] shadow-[0_18px_45px_-30px_rgb(14_26_43/0.7)]" : "border-b border-border/80 px-0 pt-1", className)}>
      <div className="min-w-0">
        {eyebrow && <p className={cn("tr1-eyebrow", tone === "dark" && "text-[#8ab5d5]")}>{eyebrow}</p>}
        <h1 className={cn("mt-1 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl", tone === "dark" && "text-white")}>{title}</h1>
        {description && <p className={cn("mt-2 max-w-2xl text-sm leading-6 text-muted-foreground", tone === "dark" && "text-[#c7d3df]")}>{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

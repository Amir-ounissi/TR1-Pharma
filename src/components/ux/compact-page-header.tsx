"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CompactPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-2.5 border-b border-[var(--tr1-line-strong)] pb-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[1.7rem] font-semibold tracking-[-0.05em] text-[var(--tr1-navy)] sm:text-[1.95rem]">
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-2xl text-[0.92rem] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

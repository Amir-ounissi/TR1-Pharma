import type { ReactNode } from "react";

export function SectionHeader({ title, description, action, id }: { title: string; description?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-[var(--tr1-navy)] sm:text-xl" id={id}>{title}</h2>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

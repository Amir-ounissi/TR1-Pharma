import type { ReactNode } from "react";

export function SectionHeader({ title, description, action, id }: { title: string; description?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="font-mono text-base font-black uppercase tracking-[-0.035em] text-[var(--tr1-navy)] sm:text-lg" id={id}>{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

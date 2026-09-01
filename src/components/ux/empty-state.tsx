import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateTone = "first_use" | "no_results" | "no_data" | "all_clear";

export function EmptyState({
  title,
  description,
  tone = "no_data",
  action,
  className,
}: {
  title: string;
  description?: string;
  tone?: EmptyStateTone;
  action?: ReactNode;
  className?: string;
}) {
  const eyebrow = {
    first_use: "Premier usage",
    no_results: "Aucun résultat",
    no_data: "Aucune donnée",
    all_clear: "Rien à signaler",
  } satisfies Record<EmptyStateTone, string>;

  return (
    <div
      className={cn(
        "rounded-[0.8rem] border border-[var(--tr1-line)] bg-white/50 px-5 py-5 text-center",
        className,
      )}
    >
      <p className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
        {eyebrow[tone]}
      </p>
      <h2 className="mt-1.5 text-base font-semibold text-[var(--tr1-navy)]">{title}</h2>
      {description ? <p className="mx-auto mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

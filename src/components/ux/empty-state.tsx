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
        "rounded-[0.85rem] border border-[var(--tr1-line)] bg-white px-5 py-6 text-center",
        className,
      )}
    >
      <p className="text-xs font-semibold text-[var(--tr1-orange)]">
        {eyebrow[tone]}
      </p>
      <h2 className="mt-2 text-base font-semibold text-[var(--tr1-navy)]">{title}</h2>
      {description ? <p className="mx-auto mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

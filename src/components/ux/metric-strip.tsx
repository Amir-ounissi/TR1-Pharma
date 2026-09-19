import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricStrip({
  items,
  className,
}: {
  items: {
    label: string;
    value: number | string;
    detail?: string;
    icon?: LucideIcon;
    accent?: boolean;
  }[];
  className?: string;
}) {
  return (
    <section
      aria-label="Indicateurs de synthèse"
      className={cn(
        "overflow-hidden rounded-[0.85rem] border border-[var(--tr1-line)] bg-white",
        className,
      )}
    >
      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <article
            key={item.label}
            className={cn(
              "flex min-h-[4.8rem] items-center justify-between gap-3 px-4 py-3",
              index > 0 && "border-t border-[var(--tr1-line)] sm:border-l sm:border-t-0 lg:border-t-0",
            )}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}
              </p>
              {item.detail ? <p className="mt-0.5 text-[0.68rem] text-muted-foreground">{item.detail}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {Icon ? (
                <Icon className={cn("size-3.5 text-[var(--tr1-navy)]/70", item.accent && "text-[var(--tr1-orange)]")} />
              ) : null}
              <p className={cn("text-[1.25rem] font-semibold tracking-[-0.03em] tabular-nums text-[var(--tr1-navy)]", item.accent && "text-[var(--tr1-orange)]")}>
                {item.value}
              </p>
            </div>
          </article>
        );
      })}
      </div>
    </section>
  );
}

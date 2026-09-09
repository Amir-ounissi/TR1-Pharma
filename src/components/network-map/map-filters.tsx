import Link from "next/link";
import { ChevronDown, Ellipsis, SlidersHorizontal } from "lucide-react";
import { getMapModeLabel, type NetworkMapMode, type NetworkMapPeriod, type NetworkMapRoleScope, type NetworkMapView } from "@/lib/network-map";
import { cn } from "@/lib/utils";

function withParams(basePath: string, params: URLSearchParams, patch: Record<string, string>) {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    next.set(key, value);
  }
  return `${basePath}?${next.toString()}`;
}

const PERIODS = [
  { value: "7d" as const, label: "7 jours" },
  { value: "30d" as const, label: "30 jours" },
  { value: "90d" as const, label: "90 jours" },
  { value: "ytd" as const, label: "YTD" },
];

export function MapFilters({
  basePath,
  params,
  view,
  mode,
  period,
  roleScope,
}: {
  basePath: string;
  params: URLSearchParams;
  view: NetworkMapView;
  mode: NetworkMapMode;
  period: NetworkMapPeriod;
  roleScope: NetworkMapRoleScope;
}) {
  const modes = roleScope === "agent"
    ? [{ value: "network" as const, label: "Mon réseau" }, { value: "priorities" as const, label: "Mes priorités" }]
    : [
        { value: "network" as const, label: getMapModeLabel("network") },
        { value: "terrain" as const, label: getMapModeLabel("terrain") },
        { value: "development" as const, label: getMapModeLabel("development") },
        { value: "priorities" as const, label: getMapModeLabel("priorities") },
      ];

  return (
    <div className={view === "map" ? "space-y-2" : "space-y-3"}>
      <div className={cn("flex flex-wrap items-center justify-between gap-2 md:gap-3", view === "map" && "md:rounded-[0.45rem] md:border md:border-[var(--tr1-line-strong)] md:bg-white/55 md:px-3 md:py-2")}>
        <div className="flex items-center gap-2">
          {[
            { value: "list" as const, label: "Liste" },
            { value: "map" as const, label: "Carte" },
          ].map((item) => (
            <Link
              className={cn(
                "min-w-[5.5rem] rounded-lg border px-3 py-2.5 text-center font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] md:min-w-0 md:rounded-md md:py-2",
                view === item.value
                  ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
                  : "border-[var(--tr1-line-strong)] bg-white/70 text-[var(--tr1-navy)]",
              )}
              href={withParams(basePath, params, { view: item.value })}
              key={item.value}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 xl:flex">
          <ToolbarChip label="Période" value={periodLabel(period)} />
          <ToolbarChip icon={<SlidersHorizontal className="size-3.5" />} label="Filtres avancés" value="Affiner" />
          <button
            className="grid h-9 w-9 place-items-center rounded-[0.45rem] border border-[var(--tr1-line-strong)] bg-white/70 text-[var(--tr1-navy)]"
            type="button"
          >
            <Ellipsis className="size-4" />
          </button>
        </div>
      </div>

      {view === "map" ? (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {modes.map((item) => (
              <Link
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.09em] md:rounded-[0.45rem] md:py-2",
                  mode === item.value
                    ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
                    : "border-[var(--tr1-line-strong)] bg-white/55 text-[var(--tr1-navy)]",
                )}
                href={withParams(basePath, params, { mode: item.value })}
                key={item.value}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <details className="group relative shrink-0 md:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[var(--tr1-line-strong)] bg-white/80 px-3 font-mono text-[0.58rem] font-black uppercase tracking-[0.08em] text-[var(--tr1-navy)] [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-3.5" />
              Filtres
            </summary>
            <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--card)] p-3 shadow-xl">
              <p className="mb-2 font-mono text-[0.56rem] font-black uppercase tracking-[0.12em] text-muted-foreground">Période</p>
              <div className="grid grid-cols-2 gap-2">
                {PERIODS.map((item) => (
                  <Link
                    className={cn(
                      "rounded-lg border px-2.5 py-2.5 text-center font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em]",
                      period === item.value
                        ? "border-[var(--tr1-orange)] bg-[var(--tr1-orange)] text-white"
                        : "border-[var(--tr1-line-strong)] bg-white/70 text-[var(--tr1-navy)]",
                    )}
                    href={withParams(basePath, params, { period: item.value })}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </details>

          <div className="hidden flex-wrap items-center gap-2 md:flex xl:hidden">
            {PERIODS.map((item) => (
              <Link
                className={cn(
                  "rounded-[0.45rem] border px-2.5 py-2 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em]",
                  period === item.value
                    ? "border-[var(--tr1-orange)] bg-[var(--tr1-orange)] text-white"
                    : "border-[var(--tr1-line-strong)] bg-white/70 text-[var(--tr1-navy)]",
                )}
                href={withParams(basePath, params, { period: item.value })}
                key={item.value}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarChip({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-[0.45rem] border border-[var(--tr1-line-strong)] bg-white/70 px-3 text-left"
      type="button"
    >
      {icon}
      <span className="font-mono text-[0.58rem] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[0.78rem] font-medium text-[var(--tr1-navy)]">{value}</span>
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </button>
  );
}

function periodLabel(period: NetworkMapPeriod) {
  return (
    {
      "7d": "7 jours",
      "30d": "30 jours",
      "90d": "90 jours",
      ytd: "YTD",
    } as const
  )[period];
}

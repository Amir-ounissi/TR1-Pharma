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
      <div className={cn("flex flex-wrap items-center justify-between gap-3", view === "map" && "rounded-[0.45rem] border border-[var(--tr1-line-strong)] bg-white/55 px-3 py-2")}>
        <div className="flex flex-wrap items-center gap-2">
        {[
          { value: "list" as const, label: "Liste" },
          { value: "map" as const, label: "Carte" },
        ].map((item) => (
          <Link
            className={cn(
              "rounded-md border px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em]",
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
        <div className="flex flex-wrap items-center gap-2">
          {modes.map((item) => (
            <Link
              className={cn(
                "rounded-[0.45rem] border px-3 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.09em]",
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
          <div className="ml-auto flex flex-wrap items-center gap-2 xl:hidden">
            {[
              { value: "7d" as const, label: "7 jours" },
              { value: "30d" as const, label: "30 jours" },
              { value: "90d" as const, label: "90 jours" },
              { value: "ytd" as const, label: "YTD" },
            ].map((item) => (
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

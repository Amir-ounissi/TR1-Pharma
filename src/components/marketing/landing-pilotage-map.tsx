"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarCheck2, GraduationCap } from "lucide-react";
import franceDepartments from "@/data/france-departments-metro.json";
import { demoPharmacies, type DemoMode, type DemoTone } from "@/lib/marketing/demo-network";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

const VIEWBOX_WIDTH = 700;
const VIEWBOX_HEIGHT = 620;
const MIN_LONGITUDE = -5.6;
const MAX_LONGITUDE = 9.8;
const MIN_LATITUDE = 41.2;
const MAX_LATITUDE = 51.4;
const LONGITUDE_SCALE = Math.cos((46.5 * Math.PI) / 180);
const MAP_PADDING_X = 42;
const MAP_PADDING_Y = 34;

type GeometryFeature = {
  properties: { code: string; nom: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

type ProjectedPoint = { x: number; y: number };

const modes = [
  { id: "commercial", label: "Commercial", icon: BriefcaseBusiness },
  { id: "animations", label: "Animations", icon: CalendarCheck2 },
  { id: "formations", label: "Formations", icon: GraduationCap },
] as const;

const departmentFeatures = (franceDepartments as { features: GeometryFeature[] }).features;

export function LandingPilotageMap() {
  const [mode, setMode] = useState<DemoMode>("commercial");
  const [selectedId, setSelectedId] = useState(demoPharmacies[0].id);

  const selected = useMemo(
    () => demoPharmacies.find((pharmacy) => pharmacy.id === selectedId) ?? demoPharmacies[0],
    [selectedId],
  );

  const priorities = useMemo(() => {
    const ranked = [...demoPharmacies].sort((a, b) => toneRank(a[mode].tone) - toneRank(b[mode].tone));
    return [selected, ...ranked.filter((pharmacy) => pharmacy.id !== selected.id)].slice(0, 3);
  }, [mode, selected]);

  const selectMode = (nextMode: DemoMode) => {
    const nextPriority = [...demoPharmacies].sort(
      (a, b) => toneRank(a[nextMode].tone) - toneRank(b[nextMode].tone),
    )[0];

    setMode(nextMode);
    setSelectedId(nextPriority.id);
    trackMarketingEvent("map_filter_use", { filter: nextMode });
  };

  return (
    <div className="w-full rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-[0_18px_48px_rgba(14,29,49,.08)] sm:p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[.58rem] font-black uppercase tracking-[.12em] text-[var(--tr1-orange)]">Pilotage terrain</p>
            <span className="rounded-full border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] px-2.5 py-1 font-mono text-[.52rem] font-bold uppercase tracking-[.08em] text-[var(--tr1-muted)]">
              Démonstration
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-[var(--tr1-navy)] sm:text-3xl">
            Votre terrain vous dit où agir.
          </h2>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[var(--tr1-muted)] sm:text-[.95rem]">
            Du national au point de vente, identifiez les signaux qui demandent une action et gardez la suite à donner sous les yeux.
          </p>
        </div>

        <div
          aria-label="Choisir les informations affichées sur la carte"
          className="grid grid-cols-3 rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-1"
          role="tablist"
        >
          {modes.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                aria-selected={active}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] motion-reduce:transition-none sm:px-3 ${active ? "bg-[var(--tr1-navy)] text-white shadow-sm" : "text-[var(--tr1-muted)] hover:bg-white"}`}
                key={id}
                onClick={() => selectMode(id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" className="size-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.75fr)] lg:gap-5">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)]">
          <div className="absolute left-4 top-4 z-20 rounded-full border border-[var(--tr1-line)] bg-white/90 px-3 py-1.5 font-mono text-[.55rem] font-black uppercase tracking-[.08em] text-[var(--tr1-muted)] shadow-sm backdrop-blur">
            Réseau national
          </div>

          <div className="relative mx-auto aspect-[1.16/1] w-full max-w-[46rem]" aria-label={`Carte de France de démonstration — filtre ${mode}`}>
            <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
              <g fill="#fffdfa" stroke="#ded3c3" strokeLinejoin="round" strokeWidth="0.72">
                {departmentFeatures.map((feature) => (
                  <path d={geometryToPath(feature.geometry)} key={feature.properties.code} />
                ))}
              </g>
            </svg>

            {demoPharmacies.map((pharmacy) => {
              const point = projectCoordinate(pharmacy.longitude, pharmacy.latitude);
              const data = pharmacy[mode];
              const isSelected = pharmacy.id === selected.id;

              return (
                <button
                  aria-label={`${pharmacy.name}, ${pharmacy.city} — ${data.status}`}
                  aria-pressed={isSelected}
                  className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 outline-none"
                  key={pharmacy.id}
                  onClick={() => setSelectedId(pharmacy.id)}
                  style={{ left: `${(point.x / VIEWBOX_WIDTH) * 100}%`, top: `${(point.y / VIEWBOX_HEIGHT) * 100}%` }}
                  type="button"
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full border-[3px] border-white shadow-[0_5px_14px_rgba(14,29,49,.16)] transition duration-200 group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-[var(--tr1-orange)]/25 motion-reduce:transition-none ${isSelected ? "scale-110 ring-4 ring-[var(--tr1-navy)]/10" : ""} ${markerClass(data.tone)}`}
                  >
                    <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
                  </span>
                  <span className={`pointer-events-none absolute left-1/2 top-full mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[.62rem] font-black shadow-sm lg:block ${isSelected ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white" : "border-[var(--tr1-line)] bg-white/92 text-[var(--tr1-navy)]"}`}>
                    {pharmacy.city}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--tr1-line)] bg-[#fffdfa] p-4 sm:p-5" aria-label="Actions prioritaires du réseau">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[.56rem] font-black uppercase tracking-[.1em] text-[var(--tr1-orange)]">À traiter</p>
              <h3 className="mt-1 text-lg font-black tracking-[-.025em] text-[var(--tr1-navy)]">3 actions prioritaires</h3>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[var(--tr1-navy)] font-mono text-xs font-black text-white">3</span>
          </div>

          <div className="mt-4 grid gap-2.5">
            {priorities.map((pharmacy, index) => {
              const data = pharmacy[mode];
              const active = pharmacy.id === selected.id;

              return (
                <button
                  className={`group w-full rounded-xl border p-3.5 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] motion-reduce:transition-none ${active ? "border-[var(--tr1-navy)] bg-white shadow-[0_10px_26px_rgba(14,29,49,.08)]" : "border-[var(--tr1-line)] bg-white/55 hover:bg-white"}`}
                  key={pharmacy.id}
                  onClick={() => setSelectedId(pharmacy.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${toneDotClass(data.tone)}`} aria-hidden="true" />
                        <span className="font-mono text-[.54rem] font-black uppercase tracking-[.08em] text-[var(--tr1-muted)]">
                          {String(index + 1).padStart(2, "0")} · {pharmacy.city}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-black text-[var(--tr1-navy)]">{pharmacy.name}</p>
                    </div>
                    <ArrowRight className={`mt-1 size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none ${active ? "text-[var(--tr1-orange)]" : "text-[var(--tr1-muted)]"}`} aria-hidden="true" />
                  </div>

                  <p className="mt-2 text-sm font-black leading-5 text-[var(--tr1-navy)]">{data.status}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--tr1-muted)]">{data.information}</p>
                  <div className="mt-3 border-t border-[var(--tr1-line)] pt-2.5">
                    <p className="font-mono text-[.52rem] font-black uppercase tracking-[.08em] text-[var(--tr1-muted)]">Prochaine action</p>
                    <p className="mt-1 text-sm font-black leading-5 text-[var(--tr1-orange)]">{data.nextAction}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <p className="mt-4 text-center text-xs font-bold tracking-[.01em] text-[var(--tr1-muted)]">
        Du national au point de vente, chaque signal mène à une action.
      </p>
    </div>
  );
}

function projectCoordinate(longitude: number, latitude: number): ProjectedPoint {
  const geographicWidth = (MAX_LONGITUDE - MIN_LONGITUDE) * LONGITUDE_SCALE;
  const geographicHeight = MAX_LATITUDE - MIN_LATITUDE;
  const availableWidth = VIEWBOX_WIDTH - MAP_PADDING_X * 2;
  const availableHeight = VIEWBOX_HEIGHT - MAP_PADDING_Y * 2;
  const scale = Math.min(availableWidth / geographicWidth, availableHeight / geographicHeight);
  const contentWidth = geographicWidth * scale;
  const contentHeight = geographicHeight * scale;
  const offsetX = (VIEWBOX_WIDTH - contentWidth) / 2;
  const offsetY = (VIEWBOX_HEIGHT - contentHeight) / 2;

  return {
    x: offsetX + (longitude - MIN_LONGITUDE) * LONGITUDE_SCALE * scale,
    y: offsetY + (MAX_LATITUDE - latitude) * scale,
  };
}

function geometryToPath(geometry: GeometryFeature["geometry"]) {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : (geometry.coordinates as number[][][][]);

  return polygons
    .flatMap((polygon) => polygon.map((ring) => ringToPath(ring)))
    .filter(Boolean)
    .join(" ");
}

function ringToPath(ring: number[][]) {
  if (!ring.length) return "";

  return ring.map(([longitude, latitude], index) => {
    const point = projectCoordinate(longitude, latitude);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ") + " Z";
}

function toneRank(tone: DemoTone) {
  if (tone === "risk") return 0;
  if (tone === "watch") return 1;
  if (tone === "neutral") return 2;
  return 3;
}

function markerClass(tone: DemoTone) {
  if (tone === "risk") return "bg-[var(--tr1-orange)]";
  if (tone === "watch") return "bg-[#dc8b6b]";
  if (tone === "neutral") return "bg-[#8d9297]";
  return "bg-[var(--tr1-navy)]";
}

function toneDotClass(tone: DemoTone) {
  if (tone === "risk") return "bg-[var(--tr1-orange)]";
  if (tone === "watch") return "bg-[#dc8b6b]";
  if (tone === "neutral") return "bg-[#8d9297]";
  return "bg-[var(--tr1-navy)]";
}

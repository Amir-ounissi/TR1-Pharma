"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarCheck2, ChevronDown, GraduationCap } from "lucide-react";
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
  const [showList, setShowList] = useState(false);

  const selected = useMemo(
    () => demoPharmacies.find((pharmacy) => pharmacy.id === selectedId) ?? demoPharmacies[0],
    [selectedId],
  );
  const selectedData = selected[mode];
  const selectedPoint = projectCoordinate(selected.longitude, selected.latitude);
  const popupPosition = getPopupPosition(selectedPoint);

  const selectMode = (nextMode: DemoMode) => {
    setMode(nextMode);
    trackMarketingEvent("map_filter_use", { filter: nextMode });
  };

  return (
    <div className="w-full rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-[0_18px_48px_rgba(14,29,49,.08)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-[-.025em] text-[var(--tr1-navy)] sm:text-2xl">Votre réseau en un regard</h2>
          <p className="mt-1 text-sm font-semibold text-[var(--tr1-muted)]">Données de démonstration</p>
        </div>
        <div aria-label="Choisir les informations affichées sur la carte" className="grid grid-cols-3 rounded-lg border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-1" role="tablist">
          {modes.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                aria-selected={active}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-bold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] motion-reduce:transition-none sm:px-3 ${active ? "bg-[var(--tr1-navy)] text-white" : "text-[var(--tr1-muted)] hover:bg-white"}`}
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

      <div className="relative mt-4 overflow-hidden rounded-xl bg-[var(--tr1-ivory)]">
        <div className="relative mx-auto aspect-[1.1/1] w-full max-w-[42rem]" aria-label={`Carte de France de démonstration — filtre ${mode}`}>
          <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
            <g fill="#fffdf8" stroke="#c7b79f" strokeLinejoin="round" strokeWidth="1.1">
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
                className={`absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white outline-none transition duration-200 focus-visible:ring-4 focus-visible:ring-[var(--tr1-orange)]/30 motion-reduce:transition-none ${isSelected ? "z-20 scale-110 shadow-[0_7px_18px_rgba(14,29,49,.24)] ring-4 ring-[var(--tr1-navy)]/10" : "z-10 shadow-[0_4px_12px_rgba(14,29,49,.18)] hover:scale-105"} ${toneClass(data.tone)}`}
                key={pharmacy.id}
                onClick={() => setSelectedId(pharmacy.id)}
                style={{ left: `${(point.x / VIEWBOX_WIDTH) * 100}%`, top: `${(point.y / VIEWBOX_HEIGHT) * 100}%` }}
                type="button"
              >
                <ModeGlyph mode={mode} />
              </button>
            );
          })}

          <div
            aria-live="polite"
            className="absolute z-30 hidden w-[15.5rem] rounded-xl border border-[var(--tr1-line)] bg-white p-4 shadow-[0_16px_42px_rgba(14,29,49,.14)] md:block"
            style={{ left: `${popupPosition.left}%`, top: `${popupPosition.top}%` }}
          >
            <PharmacySummary mode={mode} pharmacyId={selected.id} />
          </div>
        </div>
      </div>

      <div aria-live="polite" className="mt-4 min-h-[11rem] rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-4 md:hidden">
        <PharmacySummary mode={mode} pharmacyId={selected.id} />
      </div>

      <div className="mt-4 md:hidden">
        <button
          aria-expanded={showList}
          className="flex min-h-11 w-full items-center justify-between rounded-lg border border-[var(--tr1-line)] bg-white px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]"
          onClick={() => setShowList((current) => !current)}
          type="button"
        >
          <span>{showList ? "Masquer la liste" : "Voir les pharmacies en liste"}</span>
          <ChevronDown aria-hidden="true" className={`size-4 transition duration-200 motion-reduce:transition-none ${showList ? "rotate-180" : ""}`} />
        </button>
        {showList ? (
          <div className="mt-2 grid gap-2" aria-label="Pharmacies de démonstration">
            {demoPharmacies.map((pharmacy) => {
              const data = pharmacy[mode];
              const active = selected.id === pharmacy.id;
              return (
                <button
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] ${active ? "border-[var(--tr1-navy)] bg-white" : "border-[var(--tr1-line)] bg-white/55"}`}
                  key={pharmacy.id}
                  onClick={() => setSelectedId(pharmacy.id)}
                  type="button"
                >
                  <span><strong className="block">{pharmacy.name}</strong><span className="text-xs text-[var(--tr1-muted)]">{pharmacy.city} · {data.status}</span></span>
                  <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${toneDotClass(data.tone)}`} />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs font-bold tracking-[.01em] text-[var(--tr1-muted)]">
        Une vision nationale. Un suivi pharmacie par pharmacie.
      </p>
    </div>
  );
}

function PharmacySummary({ mode, pharmacyId }: { mode: DemoMode; pharmacyId: string }) {
  const pharmacy = demoPharmacies.find((item) => item.id === pharmacyId) ?? demoPharmacies[0];
  const data = pharmacy[mode];
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-black leading-5 text-[var(--tr1-navy)]">{pharmacy.name}</p>
          <p className="mt-0.5 text-xs text-[var(--tr1-muted)]">{pharmacy.city}</p>
        </div>
        <span className={`size-2.5 shrink-0 rounded-full ${toneDotClass(data.tone)}`} />
      </div>
      <p className="mt-3 text-sm font-black text-[var(--tr1-navy)]">{data.status}</p>
      <p className="mt-2 text-sm leading-5 text-[var(--tr1-muted)]">{data.information}</p>
      <p className="mt-3 border-t border-[var(--tr1-line)] pt-3 text-xs font-semibold uppercase tracking-[.04em] text-[var(--tr1-muted)]">Prochaine action</p>
      <p className="mt-1 text-sm font-black leading-5 text-[var(--tr1-navy)]">{data.nextAction}</p>
    </div>
  );
}

function ModeGlyph({ mode }: { mode: DemoMode }) {
  const Icon = mode === "commercial" ? BriefcaseBusiness : mode === "animations" ? CalendarCheck2 : GraduationCap;
  return <Icon aria-hidden="true" className="size-4 text-white" strokeWidth={2.5} />;
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

function getPopupPosition(point: ProjectedPoint) {
  const x = (point.x / VIEWBOX_WIDTH) * 100;
  const y = (point.y / VIEWBOX_HEIGHT) * 100;
  const left = clamp(x > 60 ? x - 39 : x + 6, 3, 63);
  const top = clamp(y > 64 ? y - 29 : y + 5, 3, 68);
  return { left, top };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toneClass(tone: DemoTone) {
  if (tone === "risk") return "bg-[#c2413d]";
  if (tone === "watch") return "bg-[#d97706]";
  if (tone === "neutral") return "bg-[#8d9297]";
  return "bg-[#2f855a]";
}

function toneDotClass(tone: DemoTone) {
  if (tone === "risk") return "bg-[#c2413d]";
  if (tone === "watch") return "bg-[#d97706]";
  if (tone === "neutral") return "bg-[#8d9297]";
  return "bg-[#2f855a]";
}

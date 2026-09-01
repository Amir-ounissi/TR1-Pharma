"use client";

import { useMemo } from "react";
import franceDepartments from "@/data/france-departments-metro.json";
import { buildProjectionViewport, projectCoordinate, type NetworkMapActor, type NetworkMapPharmacy, type NetworkMapRoleScope, type ProjectionViewport } from "@/lib/network-map";
import { PharmacyMarker } from "@/components/network-map/pharmacy-marker";
import type { MapDisplayState } from "@/components/network-map/map-display-controls";
import { cn } from "@/lib/utils";

type GeometryFeature = {
  properties: { code: string; nom: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

const MAP_WIDTH = 840;
const MAP_HEIGHT = 640;
const DEMO_VISUAL_ONLY_CITY_LABELS = [
  { label: "Lille", latitude: 50.6292, longitude: 3.0573 },
  { label: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { label: "Nantes", latitude: 47.2184, longitude: -1.5536 },
  { label: "Lyon", latitude: 45.764, longitude: 4.8357 },
  { label: "Marseille", latitude: 43.2965, longitude: 5.3698 },
];

export function FranceMap({
  pharmacies,
  actors,
  controls,
  roleScope,
  selectedPharmacyId,
  selectedActorKey,
  onSelectActor,
  onSelectPharmacy,
}: {
  pharmacies: NetworkMapPharmacy[];
  actors: NetworkMapActor[];
  controls: MapDisplayState;
  roleScope: NetworkMapRoleScope;
  selectedPharmacyId: string | null;
  selectedActorKey: string | null;
  onSelectActor: (actorKey: string | null) => void;
  onSelectPharmacy: (pharmacyId: string) => void;
}) {
  const geoCoded = pharmacies.filter((pharmacy) => pharmacy.latitude != null && pharmacy.longitude != null);
  const viewport = useMemo(
    () => buildProjectionViewport(
      geoCoded.map((pharmacy) => ({ latitude: pharmacy.latitude!, longitude: pharmacy.longitude! })),
      roleScope,
    ),
    [geoCoded, roleScope],
  );

  const paths = useMemo(
    () => ((franceDepartments as { features: GeometryFeature[] }).features).map((feature) => ({
      key: feature.properties.code,
      d: featureToPath(feature, viewport),
    })),
    [viewport],
  );

  const points = useMemo(
    () => geoCoded.map((pharmacy) => ({
      pharmacy,
      point: projectCoordinate(
        { latitude: pharmacy.latitude!, longitude: pharmacy.longitude! },
        viewport,
        MAP_WIDTH,
        MAP_HEIGHT,
      ),
    })),
    [geoCoded, viewport],
  );

  const actorPoints = useMemo(
    () => actors
      .filter((actor) => actor.latitude != null && actor.longitude != null)
      .map((actor) => ({
        actor,
        point: projectCoordinate(
          { latitude: actor.latitude!, longitude: actor.longitude! },
          viewport,
          MAP_WIDTH,
          MAP_HEIGHT,
        ),
      })),
    [actors, viewport],
  );

  const actorConnections = useMemo(
    () => actorPoints.flatMap(({ actor, point: actorPoint }) => {
      const linked = points
        .filter(({ pharmacy }) => pharmacy.agentName === actor.name)
        .slice(0, selectedActorKey === actor.key ? 4 : 2);

      return linked.map(({ pharmacy, point }) => ({
        key: `${actor.key}-${pharmacy.id}`,
        actorKey: actor.key,
        x1: actorPoint.x,
        y1: actorPoint.y,
        x2: point.x,
        y2: point.y,
      }));
    }),
    [actorPoints, points, selectedActorKey],
  );

  const cityLabels = useMemo(
    () => DEMO_VISUAL_ONLY_CITY_LABELS.map((item) => ({
      ...item,
      point: projectCoordinate(
        { latitude: item.latitude, longitude: item.longitude },
        viewport,
        MAP_WIDTH,
        MAP_HEIGHT,
      ),
    })),
    [viewport],
  );

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[0.95rem] border border-[var(--tr1-line-strong)] bg-[#fdf8f1] p-2">
      <svg
        aria-label="Carte stratégique du réseau officinal"
        className="h-full max-h-full w-full"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect fill="url(#tr1-map-grid)" height={MAP_HEIGHT} rx="18" width={MAP_WIDTH} />
        <g fill="#faf1e4" stroke="#dfccb1" strokeWidth="0.9">
          {paths.map((path) => <path d={path.d} key={path.key} />)}
        </g>
        {controls.showConnections ? (
          <g stroke="rgba(230,121,41,0.34)" strokeDasharray="4 6" strokeWidth="1.15">
            {actorConnections.map((connection) => (
              <line
                key={connection.key}
                opacity={selectedActorKey && selectedActorKey !== connection.actorKey ? 0.15 : 1}
                x1={connection.x1}
                x2={connection.x2}
                y1={connection.y1}
                y2={connection.y2}
              />
            ))}
          </g>
        ) : null}
        <defs>
          <pattern height="48" id="tr1-map-grid" patternUnits="userSpaceOnUse" width="48">
            <rect fill="#fdf8f1" height="48" width="48" />
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(223,205,179,0.22)" strokeWidth="1" />
          </pattern>
        </defs>
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {cityLabels.map((item) => (
          <div
            className="absolute hidden -translate-x-1/2 text-[0.58rem] text-[#9d8d74] xl:block"
            key={item.label}
            style={{ left: `${item.point.x}px`, top: `${item.point.y}px` }}
          >
            {item.label}
          </div>
        ))}

        {controls.showPharmacies ? points.map(({ pharmacy, point }) => (
          <div key={pharmacy.id}>
            <div className="absolute max-w-[8.5rem] -translate-x-1/2 -translate-y-[calc(100%+8px)] text-center" style={{ left: `${point.x}px`, top: `${point.y}px` }}>
              <div className="rounded-full border border-[var(--tr1-line)] bg-white/90 px-2 py-1">
                <p className="truncate font-mono text-[0.52rem] font-bold uppercase tracking-[0.06em] text-[var(--tr1-navy)]">
                  {pharmacy.name}
                </p>
                <p className="truncate text-[0.6rem] text-muted-foreground">{pharmacy.city || pharmacy.territoryName || "Officine"}</p>
              </div>
            </div>
            <div className="pointer-events-auto">
              <PharmacyMarker
                active={selectedPharmacyId === pharmacy.id}
                animated={pharmacy.signals.animationsInPeriod > 0}
                label={`${pharmacy.name} · ${pharmacy.presentationLabel}`}
                onSelect={() => onSelectPharmacy(pharmacy.id)}
                strategic={pharmacy.priorityLevel === "strategic"}
                tone={pharmacy.presentationTone}
                x={point.x}
                y={point.y}
              />
            </div>
          </div>
        )) : null}

        {controls.showActors ? actorPoints.map(({ actor, point }) => (
          <button
            className={cn(
              "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--tr1-line-strong)] bg-white/96 px-2 py-1 text-left transition",
              selectedActorKey === actor.key && "border-[var(--tr1-orange)]",
            )}
            key={actor.key}
            onClick={() => onSelectActor(selectedActorKey === actor.key ? null : actor.key)}
            style={{ left: `${point.x}px`, top: `${point.y}px` }}
            type="button"
          >
            <span className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[var(--tr1-navy)] font-mono text-[0.54rem] font-black text-white">
                {initials(actor.name)}
              </span>
              <span>
                <span className="block truncate font-mono text-[0.52rem] font-bold uppercase tracking-[0.06em] text-[var(--tr1-navy)]">
                  {actor.name}
                </span>
                <span className="block text-[0.58rem] text-muted-foreground">{actor.pharmacyCount} pharmacies</span>
              </span>
            </span>
          </button>
        )) : null}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function featureToPath(feature: GeometryFeature, viewport: ProjectionViewport) {
  if (feature.geometry.type === "Polygon") {
    return polygonToPath(feature.geometry.coordinates as number[][][], viewport);
  }
  return (feature.geometry.coordinates as number[][][][])
    .map((polygon) => polygonToPath(polygon, viewport))
    .join(" ");
}

function polygonToPath(polygon: number[][][], viewport: ProjectionViewport) {
  return polygon
    .map((ring) => ringToPath(ring, viewport))
    .join(" ");
}

function ringToPath(ring: number[][], viewport: ProjectionViewport) {
  return ring
    .map(([longitude, latitude], index) => {
      const point = projectCoordinate({ longitude, latitude }, viewport, MAP_WIDTH, MAP_HEIGHT);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ")
    .concat(" Z");
}

"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import franceDepartments from "@/data/france-departments-metro.json";
import { Card, CardContent } from "@/components/ui/card";
import type { PerformanceMapPharmacy, PerformanceMapTerritory } from "@/lib/performance-map";

const TILE_SIZE = 256;
const MIN_ZOOM = 4.6;
const MAX_ZOOM = 18;
const INITIAL_CAMERA: Camera = { longitude: 2.25, latitude: 46.45, zoom: 5.45 };
const TILE_URL = "https://tile.openstreetmap.org";

type Camera = { longitude: number; latitude: number; zoom: number };
type ScreenSize = { width: number; height: number };
type Point = { x: number; y: number };
type LngLat = { longitude: number; latitude: number };
type GeometryFeature = {
  properties: { code: string; nom: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};
type PointerSnapshot = Point & { id: number };
type PinchSnapshot = { distance: number; zoom: number; anchor: LngLat };
type MarkerShape = "circle" | "diamond" | "square" | "triangle";
type AlertTone = "none" | "open" | "overdue";

export function PerformanceSlippyMap({
  pharmacies,
  territories,
  selectedPharmacyId,
  selectedTerritoryId,
  onSelectPharmacy,
  onSelectTerritory,
}: {
  pharmacies: PerformanceMapPharmacy[];
  territories: PerformanceMapTerritory[];
  selectedPharmacyId: string | null;
  selectedTerritoryId: string | null;
  onSelectPharmacy: (id: string) => void;
  onSelectTerritory: (id: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, PointerSnapshot>());
  const dragLastRef = useRef<Point | null>(null);
  const pinchRef = useRef<PinchSnapshot | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [size, setSize] = useState<ScreenSize>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);

  const territoryByDepartment = useMemo(() => {
    const index = new Map<string, PerformanceMapTerritory>();
    territories.forEach((territory) => territory.departmentCodes.forEach((code) => {
      if (!index.has(code)) index.set(code, territory);
    }));
    return index;
  }, [territories]);

  const departmentFeatures = useMemo(
    () => (franceDepartments as { features: GeometryFeature[] }).features,
    [],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visibleTiles = useMemo(() => buildVisibleTiles(camera, size), [camera, size]);
  const overlayDepartments = useMemo(() => departmentFeatures.map((feature) => ({
    feature,
    d: geometryToScreenPath(feature.geometry, camera, size),
  })), [camera, departmentFeatures, size]);
  const franceMaskPath = useMemo(() => {
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const viewport = `M 0 0 H ${width} V ${height} H 0 Z`;
    const france = overlayDepartments.map(({ d }) => d).filter(Boolean).join(" ");
    return `${viewport} ${france}`;
  }, [overlayDepartments, size.height, size.width]);
  const pharmacyPoints = useMemo(() => pharmacies.flatMap((pharmacy) => {
    if (pharmacy.longitude == null || pharmacy.latitude == null) return [];
    return [{
      pharmacy,
      point: lngLatToScreen({ longitude: pharmacy.longitude, latitude: pharmacy.latitude }, camera, size),
    }];
  }), [camera, pharmacies, size]);

  const reset = () => setCamera(INITIAL_CAMERA);
  const fitTerritory = (territory: PerformanceMapTerritory) => {
    const codes = new Set(territory.departmentCodes);
    const bounds = getFeaturesBounds(departmentFeatures.filter((feature) => codes.has(feature.properties.code)));
    if (!bounds || !size.width || !size.height) return;
    setCamera(fitBounds(bounds, size, 46));
  };
  const focusPharmacy = (pharmacy: PerformanceMapPharmacy) => {
    if (pharmacy.longitude == null || pharmacy.latitude == null) return;
    setCamera({ longitude: pharmacy.longitude, latitude: pharmacy.latitude, zoom: Math.max(camera.zoom, 13.2) });
  };
  const zoomAround = (nextZoom: number, point: Point) => {
    setCamera((current) => cameraAroundPoint(current, clamp(nextZoom, MIN_ZOOM, MAX_ZOOM), point, size));
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const delta = clamp(-event.deltaY * 0.0022, -0.8, 0.8);
    zoomAround(camera.zoom + delta, point);
  };
  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as Element | null)?.closest("button,a")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAround(camera.zoom + 1, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element | null)?.closest("button,a")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragLastRef.current = { x: event.clientX, y: event.clientY };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      const midpointClient = midpoint(first, second);
      const rect = event.currentTarget.getBoundingClientRect();
      const midpointLocal = { x: midpointClient.x - rect.left, y: midpointClient.y - rect.top };
      pinchRef.current = {
        distance: distance(first, second),
        zoom: camera.zoom,
        anchor: screenToLngLat(midpointLocal, camera, size),
      };
      dragLastRef.current = null;
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const previous = pointersRef.current.get(event.pointerId)!;
    pointersRef.current.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
    if (Math.abs(previous.x - event.clientX) + Math.abs(previous.y - event.clientY) > 2) {
      suppressClickUntilRef.current = window.performance.now() + 240;
    }
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [first, second] = [...pointersRef.current.values()];
      const currentDistance = Math.max(1, distance(first, second));
      const nextZoom = clamp(
        pinchRef.current.zoom + Math.log2(currentDistance / Math.max(1, pinchRef.current.distance)),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const midpointClient = midpoint(first, second);
      const rect = event.currentTarget.getBoundingClientRect();
      const midpointLocal = { x: midpointClient.x - rect.left, y: midpointClient.y - rect.top };
      setCamera(cameraForAnchor(pinchRef.current.anchor, midpointLocal, nextZoom, size));
      return;
    }
    if (pointersRef.current.size === 1 && dragLastRef.current) {
      const dx = event.clientX - dragLastRef.current.x;
      const dy = event.clientY - dragLastRef.current.y;
      dragLastRef.current = { x: event.clientX, y: event.clientY };
      setCamera((current) => panCamera(current, dx, dy));
    }
  };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      dragLastRef.current = { x: remaining.x, y: remaining.y };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 0) {
      dragLastRef.current = null;
      pinchRef.current = null;
    }
  };

  return (
    <Card className="min-h-[42rem] overflow-hidden py-0">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-[var(--tr1-line)] bg-white/80 px-3 py-2 text-[0.64rem] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-[var(--tr1-navy)]">Secteurs</span>
            <LegendSwatch fill="#dcebe2" label="≥ 100 %" />
            <LegendSwatch fill="#f6e7cc" label="80–99 %" />
            <LegendSwatch fill="#f1d6d3" label="< 80 %" />
            <LegendSwatch fill="#eee8df" label="Sans objectif comparable" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--tr1-line)] pt-1.5">
            <span className="font-semibold text-[var(--tr1-navy)]">Pharmacies</span>
            <MarkerShapeLegend shape="circle" label="Client" />
            <MarkerShapeLegend shape="diamond" label="Prospect" />
            <MarkerShapeLegend shape="square" label="Dormante" />
            <MarkerShapeLegend shape="triangle" label="Perdue" />
            <span className="mx-0.5 h-3 w-px bg-[var(--tr1-line-strong)]" />
            <HealthLegend fill="#2f855a" label="Saine" />
            <HealthLegend fill="#d97706" label="À surveiller" />
            <HealthLegend fill="#c2413d" label="À risque" />
            <HealthLegend fill="#8d9297" label="Dormante / sans signal" />
            <span className="mx-0.5 h-3 w-px bg-[var(--tr1-line-strong)]" />
            <AlertLegend tone="open" label="Action ouverte" />
            <AlertLegend tone="overdue" label="En retard" />
            <span className="whitespace-nowrap">Taille = priorité</span>
          </div>
        </div>
        <div
          aria-label="Carte interactive de performance du réseau"
          className="relative min-h-[36rem] flex-1 touch-none select-none overflow-hidden bg-[#f5efe4] cursor-grab active:cursor-grabbing"
          onDoubleClick={onDoubleClick}
          onPointerCancel={finishPointer}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onWheel={onWheel}
          ref={viewportRef}
        >
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
            {visibleTiles.map((tile) => (
              <div
                className="absolute bg-cover bg-center bg-no-repeat"
                key={tile.key}
                style={{
                  backgroundImage: `url(${TILE_URL}/${tile.zoom}/${tile.x}/${tile.y}.png)`,
                  height: tile.size,
                  left: tile.left,
                  top: tile.top,
                  width: tile.size,
                }}
              />
            ))}
          </div>
          <svg className="absolute inset-0 z-10 h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}>
            <path d={franceMaskPath} fill="#f5efe4" fillRule="evenodd" pointerEvents="none" />
            {overlayDepartments.map(({ feature, d }) => {
              const territory = territoryByDepartment.get(feature.properties.code);
              const selected = territory?.id === selectedTerritoryId;
              if (!territory || !d) return null;
              return (
                <path
                  aria-label={`${feature.properties.nom} · ${territory.name}`}
                  className="cursor-pointer"
                  d={d}
                  fill={territoryFill(territory.objectiveAttainment)}
                  fillOpacity={selected ? 0.34 : 0.2}
                  key={feature.properties.code}
                  onClick={() => {
                    if (window.performance.now() < suppressClickUntilRef.current) return;
                    onSelectTerritory(territory.id);
                    fitTerritory(territory);
                  }}
                  pointerEvents="auto"
                  stroke={selected ? "#e67929" : "#c9aa87"}
                  strokeOpacity={selected ? 0.95 : 0.75}
                  strokeWidth={selected ? 3 : 1.2}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 z-20">
            {pharmacyPoints.map(({ pharmacy, point }) => {
              if (point.x < -40 || point.y < -40 || point.x > size.width + 40 || point.y > size.height + 40) return null;
              const selected = pharmacy.id === selectedPharmacyId;
              const marker = pharmacyMarkerVisual(pharmacy);
              const markerSize = pharmacyMarkerSize(pharmacy.priorityLevel, selected);
              const alertTone: AlertTone = pharmacy.overdueAlerts > 0 ? "overdue" : pharmacy.openAlerts > 0 ? "open" : "none";
              return (
                <button
                  aria-label={`${pharmacy.name} · ${pharmacy.commercialStatusLabel} · ${pharmacy.healthStatusLabel} · priorité ${pharmacy.priorityLevelLabel}${pharmacy.openAlerts ? ` · ${pharmacy.openAlerts} action(s) ouverte(s)` : ""}`}
                  className={`group pointer-events-auto absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center bg-transparent p-0 transition-transform duration-150 hover:scale-125 focus-visible:scale-125 focus-visible:outline-none ${selected ? "z-30 scale-125" : "z-10"}`}
                  key={pharmacy.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.performance.now() < suppressClickUntilRef.current) return;
                    onSelectPharmacy(pharmacy.id);
                    focusPharmacy(pharmacy);
                  }}
                  style={{
                    boxShadow: pharmacyMarkerShadow(alertTone, selected),
                    height: markerSize,
                    left: point.x,
                    top: point.y,
                    width: markerSize,
                  }}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="block h-[74%] w-[74%] border border-white/90 shadow-[0_1px_3px_rgba(7,20,33,.28)]"
                    style={{
                      backgroundColor: marker.color,
                      borderRadius: marker.shape === "circle" ? "999px" : marker.shape === "square" ? "22%" : undefined,
                      clipPath: markerClipPath(marker.shape),
                    }}
                  />
                  <span className="pointer-events-none absolute left-1/2 top-0 z-50 hidden min-w-[11.5rem] -translate-x-1/2 -translate-y-[calc(100%+0.65rem)] rounded-lg border border-[#0b1e32]/12 bg-white/95 px-2.5 py-2 text-left text-[0.65rem] leading-4 text-[#445265] shadow-[0_10px_28px_rgba(7,20,33,.2)] backdrop-blur group-hover:block group-focus-visible:block">
                    <strong className="block truncate text-[0.7rem] text-[var(--tr1-navy)]">{pharmacy.name}</strong>
                    <span className="block">{pharmacy.commercialStatusLabel} · {pharmacy.healthStatusLabel}</span>
                    <span className="block">Priorité {pharmacy.priorityLevelLabel} · {formatCompactCurrency(pharmacy.revenueHt)}</span>
                    {pharmacy.overdueAlerts > 0 ? <span className="block font-semibold text-red-700">{pharmacy.overdueAlerts} action(s) en retard</span> : pharmacy.openAlerts > 0 ? <span className="block font-semibold text-amber-700">{pharmacy.openAlerts} action(s) ouverte(s)</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="absolute right-3 top-3 z-30 flex flex-col overflow-hidden rounded-xl border border-[#0b1e32]/15 bg-white/95 shadow-[0_10px_30px_rgba(7,20,33,.16)] backdrop-blur">
            <MapButton label="Zoom avant" onClick={() => zoomAround(camera.zoom + 1, centerPoint(size))}>+</MapButton>
            <span className="grid h-7 min-w-11 place-items-center border-y border-[#0b1e32]/10 px-1 font-mono text-[0.55rem] font-black text-[#667384]">z{camera.zoom.toFixed(1)}</span>
            <MapButton label="Zoom arrière" onClick={() => zoomAround(camera.zoom - 1, centerPoint(size))}>−</MapButton>
            <MapButton label="Revenir à la France entière" onClick={reset}>↺</MapButton>
          </div>
          <div className="absolute bottom-2 left-2 z-30 rounded-md bg-white/90 px-2 py-1 text-[0.58rem] font-medium text-[#445265] shadow-sm backdrop-blur">Glisser pour déplacer · molette / pincement pour zoomer</div>
          <a className="absolute bottom-2 right-2 z-30 rounded-md bg-white/90 px-2 py-1 text-[0.55rem] text-[#445265] shadow-sm backdrop-blur hover:underline" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a>
          {!pharmacies.length ? <div className="absolute inset-0 z-40 grid place-items-center bg-white/60 p-8 text-center text-sm text-muted-foreground backdrop-blur-[1px]">Aucune pharmacie ne correspond aux filtres sélectionnés.</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return <button aria-label={label} className="grid size-10 place-items-center bg-white text-base font-black text-[#0b1e32] transition hover:bg-[#f7efe5]" onClick={(event) => { event.stopPropagation(); onClick(); }} type="button">{children}</button>;
}
function LegendSwatch({ fill, label }: { fill: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-black/10" style={{ backgroundColor: fill }} />{label}</span>;
}
function MarkerShapeLegend({ shape, label }: { shape: MarkerShape; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="grid size-3.5 place-items-center"><span className="block size-3 bg-[#0b1e32]" style={{ borderRadius: shape === "circle" ? "999px" : shape === "square" ? "22%" : undefined, clipPath: markerClipPath(shape) }} /></span>{label}</span>;
}
function HealthLegend({ fill, label }: { fill: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(7,20,33,.12)]" style={{ backgroundColor: fill }} />{label}</span>;
}
function AlertLegend({ tone, label }: { tone: Exclude<AlertTone, "none">; label: string }) {
  const color = tone === "overdue" ? "#c2413d" : "#d97706";
  return <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-white" style={{ boxShadow: `0 0 0 2px ${color}` }} />{label}</span>;
}
function territoryFill(value: number | null) {
  if (value == null) return "#eee8df";
  if (value >= 100) return "#dcebe2";
  if (value >= 80) return "#f6e7cc";
  return "#f1d6d3";
}
function pharmacyMarkerVisual(pharmacy: PerformanceMapPharmacy): { shape: MarkerShape; color: string } {
  const prospectStatuses = new Set(["targeted", "qualified", "contacted", "appointment_scheduled", "offer_sent", "pending_order"]);
  const shape: MarkerShape = pharmacy.commercialStatus === "lost"
    ? "triangle"
    : pharmacy.commercialStatus === "dormant"
      ? "square"
      : prospectStatuses.has(pharmacy.commercialStatus)
        ? "diamond"
        : "circle";
  return { shape, color: healthColor(pharmacy.healthStatus) };
}
function healthColor(status: string) {
  if (status === "healthy") return "#2f855a";
  if (status === "reorder_expected" || status === "awaiting_first_reorder") return "#2563a6";
  if (status === "reorder_due_soon") return "#d97706";
  if (status === "at_risk" || status === "reorder_overdue") return "#c2413d";
  if (status === "dormant") return "#8d9297";
  return "#b7ada2";
}
function markerClipPath(shape: MarkerShape) {
  if (shape === "diamond") return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
  if (shape === "triangle") return "polygon(50% 0, 100% 100%, 0 100%)";
  if (shape === "square") return "inset(0 round 22%)";
  return "circle(50% at 50% 50%)";
}
function pharmacyMarkerSize(priority: string, selected: boolean) {
  const base = priority === "strategic" ? 24 : priority === "high" ? 20 : priority === "low" ? 13 : 16;
  return selected ? base + 4 : base;
}
function pharmacyMarkerShadow(alertTone: AlertTone, selected: boolean) {
  const baseShadow = "0 2px 7px rgba(7,20,33,.28)";
  const alertRing = alertTone === "overdue" ? "0 0 0 3px #c2413d" : alertTone === "open" ? "0 0 0 3px #d97706" : "";
  const selectedRing = selected ? "0 0 0 6px rgba(230,121,41,.32)" : "";
  return [alertRing, selectedRing, baseShadow].filter(Boolean).join(", ");
}
function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
function buildVisibleTiles(camera: Camera, size: ScreenSize) {
  if (!size.width || !size.height) return [];
  const tileZoom = Math.max(0, Math.min(19, Math.floor(camera.zoom)));
  const fractionalScale = 2 ** (camera.zoom - tileZoom);
  const center = lngLatToWorld({ longitude: camera.longitude, latitude: camera.latitude }, tileZoom);
  const viewportWidth = size.width / fractionalScale;
  const viewportHeight = size.height / fractionalScale;
  const leftWorld = center.x - viewportWidth / 2;
  const topWorld = center.y - viewportHeight / 2;
  const startX = Math.floor(leftWorld / TILE_SIZE) - 1;
  const endX = Math.floor((leftWorld + viewportWidth) / TILE_SIZE) + 1;
  const startY = Math.floor(topWorld / TILE_SIZE) - 1;
  const endY = Math.floor((topWorld + viewportHeight) / TILE_SIZE) + 1;
  const tilesPerAxis = 2 ** tileZoom;
  const tiles: Array<{ key: string; zoom: number; x: number; y: number; left: number; top: number; size: number }> = [];
  for (let rawY = startY; rawY <= endY; rawY += 1) {
    if (rawY < 0 || rawY >= tilesPerAxis) continue;
    for (let rawX = startX; rawX <= endX; rawX += 1) {
      const wrappedX = ((rawX % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
      tiles.push({ key: `${tileZoom}:${rawX}:${rawY}`, zoom: tileZoom, x: wrappedX, y: rawY, left: (rawX * TILE_SIZE - leftWorld) * fractionalScale, top: (rawY * TILE_SIZE - topWorld) * fractionalScale, size: TILE_SIZE * fractionalScale + 0.6 });
    }
  }
  return tiles;
}
function geometryToScreenPath(geometry: GeometryFeature["geometry"], camera: Camera, size: ScreenSize) {
  if (!size.width || !size.height) return "";
  if (geometry.type === "Polygon") return polygonToScreenPath(geometry.coordinates as number[][][], camera, size);
  return (geometry.coordinates as number[][][][]).map((polygon) => polygonToScreenPath(polygon, camera, size)).join(" ");
}
function polygonToScreenPath(polygon: number[][][], camera: Camera, size: ScreenSize) {
  return polygon.map((ring) => ring.map(([longitude, latitude], index) => {
    const point = lngLatToScreen({ longitude, latitude }, camera, size);
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ").concat(" Z")).join(" ");
}
function getFeaturesBounds(features: GeometryFeature[]) {
  let west = Infinity; let east = -Infinity; let south = Infinity; let north = -Infinity;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      west = Math.min(west, value[0]); east = Math.max(east, value[0]); south = Math.min(south, value[1]); north = Math.max(north, value[1]); return;
    }
    value.forEach(visit);
  };
  features.forEach((feature) => visit(feature.geometry.coordinates));
  if (![west, east, south, north].every(Number.isFinite)) return null;
  return { west, east, south, north };
}
function fitBounds(bounds: { west: number; east: number; south: number; north: number }, size: ScreenSize, padding: number): Camera {
  const northWest = lngLatToWorld({ longitude: bounds.west, latitude: bounds.north }, 0);
  const southEast = lngLatToWorld({ longitude: bounds.east, latitude: bounds.south }, 0);
  const widthAtZero = Math.max(0.000001, Math.abs(southEast.x - northWest.x));
  const heightAtZero = Math.max(0.000001, Math.abs(southEast.y - northWest.y));
  const availableWidth = Math.max(80, size.width - padding * 2);
  const availableHeight = Math.max(80, size.height - padding * 2);
  const zoom = clamp(Math.log2(Math.min(availableWidth / widthAtZero, availableHeight / heightAtZero)), MIN_ZOOM, 12.5);
  const center = worldToLngLat({ x: (northWest.x + southEast.x) / 2, y: (northWest.y + southEast.y) / 2 }, 0);
  return { longitude: center.longitude, latitude: center.latitude, zoom };
}
function cameraAroundPoint(current: Camera, nextZoom: number, point: Point, size: ScreenSize) {
  return cameraForAnchor(screenToLngLat(point, current, size), point, nextZoom, size);
}
function cameraForAnchor(anchor: LngLat, point: Point, zoom: number, size: ScreenSize): Camera {
  const anchorWorld = lngLatToWorld(anchor, zoom);
  const center = worldToLngLat({ x: anchorWorld.x - (point.x - size.width / 2), y: anchorWorld.y - (point.y - size.height / 2) }, zoom);
  return { longitude: normalizeLongitude(center.longitude), latitude: clamp(center.latitude, -85, 85), zoom };
}
function panCamera(camera: Camera, dx: number, dy: number): Camera {
  const center = lngLatToWorld({ longitude: camera.longitude, latitude: camera.latitude }, camera.zoom);
  const next = worldToLngLat({ x: center.x - dx, y: center.y - dy }, camera.zoom);
  return { longitude: normalizeLongitude(next.longitude), latitude: clamp(next.latitude, -85, 85), zoom: camera.zoom };
}
function lngLatToScreen(point: LngLat, camera: Camera, size: ScreenSize) {
  const world = lngLatToWorld(point, camera.zoom);
  const center = lngLatToWorld({ longitude: camera.longitude, latitude: camera.latitude }, camera.zoom);
  const worldSize = TILE_SIZE * 2 ** camera.zoom;
  let dx = world.x - center.x;
  if (dx > worldSize / 2) dx -= worldSize;
  if (dx < -worldSize / 2) dx += worldSize;
  return { x: size.width / 2 + dx, y: size.height / 2 + world.y - center.y };
}
function screenToLngLat(point: Point, camera: Camera, size: ScreenSize) {
  const center = lngLatToWorld({ longitude: camera.longitude, latitude: camera.latitude }, camera.zoom);
  return worldToLngLat({ x: center.x + point.x - size.width / 2, y: center.y + point.y - size.height / 2 }, camera.zoom);
}
function lngLatToWorld(point: LngLat, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = clamp(point.latitude, -85.05112878, 85.05112878);
  const sin = Math.sin((latitude * Math.PI) / 180);
  return { x: ((normalizeLongitude(point.longitude) + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}
function worldToLngLat(point: Point, zoom: number): LngLat {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (point.x / scale) * 360 - 180;
  const mercatorY = 0.5 - point.y / scale;
  const latitude = 90 - (360 * Math.atan(Math.exp(-mercatorY * 2 * Math.PI))) / Math.PI;
  return { longitude, latitude };
}
function centerPoint(size: ScreenSize): Point { return { x: size.width / 2, y: size.height / 2 }; }
function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
function normalizeLongitude(value: number) { return ((((value + 180) % 360) + 360) % 360) - 180; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
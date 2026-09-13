"use client";

import { useEffect } from "react";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 7;
const ZOOM_FACTOR = 1.35;
const ANIMATION_MS = 240;

type ViewBoxState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type PinchState = {
  distance: number;
  viewport: ViewBoxState;
  anchorX: number;
  anchorY: number;
  ratioX: number;
  ratioY: number;
};

type MarkerBasePoint = {
  x: number;
  y: number;
  left: string;
  top: string;
};

const FULL_VIEW: ViewBoxState = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };

export function PerformanceMapZoomEnhancer() {
  useEffect(() => {
    let detachCurrent: (() => void) | null = null;
    let currentSvg: SVGSVGElement | null = null;

    const ensureEnhancer = () => {
      if (currentSvg?.isConnected) return;
      detachCurrent?.();
      detachCurrent = null;
      currentSvg = null;

      const svg = document.querySelector<SVGSVGElement>('svg[aria-label="Carte de performance du réseau"]');
      if (!svg) return;

      currentSvg = svg;
      detachCurrent = enhancePerformanceMap(svg);
    };

    ensureEnhancer();
    const observer = new MutationObserver(ensureEnhancer);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      detachCurrent?.();
    };
  }, []);

  return null;
}

function enhancePerformanceMap(svg: SVGSVGElement) {
  const container = svg.parentElement;
  if (!(container instanceof HTMLElement)) return () => undefined;

  const markerLayer = Array.from(container.children).find(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.classList.contains("pointer-events-none") &&
      element.classList.contains("absolute") &&
      element.classList.contains("inset-0"),
  );
  if (!markerLayer) return () => undefined;

  const markerBasePoints = new Map<HTMLButtonElement, MarkerBasePoint>();
  markerLayer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const left = parseFloat(button.style.left);
    const top = parseFloat(button.style.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    markerBasePoints.set(button, {
      x: (left / 100) * MAP_WIDTH,
      y: (top / 100) * MAP_HEIGHT,
      left: button.style.left,
      top: button.style.top,
    });
  });

  const controls = createControls();
  container.appendChild(controls.root);

  const originalTouchAction = container.style.touchAction;
  const originalCursor = container.style.cursor;
  const originalViewBox = svg.getAttribute("viewBox");
  container.style.touchAction = "none";

  let viewport: ViewBoxState = { ...FULL_VIEW };
  const pointers = new Map<number, PointerPoint>();
  let pinch: PinchState | null = null;
  let dragLast: PointerPoint | null = null;
  let movedDuringGesture = false;
  let suppressClickUntil = 0;
  let animationFrame: number | null = null;

  const aspectRatio = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    return width > 0 && height > 0 ? width / height : MAP_WIDTH / MAP_HEIGHT;
  };

  const zoomLevel = (state = viewport) => MAP_WIDTH / state.width;

  const clampViewport = (next: ViewBoxState): ViewBoxState => {
    const ratio = aspectRatio();
    const minWidth = MAP_WIDTH / MAX_ZOOM;
    let width = clamp(next.width, minWidth, MAP_WIDTH);
    let height = width / ratio;

    if (height > MAP_HEIGHT) {
      height = MAP_HEIGHT;
      width = height * ratio;
    }

    if (width >= MAP_WIDTH - 0.01 && height >= MAP_HEIGHT - 0.01) return { ...FULL_VIEW };

    return {
      x: clamp(next.x, 0, MAP_WIDTH - width),
      y: clamp(next.y, 0, MAP_HEIGHT - height),
      width,
      height,
    };
  };

  const updateMarkers = () => {
    markerBasePoints.forEach((base, button) => {
      const left = ((base.x - viewport.x) / viewport.width) * 100;
      const top = ((base.y - viewport.y) / viewport.height) * 100;
      button.style.left = `${left}%`;
      button.style.top = `${top}%`;
      button.style.visibility = left < -4 || left > 104 || top < -4 || top > 104 ? "hidden" : "visible";
    });
  };

  const render = (next: ViewBoxState) => {
    viewport = clampViewport(next);
    svg.setAttribute("viewBox", `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`);
    updateMarkers();

    const zoom = zoomLevel();
    controls.scale.textContent = `${zoom.toFixed(zoom < 2 ? 1 : 0)}×`;
    controls.zoomOut.disabled = zoom <= MIN_ZOOM + 0.001;
    controls.zoomIn.disabled = zoom >= MAX_ZOOM - 0.001;
    container.style.cursor = zoom > MIN_ZOOM ? "grab" : "default";
  };

  const animateTo = (target: ViewBoxState) => {
    if (animationFrame != null) cancelAnimationFrame(animationFrame);
    const from = { ...viewport };
    const to = clampViewport(target);
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = clamp((now - startedAt) / ANIMATION_MS, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      render({
        x: lerp(from.x, to.x, eased),
        y: lerp(from.y, to.y, eased),
        width: lerp(from.width, to.width, eased),
        height: lerp(from.height, to.height, eased),
      });
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
      else animationFrame = null;
    };

    animationFrame = requestAnimationFrame(tick);
  };

  const cancelAnimation = () => {
    if (animationFrame != null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  };

  const localPoint = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const mapPointAtClient = (clientX: number, clientY: number, state = viewport) => {
    const point = localPoint(clientX, clientY);
    return {
      x: state.x + (point.x / Math.max(point.width, 1)) * state.width,
      y: state.y + (point.y / Math.max(point.height, 1)) * state.height,
      ratioX: point.x / Math.max(point.width, 1),
      ratioY: point.y / Math.max(point.height, 1),
    };
  };

  const zoomAround = (factor: number, clientX: number, clientY: number, animate = false) => {
    const anchor = mapPointAtClient(clientX, clientY);
    const targetWidth = clamp(viewport.width / factor, MAP_WIDTH / MAX_ZOOM, MAP_WIDTH);
    const targetHeight = targetWidth / aspectRatio();
    const target = {
      x: anchor.x - anchor.ratioX * targetWidth,
      y: anchor.y - anchor.ratioY * targetHeight,
      width: targetWidth,
      height: targetHeight,
    };
    if (animate) animateTo(target);
    else render(target);
  };

  const reset = () => animateTo({ ...FULL_VIEW });

  const fitBounds = (bounds: { x: number; y: number; width: number; height: number }, maxZoom = 5.5) => {
    const ratio = aspectRatio();
    const horizontalPadding = Math.max(bounds.width * 0.18, 18);
    const verticalPadding = Math.max(bounds.height * 0.18, 18);
    let width = Math.max(bounds.width + horizontalPadding * 2, MAP_WIDTH / maxZoom);
    let height = Math.max(bounds.height + verticalPadding * 2, MAP_HEIGHT / maxZoom);

    if (width / height > ratio) height = width / ratio;
    else width = height * ratio;

    width = Math.min(width, MAP_WIDTH);
    height = Math.min(height, MAP_HEIGHT);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    animateTo({
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    });
  };

  const focusPharmacy = (button: HTMLButtonElement) => {
    const base = markerBasePoints.get(button);
    if (!base) return;
    const ratio = aspectRatio();
    const width = MAP_WIDTH / 4.4;
    const height = width / ratio;
    animateTo({
      x: base.x - width / 2,
      y: base.y - height / 2,
      width,
      height,
    });
  };

  const focusTerritory = (path: SVGPathElement) => {
    const label = path.getAttribute("aria-label") ?? "";
    const separatorIndex = label.indexOf(" · ");
    const territoryName = separatorIndex >= 0 ? label.slice(separatorIndex + 3) : null;
    const matchingPaths = territoryName
      ? Array.from(svg.querySelectorAll<SVGPathElement>("path")).filter((candidate) =>
          (candidate.getAttribute("aria-label") ?? "").endsWith(` · ${territoryName}`),
        )
      : [path];

    const boxes = matchingPaths.map((candidate) => candidate.getBBox());
    if (!boxes.length) return;

    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    fitBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    cancelAnimation();
    const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
    zoomAround(factor, event.clientX, event.clientY);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if ((event.target as Element | null)?.closest('[data-performance-map-zoom-controls="true"]')) return;
    event.preventDefault();
    zoomAround(ZOOM_FACTOR, event.clientX, event.clientY, true);
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Element | null;
    if (target?.closest('[data-performance-map-zoom-controls="true"]')) return;
    if (target?.closest("button") && markerLayer.contains(target.closest("button"))) return;

    cancelAnimation();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    container.setPointerCapture?.(event.pointerId);
    movedDuringGesture = false;

    if (pointers.size === 1) {
      dragLast = { x: event.clientX, y: event.clientY };
      pinch = null;
      if (zoomLevel() > MIN_ZOOM) container.style.cursor = "grabbing";
    } else if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const center = midpoint(first, second);
      const anchor = mapPointAtClient(center.x, center.y);
      pinch = {
        distance: distance(first, second),
        viewport: { ...viewport },
        anchorX: anchor.x,
        anchorY: anchor.y,
        ratioX: anchor.ratioX,
        ratioY: anchor.ratioY,
      };
      dragLast = null;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId)!;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (Math.abs(previous.x - event.clientX) + Math.abs(previous.y - event.clientY) > 2) movedDuringGesture = true;

    if (pointers.size >= 2 && pinch) {
      event.preventDefault();
      const [first, second] = [...pointers.values()];
      const currentDistance = Math.max(1, distance(first, second));
      const scaleFactor = currentDistance / Math.max(1, pinch.distance);
      const width = clamp(pinch.viewport.width / scaleFactor, MAP_WIDTH / MAX_ZOOM, MAP_WIDTH);
      const height = width / aspectRatio();
      const center = midpoint(first, second);
      const point = localPoint(center.x, center.y);
      const ratioX = point.x / Math.max(point.width, 1);
      const ratioY = point.y / Math.max(point.height, 1);
      render({
        x: pinch.anchorX - ratioX * width,
        y: pinch.anchorY - ratioY * height,
        width,
        height,
      });
      return;
    }

    if (pointers.size === 1 && dragLast && zoomLevel() > MIN_ZOOM) {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const dx = event.clientX - dragLast.x;
      const dy = event.clientY - dragLast.y;
      dragLast = { x: event.clientX, y: event.clientY };
      render({
        ...viewport,
        x: viewport.x - (dx / Math.max(rect.width, 1)) * viewport.width,
        y: viewport.y - (dy / Math.max(rect.height, 1)) * viewport.height,
      });
    }
  };

  const finishPointer = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try {
      container.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }

    if (movedDuringGesture) suppressClickUntil = performance.now() + 250;

    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      dragLast = { ...remaining };
      pinch = null;
    } else if (pointers.size === 0) {
      dragLast = null;
      pinch = null;
      container.style.cursor = zoomLevel() > MIN_ZOOM ? "grab" : "default";
    }
  };

  const onClickCapture = (event: MouseEvent) => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || target.closest('[data-performance-map-zoom-controls="true"]')) return;

    const pharmacyButton = target.closest("button");
    if (pharmacyButton instanceof HTMLButtonElement && markerLayer.contains(pharmacyButton)) {
      focusPharmacy(pharmacyButton);
      return;
    }

    if (target instanceof SVGPathElement && target.classList.contains("cursor-pointer")) focusTerritory(target);
  };

  const onResize = () => render(viewport);

  controls.zoomIn.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    zoomAround(ZOOM_FACTOR, rect.left + rect.width / 2, rect.top + rect.height / 2, true);
  });
  controls.zoomOut.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    zoomAround(1 / ZOOM_FACTOR, rect.left + rect.width / 2, rect.top + rect.height / 2, true);
  });
  controls.reset.addEventListener("click", reset);

  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("dblclick", onDoubleClick);
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", finishPointer);
  container.addEventListener("pointercancel", finishPointer);
  container.addEventListener("click", onClickCapture, true);
  container.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);

  render({ ...FULL_VIEW });

  return () => {
    cancelAnimation();
    container.removeEventListener("wheel", onWheel);
    container.removeEventListener("dblclick", onDoubleClick);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", finishPointer);
    container.removeEventListener("pointercancel", finishPointer);
    container.removeEventListener("click", onClickCapture, true);
    container.removeEventListener("click", onClick);
    window.removeEventListener("resize", onResize);
    controls.root.remove();
    if (originalViewBox) svg.setAttribute("viewBox", originalViewBox);
    else svg.removeAttribute("viewBox");
    markerBasePoints.forEach((base, button) => {
      button.style.left = base.left;
      button.style.top = base.top;
      button.style.removeProperty("visibility");
    });
    container.style.touchAction = originalTouchAction;
    container.style.cursor = originalCursor;
  };
}

function createControls() {
  const root = document.createElement("div");
  root.dataset.performanceMapZoomControls = "true";
  root.className =
    "absolute right-3 top-3 z-30 flex flex-col overflow-hidden rounded-xl border border-[#0b1e32]/15 bg-white/95 shadow-[0_10px_30px_rgba(7,20,33,.16)] backdrop-blur";

  const zoomIn = controlButton("+", "Zoom avant");
  const zoomOut = controlButton("−", "Zoom arrière");
  const reset = controlButton("↺", "Revenir à la France entière");
  const scale = document.createElement("span");
  scale.className =
    "grid h-7 min-w-11 place-items-center border-y border-[#0b1e32]/10 px-1 font-mono text-[0.55rem] font-black text-[#667384]";
  scale.setAttribute("aria-live", "polite");

  root.append(zoomIn, scale, zoomOut, reset);
  return { root, zoomIn, zoomOut, reset, scale };
}

function controlButton(text: string, label: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.className =
    "grid size-9 place-items-center bg-white font-mono text-base font-black text-[#0b1e32] transition hover:bg-[#f5efe4] disabled:cursor-not-allowed disabled:opacity-35";
  return button;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function midpoint(first: PointerPoint, second: PointerPoint) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first: PointerPoint, second: PointerPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

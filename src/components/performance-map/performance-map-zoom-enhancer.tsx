"use client";

import { useEffect } from "react";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 640;
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_FACTOR = 1.35;
const TRANSITION_MS = 220;

type TransformState = {
  scale: number;
  x: number;
  y: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type PinchState = {
  distance: number;
  contentX: number;
  contentY: number;
};

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
      element !== svg &&
      element.classList.contains("pointer-events-none") &&
      element.classList.contains("absolute") &&
      element.classList.contains("inset-0"),
  );
  if (!markerLayer) return () => undefined;

  const controls = createControls();
  container.appendChild(controls.root);

  const originalTouchAction = container.style.touchAction;
  const originalCursor = container.style.cursor;
  container.style.touchAction = "none";
  container.style.cursor = "grab";

  let state: TransformState = { scale: MIN_SCALE, x: 0, y: 0 };
  const pointers = new Map<number, PointerPoint>();
  let pinch: PinchState | null = null;
  let dragLast: PointerPoint | null = null;
  let movedDuringGesture = false;
  let suppressClickUntil = 0;
  let transitionTimer: number | null = null;

  const setTransition = (enabled: boolean) => {
    const value = enabled ? `transform ${TRANSITION_MS}ms cubic-bezier(.2,.8,.2,1)` : "none";
    svg.style.transition = value;
    markerLayer.style.transition = value;
    if (transitionTimer != null) window.clearTimeout(transitionTimer);
    if (enabled) {
      transitionTimer = window.setTimeout(() => {
        svg.style.transition = "none";
        markerLayer.style.transition = "none";
        transitionTimer = null;
      }, TRANSITION_MS);
    }
  };

  const clampState = (next: TransformState): TransformState => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (!width || !height || scale <= MIN_SCALE) return { scale: MIN_SCALE, x: 0, y: 0 };

    const minX = width - width * scale;
    const minY = height - height * scale;
    return {
      scale,
      x: clamp(next.x, minX, 0),
      y: clamp(next.y, minY, 0),
    };
  };

  const render = (next: TransformState, animate = false) => {
    state = clampState(next);
    setTransition(animate);
    const transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    svg.style.transformOrigin = "0 0";
    markerLayer.style.transformOrigin = "0 0";
    svg.style.transform = transform;
    markerLayer.style.transform = transform;
    controls.scale.textContent = `${Math.round(state.scale * 100)} %`;
    controls.zoomOut.disabled = state.scale <= MIN_SCALE + 0.001;
    controls.zoomIn.disabled = state.scale >= MAX_SCALE - 0.001;
    container.style.cursor = state.scale > MIN_SCALE ? "grab" : "default";
  };

  const localPoint = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const zoomAround = (targetScale: number, point: PointerPoint, animate = false) => {
    const scale = clamp(targetScale, MIN_SCALE, MAX_SCALE);
    const ratio = scale / state.scale;
    render(
      {
        scale,
        x: point.x - (point.x - state.x) * ratio,
        y: point.y - (point.y - state.y) * ratio,
      },
      animate,
    );
  };

  const reset = (animate = true) => render({ scale: MIN_SCALE, x: 0, y: 0 }, animate);

  const focusBaseBounds = (bounds: { x: number; y: number; width: number; height: number }, maxScale = 4.5) => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height || bounds.width <= 0 || bounds.height <= 0) return;

    const pixelBounds = {
      x: (bounds.x / MAP_WIDTH) * width,
      y: (bounds.y / MAP_HEIGHT) * height,
      width: (bounds.width / MAP_WIDTH) * width,
      height: (bounds.height / MAP_HEIGHT) * height,
    };
    const padding = 0.72;
    const targetScale = clamp(
      Math.min((width * padding) / pixelBounds.width, (height * padding) / pixelBounds.height),
      1.5,
      maxScale,
    );
    const centerX = pixelBounds.x + pixelBounds.width / 2;
    const centerY = pixelBounds.y + pixelBounds.height / 2;
    render(
      {
        scale: targetScale,
        x: width / 2 - centerX * targetScale,
        y: height / 2 - centerY * targetScale,
      },
      true,
    );
  };

  const focusPharmacy = (button: HTMLButtonElement) => {
    const left = parseFloat(button.style.left);
    const top = parseFloat(button.style.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const baseX = (left / 100) * width;
    const baseY = (top / 100) * height;
    const targetScale = Math.max(state.scale, 3.4);
    render(
      {
        scale: targetScale,
        x: width / 2 - baseX * targetScale,
        y: height / 2 - baseY * targetScale,
      },
      true,
    );
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
    focusBaseBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    setTransition(false);
    const point = localPoint(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.14 : 1 / 1.14;
    zoomAround(state.scale * factor, point);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if ((event.target as Element | null)?.closest('[data-performance-map-zoom-controls="true"]')) return;
    event.preventDefault();
    zoomAround(state.scale * ZOOM_FACTOR, localPoint(event.clientX, event.clientY), true);
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Element | null;
    if (target?.closest("button")) return;

    setTransition(false);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    container.setPointerCapture?.(event.pointerId);
    movedDuringGesture = false;

    if (pointers.size === 1) {
      dragLast = { x: event.clientX, y: event.clientY };
      pinch = null;
      if (state.scale > MIN_SCALE) container.style.cursor = "grabbing";
    } else if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const centerClient = midpoint(first, second);
      const center = localPoint(centerClient.x, centerClient.y);
      pinch = {
        distance: distance(first, second),
        contentX: (center.x - state.x) / state.scale,
        contentY: (center.y - state.y) / state.scale,
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
      const centerClient = midpoint(first, second);
      const center = localPoint(centerClient.x, centerClient.y);
      const nextScale = clamp(state.scale * (currentDistance / Math.max(1, pinch.distance)), MIN_SCALE, MAX_SCALE);
      render({
        scale: nextScale,
        x: center.x - pinch.contentX * nextScale,
        y: center.y - pinch.contentY * nextScale,
      });
      pinch = {
        distance: currentDistance,
        contentX: (center.x - state.x) / state.scale,
        contentY: (center.y - state.y) / state.scale,
      };
      return;
    }

    if (pointers.size === 1 && dragLast && state.scale > MIN_SCALE) {
      event.preventDefault();
      const dx = event.clientX - dragLast.x;
      const dy = event.clientY - dragLast.y;
      dragLast = { x: event.clientX, y: event.clientY };
      render({ ...state, x: state.x + dx, y: state.y + dy });
    }
  };

  const finishPointer = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try {
      container.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }

    if (movedDuringGesture) suppressClickUntil = window.performance.now() + 250;

    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      dragLast = { ...remaining };
      pinch = null;
    } else if (pointers.size === 0) {
      dragLast = null;
      pinch = null;
      container.style.cursor = state.scale > MIN_SCALE ? "grab" : "default";
    }
  };

  const onClickCapture = (event: MouseEvent) => {
    if (window.performance.now() < suppressClickUntil) {
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

  const onResize = () => render(state);

  controls.zoomIn.addEventListener("click", () => {
    zoomAround(
      state.scale * ZOOM_FACTOR,
      { x: container.clientWidth / 2, y: container.clientHeight / 2 },
      true,
    );
  });
  controls.zoomOut.addEventListener("click", () => {
    zoomAround(
      state.scale / ZOOM_FACTOR,
      { x: container.clientWidth / 2, y: container.clientHeight / 2 },
      true,
    );
  });
  controls.reset.addEventListener("click", () => reset(true));

  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("dblclick", onDoubleClick);
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", finishPointer);
  container.addEventListener("pointercancel", finishPointer);
  container.addEventListener("click", onClickCapture, true);
  container.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);

  render(state);

  return () => {
    if (transitionTimer != null) window.clearTimeout(transitionTimer);
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
    svg.style.removeProperty("transform");
    svg.style.removeProperty("transform-origin");
    svg.style.removeProperty("transition");
    markerLayer.style.removeProperty("transform");
    markerLayer.style.removeProperty("transform-origin");
    markerLayer.style.removeProperty("transition");
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
  const reset = controlButton("↺", "Réinitialiser le zoom");
  const scale = document.createElement("span");
  scale.className = "grid h-7 min-w-11 place-items-center border-y border-[#0b1e32]/10 px-1 font-mono text-[0.55rem] font-black text-[#667384]";
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
    "grid size-9 place-items-center bg-white text-lg font-black leading-none text-[#0b1e32] transition hover:bg-[#f6efe5] disabled:cursor-not-allowed disabled:opacity-35";
  return button;
}

function midpoint(a: PointerPoint, b: PointerPoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

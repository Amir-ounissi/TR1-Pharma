import { describe, expect, it } from "vitest";
import {
  buildProjectionViewport,
  getPeriodStart,
  projectCoordinate,
  resolveNetworkMapMode,
  resolveNetworkMapPeriod,
} from "./network-map";

describe("network map helpers", () => {
  it("defaults manager mode to réseau", () => {
    expect(resolveNetworkMapMode(undefined, "manager")).toBe("network");
    expect(resolveNetworkMapMode("terrain", "manager")).toBe("terrain");
  });

  it("restricts agent modes to network and priorities", () => {
    expect(resolveNetworkMapMode("terrain", "agent")).toBe("network");
    expect(resolveNetworkMapMode("priorities", "agent")).toBe("priorities");
  });

  it("resolves supported periods", () => {
    expect(resolveNetworkMapPeriod("7d")).toBe("7d");
    expect(resolveNetworkMapPeriod("oops")).toBe("30d");
  });

  it("computes period starts deterministically", () => {
    const now = new Date("2026-08-11T10:00:00Z");
    expect(getPeriodStart("7d", now).toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(getPeriodStart("ytd", now).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("focuses the agent viewport on visible pharmacies", () => {
    const viewport = buildProjectionViewport([
      { latitude: 43.3, longitude: 5.4 },
      { latitude: 43.7, longitude: 7.2 },
    ], "agent");

    expect(viewport.minLongitude).toBeGreaterThan(-5.8);
    expect(viewport.maxLongitude).toBeLessThan(9.8);
    expect(viewport.minLatitude).toBeGreaterThan(41);
    expect(viewport.maxLatitude).toBeLessThan(51.6);
  });

  it("keeps the full frame for manager and no-data cases", () => {
    const viewport = buildProjectionViewport([], "manager");
    expect(viewport).toEqual({
      minLongitude: -5.8,
      maxLongitude: 9.8,
      minLatitude: 41,
      maxLatitude: 51.6,
    });
  });

  it("projects coordinates into svg space", () => {
    const viewport = buildProjectionViewport([{ latitude: 48.85, longitude: 2.35 }], "manager");
    const point = projectCoordinate({ latitude: 48.85, longitude: 2.35 }, viewport, 1000, 700);

    expect(point.x).toBeGreaterThan(0);
    expect(point.x).toBeLessThan(1000);
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(700);
  });
});

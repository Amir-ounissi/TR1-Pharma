import { describe, expect, it } from "vitest";
import { buildPageHref } from "./pagination";

describe("pagination hrefs", () => {
  it("builds pagination without filters", () => {
    expect(buildPageHref("/dashboard/orders", {}, 2)).toBe("/dashboard/orders?page=2");
  });

  it("preserves one active filter", () => {
    expect(buildPageHref("/dashboard/orders", { status: "pending", page: "1" }, 2)).toBe("/dashboard/orders?status=pending&page=2");
  });

  it("preserves every active filter", () => {
    const href = buildPageHref("/dashboard/orders", { status: "confirmed", type: "reorder", source: "agent", classification: "reorder", from: "2026-08-01", to: "2026-08-31", page: "3" }, 4);
    expect(Object.fromEntries(new URL(href, "https://tr1.local").searchParams)).toEqual({ status: "confirmed", type: "reorder", source: "agent", classification: "reorder", from: "2026-08-01", to: "2026-08-31", page: "4" });
  });
});

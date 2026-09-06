import { describe, expect, it } from "vitest";
import { formatSaasLimit, resolveSaasUsageProgress, saasUsageStateLabel } from "./commercial";

describe("SaaS commercial usage helpers", () => {
  it("keeps an unlimited quota distinct from a finite quota", () => {
    expect(resolveSaasUsageProgress(42, null)).toEqual({
      used: 42,
      limit: null,
      remaining: null,
      percent: null,
      state: "unlimited",
    });
  });

  it("computes a normal finite quota deterministically", () => {
    expect(resolveSaasUsageProgress(20, 100)).toEqual({
      used: 20,
      limit: 100,
      remaining: 80,
      percent: 20,
      state: "normal",
    });
  });

  it("flags quota pressure from eighty percent", () => {
    expect(resolveSaasUsageProgress(80, 100).state).toBe("warning");
  });

  it("keeps exactly-at-limit usage as warning rather than exceeded", () => {
    expect(resolveSaasUsageProgress(100, 100)).toMatchObject({
      remaining: 0,
      percent: 100,
      state: "warning",
    });
  });

  it("flags actual overage explicitly", () => {
    expect(resolveSaasUsageProgress(101, 100)).toMatchObject({
      remaining: 0,
      percent: 100,
      state: "exceeded",
    });
  });

  it("formats limits and labels without hiding unlimited status", () => {
    expect(formatSaasLimit(null)).toBe("Illimité");
    expect(formatSaasLimit(250, "documents")).toContain("250 documents");
    expect(saasUsageStateLabel("unlimited")).toBe("Illimité");
    expect(saasUsageStateLabel("warning")).toBe("À surveiller");
  });
});

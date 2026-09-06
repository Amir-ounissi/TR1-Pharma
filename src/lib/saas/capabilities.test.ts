import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND_TERMINOLOGY,
  isSaasCapability,
  resolveBrandTerminology,
  resolveCapabilityDecision,
} from "./capabilities";

describe("SaaS capability contract", () => {
  it("recognizes canonical capabilities without accepting arbitrary keys", () => {
    expect(isSaasCapability("sell_out")).toBe(true);
    expect(isSaasCapability("executive_cockpit")).toBe(true);
    expect(isSaasCapability("naali_special_feature")).toBe(false);
  });

  it("gives a brand override precedence over its plan", () => {
    expect(resolveCapabilityDecision({ planEnabled: true, overrideEnabled: false })).toEqual({
      enabled: false,
      source: "override",
    });
    expect(resolveCapabilityDecision({ planEnabled: false, overrideEnabled: true })).toEqual({
      enabled: true,
      source: "override",
    });
  });

  it("keeps legacy brands fully enabled until their plan is explicitly changed", () => {
    expect(resolveCapabilityDecision({ planEnabled: false, legacyFull: true })).toEqual({
      enabled: true,
      source: "legacy_full",
    });
  });

  it("returns plan and none decisions deterministically", () => {
    expect(resolveCapabilityDecision({ planEnabled: true })).toEqual({ enabled: true, source: "plan" });
    expect(resolveCapabilityDecision({ planEnabled: false })).toEqual({ enabled: false, source: "none" });
  });

  it("merges only supported non-empty terminology overrides", () => {
    expect(resolveBrandTerminology({
      field_rep_singular: "Délégué pharmaceutique",
      field_rep_plural: "Délégués pharmaceutiques",
      reorder: "Réassort",
      unknown_label: "ignore me",
      pharmacy_singular: "   ",
    })).toEqual({
      ...DEFAULT_BRAND_TERMINOLOGY,
      field_rep_singular: "Délégué pharmaceutique",
      field_rep_plural: "Délégués pharmaceutiques",
      reorder: "Réassort",
    });
  });

  it("falls back safely for malformed terminology", () => {
    expect(resolveBrandTerminology(null)).toEqual(DEFAULT_BRAND_TERMINOLOGY);
    expect(resolveBrandTerminology(["bad"])).toEqual(DEFAULT_BRAND_TERMINOLOGY);
  });
});

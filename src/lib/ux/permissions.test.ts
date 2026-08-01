import { describe, expect, it } from "vitest";
import { canAccessDesignSystem, canUseAdministrationNavigation, canUseManagerNavigation } from "./permissions";

describe("UX permission helpers", () => {
  it("keeps administration hidden from agents", () => {
    expect(canUseAdministrationNavigation("agent")).toBe(false);
    expect(canUseManagerNavigation("agent")).toBe(false);
  });

  it("allows managers without granting administration", () => {
    expect(canUseManagerNavigation("tr1_manager")).toBe(true);
    expect(canUseAdministrationNavigation("tr1_manager")).toBe(false);
  });

  it("guards the internal design system", () => {
    expect(canAccessDesignSystem("agent", "production")).toBe(false);
    expect(canAccessDesignSystem("brand_admin", "production")).toBe(true);
    expect(canAccessDesignSystem("agent", "development")).toBe(true);
  });
});

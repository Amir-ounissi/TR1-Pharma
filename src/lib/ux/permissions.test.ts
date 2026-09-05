import { describe, expect, it } from "vitest";
import { canAccessDesignSystem, canAccessReferenceAdministration, canUseAdministrationNavigation, canUseManagerNavigation } from "./permissions";

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
    expect(canAccessDesignSystem("agent")).toBe(false);
    expect(canAccessDesignSystem("brand_admin")).toBe(false);
    expect(canAccessDesignSystem("tr1_manager")).toBe(false);
    expect(canAccessDesignSystem("super_admin")).toBe(true);
  });

  it("allows only elevated tenant roles on reference administration routes", () => {
    expect(canAccessReferenceAdministration("brand_admin")).toBe(true);
    expect(canAccessReferenceAdministration("tr1_manager")).toBe(true);
    expect(canAccessReferenceAdministration("super_admin")).toBe(true);
    expect(canAccessReferenceAdministration("brand_user")).toBe(false);
    expect(canAccessReferenceAdministration("agent")).toBe(false);
  });
});

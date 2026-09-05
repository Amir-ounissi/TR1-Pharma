import { describe, expect, it } from "vitest";
import { canAdministerProducts } from "./product-permissions";

describe("canAdministerProducts", () => {
  it.each(["brand_admin", "tr1_manager", "super_admin"])(
    "allows %s to administer the catalog",
    (role) => expect(canAdministerProducts(role)).toBe(true),
  );

  it.each(["agent", "facilitator", "brand_user", null])(
    "keeps %s read-only",
    (role) => expect(canAdministerProducts(role)).toBe(false),
  );
});

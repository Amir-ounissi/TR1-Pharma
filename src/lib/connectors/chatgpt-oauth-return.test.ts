import { describe, expect, it } from "vitest";
import { oauthConsentReturn } from "./chatgpt-oauth-return";

describe("OAuth consent post-login redirect", () => {
  const validId = "8ac830fe-153a-4d85-9516-fae9f3908a33";
  it("allows only the explicit TR1 consent route", () => {
    expect(oauthConsentReturn("/oauth/consent?authorization_id=" + validId))
      .toBe("/oauth/consent?authorization_id=" + validId);
  });
  it("rejects open redirects and other internal pages", () => {
    for (const value of [
      "https://evil.example/redirect",
      "//evil.example",
      "/dashboard",
      "/oauth/consent?authorization_id=" + validId + "&next=https://evil.example",
      "/oauth/consent?authorization_id=%2f%2fevil.example",
      "/oauth/consent?authorization_id=abc",
      "javascript:alert(1)",
    ]) expect(oauthConsentReturn(value)).toBeNull();
  });
});

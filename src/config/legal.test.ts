import { describe, expect, it, vi } from "vitest";
import { LEGAL_PLACEHOLDER, readLegalConfiguration, validateLegalConfiguration } from "./legal";

const complete = {
  APP_ENV: "production",
  LEGAL_ENTITY_NAME: "Example",
  LEGAL_FORM: "Example",
  LEGAL_SHARE_CAPITAL: "Example",
  LEGAL_REGISTERED_OFFICE: "Example",
  LEGAL_REGISTRATION_NUMBER: "Example",
  LEGAL_VAT_NUMBER: "Example",
  LEGAL_PUBLICATION_DIRECTOR: "Example",
  LEGAL_CONTACT_EMAIL: "contact@example.test",
  PRIVACY_CONTACT_EMAIL: "privacy@example.test",
  PRIVACY_DATA_CONTROLLER: "Example",
  LEGAL_HOSTING_PROVIDER_NAME: "Example",
  LEGAL_HOSTING_PROVIDER_ADDRESS: "Example",
  PRIVACY_LEAD_RETENTION_DURATION: "Example",
  PRIVACY_LEGAL_BASIS: "Example",
  PRIVACY_POLICY_UPDATED_AT: "2026-08-03",
};

describe("legal configuration", () => {
  it("uses explicit placeholders outside production", () => {
    const configuration = readLegalConfiguration({ APP_ENV: "staging" });
    expect(configuration.information.legalEntityName).toBe(LEGAL_PLACEHOLDER);
    expect(configuration.missingFields).toContain("legalEntityName");
  });

  it("blocks production when required information is missing", () => {
    expect(() => validateLegalConfiguration({ APP_ENV: "production" }, vi.fn())).toThrow(/Build production interdit/);
  });

  it("accepts a complete production configuration", () => {
    expect(validateLegalConfiguration(complete, vi.fn()).missingFields).toEqual([]);
  });
});

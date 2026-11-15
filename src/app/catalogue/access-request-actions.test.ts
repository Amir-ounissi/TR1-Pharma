import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  updateIs: vi.fn(),
  saved: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "192.0.2.10" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error("REDIRECT:" + url); },
}));
vi.mock("@/lib/runtime-environment", () => ({
  readRuntimeEnvironment: () => ({
    leadCaptureEnabled: true,
    LEAD_CAPTURE_SALT: "test-only-request-salt-for-unit-tests",
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import { requestCatalogueAccessAction } from "./access-request-actions";

function submission(extra: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    fullName: "Marie Martin",
    role: "titulaire",
    professionalEmail: "marie@pharmacie.example",
    phone: "06 12 34 56 78",
    pharmacyName: "Pharmacie du Centre",
    addressLine: "12 rue de la République",
    postalCode: "13800",
    city: "Istres",
    siret: "",
    finess: "123456789",
    pharmacyConfirmation: "true",
    privacyAcknowledged: "true",
    website: "",
    ...extra,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: "test-lead-id", error: null });
  mocks.read.mockResolvedValue({ data: { internal_notes: "Note de l’équipe" }, error: null });
  const writeQuery = { eq: mocks.updateEq, is: mocks.updateIs, select: mocks.saved };
  mocks.updateEq.mockReturnValue(writeQuery);
  mocks.updateIs.mockReturnValue(writeQuery);
  mocks.saved.mockResolvedValue({ data: [{ id: "test-lead-id" }], error: null });
  mocks.update.mockReturnValue(writeQuery);
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ single: mocks.read }) }),
    update: mocks.update,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("pharmacy catalogue access request", () => {
  it("stores a verified pharmacy request in the private CRM lead notes", async () => {
    await expect(requestCatalogueAccessAction({}, submission()))
      .rejects.toThrow("REDIRECT:/catalogue/demander-acces?confirmation=1");

    expect(mocks.rpc).toHaveBeenCalledWith("capture_commercial_lead", expect.objectContaining({
      lead_source: "website_catalogue_access",
      lead_email: "marie@pharmacie.example",
      lead_company_name: "Pharmacie du Centre",
    }));
    expect(mocks.update).toHaveBeenCalledWith({
      internal_notes: expect.stringContaining("DEMANDE D’ACCÈS AU CATALOGUE PROFESSIONNEL TR1 PHARMA"),
    });
    expect(mocks.update).toHaveBeenCalledWith({
      internal_notes: expect.stringContaining("FINESS : 123456789"),
    });
  });

  it("requires at least one official pharmacy identifier", async () => {
    const result = await requestCatalogueAccessAction({}, submission({ finess: "" }));
    expect(result.fieldErrors?.siret).toContain("SIRET ou FINESS");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid FINESS number", async () => {
    const result = await requestCatalogueAccessAction({}, submission({ finess: "12345" }));
    expect(result.fieldErrors?.finess).toContain("9 chiffres");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid French phone number", async () => {
    const result = await requestCatalogueAccessAction({}, submission({ phone: "123" }));
    expect(result.fieldErrors?.phone).toContain("téléphone français");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not write a request when the pharmacy declaration is missing", async () => {
    const result = await requestCatalogueAccessAction({}, submission({ pharmacyConfirmation: "" }));
    expect(result.fieldErrors?.pharmacyConfirmation).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps the honeypot effective without a database call", async () => {
    await expect(requestCatalogueAccessAction({}, submission({ website: "bot-content" })))
      .rejects.toThrow("REDIRECT:/catalogue/demander-acces?confirmation=1");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps the entered information when the database rejects the request", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    const result = await requestCatalogueAccessAction({}, submission());
    expect(result.error).toBeTruthy();
    expect(result.fields).toMatchObject({
      fullName: "Marie Martin",
      pharmacyName: "Pharmacie du Centre",
      finess: "123456789",
    });
  });
});

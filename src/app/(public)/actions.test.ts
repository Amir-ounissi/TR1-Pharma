import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), read: vi.fn(), update: vi.fn(), updateEq: vi.fn(), updateIs: vi.fn(), saved: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/runtime-environment", () => ({ readRuntimeEnvironment: () => ({ leadCaptureEnabled: true, LEAD_CAPTURE_SALT: "test-only-request-salt-for-unit-tests" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));

import { captureLeadAction } from "./actions";

function submission(extra: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ fullName: "Marie Martin", professionalEmail: "marie@example.com", companyName: "Nova Santé", leadAudience: "brand", website: "", websiteUrl: "https://example.com", need: "Implanter notre gamme", ...extra })) data.set(key, value);
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
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: mocks.read }) }), update: mocks.update });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("public lead submission without live database writes", () => {
  it("preserves the destination, existing notes and source attribution", async () => {
    await expect(captureLeadAction({}, submission())).rejects.toThrow("REDIRECT:/merci");
    expect(mocks.rpc).toHaveBeenCalledWith("capture_commercial_lead", expect.objectContaining({ lead_source: "website_brand", lead_email: "marie@example.com" }));
    expect(mocks.update).toHaveBeenCalledWith({ internal_notes: "Note de l’équipe\n\nDemande via le site\nSite web : https://example.com\nBesoin exprimé : Implanter notre gamme" });
    expect(mocks.updateEq).toHaveBeenCalledWith("internal_notes", "Note de l’équipe");
  });

  it("does not write a pharmacy submission without its location", async () => {
    const result = await captureLeadAction({}, submission({ leadAudience: "pharmacy", location: "" }));
    expect(result.fieldErrors?.location).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps every visible field after a database rejection", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    const result = await captureLeadAction({}, submission({ leadAudience: "pharmacy", location: "13800" }));
    expect(result.error).toBeTruthy();
    expect(result.fields).toMatchObject({ fullName: "Marie Martin", location: "13800", need: "Implanter notre gamme", websiteUrl: "https://example.com" });
  });

  it("returns an actionable error on transport failure", async () => {
    mocks.rpc.mockRejectedValue(new Error("network unavailable"));
    const result = await captureLeadAction({}, submission());
    expect(result.error).toContain("vous pouvez réessayer");
    expect(result.fields?.need).toBe("Implanter notre gamme");
  });

  it("detects a concurrent notes edit instead of overwriting it", async () => {
    mocks.saved.mockResolvedValue({ data: [], error: null });
    const result = await captureLeadAction({}, submission());
    expect(result.error).toBeTruthy();
    expect(result.fields?.websiteUrl).toBe("https://example.com");
  });

  it("keeps the honeypot effective without a database call", async () => {
    await expect(captureLeadAction({}, submission({ website: "bot-content" }))).rejects.toThrow("REDIRECT:/merci");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

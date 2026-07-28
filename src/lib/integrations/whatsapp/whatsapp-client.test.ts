import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: { enabled: false } as
    | { enabled: false }
    | {
        enabled: true;
        WHATSAPP_ACCESS_TOKEN: string;
        WHATSAPP_PHONE_NUMBER_ID: string;
      },
}));

vi.mock("./whatsapp-config", () => ({
  getWhatsAppConfig: () => state.config,
}));

import { sendWhatsAppMessage } from "./whatsapp-client";

describe("WhatsApp client", () => {
  afterEach(() => {
    state.config = { enabled: false };
    vi.unstubAllGlobals();
  });

  it("simulates delivery when the connector is disabled", async () => {
    expect(await sendWhatsAppMessage({ to: "+33612345678", text: "Bonjour" })).toEqual({ simulated: true });
  });

  it("uses the provider without exposing the token in the payload", async () => {
    state.config = {
      enabled: true,
      WHATSAPP_ACCESS_TOKEN: "server-access-token-value",
      WHATSAPP_PHONE_NUMBER_ID: "phone-123",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWhatsAppMessage({ to: "+33612345678", text: "Bonjour" })).resolves.toEqual({ simulated: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/phone-123/messages");
    expect(String(init.body)).not.toContain("server-access-token-value");
    expect(init.headers.Authorization).toBe("Bearer server-access-token-value");
  });

  it("propagates a provider failure without returning provider content", async () => {
    state.config = {
      enabled: true,
      WHATSAPP_ACCESS_TOKEN: "server-access-token-value",
      WHATSAPP_PHONE_NUMBER_ID: "phone-123",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(sendWhatsAppMessage({ to: "+33612345678", text: "Bonjour" }))
      .rejects.toThrow("WhatsApp provider error 503");
  });
});

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWhatsAppAssistantEngine } from "./whatsapp-tools";

describe("WhatsApp Assistant gateway", () => {
  it("propagates Assistant Core gateway failures", async () => {
    const admin = {
      rpc: async () => ({ data: null, error: { message: "Assistant unavailable" } }),
    } as unknown as SupabaseClient;

    await expect(createWhatsAppAssistantEngine(admin, "event-1").process({
      brandId: "00000000-0000-0000-0000-000000000101",
      message: "Quelle est ma prochaine visite ?",
      timezone: "Europe/Paris",
    })).rejects.toThrow("Assistant unavailable");
  });
});

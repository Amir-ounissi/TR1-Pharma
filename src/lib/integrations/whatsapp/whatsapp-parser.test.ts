import { describe, expect, it } from "vitest";
import { parseWhatsAppPayload } from "./whatsapp-parser";

describe("WhatsApp parser", () => {
  it("normalizes an inbound text message", () => {
    expect(parseWhatsAppPayload({
      entry: [{ id: "event-1", changes: [{ value: { messages: [{ id: "wamid-1", from: "33612345678", type: "text", text: { body: " Bonjour " } }] } }] }],
    })).toEqual([{ providerEventId: "event-1", providerMessageId: "wamid-1", phone: "+33612345678", type: "text", text: "Bonjour" }]);
  });

  it("retains unsupported media types without reading media", () => {
    const result = parseWhatsAppPayload({
      entry: [{ changes: [{ value: { messages: [{ id: "wamid-2", from: "33612345678", type: "image" }] } }] }],
    });
    expect(result[0]).toMatchObject({ type: "image", text: undefined });
  });

  it("rejects malformed and oversized payloads", () => {
    expect(() => parseWhatsAppPayload({ entry: [] })).toThrow();
    expect(() => parseWhatsAppPayload({
      entry: [{ changes: [{ value: { messages: [{ id: "x", from: "33612345678", type: "text", text: { body: "x".repeat(1201) } }] } }] }],
    })).toThrow();
  });
});


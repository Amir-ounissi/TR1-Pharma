import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizePhone, verifyWhatsAppSignature } from "./whatsapp-security";

describe("WhatsApp security", () => {
  it.each([
    ["+33 6 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
    ["33612345678", "+33612345678"],
  ])("normalizes %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it("rejects invalid numbers", () => expect(() => normalizePhone("0612")).toThrow());

  it("validates HMAC signatures in constant-time compatible form", () => {
    const body = "{\"entry\":[]}";
    const secret = "a-secret-at-least-sixteen";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyWhatsAppSignature(body, signature, secret)).toBe(true);
    expect(verifyWhatsAppSignature(`${body}x`, signature, secret)).toBe(false);
    expect(verifyWhatsAppSignature(body, null, secret)).toBe(false);
  });
});


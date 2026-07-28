import { createHmac, timingSafeEqual } from "node:crypto";

export function normalizePhone(value: string) {
  const normalized = value.trim().replace(/[^\d+]/g, "").replace(/^00/, "+");
  const withPrefix = normalized.startsWith("+") ? normalized : `+${normalized}`;
  if (!/^\+[1-9]\d{7,14}$/.test(withPrefix)) throw new Error("Invalid phone number");
  return withPrefix;
}

export function verifyWhatsAppSignature(body: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const received = Buffer.from(signature.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}


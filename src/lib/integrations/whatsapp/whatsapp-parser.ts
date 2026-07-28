import { z } from "zod";
import { normalizePhone } from "./whatsapp-security";
import type { WhatsAppMessage } from "./whatsapp-types";

const payloadSchema = z.object({
  entry: z.array(z.object({
    id: z.string().optional(),
    changes: z.array(z.object({
      value: z.object({
        messages: z.array(z.object({
          id: z.string().min(1).max(200),
          from: z.string().min(8).max(20),
          type: z.string().min(1).max(40),
          text: z.object({ body: z.string().max(1200) }).optional(),
        })).optional(),
      }),
    })),
  })).min(1),
}).passthrough();

export function parseWhatsAppPayload(payload: unknown): WhatsAppMessage[] {
  const parsed = payloadSchema.parse(payload);
  return parsed.entry.flatMap((entry) => entry.changes.flatMap((change) =>
    (change.value.messages ?? []).map((message) => ({
      providerEventId: entry.id,
      providerMessageId: message.id,
      phone: normalizePhone(message.from),
      type: message.type,
      text: message.text?.body.trim(),
    })),
  ));
}


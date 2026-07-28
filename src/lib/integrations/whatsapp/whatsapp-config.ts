import "server-only";
import { z } from "zod";

const enabledSchema = z.object({
  WHATSAPP_ENABLED: z.literal("true"),
  WHATSAPP_ACCESS_TOKEN: z.string().min(20),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(4),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(4),
  WHATSAPP_VERIFY_TOKEN: z.string().min(16),
  WHATSAPP_APP_SECRET: z.string().min(16),
});

export function getWhatsAppConfig() {
  if (process.env.WHATSAPP_ENABLED !== "true") return { enabled: false as const };
  const value = enabledSchema.parse(process.env);
  return { enabled: true as const, ...value };
}


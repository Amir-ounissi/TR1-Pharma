import { getWhatsAppConfig } from "./whatsapp-config";
import type { WhatsAppOutbound } from "./whatsapp-types";

export async function sendWhatsAppMessage(message: WhatsAppOutbound) {
  const config = getWhatsAppConfig();
  if (!config.enabled) return { simulated: true };
  const response = await fetch(`https://graph.facebook.com/v23.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", to: message.to.replace("+", ""), type: "text", text: { body: message.text } }),
  });
  if (!response.ok) throw new Error(`WhatsApp provider error ${response.status}`);
  return { simulated: false };
}


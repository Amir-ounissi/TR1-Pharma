import { createAdminClient } from "../../supabase/admin";
import { renderAssistantForWhatsApp } from "./whatsapp-renderer";
import { sendWhatsAppMessage } from "./whatsapp-client";
import { createWhatsAppAssistantEngine, executeWhatsAppTool, getWhatsAppBrandContexts, getWhatsAppPendingDraft } from "./whatsapp-tools";
import type { WhatsAppMessage } from "./whatsapp-types";

const unsupported = "Ce format n’est pas encore pris en charge. Pour l’instant, envoyez-moi un message texte.";
const unlinked = "Ce numéro n’est pas encore associé à un compte TR1 Pharma.\n\nConnectez-vous à TR1 puis ouvrez :\nMon compte → Connecter WhatsApp.";

export async function processWhatsAppMessage(message: WhatsAppMessage, appUrl: string) {
  const admin = createAdminClient();
  const { data: ingested, error } = await admin.rpc("ingest_whatsapp_event", {
    target_provider_event_id: message.providerEventId ?? null,
    target_provider_message_id: message.providerMessageId,
    target_phone: message.phone,
    target_event_type: "message",
    target_message_type: message.type,
    target_message_text: message.text ?? null,
    target_metadata: {},
  });
  if (error) throw new Error(error.message);
  if (ingested.duplicate) return { duplicate: true, response: null };
  const eventId = ingested.event_id as string;
  let responseText = "";
  let activeBrandId: string | null = null;
  const audit = async (eventName: string, metadata: Record<string, unknown> = {}) => {
    await admin.rpc("record_whatsapp_audit", {
      target_event_id: eventId,
      target_event_name: eventName,
      target_metadata: metadata,
    });
  };
  const track = async (eventName: string) => {
    if (!activeBrandId) return;
    try {
      await executeWhatsAppTool(admin, eventId, "track_product_event", {
        target_event: eventName,
        target_brand_id: activeBrandId,
        target_pharmacy_id: null,
        target_source: "whatsapp",
        target_metadata: {},
      });
    } catch {}
  };
  try {
    await audit("message_accepted");
    const { data: allowed } = await admin.rpc("check_whatsapp_rate_limit", { target_key: `message:${message.phone}`, target_limit: 30, target_window_seconds: 3600 });
    if (!allowed) throw new Error("Rate limit exceeded");
    if (message.type !== "text") {
      responseText = unsupported;
      await audit("message_rejected", { reason: "unsupported_type", message_type: message.type });
    }
    else if (/^TR1-[A-Z0-9]{6}$/i.test(message.text ?? "")) {
      const { data: linkingAllowed } = await admin.rpc("check_whatsapp_rate_limit", {
        target_key: `link:${message.phone}`,
        target_limit: 5,
        target_window_seconds: 600,
      });
      if (!linkingAllowed) {
        responseText = "Trop de tentatives. Réessayez dans quelques minutes.";
        await audit("linking_rejected", { reason: "rate_limit" });
      } else {
        const { data: link, error: linkError } = await admin.rpc("claim_whatsapp_link", { target_code: message.text, target_phone: message.phone });
        responseText = linkError ? "Code de liaison invalide ou expiré." : "Votre compte WhatsApp est maintenant associé à TR1 Pharma.";
        if (linkError) {
          await audit("linking_rejected", { reason: "invalid_or_expired" });
        } else {
          activeBrandId = String(link.brand_id);
          await audit("linking_completed");
          await track("whatsapp_link_completed");
        }
      }
    } else {
      let contexts: Array<{ brand_id: string; brand_name: string }>;
      try { contexts = await getWhatsAppBrandContexts(admin, eventId); } catch { contexts = []; }
      if (!contexts.length) {
        responseText = unlinked;
        await audit("identity_unavailable");
      }
      else if (contexts.length > 1) responseText = "Cette action concerne quelle marque ?\n" + contexts.map((item, index) => `${index + 1} — ${item.brand_name}`).join("\n");
      else {
        activeBrandId = contexts[0].brand_id;
        await audit("user_resolved");
        await track("whatsapp_message_received");
        const pending = await getWhatsAppPendingDraft(admin,eventId);
        if (/^(1|confirmer)$/i.test(message.text ?? "") && pending) {
          const result = await executeWhatsAppTool(admin,eventId,"confirm_assistant_draft",{target_draft_id:pending.id});
          responseText = result.already_confirmed ? "Cette action a déjà été enregistrée." : "Compte rendu enregistré. La prochaine action a été créée.";
          await audit("draft_confirmed", { already_confirmed: Boolean(result.already_confirmed) });
          await track("whatsapp_draft_confirmed");
        } else if (/^(3|annuler)$/i.test(message.text ?? "") && pending?.status === "pending") {
          await executeWhatsAppTool(admin,eventId,"cancel_assistant_draft",{target_draft_id:pending.id});
          responseText = "Brouillon annulé. Aucune donnée métier n’a été enregistrée.";
          await audit("draft_cancelled");
          await track("whatsapp_draft_cancelled");
        } else if (/^(2|modifier)$/i.test(message.text ?? "") && pending?.status === "pending") {
          responseText = `Modifiez ce brouillon dans TR1 :\n${appUrl}/dashboard/agent/assistant`;
        } else {
          await audit("assistant_called");
          const response = await createWhatsAppAssistantEngine(admin,eventId).process({
            brandId: contexts[0].brand_id,
            message: message.text ?? "",
            timezone: "Europe/Paris",
          });
          responseText = renderAssistantForWhatsApp(response, appUrl);
          if (response.kind === "draft") {
            await audit("draft_returned");
            await track("whatsapp_draft_presented");
          }
        }
        await track("whatsapp_message_processed");
      }
    }
    await sendWhatsAppMessage({ to: message.phone, text: responseText });
    await audit("outbound_sent");
    await track("whatsapp_assistant_response_sent");
    await admin.rpc("complete_whatsapp_event",{target_event_id:eventId,target_status:"processed",target_error:null});
    return { duplicate:false,response:responseText,eventId };
  } catch (processingError) {
    await audit("processing_failed", { stage: "processor" });
    await track("whatsapp_delivery_failed");
    await admin.rpc("complete_whatsapp_event",{target_event_id:eventId,target_status:"failed",target_error:processingError instanceof Error ? processingError.message : "Unknown"});
    throw processingError;
  }
}

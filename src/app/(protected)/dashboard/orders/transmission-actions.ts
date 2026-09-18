"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredential } from "@/lib/integrations/gmail/credentials";
import { refreshGoogleAccessToken, sendGmailRawMessage } from "@/lib/integrations/gmail/google";
import { buildMimeMessage, buildTr1OrderPdf, type EmailAttachment } from "@/lib/orders/order-email";
import { buildOrderPdfPayload } from "@/lib/orders/order-pdf-payload";

const uuid = z.string().uuid();
const allowedRoles = new Set(["agent", "brand_user", "brand_admin", "tr1_manager", "super_admin"]);
const allowedDocumentTypes = new Set(["kbis", "rib"]);
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export type OrderTransmissionActionState = {
  error?: string;
  success?: string;
};

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "document";
}

function commercialLabel(fullName?: string | null, email?: string | null) {
  return [fullName?.trim(), email?.trim()].filter(Boolean).join(" · ") || null;
}

async function requireTransmissionOrder(orderId: string) {
  const { supabase, brand, userId } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!allowedRoles.has(role)) throw new Error("Vous n’avez pas accès à la transmission de commandes.");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id,brand_id,pharmacy_id,brand_pharmacy_id,order_number,external_order_id,order_date,order_status,subtotal_ht,discount_amount_ht,net_amount_ht,tax_amount,total_ttc,notes,created_by")
    .eq("id", orderId)
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (error || !order) throw new Error("Commande introuvable.");

  return { supabase, brand, userId, order };
}

export async function updatePharmacyVatNumberAction(
  _state: OrderTransmissionActionState,
  formData: FormData,
): Promise<OrderTransmissionActionState> {
  const parsed = z.object({
    orderId: uuid,
    vatNumber: z.string().trim().min(4).max(32),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Renseignez un numéro de TVA valide." };

  try {
    const { order } = await requireTransmissionOrder(parsed.data.orderId);
    const admin = createAdminClient();
    const { error } = await admin
      .from("pharmacies")
      .update({ vat_number: parsed.data.vatNumber })
      .eq("id", order.pharmacy_id);
    if (error) throw error;
    revalidatePath(`/dashboard/orders/${order.id}`);
    revalidatePath(`/dashboard/pharmacies/${order.brand_pharmacy_id}`);
    return { success: "Numéro de TVA enregistré." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d’enregistrer le numéro de TVA." };
  }
}

export async function uploadPharmacyDocumentAction(
  _state: OrderTransmissionActionState,
  formData: FormData,
): Promise<OrderTransmissionActionState> {
  const orderIdValue = String(formData.get("orderId") ?? "");
  const documentType = String(formData.get("documentType") ?? "").toLowerCase();
  const file = formData.get("file");
  const orderId = uuid.safeParse(orderIdValue);
  if (!orderId.success || !allowedDocumentTypes.has(documentType)) return { error: "Document invalide." };
  if (!(file instanceof File) || file.size === 0 || file.size > 10_485_760 || !allowedMimeTypes.has(file.type)) {
    return { error: "Ajoutez un PDF, JPG ou PNG de 10 Mo maximum." };
  }

  try {
    const { brand, userId, order } = await requireTransmissionOrder(orderId.data);
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("pharmacy_documents")
      .select("id,object_path")
      .eq("brand_id", brand.id)
      .eq("pharmacy_id", order.pharmacy_id)
      .eq("document_type", documentType)
      .maybeSingle();

    const objectPath = `${brand.id}/${order.pharmacy_id}/${documentType}-${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await admin.storage
      .from("pharmacy-documents")
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const payload = {
      brand_id: brand.id,
      pharmacy_id: order.pharmacy_id,
      document_type: documentType,
      file_name: file.name.slice(0, 255),
      content_type: file.type,
      object_path: objectPath,
      uploaded_by: userId,
      updated_at: new Date().toISOString(),
    };
    const { error: dbError } = existing
      ? await admin.from("pharmacy_documents").update(payload).eq("id", existing.id)
      : await admin.from("pharmacy_documents").insert(payload);
    if (dbError) {
      await admin.storage.from("pharmacy-documents").remove([objectPath]);
      throw dbError;
    }
    if (existing?.object_path && existing.object_path !== objectPath) {
      await admin.storage.from("pharmacy-documents").remove([existing.object_path]);
    }

    revalidatePath(`/dashboard/orders/${order.id}`);
    return { success: `${documentType.toUpperCase()} enregistré.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d’enregistrer le document." };
  }
}

export async function disconnectGmailAction(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const { userId, order } = await requireTransmissionOrder(orderId);
  const admin = createAdminClient();
  const { error } = await admin.from("user_gmail_connections").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/orders/${order.id}`);
}

export async function sendOrderByEmailAction(
  _state: OrderTransmissionActionState,
  formData: FormData,
): Promise<OrderTransmissionActionState> {
  const parsed = z.object({ orderId: uuid }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Commande invalide." };

  let transmissionId: string | null = null;
  try {
    const { supabase, brand, userId, order } = await requireTransmissionOrder(parsed.data.orderId);
    if (["draft", "needs_correction", "rejected", "cancelled"].includes(order.order_status)) {
      return { error: "La commande doit être soumise à la marque avant transmission par email." };
    }

    const admin = createAdminClient();
    const creatorId = order.created_by || userId;
    const [
      { data: brandData, error: brandError },
      { data: pharmacy, error: pharmacyError },
      { data: items, error: itemsError },
      { data: documents, error: documentsError },
      { data: gmail, error: gmailError },
      { data: creator },
      { data: creatorProfile },
    ] = await Promise.all([
      supabase.from("brands").select("name,code,order_email").eq("id", brand.id).single(),
      supabase.from("pharmacies").select("legal_name,trade_name,cip_code,siret,vat_number,email,phone,address_line_1,address_line_2,postal_code,city").eq("id", order.pharmacy_id).single(),
      supabase.from("order_items").select("product_id,product_name_snapshot,sku_snapshot,quantity,free_quantity,unit_price_ht,discount_rate,net_unit_price_ht,line_total_ht,tax_rate").eq("order_id", order.id).order("created_at"),
      admin.from("pharmacy_documents").select("document_type,file_name,content_type,object_path").eq("brand_id", brand.id).eq("pharmacy_id", order.pharmacy_id),
      admin.from("user_gmail_connections").select("email,refresh_token_ciphertext").eq("user_id", userId).maybeSingle(),
      admin.from("users").select("email").eq("id", creatorId).maybeSingle(),
      admin.from("user_profiles").select("full_name").eq("user_id", creatorId).maybeSingle(),
    ]);
    if (brandError || pharmacyError || itemsError || documentsError || gmailError || !brandData || !pharmacy) {
      throw new Error("Impossible de préparer les données de transmission.");
    }

    const recipient = brandData.order_email?.trim();
    const byType = new Map((documents ?? []).map((document) => [document.document_type, document]));
    const missing: string[] = [];
    if (!recipient) missing.push("email de prise de commande de la marque");
    if (!gmail) missing.push("connexion Gmail");
    if (!(items ?? []).length) missing.push("lignes de commande");
    if (missing.length) return { error: `Transmission bloquée : ${missing.join(", ")}.` };

    const productIds = [
      ...new Set(
        (items ?? [])
          .map((item) => item.product_id)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    ];
    const { data: products, error: productsError } = productIds.length
      ? await supabase
          .from("products")
          .select("id,ean,units_per_case")
          .eq("brand_id", brand.id)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) throw new Error("Impossible de charger le référentiel produits du bon de commande.");

    const pdfPayload = buildOrderPdfPayload({
      order,
      brand: { ...brandData, order_email: recipient ?? null },
      pharmacy,
      items: items ?? [],
      products: products ?? [],
      commercialEmail: commercialLabel(creatorProfile?.full_name, creator?.email || gmail!.email),
    });
    const reference = pdfPayload.reference;
    const pharmacyName = pdfPayload.pharmacy.name;
    const subject = `Commande ${brandData.name} · ${pharmacyName} · ${reference}`;
    const administrativeDocuments = ["kbis", "rib"].filter((type) => byType.has(type));
    const bodyLines = [
      "Bonjour,",
      "",
      `Vous trouverez ci-joint la commande ${reference} pour ${pharmacyName}.`,
    ];
    if (administrativeDocuments.length) {
      bodyLines.push(
        `Les pièces administratives disponibles (${administrativeDocuments.map((type) => type.toUpperCase()).join(", ")}) sont également jointes.`,
      );
    }
    bodyLines.push("");
    if (pharmacy.vat_number?.trim()) {
      bodyLines.push(`N° TVA : ${pharmacy.vat_number}`);
    }
    bodyLines.push(
      `Total TTC : ${Number(order.total_ttc ?? 0).toFixed(2)} €`,
      "",
      "Bonne réception,",
      "",
      "Ceci est un message automatique, mais vous pouvez y répondre directement.",
    );
    const body = bodyLines.join("\n");

    const pdf = buildTr1OrderPdf(pdfPayload);
    const attachments: EmailAttachment[] = [
      { filename: `bon-de-commande-${safeFileName(reference)}.pdf`, contentType: "application/pdf", data: pdf },
    ];

    for (const type of ["kbis", "rib"] as const) {
      const document = byType.get(type);
      if (!document) continue;
      const { data, error } = await admin.storage.from("pharmacy-documents").download(document.object_path);
      if (error || !data) throw new Error(`Impossible de charger le ${type.toUpperCase()}.`);
      attachments.push({
        filename: `${type}-${safeFileName(document.file_name)}`,
        contentType: document.content_type,
        data: Buffer.from(await data.arrayBuffer()),
      });
    }

    const { data: transmission, error: transmissionError } = await admin
      .from("order_email_transmissions")
      .insert({
        order_id: order.id,
        brand_id: brand.id,
        pharmacy_id: order.pharmacy_id,
        actor_user_id: userId,
        status: "sending",
        sender_email: gmail!.email,
        recipient_email: recipient!,
        subject,
        body_text: body,
        attachment_manifest: attachments.map((attachment) => ({ filename: attachment.filename, content_type: attachment.contentType })),
      })
      .select("id")
      .single();
    if (transmissionError || !transmission) throw transmissionError || new Error("Impossible de créer le journal d’envoi.");
    transmissionId = transmission.id;

    const accessToken = await refreshGoogleAccessToken(decryptCredential(gmail!.refresh_token_ciphertext));
    const raw = buildMimeMessage({ from: gmail!.email, to: recipient!, subject, body, attachments });
    const messageId = await sendGmailRawMessage(accessToken, raw);

    const { error: updateError } = await admin
      .from("order_email_transmissions")
      .update({ status: "sent", external_message_id: messageId, sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() })
      .eq("id", transmission.id);
    if (updateError) throw updateError;

    revalidatePath(`/dashboard/orders/${order.id}`);
    return { success: `Commande envoyée depuis ${gmail!.email} à ${recipient}.` };
  } catch (error) {
    if (transmissionId) {
      const admin = createAdminClient();
      await admin.from("order_email_transmissions").update({
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 2000) : "Erreur d’envoi",
        updated_at: new Date().toISOString(),
      }).eq("id", transmissionId);
    }
    console.error("[order_email_transmission_error]", {
      orderId: parsed.data.orderId,
      transmissionId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return { error: error instanceof Error ? error.message : "Impossible d’envoyer la commande." };
  }
}

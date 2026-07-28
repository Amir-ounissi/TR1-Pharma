"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

export async function startWhatsAppLinkAction() {
  const { supabase, brand } = await requireActiveBrand();
  const { data, error } = await supabase.rpc("start_whatsapp_link", { target_brand_id: brand.id });
  if (error || !data?.[0]) return { error: "Impossible de générer le code." };
  revalidatePath("/dashboard/account/whatsapp");
  return { code: data[0].code as string, expiresAt: data[0].expires_at as string };
}

export async function revokeWhatsAppAction(channelId: string) {
  const parsed = z.string().regex(/^[0-9a-f-]{36}$/i).safeParse(channelId);
  if (!parsed.success) return { error: "Liaison invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("revoke_whatsapp_channel", { target_channel_id: parsed.data });
  if (error) return { error: "Révocation refusée." };
  revalidatePath("/dashboard/account/whatsapp");
  return { success: true };
}


"use server";

import { revalidatePath } from "next/cache";
import { requireActiveBrandRole } from "@/lib/auth";
import { reconcileHubSpotConnection } from "@/lib/integrations/hubspot/reconciliation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncHubSpotFromAgentSettingsAction(): Promise<void> {
  const { brand } = await requireActiveBrandRole(["agent"] as const);
  const admin = createAdminClient();

  const { data: connection, error } = await admin
    .from("connector_connections")
    .select("id,provider,status")
    .eq("brand_id", brand.id)
    .eq("provider", "hubspot")
    .eq("status", "active")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!connection) throw new Error("Aucun connecteur HubSpot actif n’est configuré.");

  await reconcileHubSpotConnection(brand.id, String(connection.id));

  revalidatePath("/dashboard/agent/settings");
  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/pharmacies");
}

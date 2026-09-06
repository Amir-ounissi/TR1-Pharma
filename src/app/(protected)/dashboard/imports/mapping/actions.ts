"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrandRole } from "@/lib/auth";
import { validateDataMapping } from "@/lib/data-mapping";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";
import type { ImportEntity } from "@/lib/reference-data";

export type MappingActionState = { error?: string; success?: string };

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  entityType: z.enum(["pharmacies", "contacts", "brand_pharmacies", "products", "orders"]),
  sourceSystem: z.string().trim().min(2).max(120),
  mappingJson: z.string().trim().min(2),
  isDefault: z.boolean(),
});

export async function saveMappingProfileAction(
  _state: MappingActionState,
  formData: FormData,
): Promise<MappingActionState> {
  const parsed = schema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    entityType: formData.get("entityType"),
    sourceSystem: formData.get("sourceSystem"),
    mappingJson: formData.get("mappingJson"),
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) return { error: "Profil de mapping invalide." };

  let mapping: Record<string, string>;
  try {
    const decoded = JSON.parse(parsed.data.mappingJson);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return { error: "Le mapping doit être un objet JSON source → champ TR1." };
    }
    mapping = decoded as Record<string, string>;
  } catch {
    return { error: "Le mapping JSON est invalide." };
  }

  const mappingErrors = validateDataMapping(parsed.data.entityType as ImportEntity, mapping);
  if (mappingErrors.length > 0) return { error: mappingErrors[0] };

  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const { error } = await supabase.rpc("save_data_mapping_profile", {
    target_brand_id: brand.id,
    target_profile_id: parsed.data.id || null,
    target_name: parsed.data.name,
    target_entity_type: parsed.data.entityType,
    target_source_system: parsed.data.sourceSystem,
    target_mapping: mapping,
    target_transforms: {},
    target_is_default: parsed.data.isDefault,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/imports/mapping");
  revalidatePath("/dashboard/imports");
  return { success: "Profil de mapping enregistré." };
}

export async function archiveMappingProfileAction(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const { error } = await supabase.rpc("archive_data_mapping_profile", {
    target_brand_id: brand.id,
    target_profile_id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/imports/mapping");
  revalidatePath("/dashboard/imports");
}

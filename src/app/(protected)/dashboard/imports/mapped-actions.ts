"use server";

import { previewImportAction, type ImportActionState } from "@/app/(protected)/dashboard/reference/actions";
import { requireActiveBrandRole } from "@/lib/auth";
import { parseCsv } from "@/lib/csv-import";
import { referenceAdministrationRoles } from "@/lib/ux/permissions";
import type { ImportEntity } from "@/lib/reference-data";

function escapeCsvCell(value: string) {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function rebuildMappedCsv(
  headers: string[],
  mappedHeaders: Record<string, string>,
  rows: Array<{ payload: Record<string, string> }>,
) {
  const outputHeaders = headers.map((header) => mappedHeaders[header] ?? header);
  const output = [outputHeaders.map(escapeCsvCell).join(";")];
  for (const row of rows) {
    output.push(headers.map((header) => escapeCsvCell(row.payload[header] ?? "")).join(";"));
  }
  return output.join("\n");
}

export async function previewMappedImportAction(
  state: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const profileId = String(formData.get("mappingProfileId") ?? "").trim();
  if (!profileId) return previewImportAction(state, formData);

  const entity = String(formData.get("entity") ?? "") as ImportEntity;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Sélectionnez un fichier CSV." };
  }

  const { supabase, brand } = await requireActiveBrandRole(referenceAdministrationRoles);
  const { data: capability, error: capabilityError } = await supabase.rpc("has_brand_capability", {
    target_brand_id: brand.id,
    target_capability_key: "data_mapping",
  });
  if (capabilityError) return { error: capabilityError.message };
  if (!capability) return { error: "Data Mapping Studio n’est pas disponible pour cette marque." };

  const { data: profile, error: profileError } = await supabase
    .from("data_mapping_profiles")
    .select("id,entity_type,mapping,name,version")
    .eq("id", profileId)
    .eq("brand_id", brand.id)
    .eq("is_active", true)
    .maybeSingle();

  if (profileError) return { error: profileError.message };
  if (!profile) return { error: "Profil de mapping introuvable." };
  if (profile.entity_type !== entity) {
    return { error: `Le profil « ${profile.name} » ne correspond pas au type de données sélectionné.` };
  }

  const mapping = profile.mapping && typeof profile.mapping === "object" && !Array.isArray(profile.mapping)
    ? (profile.mapping as Record<string, string>)
    : {};
  const mappedPreview = parseCsv(await file.text(), entity, mapping);
  if (mappedPreview.rows.length === 0) return { error: "Le fichier ne contient aucune donnée." };

  const headerErrors = mappedPreview.rows[0]?.lineNumber === 1 && !mappedPreview.rows[0].isValid
    ? mappedPreview.rows[0].errors
    : [];
  if (headerErrors.length > 0) {
    return {
      error: headerErrors[0],
      mapping: mappedPreview.mapping,
      errors: [{ line: 1, messages: headerErrors }],
    };
  }

  const mappedCsv = rebuildMappedCsv(mappedPreview.headers, mappedPreview.mapping, mappedPreview.rows);
  const delegated = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key !== "file" && key !== "mappingProfileId") delegated.append(key, value);
  }
  delegated.set("file", new File([mappedCsv], file.name, { type: "text/csv" }));

  const result = await previewImportAction(state, delegated);
  if (result.batchId) {
    await supabase
      .from("import_batches")
      .update({
        column_mapping: mappedPreview.mapping,
        metadata: {
          mapping_profile_id: profile.id,
          mapping_profile_name: profile.name,
          mapping_profile_version: profile.version,
        },
      })
      .eq("id", result.batchId)
      .eq("brand_id", brand.id);
  }

  return {
    ...result,
    mapping: mappedPreview.mapping,
    success: result.success ? `${result.success} Profil « ${profile.name} » appliqué.` : result.success,
  };
}

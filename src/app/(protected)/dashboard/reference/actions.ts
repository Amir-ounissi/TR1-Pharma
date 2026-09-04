"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { parseCsv } from "@/lib/csv-import";
import {
  activityStatuses, commercialStatuses, pharmacySources, potentialLevels, priorityLevels,
  type ImportEntity, type ImportStrategy,
} from "@/lib/reference-data";

export type ReferenceActionState = { error?: string; success?: string; entityId?: string };
export type ImportActionState = ReferenceActionState & {
  batchId?: string;
  validRows?: number;
  errorRows?: number;
  duplicateRows?: number;
  mapping?: Record<string, string>;
  errors?: Array<{ line: number; messages: string[] }>;
};

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));
const optionalUuid = z.string().uuid().optional().or(z.literal(""));

const pharmacySchema = z.object({
  existingPharmacyId: optionalUuid,
  legalName: z.string().trim().max(180),
  tradeName: optionalText,
  cipCode: z.string().trim().max(30).optional().or(z.literal("")),
  finessCode: z.string().trim().max(30).optional().or(z.literal("")),
  siret: z.string().trim().regex(/^$|^\d{14}$/),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.email(), z.literal("")]),
  website: z.union([z.url(), z.literal("")]),
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: z.string().trim().max(12).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  pharmacyGroupId: optionalUuid,
  commercialStatus: z.enum(commercialStatuses),
  activityStatus: z.enum(activityStatuses),
  priorityLevel: z.enum(priorityLevels),
  potentialLevel: z.enum(potentialLevels),
  potentialScore: z.union([z.coerce.number().min(0).max(100), z.literal("")]),
  source: z.enum(pharmacySources),
  territoryId: optionalUuid,
  currentAgentUserId: optionalUuid,
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  confirmDuplicate: z.boolean().default(false),
}).superRefine((value, context) => {
  if (!value.existingPharmacyId && value.legalName.length < 2) context.addIssue({ code: "custom", path: ["legalName"], message: "Raison sociale obligatoire" });
});

export async function createPharmacyAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = pharmacySchema.safeParse({
    existingPharmacyId: formData.get("existingPharmacyId"), legalName: formData.get("legalName"), tradeName: formData.get("tradeName"),
    cipCode: formData.get("cipCode"), finessCode: formData.get("finessCode"), siret: formData.get("siret"),
    phone: formData.get("phone"), email: formData.get("email"), website: formData.get("website"),
    addressLine1: formData.get("addressLine1"), addressLine2: formData.get("addressLine2"), postalCode: formData.get("postalCode"), city: formData.get("city"),
    pharmacyGroupId: formData.get("pharmacyGroupId"), commercialStatus: formData.get("commercialStatus"), activityStatus: formData.get("activityStatus"),
    priorityLevel: formData.get("priorityLevel"), potentialLevel: formData.get("potentialLevel"), potentialScore: formData.get("potentialScore"),
    source: formData.get("source"), territoryId: formData.get("territoryId"), currentAgentUserId: formData.get("currentAgentUserId"),
    notes: formData.get("notes"), confirmDuplicate: formData.get("confirmDuplicate") === "true",
  });
  if (!parsed.success) return { error: "Les informations de la pharmacie sont invalides." };
  const { supabase, brand } = await requireActiveBrand();
  if (!parsed.data.existingPharmacyId && !parsed.data.confirmDuplicate) {
    const { data: duplicates } = await supabase.rpc("find_pharmacy_duplicates", {
      candidate_siret: parsed.data.siret || null, candidate_cip: parsed.data.cipCode || null,
      candidate_finess: parsed.data.finessCode || null, candidate_name: parsed.data.tradeName || parsed.data.legalName,
      candidate_postal_code: parsed.data.postalCode || null, candidate_address: parsed.data.addressLine1 || null,
    });
    if ((duplicates ?? []).length > 0) return { error: "Doublon potentiel détecté. Vérifiez la pharmacie existante ou confirmez explicitement la création." };
  }
  const { data, error } = await supabase.rpc("create_brand_pharmacy", {
    target_brand_id: brand.id,
    existing_pharmacy_id: parsed.data.existingPharmacyId || null,
    pharmacy_data: {
      legal_name: parsed.data.legalName, trade_name: parsed.data.tradeName, cip_code: parsed.data.cipCode,
      finess_code: parsed.data.finessCode, siret: parsed.data.siret, phone: parsed.data.phone, email: parsed.data.email,
      website: parsed.data.website, address_line_1: parsed.data.addressLine1, address_line_2: parsed.data.addressLine2,
      postal_code: parsed.data.postalCode, city: parsed.data.city, country_code: "FR", pharmacy_group_id: parsed.data.pharmacyGroupId,
    },
    relation_data: {
      commercial_status: parsed.data.commercialStatus, activity_status: parsed.data.activityStatus,
      priority_level: parsed.data.priorityLevel, potential_level: parsed.data.potentialLevel,
      potential_score: parsed.data.potentialScore, source: parsed.data.source, territory_id: parsed.data.territoryId,
      current_agent_user_id: parsed.data.currentAgentUserId, notes: parsed.data.notes,
    },
  });
  if (error) return { error: error.code === "23505" ? "Cette pharmacie ou cette relation existe déjà." : error.message };
  return { success: "Pharmacie ajoutée au référentiel.", entityId: data as string };
}

const relationSchema = z.object({
  id: z.string().uuid(), commercialStatus: z.enum(commercialStatuses), activityStatus: z.enum(activityStatuses),
  priorityLevel: z.enum(priorityLevels), potentialLevel: z.enum(potentialLevels),
  potentialScore: z.union([z.coerce.number().min(0).max(100), z.literal("")]), source: z.enum(pharmacySources),
  currentAgentUserId: optionalUuid, territoryId: optionalUuid, nextActionType: optionalText,
  nextActionAt: z.string().optional().or(z.literal("")), notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export async function updateBrandPharmacyAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = relationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Les paramètres commerciaux sont invalides." };
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.from("brand_pharmacies").update({
    commercial_status: parsed.data.commercialStatus, activity_status: parsed.data.activityStatus,
    priority_level: parsed.data.priorityLevel, potential_level: parsed.data.potentialLevel,
    potential_score: parsed.data.potentialScore === "" ? null : parsed.data.potentialScore,
    source: parsed.data.source, current_agent_user_id: parsed.data.currentAgentUserId || null,
    territory_id: parsed.data.territoryId || null, next_action_type: parsed.data.nextActionType || null,
    next_action_at: parsed.data.nextActionAt || null, notes: parsed.data.notes || null,
  }).eq("id", parsed.data.id).eq("brand_id", brand.id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pharmacies/${parsed.data.id}`);
  revalidatePath("/dashboard/pharmacies");
  return { success: "Relation commerciale mise à jour." };
}


export async function updateAgentPotentialAction(
  _state: ReferenceActionState,
  formData: FormData,
): Promise<ReferenceActionState> {
  const parsed = z.object({
    id: z.string().uuid(),
    potentialLevel: z.enum(potentialLevels),
    potentialScore: z.union([
      z.coerce.number().min(0).max(100),
      z.literal(""),
    ]),
    notes: z.string().trim().max(4000).optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Le potentiel renseigné est invalide." };
  }

  const { supabase, brand } = await requireActiveBrand();

  const { error } = await supabase
    .from("brand_pharmacies")
    .update({
      potential_level: parsed.data.potentialLevel,
      potential_score:
        parsed.data.potentialScore === ""
          ? null
          : parsed.data.potentialScore,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id)
    .eq("brand_id", brand.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/pharmacies/${parsed.data.id}`);
  revalidatePath("/dashboard/pharmacies");

  return { success: "Potentiel mis à jour." };
}

export async function archiveBrandPharmacyAction(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.from("brand_pharmacies").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("brand_id", brand.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/pharmacies");
}

export async function createContactAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const schema = z.object({ pharmacyId: z.string().uuid(), firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), jobTitle: optionalText, email: z.union([z.email(), z.literal("")]), phone: optionalText, isPrimary: z.boolean() });
  const parsed = schema.safeParse({ pharmacyId: formData.get("pharmacyId"), firstName: formData.get("firstName"), lastName: formData.get("lastName"), jobTitle: formData.get("jobTitle"), email: formData.get("email"), phone: formData.get("phone"), isPrimary: formData.get("isPrimary") === "on" });
  if (!parsed.success) return { error: "Contact invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.from("pharmacy_contacts").insert({ pharmacy_id: parsed.data.pharmacyId, first_name: parsed.data.firstName, last_name: parsed.data.lastName, job_title: parsed.data.jobTitle || null, email: parsed.data.email || null, phone: parsed.data.phone || null, is_primary: parsed.data.isPrimary });
  if (error) return { error: error.code === "23505" ? "Un contact principal actif existe déjà." : error.message };
  revalidatePath("/dashboard/pharmacies");
  return { success: "Contact ajouté." };
}

const productSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(1),
  ean: optionalText,
  category: optionalText,
  format: optionalText,
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  productFamily: optionalText,
  strategicPriority: z.enum(["standard", "priority", "strategic"]),
  pharmacyEligible: z.boolean(),
  countsForDistribution: z.boolean(),
  wholesalePrice: z.union([z.coerce.number().min(0), z.literal("")]),
  retailPrice: z.union([z.coerce.number().min(0), z.literal("")]),
  taxRate: z.union([
    z.coerce.number().min(0).max(100),
    z.literal(""),
  ]),
  unitsPerCase: z.union([
    z.coerce.number().int().min(1),
    z.literal(""),
  ]),
  minimumOrderQuantity: z.union([
    z.coerce.number().int().min(1),
    z.literal(""),
  ]),
});

function productFormValues(formData: FormData) {
  return {
    name: formData.get("name"),
    sku: formData.get("sku"),
    ean: formData.get("ean"),
    category: formData.get("category"),
    format: formData.get("format"),
    description: formData.get("description"),
    productFamily: formData.get("productFamily"),
    strategicPriority: formData.get("strategicPriority"),
    pharmacyEligible: formData.get("pharmacyEligible") === "on",
    countsForDistribution:
      formData.get("countsForDistribution") === "on",
    wholesalePrice: formData.get("wholesalePrice"),
    retailPrice: formData.get("retailPrice"),
    taxRate: formData.get("taxRate"),
    unitsPerCase: formData.get("unitsPerCase"),
    minimumOrderQuantity: formData.get("minimumOrderQuantity"),
  };
}

function productMutationPayload(
  data: z.infer<typeof productSchema>,
) {
  return {
    name: data.name,
    sku: data.sku,
    ean: data.ean || null,
    category: data.category || null,
    format: data.format || null,
    description: data.description || null,
    product_family: data.productFamily || null,
    strategic_priority: data.strategicPriority,
    is_pharmacy_eligible: data.pharmacyEligible,
    counts_for_distribution: data.countsForDistribution,
    wholesale_price_ht:
      data.wholesalePrice === "" ? null : data.wholesalePrice,
    retail_price_ttc:
      data.retailPrice === "" ? null : data.retailPrice,
    tax_rate: data.taxRate === "" ? null : data.taxRate,
    units_per_case:
      data.unitsPerCase === "" ? null : data.unitsPerCase,
    minimum_order_quantity:
      data.minimumOrderQuantity === ""
        ? null
        : data.minimumOrderQuantity,
  };
}

export async function createProductAction(
  _state: ReferenceActionState,
  formData: FormData,
): Promise<ReferenceActionState> {
  const parsed = productSchema.safeParse(productFormValues(formData));

  if (!parsed.success) {
    return { error: "Produit invalide." };
  }

  const { supabase, brand } = await requireActiveBrand();

  const { error } = await supabase.from("products").insert({
    brand_id: brand.id,
    ...productMutationPayload(parsed.data),
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ce SKU ou cet EAN existe déjà."
          : error.message,
    };
  }

  revalidatePath("/dashboard/products");

  return { success: "Produit créé." };
}

export async function updateProductAction(
  _state: ReferenceActionState,
  formData: FormData,
): Promise<ReferenceActionState> {
  const parsed = productSchema
    .extend({ id: z.string().uuid() })
    .safeParse({
      id: formData.get("id"),
      ...productFormValues(formData),
    });

  if (!parsed.success) {
    return { error: "Produit invalide." };
  }

  const { supabase, brand } = await requireActiveBrand();

  const { id, ...productData } = parsed.data;

  const { error } = await supabase
    .from("products")
    .update(productMutationPayload(productData))
    .eq("id", id)
    .eq("brand_id", brand.id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ce SKU ou cet EAN existe déjà."
          : error.message,
    };
  }

  revalidatePath("/dashboard/products");

  return { success: "Fiche produit mise à jour." };
}

export async function addBrandPharmacyProductAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = z.object({ brandPharmacyId: z.string().uuid(), productId: z.string().uuid(), status: z.enum(["planned", "implanted", "active", "temporarily_unavailable", "removed"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Produit implanté invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.from("brand_pharmacy_products").insert({ brand_pharmacy_id: parsed.data.brandPharmacyId, product_id: parsed.data.productId, status: parsed.data.status, source: "tr1_prospecting" });
  if (error) return { error: error.code === "23505" ? "Ce produit est déjà actif dans la pharmacie." : error.message };
  revalidatePath(`/dashboard/pharmacies/${parsed.data.brandPharmacyId}`);
  return { success: "Produit ajouté à la pharmacie." };
}

export async function createGroupAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = z.object({ name: z.string().trim().min(2), groupType: z.enum(["national_group", "regional_group", "banner", "network", "wholesaler_distributor", "independent", "other"]), website: z.union([z.url(), z.literal("")]), headquartersCity: optionalText, notes: optionalText }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Groupement invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.from("pharmacy_groups").insert({ name: parsed.data.name, group_type: parsed.data.groupType, website: parsed.data.website || null, headquarters_city: parsed.data.headquartersCity || null, notes: parsed.data.notes || null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/groups");
  return { success: "Groupement créé." };
}

export async function updateGroupAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = z.object({ id: z.string().uuid(), name: z.string().trim().min(2), groupType: z.enum(["national_group", "regional_group", "banner", "network", "wholesaler_distributor", "independent", "other"]), website: z.union([z.url(), z.literal("")]), headquartersCity: optionalText, notes: optionalText }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Groupement invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.from("pharmacy_groups").update({ name: parsed.data.name, group_type: parsed.data.groupType, website: parsed.data.website || null, headquarters_city: parsed.data.headquartersCity || null, notes: parsed.data.notes || null }).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/groups");
  return { success: "Groupement mis à jour." };
}

export async function createTerritoryAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = z.object({ name: z.string().trim().min(2), organizationId: z.string().uuid(), territoryType: z.enum(["country", "region", "department", "postal_area", "custom"]), regionCode: optionalText, departmentCode: optionalText, postalCodes: optionalText }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Territoire invalide." };
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.from("territories").insert({ organization_id: parsed.data.organizationId, brand_id: brand.id, name: parsed.data.name, territory_type: parsed.data.territoryType, region_code: parsed.data.regionCode || null, department_code: parsed.data.departmentCode || null, postal_codes: parsed.data.postalCodes ? parsed.data.postalCodes.split(",").map((value) => value.trim()).filter(Boolean) : null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/territories");
  return { success: "Territoire créé." };
}

export async function updateTerritoryAction(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const parsed = z.object({ id: z.string().uuid(), name: z.string().trim().min(2), territoryType: z.enum(["country", "region", "department", "postal_area", "custom"]), regionCode: optionalText, departmentCode: optionalText, postalCodes: optionalText }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Territoire invalide." };
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.from("territories").update({ name: parsed.data.name, territory_type: parsed.data.territoryType, region_code: parsed.data.regionCode || null, department_code: parsed.data.departmentCode || null, postal_codes: parsed.data.postalCodes ? parsed.data.postalCodes.split(",").map((value) => value.trim()).filter(Boolean) : null }).eq("id", parsed.data.id).eq("brand_id", brand.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/territories");
  return { success: "Territoire mis à jour." };
}

export async function toggleProductAction(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  const { supabase, brand } = await requireActiveBrand();
  const isActive = parsed.active === "true";
  const { error } = await supabase.from("products").update({ is_active: isActive, discontinued_at: isActive ? null : new Date().toISOString() }).eq("id", parsed.id).eq("brand_id", brand.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/products");
}

export async function previewImportAction(_state: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const entity = formData.get("entity") as ImportEntity;
  const strategy = formData.get("strategy") as ImportStrategy;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) return { error: "Sélectionnez un CSV de moins de 5 Mo." };
  if (!(["pharmacies", "contacts", "brand_pharmacies", "products", "orders"] as string[]).includes(entity)) return { error: "Type d’import invalide." };
  if (!(["create_only", "update_only", "upsert", "skip_duplicates"] as string[]).includes(strategy)) return { error: "Stratégie invalide." };
  const preview = parseCsv(await file.text(), entity);
  if (preview.rows.length === 0) return { error: "Le fichier ne contient aucune donnée." };
  const { supabase, brand, userId } = await requireActiveBrand();
  if (entity === "orders") {
    type StagedOrder = { lineNumber: number; payload: Record<string, string>; normalizedPayload: Record<string, unknown>; errors: string[]; isValid: boolean; isDuplicate: boolean };
    const grouped = new Map<string, StagedOrder>();
    const invalidRows: StagedOrder[] = [];
    for (const row of preview.rows) {
      const errors = [...row.errors];
      let brandPharmacyId = row.normalizedPayload.brand_pharmacy_id || "";
      if (row.isValid && brandPharmacyId) {
        const { count } = await supabase.from("brand_pharmacies").select("id", { count: "exact", head: true }).eq("id", brandPharmacyId).eq("brand_id", brand.id).is("archived_at", null);
        if (count !== 1) errors.push("Relation marque-pharmacie inconnue");
      } else if (row.isValid) {
        let pharmacyQuery = supabase.from("pharmacies").select("id");
        if (row.normalizedPayload.siret) pharmacyQuery = pharmacyQuery.eq("siret", row.normalizedPayload.siret);
        else if (row.normalizedPayload.cip_code) pharmacyQuery = pharmacyQuery.eq("cip_code", row.normalizedPayload.cip_code);
        else pharmacyQuery = pharmacyQuery.eq("finess_code", row.normalizedPayload.finess_code);
        const { data: pharmacyMatches } = await pharmacyQuery.limit(2);
        if ((pharmacyMatches ?? []).length !== 1) errors.push((pharmacyMatches ?? []).length > 1 ? "Pharmacie ambiguë" : "Pharmacie inconnue");
        else {
          const { data: relation } = await supabase.from("brand_pharmacies").select("id").eq("brand_id", brand.id).eq("pharmacy_id", pharmacyMatches![0].id).is("archived_at", null).maybeSingle();
          brandPharmacyId = relation?.id ?? "";
          if (!brandPharmacyId) errors.push("Pharmacie non rattachée à la marque");
        }
      }
      let productId = row.normalizedPayload.product_id || "";
      if (row.isValid) {
        let productQuery = supabase.from("products").select("id").eq("brand_id", brand.id).eq("is_active", true);
        if (productId) productQuery = productQuery.eq("id", productId);
        else if (row.normalizedPayload.sku) productQuery = productQuery.ilike("sku", row.normalizedPayload.sku);
        else productQuery = productQuery.ilike("ean", row.normalizedPayload.ean);
        const { data: productMatches } = await productQuery.limit(2);
        if ((productMatches ?? []).length !== 1) errors.push((productMatches ?? []).length > 1 ? "Produit ambigu" : "Produit inconnu");
        else productId = productMatches![0].id;
      }
      const externalId = row.normalizedPayload.external_order_id;
      const { count: existingCount } = errors.length === 0 ? await supabase.from("orders").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("external_order_id", externalId) : { count: 0 };
      const isDuplicate = (existingCount ?? 0) > 0;
      if (isDuplicate) errors.push("Commande externe déjà existante");
      if (errors.length > 0) {
        invalidRows.push({ lineNumber: row.lineNumber, payload: row.payload, normalizedPayload: row.normalizedPayload, errors, isValid: false, isDuplicate });
        continue;
      }
      const item = { product_id: productId, quantity: Number(row.normalizedPayload.quantity), free_quantity: Number(row.normalizedPayload.free_quantity || 0), unit_price_ht: Number(row.normalizedPayload.unit_price_ht), discount_rate: row.normalizedPayload.discount_rate ? Number(row.normalizedPayload.discount_rate) : null, tax_rate: Number(row.normalizedPayload.tax_rate || 20) };
      const existing = grouped.get(externalId);
      if (existing) (existing.normalizedPayload.items as Array<Record<string, unknown>>).push(item);
      else grouped.set(externalId, { lineNumber: row.lineNumber, payload: row.payload, normalizedPayload: { brand_pharmacy_id: brandPharmacyId, external_order_id: externalId, order_number: row.normalizedPayload.order_number || null, order_type: row.normalizedPayload.order_type || "other", order_status: row.normalizedPayload.order_status || "invoiced", order_date: row.normalizedPayload.order_date, payment_status: row.normalizedPayload.payment_status || "pending", shipping_amount_ht: Number(row.normalizedPayload.shipping_amount_ht || 0), items: [item] }, errors: [], isValid: true, isDuplicate: false });
    }
    const stagedRows = [...grouped.values(), ...invalidRows];
    const validRows = grouped.size;
    const errorRows = invalidRows.length;
    const duplicateRows = invalidRows.filter((row) => row.isDuplicate).length;
    const { data: batch, error: batchError } = await supabase.from("import_batches").insert({ brand_id: brand.id, entity_type: "orders", strategy, file_name: file.name, column_mapping: preview.mapping, valid_rows: validRows, error_rows: errorRows, duplicate_rows: duplicateRows, created_by: userId }).select("id").single();
    if (batchError || !batch) return { error: batchError?.message ?? "Prévisualisation impossible." };
    const { error: rowsError } = await supabase.from("import_rows").insert(stagedRows.map((row) => ({ batch_id: batch.id, line_number: row.lineNumber, payload: row.payload, normalized_payload: row.normalizedPayload, errors: row.errors, is_valid: row.isValid, is_duplicate: row.isDuplicate })));
    if (rowsError) return { error: rowsError.message };
    return { success: "Prévisualisation commandes prête. Aucune donnée métier n’a été écrite.", batchId: batch.id, validRows, errorRows, duplicateRows, mapping: preview.mapping, errors: invalidRows.slice(0,20).map((row) => ({ line: row.lineNumber, messages: row.errors })) };
  }
  let duplicateRows = 0;
  const rows = [];
  for (const row of preview.rows) {
    let duplicate = false;
    if (row.isValid && entity === "pharmacies") {
      const { data } = await supabase.rpc("find_pharmacy_duplicates", {
        candidate_siret: row.normalizedPayload.siret || null, candidate_cip: row.normalizedPayload.cip_code || null,
        candidate_finess: row.normalizedPayload.finess_code || null, candidate_name: row.normalizedPayload.trade_name || row.normalizedPayload.legal_name,
        candidate_postal_code: row.normalizedPayload.postal_code || null, candidate_address: row.normalizedPayload.address_line_1 || null,
      });
      duplicate = (data ?? []).length > 0;
    } else if (row.isValid && entity === "products") {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).ilike("sku", row.normalizedPayload.sku);
      duplicate = (count ?? 0) > 0;
    }
    if (duplicate) duplicateRows += 1;
    rows.push({ ...row, isDuplicate: duplicate });
  }
  const validRows = rows.filter((row) => row.isValid).length;
  const errorRows = rows.length - validRows;
  const { data: batch, error: batchError } = await supabase.from("import_batches").insert({ brand_id: brand.id, entity_type: entity, strategy, file_name: file.name, column_mapping: preview.mapping, valid_rows: validRows, error_rows: errorRows, duplicate_rows: duplicateRows, created_by: userId }).select("id").single();
  if (batchError || !batch) return { error: batchError?.message ?? "Prévisualisation impossible." };
  const { error: rowsError } = await supabase.from("import_rows").insert(rows.map((row) => ({ batch_id: batch.id, line_number: row.lineNumber, payload: row.payload, normalized_payload: row.normalizedPayload, errors: row.errors, is_valid: row.isValid, is_duplicate: row.isDuplicate })));
  if (rowsError) return { error: rowsError.message };
  return { success: "Prévisualisation prête. Aucune donnée métier n’a été écrite.", batchId: batch.id, validRows, errorRows, duplicateRows, mapping: preview.mapping, errors: rows.filter((row) => !row.isValid).slice(0, 20).map((row) => ({ line: row.lineNumber, messages: row.errors })) };
}

export async function confirmImportAction(formData: FormData) {
  const batchId = z.string().uuid().parse(formData.get("batchId"));
  const { supabase } = await requireActiveBrand();
  const { data: batch } = await supabase.from("import_batches").select("entity_type").eq("id", batchId).maybeSingle();
  const { error } = batch?.entity_type === "orders"
    ? await supabase.rpc("confirm_order_import", { target_batch_id: batchId })
    : await supabase.rpc("confirm_reference_import", { target_batch_id: batchId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/imports");
  revalidatePath("/dashboard/pharmacies");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/network");
}

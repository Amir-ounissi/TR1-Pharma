import type { ImportEntity } from "@/lib/reference-data";

export const IGNORE_MAPPING_TARGET = "__ignore__" as const;

export type CanonicalImportField = {
  key: string;
  label: string;
  required?: boolean;
  description?: string;
  aliases?: readonly string[];
};

export type DataMapping = Record<string, string>;

export const canonicalImportFields: Record<ImportEntity, readonly CanonicalImportField[]> = {
  pharmacies: [
    { key: "legal_name", label: "Raison sociale", required: true, aliases: ["pharmacy_name", "nom_pharmacie", "raison_sociale"] },
    { key: "trade_name", label: "Nom commercial", aliases: ["enseigne", "nom_commercial"] },
    { key: "external_id", label: "Identifiant externe", aliases: ["pharmacy_external_id", "id_externe"] },
    { key: "cip_code", label: "Code CIP", aliases: ["cip", "code_cip"] },
    { key: "finess_code", label: "FINESS", aliases: ["finess", "code_finess"] },
    { key: "siret", label: "SIRET" },
    { key: "phone", label: "Téléphone", aliases: ["telephone", "tel"] },
    { key: "email", label: "Email" },
    { key: "website", label: "Site web", aliases: ["site_web", "url"] },
    { key: "address_line_1", label: "Adresse", aliases: ["address", "adresse", "adresse_1"] },
    { key: "address_line_2", label: "Complément d’adresse", aliases: ["adresse_2"] },
    { key: "postal_code", label: "Code postal", aliases: ["cp", "zipcode"] },
    { key: "city", label: "Ville", aliases: ["commune"] },
    { key: "country_code", label: "Pays", aliases: ["country", "pays"] },
    { key: "pharmacy_group_id", label: "Identifiant groupement" },
    { key: "commercial_status", label: "Statut commercial" },
    { key: "activity_status", label: "Statut d’activité" },
    { key: "priority_level", label: "Priorité" },
    { key: "potential_level", label: "Potentiel" },
    { key: "potential_score", label: "Score potentiel" },
    { key: "source", label: "Source" },
    { key: "territory_id", label: "Identifiant territoire" },
    { key: "current_agent_user_id", label: "Commercial affecté" },
    { key: "notes", label: "Notes" },
  ],
  contacts: [
    { key: "pharmacy_id", label: "Identifiant pharmacie", required: true },
    { key: "first_name", label: "Prénom", required: true, aliases: ["prenom"] },
    { key: "last_name", label: "Nom", required: true, aliases: ["nom"] },
    { key: "job_title", label: "Fonction", aliases: ["poste", "role"] },
    { key: "email", label: "Email" },
    { key: "phone", label: "Téléphone", aliases: ["telephone", "tel"] },
    { key: "is_primary", label: "Contact principal", aliases: ["principal"] },
  ],
  brand_pharmacies: [
    { key: "pharmacy_id", label: "Identifiant pharmacie", required: true },
    { key: "external_id", label: "Identifiant externe" },
    { key: "commercial_status", label: "Statut commercial" },
    { key: "activity_status", label: "Statut d’activité" },
    { key: "priority_level", label: "Priorité" },
    { key: "potential_level", label: "Potentiel" },
    { key: "potential_score", label: "Score potentiel" },
    { key: "source", label: "Source" },
    { key: "territory_id", label: "Identifiant territoire" },
    { key: "current_agent_user_id", label: "Commercial affecté" },
    { key: "notes", label: "Notes" },
  ],
  products: [
    { key: "name", label: "Nom produit", required: true, aliases: ["product_name", "nom_produit", "produit"] },
    { key: "sku", label: "SKU / ACL", required: true, aliases: ["product_code", "code_produit", "reference", "acl", "acl_fr"] },
    { key: "ean", label: "EAN", aliases: ["ean13", "ean_13", "code_ean"] },
    { key: "category", label: "Catégorie", aliases: ["categorie"] },
    { key: "format", label: "Format", aliases: ["conditionnement"] },
    { key: "description", label: "Description" },
    { key: "product_family", label: "Famille produit", aliases: ["famille", "gamme"] },
    { key: "strategic_priority", label: "Priorité stratégique", aliases: ["strategic"] },
    { key: "is_pharmacy_eligible", label: "Éligible pharmacie" },
    { key: "counts_for_distribution", label: "Compte dans la DN" },
    { key: "wholesale_price_ht", label: "Prix de gros HT", aliases: ["unit_price_ht", "prix_achat_ht", "prix_achat_ht_eur", "prix_gros_ht"] },
    { key: "retail_price_ttc", label: "PVC TTC", aliases: ["pvc_ttc", "pvc_ttc_eur", "prix_public_ttc", "prix_vente_ttc"] },
    { key: "tax_rate", label: "TVA" },
    { key: "units_per_case", label: "Colisage" },
    { key: "minimum_order_quantity", label: "MOQ" },
    { key: "is_active", label: "Actif", aliases: ["active", "actif"] },
  ],
  orders: [
    { key: "external_order_id", label: "Identifiant commande externe", required: true },
    { key: "order_number", label: "Numéro de commande" },
    { key: "order_date", label: "Date commande", required: true },
    { key: "order_type", label: "Type de commande" },
    { key: "order_status", label: "Statut commande", aliases: ["status"] },
    { key: "payment_status", label: "Statut paiement" },
    { key: "shipping_amount_ht", label: "Frais de port HT" },
    { key: "brand_pharmacy_id", label: "Relation marque-pharmacie" },
    { key: "siret", label: "SIRET pharmacie" },
    { key: "cip_code", label: "CIP pharmacie", aliases: ["cip"] },
    { key: "finess_code", label: "FINESS pharmacie", aliases: ["finess"] },
    { key: "product_id", label: "Identifiant produit" },
    { key: "sku", label: "SKU / ACL produit", aliases: ["product_code", "reference", "acl"] },
    { key: "ean", label: "EAN produit", aliases: ["ean13", "code_ean"] },
    { key: "quantity", label: "Quantité", required: true, aliases: ["qty", "quantite"] },
    { key: "free_quantity", label: "Quantité gratuite", aliases: ["gratuit", "qte_gratuite"] },
    { key: "unit_price_ht", label: "Prix unitaire HT", required: true, aliases: ["prix_unitaire_ht"] },
    { key: "discount_rate", label: "Remise %", aliases: ["remise", "discount"] },
    { key: "tax_rate", label: "TVA" },
  ],
};

export function normalizeMappingHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function canonicalFieldKeys(entity: ImportEntity) {
  return new Set(canonicalImportFields[entity].map((field) => field.key));
}

export function suggestCanonicalField(header: string, entity: ImportEntity) {
  const normalized = normalizeMappingHeader(header);
  for (const field of canonicalImportFields[entity]) {
    if (normalizeMappingHeader(field.key) === normalized) return field.key;
    if ((field.aliases ?? []).some((alias) => normalizeMappingHeader(alias) === normalized)) return field.key;
  }
  return null;
}

export function validateDataMapping(entity: ImportEntity, mapping: DataMapping) {
  const allowedTargets = canonicalFieldKeys(entity);
  const errors: string[] = [];
  const targets = new Map<string, string>();

  for (const [source, target] of Object.entries(mapping)) {
    if (!source.trim()) {
      errors.push("Une colonne source est vide.");
      continue;
    }
    if (target === IGNORE_MAPPING_TARGET) continue;
    if (!allowedTargets.has(target)) {
      errors.push(`Champ TR1 inconnu : ${target}`);
      continue;
    }
    const previousSource = targets.get(target);
    if (previousSource && previousSource !== source) {
      errors.push(`Le champ ${target} est mappé plusieurs fois (${previousSource}, ${source}).`);
    } else {
      targets.set(target, source);
    }
  }

  const required = canonicalImportFields[entity].filter((field) => field.required).map((field) => field.key);
  for (const requiredField of required) {
    if (!targets.has(requiredField)) errors.push(`Champ obligatoire non mappé : ${requiredField}`);
  }

  return errors;
}

export function resolveExplicitMapping(header: string, mapping: DataMapping) {
  const normalizedHeader = normalizeMappingHeader(header);
  for (const [source, target] of Object.entries(mapping)) {
    if (normalizeMappingHeader(source) === normalizedHeader) return target;
  }
  return null;
}

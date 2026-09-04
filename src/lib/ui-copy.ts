const valueLabels: Record<string, string> = {
  // Commandes
  draft: "Brouillon",
  pending: "En attente",
  confirmed: "Confirmée",
  invoiced: "Facturée",
  partially_delivered: "Partiellement livrée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",

  initial: "Implantation",
  reorder: "Réassort",
  complementary: "Commande complémentaire",
  replacement: "Remplacement",
  sample: "Échantillon",
  return: "Retour",
  credit_note: "Avoir",
  other: "Autre",

  not_applicable: "Non applicable",
  partially_paid: "Partiellement payé",
  paid: "Payé",
  overdue: "En retard",

  manual: "Saisie manuelle",
  agent: "Agent terrain",
  brand: "Marque",
  import: "Import",
  api: "API",
  erp: "ERP",
  system: "Système",

  // Missions
  commercial_visit: "Visite commerciale",
  prospecting_visit: "Visite de prospection",
  animation: "Animation",
  training: "Formation",
  merchandising: "Merchandising",
  pharmacy_audit: "Audit pharmacie",
  reactivation: "Réactivation",
  product_launch: "Lancement produit",
  stock_check: "Contrôle de stock",
  relationship_visit: "Visite relationnelle",

  requested: "Demandée",
  to_assign: "À affecter",
  assigned: "Affectée",
  accepted: "Acceptée",
  scheduled: "Planifiée",
  in_progress: "En cours",
  report_pending: "Compte rendu attendu",
  completed: "Terminée",
  rejected: "Refusée",
  no_show: "Absence",

  low: "Faible",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",

  in_pharmacy: "En pharmacie",
  remote: "À distance",
  hybrid: "Hybride",
  external_event: "Événement extérieur",

  // Produits / pharmacie
  standard: "Standard",
  priority: "Prioritaire",
  strategic: "Stratégique",
  planned: "Planifié",
  implanted: "Implanté",
  active: "Actif",
  temporarily_unavailable: "Temporairement indisponible",

  tr1_prospecting: "Prospection TR1",
  brand_existing_client: "Client existant de la marque",
  referral: "Recommandation",
  groupement: "Groupement",
  event: "Événement",
  inbound: "Demande entrante",

  // Historique / actions courantes
  insert: "Création",
  update: "Mise à jour",
  delete: "Suppression",
  create: "Création",
  archive: "Archivage",
  restore: "Restauration",
  order_created: "Commande créée",
  order_updated: "Commande mise à jour",
  order_status_changed: "Statut de commande modifié",
  mission_created: "Mission créée",
  mission_updated: "Mission mise à jour",
  mission_status_changed: "Statut de mission modifié",
};

export function uiLabel(value: string | null | undefined) {
  if (!value) return "—";
  return valueLabels[value] ?? value;
}

const exactMessages: Record<string, string> = {
  "Self assignment is forbidden":
    "Vous ne pouvez pas vous attribuer directement cette pharmacie.",
  "Brand access is required":
    "Vous n’avez pas accès à cette marque.",
  "Order creation forbidden":
    "Vous n’êtes pas autorisé à créer cette commande.",
  "Select one pharmacy resolution method":
    "Sélectionnez une seule méthode d’identification de la pharmacie.",
  "Brand pharmacy unavailable":
    "Cette pharmacie n’est pas disponible pour cette marque.",
  "A pharmacy name is required":
    "Le nom de la pharmacie est obligatoire.",
  "A matching directory pharmacy already exists; select it before confirming":
    "Une pharmacie correspondante existe déjà dans TR1. Sélectionnez-la avant de confirmer.",
  "Directory pharmacy unavailable":
    "Cette pharmacie n’est plus disponible dans le référentiel TR1.",
  "Assignment brand scope mismatch":
    "Cette affectation ne correspond pas au périmètre de la marque.",
  "Assigned user has no active brand membership":
    "L’utilisateur sélectionné n’a pas d’accès actif à cette marque.",
  "Territory has multiple active agent portfolios":
    "Plusieurs agents actifs sont affectés à ce territoire.",
  "Territory pharmacy already has another primary agent":
    "Cette pharmacie est déjà affectée à un autre agent principal.",
  "Insufficient brand permission":
    "Vos droits sont insuffisants pour cette marque.",
  "Pharmacy unavailable":
    "Cette pharmacie n’est pas disponible.",
};

export function translateUiMessage(value: string | null | undefined) {
  if (!value) return "";

  const message = value.trim();
  if (exactMessages[message]) return exactMessages[message];

  let match = message.match(
    /^Explicit Date de Commande was blank; used header date ['"](.+?)['"] as orderDate\.?$/i,
  );
  if (match) {
    return `La date de commande était vide ; la date du document (${match[1]}) a été utilisée.`;
  }

  match = message.match(
    /^Unlabeled number ['"](.+?)['"] ignored; SIRET\/CIP\/FINESS left null\.?$/i,
  );
  if (match) {
    return `Le numéro ${match[1]} n’étant pas identifié comme CIP, SIRET ou FINESS, il a été ignoré.`;
  }

  if (/rows? with only free units/i.test(message)) {
    return "Les lignes contenant uniquement des unités gratuites ont été intégrées en UG.";
  }

  if (/no SKU provided/i.test(message)) {
    return "Aucune référence interne n’est indiquée sur le document ; le champ a été laissé vide.";
  }

  // Empêche une erreur technique anglaise brute d'arriver à l'utilisateur.
  if (
    /\b(forbidden|required|unavailable|invalid|failed|failure|cannot|missing|must|already exists|permission|assignment|not found)\b/i.test(
      message,
    )
  ) {
    return "Une erreur technique est survenue. Vérifiez les informations puis réessayez.";
  }

  return message;
}

const matchMethodLabels: Record<string, string> = {
  siret: "SIRET",
  cip: "CIP",
  finess: "FINESS",
  name_postal_code: "nom + code postal",
  name_contains_postal_code: "nom proche + code postal",
  postal_code: "code postal",
  ean: "EAN",
  sku: "référence interne",
  reference_ean: "EAN de référence",
  reference_sku: "référence interne associée",
  exact_name: "nom exact",
};

export function translateMatchMethod(value: string | null | undefined) {
  if (!value) return "automatique";
  return matchMethodLabels[value] ?? "automatique";
}

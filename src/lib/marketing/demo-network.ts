export type DemoMode = "commercial" | "animations" | "formations";
export type DemoTone = "healthy" | "watch" | "risk" | "neutral";

export type DemoModeData = {
  tone: DemoTone;
  status: string;
  information: string;
  nextAction: string;
};

export type FormationDetail = {
  module: string;
  date: string;
  trainer: string;
  participants: number;
  status: string;
  averageScore?: number;
};

export type AnimationDetail = {
  date: string;
  facilitator: string;
  status: string;
  objective: string;
  sellOut: string;
  observedRevenue: string;
  billing: string;
};

export type DemoPharmacy = {
  id: string;
  name: string;
  city: string;
  longitude: number;
  latitude: number;
  commercial: DemoModeData;
  animations: DemoModeData;
  formations: DemoModeData;
  formationDetail?: FormationDetail;
  animationDetail?: AnimationDetail;
};

export const demoPharmacies: DemoPharmacy[] = [
  {
    id: "arcades-lille",
    name: "Pharmacie des Arcades",
    city: "Lille",
    longitude: 3.0573,
    latitude: 50.6292,
    commercial: {
      tone: "risk",
      status: "Réassort attendu",
      information: "Aucune commande depuis 71 jours.",
      nextAction: "Relancer le titulaire.",
    },
    animations: {
      tone: "watch",
      status: "Animation planifiée",
      information: "Intervenant affecté · intervention à venir.",
      nextAction: "Vérifier le brief avant l’intervention.",
    },
    formations: {
      tone: "healthy",
      status: "Module terminé",
      information: "5 participants · score moyen 86 %.",
      nextAction: "Partager les acquis et programmer la suite.",
    },
    formationDetail: {
      module: "Conseil sommeil",
      date: "2 sept. 2026",
      trainer: "Nadia Benali",
      participants: 5,
      status: "Terminée",
      averageScore: 86,
    },
  },
  {
    id: "republique-paris",
    name: "Pharmacie République",
    city: "Paris",
    longitude: 2.3522,
    latitude: 48.8566,
    commercial: {
      tone: "healthy",
      status: "Compte actif",
      information: "Réassort régulier et prochain échange préparé.",
      nextAction: "Maintenir le rythme de suivi.",
    },
    animations: {
      tone: "watch",
      status: "Compte rendu attendu",
      information: "Animation réalisée · compte rendu en attente.",
      nextAction: "Récupérer le compte rendu.",
    },
    formations: {
      tone: "watch",
      status: "Complément à prévoir",
      information: "4 participants · module terminé · score moyen 62 %.",
      nextAction: "Programmer un complément de formation.",
    },
    formationDetail: {
      module: "Répondre aux objections",
      date: "10 sept. 2026",
      trainer: "Sophie Martin",
      participants: 4,
      status: "Complément à prévoir",
      averageScore: 62,
    },
  },
  {
    id: "graslin-nantes",
    name: "Pharmacie Graslin",
    city: "Nantes",
    longitude: -1.5536,
    latitude: 47.2184,
    commercial: {
      tone: "watch",
      status: "Prochaine action à définir",
      information: "Dernier échange enregistré, aucune suite planifiée.",
      nextAction: "Définir la prochaine visite.",
    },
    animations: {
      tone: "watch",
      status: "Intervenant à confirmer",
      information: "Créneau proposé · intervenant non confirmé.",
      nextAction: "Confirmer l’intervenant.",
    },
    formations: {
      tone: "neutral",
      status: "Module commencé",
      information: "Résultats incomplets.",
      nextAction: "Terminer le module avant de calculer un score.",
    },
    formationDetail: {
      module: "Découverte de la gamme",
      date: "12 sept. 2026",
      trainer: "Julien Morel",
      participants: 3,
      status: "En cours",
    },
  },
  {
    id: "bellecour-lyon",
    name: "Pharmacie Bellecour",
    city: "Lyon",
    longitude: 4.8357,
    latitude: 45.764,
    commercial: {
      tone: "healthy",
      status: "Visite planifiée",
      information: "Prochain rendez-vous confirmé.",
      nextAction: "Préparer la visite.",
    },
    animations: {
      tone: "healthy",
      status: "Animation réalisée",
      information: "Rapport validé · résultats disponibles.",
      nextAction: "Préparer le suivi commercial.",
    },
    formations: {
      tone: "watch",
      status: "Formation à programmer",
      information: "Aucune session réalisée sur la période.",
      nextAction: "Planifier une formation équipe.",
    },
  },
  {
    id: "comedie-montpellier",
    name: "Pharmacie Comédie",
    city: "Montpellier",
    longitude: 3.8767,
    latitude: 43.6108,
    commercial: {
      tone: "watch",
      status: "Réassort à surveiller",
      information: "Rotation à contrôler lors du prochain passage.",
      nextAction: "Vérifier le stock et le réassort.",
    },
    animations: {
      tone: "healthy",
      status: "Bilan disponible",
      information: "Animation réalisée · bilan disponible.",
      nextAction: "Préparer le suivi commercial.",
    },
    formations: {
      tone: "healthy",
      status: "Formation terminée",
      information: "6 participants · 3 modules terminés · score moyen 91 %.",
      nextAction: "Partager la synthèse à l’équipe.",
    },
    formationDetail: {
      module: "Conseiller la gamme",
      date: "4 sept. 2026",
      trainer: "Nadia Benali",
      participants: 6,
      status: "Terminée",
      averageScore: 91,
    },
    animationDetail: {
      date: "31 août 2026",
      facilitator: "Sophie Martin",
      status: "Bilan disponible",
      objective: "Soutenir le conseil et la rotation de la gamme.",
      sellOut: "24 unités déclarées",
      observedRevenue: "En cours d’observation",
      billing: "Facturation à valider",
    },
  },
  {
    id: "prado-marseille",
    name: "Pharmacie du Prado",
    city: "Marseille",
    longitude: 5.3698,
    latitude: 43.2965,
    commercial: {
      tone: "healthy",
      status: "Compte en progression",
      information: "Réassort enregistré et suivi actif.",
      nextAction: "Suivre la rotation des références.",
    },
    animations: {
      tone: "watch",
      status: "Animation planifiée",
      information: "Intervention programmée · aucun résultat à ce stade.",
      nextAction: "Valider les derniers éléments du brief.",
    },
    formations: {
      tone: "watch",
      status: "Complément à prévoir",
      information: "3 participants · module terminé · score moyen 68 %.",
      nextAction: "Renforcer les notions les moins maîtrisées.",
    },
    formationDetail: {
      module: "Conseil au comptoir",
      date: "6 sept. 2026",
      trainer: "Julien Morel",
      participants: 3,
      status: "Complément à prévoir",
      averageScore: 68,
    },
  },
];

export const demoPharmacyById = new Map(demoPharmacies.map((pharmacy) => [pharmacy.id, pharmacy]));

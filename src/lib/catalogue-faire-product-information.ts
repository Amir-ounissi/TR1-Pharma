// Informations complémentaires issues de fiches de vendeurs tiers sur Faire.
// Vérifier avec la documentation fabricant avant tout usage réglementaire/marketing final.
// Aucun prix fournisseur ou prix de vente n’est collecté dans ce module.
export type FaireProductInformation = {
  description: string;
  benefits: string[];
  keyIngredients: string[];
  origin: string;
  sourceUrl: string;
  sourceSeller: string;
};

export const faireProductInformationByEan: Record<string, FaireProductInformation> = {
  "8809447256221": {
    "description": "Crème légère, à la texture proche d’un gel, conçue pour hydrater et apporter du confort aux peaux fragilisées. Fini non gras.",
    "benefits": [
      "Hydratation et confort cutané",
      "Aide à préserver la barrière d’hydratation",
      "Teint d’apparence plus uniforme"
    ],
    "keyIngredients": [
      "Niacinamide",
      "Panthénol",
      "Céramide NP",
      "Squalane"
    ],
    "origin": "Corée du Sud",
    "sourceUrl": "https://www.faire.com/fr/product/p_hx7tyncw32",
    "sourceSeller": "K-Beauty by AesthySkin"
  },
  "8809782555508": {
    "description": "Protection solaire visage SPF50+ PA++++ à texture crémeuse légère, formulée avec du riz et des extraits fermentés. Fini sans trace blanche selon la description du vendeur.",
    "benefits": [
      "Protection solaire quotidienne SPF50+ PA++++",
      "Fini confortable et non collant",
      "Hydratation et effet éclat"
    ],
    "keyIngredients": [
      "Extrait de riz",
      "Ferments de céréales",
      "Niacinamide"
    ],
    "origin": "Corée du Sud",
    "sourceUrl": "https://www.faire.com/fr/product/p_cheynx25gx",
    "sourceSeller": "SKEEN"
  },
  "8809968130277": {
    "description": "Soin solaire visage SPF50+ PA++++ à la texture fraîche et légère, associant eau de graine de riz et panthénol.",
    "benefits": [
      "Protection solaire quotidienne SPF50+ PA++++",
      "Texture légère, non grasse",
      "Hydratation et confort"
    ],
    "keyIngredients": [
      "Eau de riz",
      "Panthénol (vitamine B5)"
    ],
    "origin": "Corée du Sud",
    "sourceUrl": "https://www.faire.com/product/p_hw32cj5sqg",
    "sourceSeller": "Glowiss"
  },
  "8809657114960": {
    "description": "Sérum visage à la texture légèrement miellée, associant propolis et niacinamide pour les peaux sujettes aux irrégularités de texture et à l’excès de sébum.",
    "benefits": [
      "Hydratation et confort",
      "Aspect des pores et excès de sébum",
      "Apparence des rougeurs"
    ],
    "keyIngredients": [
      "Extrait de propolis (60 % selon vendeur)",
      "Niacinamide (2 % selon vendeur)"
    ],
    "origin": "Corée du Sud",
    "sourceUrl": "https://www.faire.com/product/p_be9dsxu4en",
    "sourceSeller": "AhoyBeauty"
  },
  "8809937361725": {
    "description": "Masque hydrogel Biodance conçu pour hydrater les peaux en manque de confort. La texture adhère au visage et devient progressivement translucide pendant la pose.",
    "benefits": [
      "Hydratation",
      "Confort des peaux sensibles",
      "Soutien de la barrière cutanée"
    ],
    "keyIngredients": [
      "Céramides",
      "Panthénol",
      "Acide hyaluronique"
    ],
    "origin": "Corée du Sud",
    "sourceUrl": "https://www.faire.com/es-es/product/p_yu445q27a3",
    "sourceSeller": "Holy Skin"
  },
  "8809447256122": {
    "description": "Brume visage à deux phases associant essence aqueuse et fraction crémeuse, pour rafraîchir et hydrater la peau sans application manuelle.",
    "benefits": [
      "Hydratation rapide",
      "Apaisement et confort",
      "Utilisation au cours de la journée"
    ],
    "keyIngredients": [
      "Acide hyaluronique",
      "Panthénol",
      "Centella asiatica"
    ],
    "origin": "Corée du Sud",
    "sourceUrl": "https://www.faire.com/product/p_3m5gze3j3q",
    "sourceSeller": "Glowiss"
  }
};

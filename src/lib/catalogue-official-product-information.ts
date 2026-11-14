// Documentation produit du fabricant ; descriptions reformulées, sans données tarifaires.
// Les listes d'actifs mises en avant ne remplacent pas la liste INCI réglementaire du lot livré.
// Ne pas assimiler l'information fabricant à une donnée issue de la Base Claude Bernard.
export type OfficialEducation = {
  description:string;
  benefits:string[];
  keyIngredients:string[];
  sourceUrl:string;
  sourceName:string;
  usage?:string;
};
export const officialBiodanceByName: Record<string,OfficialEducation> = {
  "Bio Collagen-Real Deep Mask": {
    "description": "Masque hydrogel conçu pour apporter de l’hydratation et améliorer l’apparence de la fermeté et du grain de peau.",
    "benefits": [
      "Hydratation",
      "Aspect des pores",
      "Souplesse et élasticité apparentes"
    ],
    "keyIngredients": [
      "Collagène hydrolysé 243 Da",
      "Acide hyaluronique",
      "Ferments de Galactomyces"
    ],
    "sourceUrl": "https://biodance.com/pages/bio-collagen-real-deep-mask",
    "sourceName": "Biodance (fabricant)",
    "usage": "Appliquer sur peau nettoyée pendant 3 à 4 heures ou pendant la nuit selon les indications du fabricant."
  },
  "Hydro Cera-nol Real Deep Mask": {
    "description": "Masque hydrogel axé sur le confort des peaux déshydratées et le soutien de la barrière cutanée.",
    "benefits": [
      "Hydratation et confort",
      "Peaux sèches ou sensibles",
      "Protection contre la perte en eau"
    ],
    "keyIngredients": [
      "Complexe Cera-nol",
      "Céramides",
      "Panthénol",
      "Acide hyaluronique"
    ],
    "sourceUrl": "https://biodance.com/pages/hydro-cera-nol-real-deep-mask",
    "sourceName": "Biodance (fabricant)",
    "usage": "Appliquer sur peau propre et laisser poser selon la notice du masque."
  },
  "Radiant Vita Niacinamide Real Deep Mask": {
    "description": "Masque hydrogel éclat pensé pour les teints ternes et irréguliers.",
    "benefits": [
      "Éclat du teint",
      "Uniformité visuelle",
      "Hydratation"
    ],
    "keyIngredients": [
      "Niacinamide",
      "Glutathion",
      "Eau d’ananas"
    ],
    "sourceUrl": "https://biodance.com/pages/radiant-vita-niacinamide-real-deep-mask",
    "sourceName": "Biodance (fabricant)"
  },
  "Refreshing Sea Kelp Real Deep Mask": {
    "description": "Masque hydrogel apaisant ciblant les peaux mixtes à grasses sujettes aux imperfections et aux rougeurs visibles.",
    "benefits": [
      "Confort cutané",
      "Aspect des rougeurs",
      "Équilibre des peaux grasses"
    ],
    "keyIngredients": [
      "Algue marine fermentée (sea kelp)",
      "Eau de mer",
      "Niacinamide"
    ],
    "sourceUrl": "https://biodance.com/pages/refreshing-sea-kelp-real-deep-mask",
    "sourceName": "Biodance (fabricant)"
  },
  "Rejuvenating Caviar PDRN Real Deep Mask": {
    "description": "Masque hydrogel nourrissant à base d’ingrédients marins, dédié à la souplesse et à l’éclat des peaux en perte de confort.",
    "benefits": [
      "Souplesse",
      "Hydratation",
      "Apparence plus lisse"
    ],
    "keyIngredients": [
      "Eau de caviar",
      "Extrait de caviar",
      "PDRN de saumon"
    ],
    "sourceUrl": "https://biodance.com/pages/rejuvenating-caviar-pdrn-real-deep-mask",
    "sourceName": "Biodance (fabricant)"
  },
  "Collagen Gel Toner Pads": {
    "description": "Disques de soin imprégnés d’hydrogel, destinés à lisser visuellement la peau et à améliorer son confort avant les soins.",
    "benefits": [
      "Aspect des pores",
      "Élasticité apparente",
      "Préparation de la peau"
    ],
    "keyIngredients": [
      "Eau de collagène",
      "Peptides",
      "Acide hyaluronique"
    ],
    "sourceUrl": "https://biodance.com/pages/collagen-gel-toner-pads",
    "sourceName": "Biodance (fabricant)",
    "usage": "Sur peau propre, laisser poser les pads quelques minutes ou utiliser selon la notice fabricant."
  },
  "Cera-nol Gel Toner Pads": {
    "description": "Pads hydrogel rafraîchissants pour apporter de l’hydratation et du confort aux peaux sensibles.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Soutien de la barrière cutanée"
    ],
    "keyIngredients": [
      "Céramides",
      "Panthénol",
      "Eau glaciaire"
    ],
    "sourceUrl": "https://biodance.com/pages/cera-nol-gel-toner-pads",
    "sourceName": "Biodance (fabricant)"
  },
  "Vita Niacinamide Gel Toner Pads": {
    "description": "Pads hydrogel éclat, conçus pour les teints irréguliers et ternes.",
    "benefits": [
      "Éclat",
      "Uniformité du teint",
      "Hydratation"
    ],
    "keyIngredients": [
      "Niacinamide",
      "Extrait d’ananas",
      "Glutathion",
      "Acide hyaluronique"
    ],
    "sourceUrl": "https://biodance.com/pages/vita-niacinamide-gel-toner-pads",
    "sourceName": "Biodance (fabricant)"
  },
  "Sea Kelp Gel Toner Pads": {
    "description": "Pads hydrogel apaisants à l’algue marine fermentée, particulièrement orientés vers les peaux grasses.",
    "benefits": [
      "Apaisement",
      "Confort des peaux à imperfections",
      "Effet rafraîchissant"
    ],
    "keyIngredients": [
      "Sea kelp fermenté",
      "Eau de mer"
    ],
    "sourceUrl": "https://biodance.com/pages/sea-kelp-gel-toner-pads",
    "sourceName": "Biodance (fabricant)"
  },
  "Caviar PDRN Dual Gel Toner Pads": {
    "description": "Pads de soin à double usage, pouvant être utilisés en geste d’essuyage ou en pose localisée, pour l’hydratation et la souplesse.",
    "benefits": [
      "Hydratation",
      "Souplesse",
      "Éclat"
    ],
    "keyIngredients": [
      "Complexe Caviar PDRN"
    ],
    "sourceUrl": "https://biodance.com/pages/caviar-pdrn-dual-gel-toner-pads",
    "sourceName": "Biodance (fabricant)"
  },
  "First Synergy Toner": {
    "description": "Lotion tonique hydratante pensée pour préparer la peau aux étapes suivantes de la routine.",
    "benefits": [
      "Hydratation",
      "Préparation aux soins",
      "Confort"
    ],
    "keyIngredients": [
      "Acides hyaluroniques de différents poids moléculaires",
      "Panthénol",
      "Complexe apaisant"
    ],
    "sourceUrl": "https://biodance.com/pages/first-synergy-toner",
    "sourceName": "Biodance (fabricant)"
  },
  "Skin Refining Mild PHA Toner": {
    "description": "Lotion exfoliante douce, avec PHA, destinée à améliorer l’aspect du grain de peau.",
    "benefits": [
      "Exfoliation douce",
      "Aspect plus lisse",
      "Confort après exfoliation"
    ],
    "keyIngredients": [
      "PHA 8 %",
      "LHA",
      "Céramides",
      "Facteurs naturels d’hydratation"
    ],
    "sourceUrl": "https://biodance.com/pages/skin-refining-mild-pha-toner",
    "sourceName": "Biodance (fabricant)",
    "usage": "Commencer quelques fois par semaine, puis adapter la fréquence selon la tolérance ; appliquer une protection solaire en journée."
  },
  "Micro Dual Serum Toner": {
    "description": "Lotion sérum biphasée associant une phase aqueuse et une phase huileuse pour hydrater la peau et raviver son éclat.",
    "benefits": [
      "Hydratation",
      "Souplesse",
      "Éclat"
    ],
    "keyIngredients": [
      "Huile de pépins de raisin pressée à froid",
      "Panthénol",
      "Acide hyaluronique"
    ],
    "sourceUrl": "https://biodance.com/pages/micro-dual-serum-toner",
    "sourceName": "Biodance (fabricant)",
    "usage": "Agiter avant utilisation pour mélanger les deux phases."
  },
  "Pore Perfecting Collagen Peptide Serum": {
    "description": "Sérum visage à la ligne collagène dédié à l’apparence des pores et au maintien d’une peau souple.",
    "benefits": [
      "Aspect des pores",
      "Élasticité apparente",
      "Éclat"
    ],
    "keyIngredients": [
      "Eau de collagène 243 Da",
      "Complexe de peptides"
    ],
    "sourceUrl": "https://biodance.com/pages/pore-perfecting-collagen-peptide-serum",
    "sourceName": "Biodance (fabricant)"
  },
  "Hydro Cera-nol Serum": {
    "description": "Sérum léger pour apporter une hydratation continue et renforcer le confort des peaux sèches.",
    "benefits": [
      "Hydratation",
      "Confort des peaux sensibles",
      "Soutien de la barrière cutanée"
    ],
    "keyIngredients": [
      "Acides hyaluroniques",
      "Céramides",
      "D-panthénol",
      "Allantoïne"
    ],
    "sourceUrl": "https://biodance.com/pages/hydro-cera-nol-serum",
    "sourceName": "Biodance (fabricant)",
    "usage": "Après la lotion, appliquer 2 à 3 gouttes et terminer par une crème hydratante."
  },
  "Radiant Vita Niacinamide Serum": {
    "description": "Sérum à la niacinamide pour une apparence de teint plus homogène et lumineuse.",
    "benefits": [
      "Éclat",
      "Aspect des taches",
      "Uniformité"
    ],
    "keyIngredients": [
      "Niacinamide",
      "Glutathion",
      "Eau d’ananas"
    ],
    "sourceUrl": "https://biodance.com/pages/radiant-vita-niacinamide-serum",
    "sourceName": "Biodance (fabricant)"
  },
  "Refreshing Sea Kelp Serum": {
    "description": "Sérum aqueux destiné aux peaux mixtes à grasses qui cherchent confort et apaisement.",
    "benefits": [
      "Confort",
      "Aspect des rougeurs",
      "Équilibre de la peau"
    ],
    "keyIngredients": [
      "Eau d’algue marine fermentée",
      "Centella asiatica"
    ],
    "sourceUrl": "https://biodance.com/pages/refreshing-sea-kelp-serum",
    "sourceName": "Biodance (fabricant)"
  },
  "Collagen Peptide Liposome Bubble Booster": {
    "description": "Booster moussant activé par agitation, conçu pour préparer la peau et en améliorer l’aspect rebondi.",
    "benefits": [
      "Éclat",
      "Aspect rebondi",
      "Confort"
    ],
    "keyIngredients": [
      "Liposomes de peptides de collagène",
      "Eau de collagène 243 Da"
    ],
    "sourceUrl": "https://biodance.com/pages/collagen-peptide-liposome-bubble-booster",
    "sourceName": "Biodance (fabricant)",
    "usage": "Agiter selon la notice pour activer la texture moussante."
  },
  "Caviar PDRN Liposome Bubble Booster": {
    "description": "Booster moussant à base de liposomes Caviar PDRN, destiné aux routines hydratantes.",
    "benefits": [
      "Hydratation",
      "Éclat",
      "Souplesse"
    ],
    "keyIngredients": [
      "Liposomes de Caviar PDRN"
    ],
    "sourceUrl": "https://biodance.com/pages/caviar-pdrn-liposome-bubble-booster",
    "sourceName": "Biodance (fabricant)",
    "usage": "Agiter selon la notice pour activer la texture moussante."
  },
  "Pore Perfecting Collagen Peptide Cream": {
    "description": "Crème visage à la ligne collagène, conçue pour lisser visuellement et hydrater la peau.",
    "benefits": [
      "Aspect des pores",
      "Souplesse",
      "Éclat"
    ],
    "keyIngredients": [
      "Eau de collagène 243 Da",
      "Peptides"
    ],
    "sourceUrl": "https://biodance.com/pages/pore-perfecting-collagen-peptide-cream",
    "sourceName": "Biodance (fabricant)"
  },
  "Radiant Vita Niacinamide Cream": {
    "description": "Crème éclat destinée au soin des teints irréguliers.",
    "benefits": [
      "Éclat",
      "Uniformité",
      "Hydratation"
    ],
    "keyIngredients": [
      "Niacinamide",
      "Eau d’ananas",
      "Glutathion"
    ],
    "sourceUrl": "https://biodance.com/pages/vita-niacinamide-cream",
    "sourceName": "Biodance (fabricant)"
  },
  "Skin-Glow Essence Cream": {
    "description": "Crème hydratante visant le confort et l’éclat des peaux sujettes à la déshydratation.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Éclat"
    ],
    "keyIngredients": [
      "Acide hyaluronique",
      "Céramides",
      "Facteurs naturels d’hydratation",
      "Probiotiques"
    ],
    "sourceUrl": "https://biodance.com/pages/biodance-skin-glow-essence-cream-50ml",
    "sourceName": "Biodance (fabricant)"
  },
  "Rejuvenating Caviar PDRN Capsule Cream": {
    "description": "Crème à capsules pour une apparence plus souple et lumineuse des peaux sèches.",
    "benefits": [
      "Hydratation",
      "Souplesse",
      "Éclat"
    ],
    "keyIngredients": [
      "Extrait et eau de caviar",
      "PDRN de saumon"
    ],
    "sourceUrl": "https://biodance.com/pages/rejuvenating-caviar-pdrn-capsule-cream",
    "sourceName": "Biodance (fabricant)"
  },
  "Collagen Cleansing Oil": {
    "description": "Huile nettoyante première étape du double nettoyage, destinée au retrait du maquillage et des filtres solaires.",
    "benefits": [
      "Démaquillage",
      "Nettoyage des impuretés",
      "Confort"
    ],
    "keyIngredients": [
      "Huiles végétales",
      "Peptides",
      "Collagène 243 Da"
    ],
    "sourceUrl": "https://biodance.com/pages/collagen-cleansing-oil",
    "sourceName": "Biodance (fabricant)"
  },
  "Hydro Ceramide Cleansing Powder": {
    "description": "Poudre nettoyante enzymatique pour éliminer en douceur les impuretés de surface.",
    "benefits": [
      "Nettoyage",
      "Aspect du grain de peau",
      "Confort"
    ],
    "keyIngredients": [
      "Céramides",
      "Acide hyaluronique",
      "Papaïne"
    ],
    "sourceUrl": "https://biodance.com/pages/hydro-ceramide-cleansing-powder",
    "sourceName": "Biodance (fabricant)"
  },
  "Collagen Peptide Eye Patches": {
    "description": "Patchs hydrogel contour des yeux destinés à hydrater et améliorer l’aspect des ridules.",
    "benefits": [
      "Hydratation du contour des yeux",
      "Aspect des ridules",
      "Élasticité apparente"
    ],
    "keyIngredients": [
      "Collagène 243 Da",
      "Peptides",
      "Caféine"
    ],
    "sourceUrl": "https://biodance.com/pages/collagen-peptide-eye-patches",
    "sourceName": "Biodance (fabricant)"
  },
  "Caviar PDRN Eye Patches": {
    "description": "Patchs hydrogel contour des yeux pour améliorer l’aspect des poches et préserver l’hydratation.",
    "benefits": [
      "Hydratation",
      "Aspect des poches",
      "Éclat du regard"
    ],
    "keyIngredients": [
      "Eau de caviar",
      "PDRN de saumon",
      "Caféine"
    ],
    "sourceUrl": "https://biodance.com/pages/caviar-pdrn-eye-patches",
    "sourceName": "Biodance (fabricant)"
  },
  "Collagen Peptide Jelly Serum Mist": {
    "description": "Brume sérum à texture gel dédiée à l’hydratation et à l’éclat du visage.",
    "benefits": [
      "Hydratation",
      "Éclat",
      "Souplesse"
    ],
    "keyIngredients": [
      "Collagène 243 Da",
      "Peptides"
    ],
    "sourceUrl": "https://biodance.com/pages/collagen-peptide-jelly-serum-mist",
    "sourceName": "Biodance (fabricant)"
  },
  "Caviar PDRN Jelly Serum Mist": {
    "description": "Brume sérum à texture gel nourrissante et hydratante.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Souplesse"
    ],
    "keyIngredients": [
      "Eau de caviar",
      "PDRN"
    ],
    "sourceUrl": "https://biodance.com/pages/caviar-pdrn-jelly-serum-mist",
    "sourceName": "Biodance (fabricant)"
  }
};

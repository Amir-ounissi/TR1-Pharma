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

// Fiches publiques Beauty of Joseon recoupées avec le site officiel.
// Un même soin peut exister en formats différents, identifiés par EAN distincts.
export const officialBeautyOfJoseonByEan: Record<string,OfficialEducation> = {
  "8809738312872": {
    "description": "Gel exfoliant peluchant à base de fleur de prunier et de cellulose, pour une peau visuellement plus lisse.",
    "benefits": [
      "Exfoliation douce",
      "Grain de peau affiné",
      "Confort"
    ],
    "keyIngredients": [
      "Eau de fleur de prunier",
      "Cellulose végétale"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/apricot-blossom-peeling-gel",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Sur peau sèche et propre, masser doucement puis rincer soigneusement."
  },
  "8809968133124": {
    "description": "Sérum hydratant destiné aux peaux sujettes aux sensations d’inconfort.",
    "benefits": [
      "Hydratation",
      "Confort cutané",
      "Soutien de la barrière"
    ],
    "keyIngredients": [
      "Green Tea-HA™",
      "Panthénol",
      "Céramide NP"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/calming-barrier-serum",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809738316412": {
    "description": "Sérum apaisant et hydratant associant thé vert et panthénol.",
    "benefits": [
      "Confort",
      "Hydratation",
      "Aspect des rougeurs"
    ],
    "keyIngredients": [
      "Thé vert",
      "Panthénol"
    ],
    "sourceUrl": "https://beautyofjoseon.com/collections/serum",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809968130918": {
    "description": "Sérum apaisant et hydratant associant thé vert et panthénol.",
    "benefits": [
      "Confort",
      "Hydratation",
      "Aspect des rougeurs"
    ],
    "keyIngredients": [
      "Thé vert",
      "Panthénol"
    ],
    "sourceUrl": "https://beautyofjoseon.com/collections/serum",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809525249565": {
    "description": "Crème nourrissante au riz et au ginseng, pour une peau souple et un fini lumineux.",
    "benefits": [
      "Hydratation",
      "Souplesse",
      "Éclat"
    ],
    "keyIngredients": [
      "Eau de son de riz",
      "Ginseng",
      "Squalane",
      "Niacinamide"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/dynasty-cream",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Après lotion et sérum, appliquer une petite quantité sur visage et cou."
  },
  "8809954941498": {
    "description": "Crème nourrissante au riz et au ginseng, pour une peau souple et un fini lumineux.",
    "benefits": [
      "Hydratation",
      "Souplesse",
      "Éclat"
    ],
    "keyIngredients": [
      "Eau de son de riz",
      "Ginseng",
      "Squalane",
      "Niacinamide"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/dynasty-cream",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Après lotion et sérum, appliquer une petite quantité sur visage et cou."
  },
  "8809968130130": {
    "description": "Huile démaquillante conçue pour retirer maquillage, sébum et filtres solaires lors du premier nettoyage.",
    "benefits": [
      "Démaquillage",
      "Élimination des impuretés",
      "Confort"
    ],
    "keyIngredients": [
      "Huile de soja",
      "Huile de graines de ginseng"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/ginseng-cleansing-oil",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Masser sur peau sèche, émulsionner avec de l’eau puis rincer."
  },
  "8809738310960": {
    "description": "Essence tonique hydratante qui associe ginseng et niacinamide.",
    "benefits": [
      "Hydratation",
      "Éclat",
      "Équilibre sébum/hydratation"
    ],
    "keyIngredients": [
      "Eau de racine de ginseng",
      "Niacinamide",
      "Complexe ginseng"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/ginseng-essence-water",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809864752689": {
    "description": "Soin solaire visage à texture sérum, associant protection UV et actifs hydratants.",
    "benefits": [
      "Protection solaire",
      "Hydratation",
      "Confort"
    ],
    "keyIngredients": [
      "Ginseng"
    ],
    "sourceUrl": "https://beautyofjoseon.com/collections/sunscreen",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809738312728": {
    "description": "Sérum éclat ciblant l’apparence du teint irrégulier.",
    "benefits": [
      "Éclat",
      "Teint visuellement unifié",
      "Hydratation"
    ],
    "keyIngredients": [
      "Eau de riz",
      "Alpha-arbutine"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/glow-deep-serum-rice-alpha-arbutin",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809968130871": {
    "description": "Sérum éclat ciblant l’apparence du teint irrégulier.",
    "benefits": [
      "Éclat",
      "Teint visuellement unifié",
      "Hydratation"
    ],
    "keyIngredients": [
      "Eau de riz",
      "Alpha-arbutine"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/glow-deep-serum-rice-alpha-arbutin",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809968130239": {
    "description": "Lotion biphasée à base de riz, pensée pour hydrater tout en atténuant l’apparence du sébum.",
    "benefits": [
      "Hydratation",
      "Éclat sans effet gras",
      "Équilibre sébum/hydratation"
    ],
    "keyIngredients": [
      "Extrait de riz",
      "Acides aminés de riz"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/glow-replenishing-rice-milk",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Agiter pour mélanger les deux phases. Appliquer après le nettoyage, avec les mains ou un coton."
  },
  "8809657114960": {
    "description": "Sérum visage à la propolis et à la niacinamide, destiné à améliorer l’apparence des pores et l’éclat.",
    "benefits": [
      "Confort",
      "Éclat",
      "Aspect des pores"
    ],
    "keyIngredients": [
      "Propolis 60 %",
      "Niacinamide 2 %",
      "BHA"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/glow-serum-propolis-niacinamide",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer 2 à 3 gouttes sur le visage, puis tapoter jusqu’à absorption."
  },
  "8809968130895": {
    "description": "Sérum visage à la propolis et à la niacinamide, destiné à améliorer l’apparence des pores et l’éclat.",
    "benefits": [
      "Confort",
      "Éclat",
      "Aspect des pores"
    ],
    "keyIngredients": [
      "Propolis 60 %",
      "Niacinamide 2 %",
      "BHA"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/glow-serum-propolis-niacinamide",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer 2 à 3 gouttes sur le visage, puis tapoter jusqu’à absorption."
  },
  "8809738314678": {
    "description": "Gel nettoyant doux légèrement acide, destiné au nettoyage quotidien sans effet décapant.",
    "benefits": [
      "Nettoyage",
      "Confort",
      "Préparation de la peau"
    ],
    "keyIngredients": [
      "Eau de prune verte",
      "Extrait de haricot mungo"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/green-plum-refreshing-cleanser",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Sur visage humide, masser doucement puis rincer à l’eau tiède."
  },
  "8809968132172": {
    "description": "Gel nettoyant doux légèrement acide, destiné au nettoyage quotidien sans effet décapant.",
    "benefits": [
      "Nettoyage",
      "Confort",
      "Préparation de la peau"
    ],
    "keyIngredients": [
      "Eau de prune verte",
      "Extrait de haricot mungo"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/green-plum-refreshing-cleanser",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Sur visage humide, masser doucement puis rincer à l’eau tiède."
  },
  "8809968130123": {
    "description": "Lotion exfoliante pour peaux au grain irrégulier ou à pores visibles.",
    "benefits": [
      "Exfoliation",
      "Peau d’apparence plus lisse",
      "Aspect des pores"
    ],
    "keyIngredients": [
      "Eau de prune verte",
      "AHA",
      "BHA"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/green-plum-refreshing-toner-aha-bha",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Après nettoyage, appliquer en évitant le contour des yeux. Utiliser une protection solaire en journée."
  },
  "8809968130246": {
    "description": "Masque crème à rincer associant riz, miel et argile pour hydrater et purifier.",
    "benefits": [
      "Confort",
      "Éclat",
      "Nettoyage de surface"
    ],
    "keyIngredients": [
      "Riz",
      "Miel",
      "Kaolin"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/ground-rice-and-honey-glow-mask",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer une couche homogène, laisser poser 15 à 20 minutes puis rincer."
  },
  "8809875906477": {
    "description": "Sérum éclat à la vitamine C stabilisée, associé à la centella asiatica.",
    "benefits": [
      "Éclat",
      "Teint visuellement plus homogène",
      "Confort"
    ],
    "keyIngredients": [
      "Centella asiatica",
      "3-O-ethyl ascorbic acid (vitamine C stabilisée)"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/light-on-serum-centella-vita-c",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer après la lotion, puis la crème. Le matin, terminer par une protection solaire."
  },
  "8809864766884": {
    "description": "Stick solaire matifiant, pensé pour les retouches de protection au cours de la journée.",
    "benefits": [
      "Protection solaire",
      "Fini mat",
      "Retouches pratiques"
    ],
    "keyIngredients": [
      "Armoise (mugwort)",
      "Thé vert",
      "Complexe séborégulateur"
    ],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/matte-sun-stick-mugwort-camelia",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer sur les zones exposées ; renouveler régulièrement selon les recommandations de protection solaire."
  },
  "8809968133476": {
    "description": "Sérum lissant formulé avec un complexe PDRN de haricot rouge et des peptides.",
    "benefits": [
      "Aspect des pores",
      "Peau d’apparence plus rebondie",
      "Souplesse"
    ],
    "keyIngredients": [
      "Red Bean PDRN™",
      "Peptides"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/pore-firming-red-bean-pdrn-serum-global",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809606851663": {
    "description": "Baume démaquillant qui fond au massage, pour retirer maquillage et filtres solaires.",
    "benefits": [
      "Démaquillage",
      "Nettoyage",
      "Confort"
    ],
    "keyIngredients": [
      "Huile de son de riz",
      "Extraits de céréales"
    ],
    "sourceUrl": "https://beautyofjoseon.com/collections/cleanser",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809738316986": {
    "description": "Masque crème à l’argile et au haricot rouge pour améliorer l’aspect des pores sans sensation de dessèchement.",
    "benefits": [
      "Aspect des pores",
      "Excès de sébum",
      "Confort"
    ],
    "keyIngredients": [
      "Argile kaolin",
      "Extrait de haricot rouge"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/red-bean-refreshing-pore-mask",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Sur peau propre et légèrement humide, appliquer 5 à 10 minutes, puis masser doucement et rincer."
  },
  "8809738316993": {
    "description": "Gel hydratant léger destiné notamment aux peaux mixtes et grasses.",
    "benefits": [
      "Hydratation légère",
      "Aspect du sébum",
      "Souplesse"
    ],
    "keyIngredients": [
      "Extrait de haricot rouge",
      "Complexe de peptides"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/red-bean-water-gel",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809782555508": {
    "description": "Soin de protection solaire quotidien SPF50+ PA++++ au riz et aux extraits fermentés.",
    "benefits": [
      "Protection UV",
      "Hydratation",
      "Fini confortable"
    ],
    "keyIngredients": [
      "Riz",
      "Extraits fermentés"
    ],
    "sourceUrl": "https://beautyofjoseon.com/collections/sunscreen",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Dernière étape du soin du matin. Appliquer généreusement et renouveler régulièrement."
  },
  "8809968130277": {
    "description": "Fluide solaire SPF50+ PA++++ léger à base d’eau de riz et de panthénol.",
    "benefits": [
      "Protection UV",
      "Hydratation légère",
      "Confort des peaux mixtes"
    ],
    "keyIngredients": [
      "Eau de riz",
      "Panthénol (B5)"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/relief-sun-aqua-fresh",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Dernière étape de la routine du matin, appliquer généreusement puis renouveler au moins toutes les deux heures en cas d’exposition."
  },
  "8809738316146": {
    "description": "Sérum contour des yeux au ginseng et au rétinal, ciblant l’apparence des ridules.",
    "benefits": [
      "Hydratation du contour des yeux",
      "Aspect des ridules",
      "Souplesse"
    ],
    "keyIngredients": [
      "Ginseng",
      "Rétinal"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/revive-eye-serum-ginseng-retinal",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Commencer progressivement, notamment sur peau sensible ; appliquer une protection solaire dans la journée."
  },
  "8809968133193": {
    "description": "Crème hydratante au rétinol et au ginseng, destinée à améliorer l’apparence du grain de peau et la souplesse.",
    "benefits": [
      "Hydratation",
      "Aspect de la fermeté",
      "Grain de peau"
    ],
    "keyIngredients": [
      "Rétinol",
      "Ginseng Ceramide™"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/revive-firming-moisturizer",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Introduire progressivement selon la tolérance et porter une protection solaire en journée."
  },
  "8809968132523": {
    "description": "Patchs hydrogel contour des yeux au ginseng et au rétinal.",
    "benefits": [
      "Hydratation du regard",
      "Aspect des ridules",
      "Confort"
    ],
    "keyIngredients": [
      "Ginseng",
      "Rétinal",
      "Céramides"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/revive-under-eye-patch",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809738316139": {
    "description": "Sérum hydratant associant ginseng et filtrat de sécrétion d’escargot, pour une peau d’apparence rebondie.",
    "benefits": [
      "Hydratation",
      "Aspect de l’élasticité",
      "Confort"
    ],
    "keyIngredients": [
      "Ginseng",
      "Mucine d’escargot",
      "Centella asiatica"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/revive-serum-ginseng-snail-mucin",
    "sourceName": "Beauty of Joseon (fabricant)"
  },
  "8809968130888": {
    "description": "Sérum hydratant associant ginseng et filtrat de sécrétion d’escargot, pour une peau d’apparence rebondie.",
    "benefits": [
      "Hydratation",
      "Aspect de l’élasticité",
      "Confort"
    ],
    "keyIngredients": [
      "Ginseng",
      "Mucine d’escargot",
      "Centella asiatica"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/revive-serum-ginseng-snail-mucin",
    "sourceName": "Beauty of Joseon (fabricant)"
  }
};

// Fiches Dr. Althea rapprochées de sa documentation fabricant.
export const officialDrAltheaByEan: Record<string,OfficialEducation> = {
  "8809447256221": {
    "description": "Crème apaisante à texture légère, destinée aux peaux en recherche d’hydratation et de confort, notamment après les imperfections.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Soutien de la barrière cutanée"
    ],
    "keyIngredients": [
      "Céramide NP",
      "Panthénol",
      "Niacinamide",
      "Eau de tea tree"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/best-selling-recovery-duo",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Appliquer en dernière étape de soin et terminer par une protection solaire le matin."
  },
  "8809447256795": {
    "description": "Crème riche pour renforcer le confort des peaux sèches et soutenir la fonction barrière.",
    "benefits": [
      "Confort",
      "Hydratation",
      "Peau d’apparence plus souple"
    ],
    "keyIngredients": [
      "Ectoïne",
      "Bétaïne",
      "Bêta-glucane",
      "Acide hyaluronique",
      "Guaiazulène"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/dual-cream-set-345-relief-cream-147-barrier-cream",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Appliquer après le sérum, notamment dans la routine du soir."
  },
  "8809447256115": {
    "description": "Brume biphasée destinée à apporter de l’hydratation et du confort au cours de la journée.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Rafraîchissement"
    ],
    "keyIngredients": [
      "Eau de son de riz",
      "Panthénol",
      "Acide hyaluronique",
      "Centella asiatica",
      "Madécassoside"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/345-relief-cream-duo",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Agiter pour mélanger les deux phases, fermer yeux et bouche puis vaporiser uniformément."
  },
  "8809447256122": {
    "description": "Brume biphasée destinée à apporter de l’hydratation et du confort au cours de la journée.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Rafraîchissement"
    ],
    "keyIngredients": [
      "Eau de son de riz",
      "Panthénol",
      "Acide hyaluronique",
      "Centella asiatica",
      "Madécassoside"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/345-relief-cream-duo",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Agiter pour mélanger les deux phases, fermer yeux et bouche puis vaporiser uniformément."
  },
  "8809447256191": {
    "description": "Sérum léger destiné aux peaux déshydratées, conçu pour un fini lumineux sans effet gras.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Éclat"
    ],
    "keyIngredients": [
      "Eau de bambou",
      "Panthénol",
      "Guaiazulène",
      "PDRN d’origine végétale"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/aqua-deep-hydration-duo",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Appliquer après le nettoyage et avant la crème."
  },
  "8809447256085": {
    "description": "Crème hydratante à texture aqueuse, pensée pour apporter du confort sans sensation de lourdeur.",
    "benefits": [
      "Hydratation",
      "Confort",
      "Fini léger"
    ],
    "keyIngredients": [
      "Eau de bambou",
      "Panthénol",
      "Guaiazulène"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/aqua-deep-hydration-duo",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Appliquer après le sérum sur visage et cou."
  },
  "8809447256412": {
    "description": "Crème hydratante au PDRN d’origine fermentaire destinée au confort des peaux sèches et ternes.",
    "benefits": [
      "Hydratation",
      "Éclat",
      "Confort"
    ],
    "keyIngredients": [
      "PDRN vegan 5 000 ppm (Sodium DNA)",
      "Panthénol",
      "Eau de centella asiatica"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/pdrn-reju-5000-cream",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Appliquer après le sérum, adapter la quantité aux zones sèches."
  },
  "8809447254609": {
    "description": "Sérum concentré destiné aux utilisateurs habitués à la niacinamide et recherchant un effet sur la brillance.",
    "benefits": [
      "Aspect du sébum",
      "Aspect des pores",
      "Uniformité du teint"
    ],
    "keyIngredients": [
      "Niacinamide 15 %",
      "Zinc PCA"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/15-niacinamide-purity-serum",
    "sourceName": "Dr. Althea (fabricant)"
  },
  "8809447255101": {
    "description": "Sérum éclat à la vitamine C stabilisée, à texture légère et non collante.",
    "benefits": [
      "Éclat",
      "Teint visuellement homogène",
      "Confort"
    ],
    "keyIngredients": [
      "Vitamine C stabilisée (3-O-ethyl ascorbic acid)",
      "Eau d’argousier",
      "Niacinamide"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/gentle-vitamin-c-serum",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Introduire progressivement selon la tolérance ; en journée, terminer par une protection solaire."
  },
  "8809447256238": {
    "description": "Sérum à texture mousse qui se transforme en fluide léger lors de l’application.",
    "benefits": [
      "Hydratation",
      "Éclat",
      "Préparation au maquillage"
    ],
    "keyIngredients": [
      "Eau de collagène",
      "Argousier",
      "Bakuchiol"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/abc-glow-whipped-serum",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Après le nettoyage, répartir 1 à 2 pressions, puis appliquer la crème."
  },
  "8809447255620": {
    "description": "Baume nettoyant à distributeur mécanique qui dissout maquillage, filtres solaires et sébum de surface.",
    "benefits": [
      "Démaquillage",
      "Nettoyage",
      "Confort"
    ],
    "keyIngredients": [
      "Huile de son de riz",
      "Thé vert",
      "Huile de jojoba"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/pore-refresh-grinding-cleansing-balm",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Tourner le distributeur, masser sur peau sèche, émulsionner avec de l’eau puis rincer."
  },
  "8809447256658": {
    "description": "Sérum contour des yeux avec applicateur masseur conçu pour rafraîchir et améliorer l’aspect des ridules.",
    "benefits": [
      "Hydratation du regard",
      "Aspect des ridules",
      "Massage rafraîchissant"
    ],
    "keyIngredients": [
      "Rétinol",
      "Bakuchiol",
      "Panthénol",
      "Céramide NP"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/retinol-flat-iron-eye-roller",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Utiliser le soir, sans contact direct avec les yeux, en introduisant progressivement le produit."
  },
  "8809447257068": {
    "description": "Crème visage contenant du rétinol, destinée aux soins de la texture et de l’aspect des ridules.",
    "benefits": [
      "Grain de peau",
      "Aspect des ridules",
      "Souplesse"
    ],
    "keyIngredients": [
      "Rétinol 0,15 %"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/collections/cream",
    "sourceName": "Dr. Althea (fabricant)",
    "usage": "Introduire progressivement selon la tolérance et appliquer un SPF dans la journée."
  },
  "8809447255583": {
    "description": "Huile nettoyante douce, première étape du double nettoyage pour retirer maquillage et filtres solaires.",
    "benefits": [
      "Démaquillage",
      "Nettoyage",
      "Confort"
    ],
    "keyIngredients": [
      "Huiles émollientes végétales"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/collections/cleanser",
    "sourceName": "Dr. Althea (fabricant)"
  }
};

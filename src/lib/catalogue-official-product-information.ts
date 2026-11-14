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
  skinTypes?:string[];
  usageSteps?:string[];
  precautions?:string[];
  inci?:string;
  packaging?:string;
  origin?:string;
  alternateName?:string;
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
    "description": "Masque visage hydrogel en deux parties, conçu pour apporter une hydratation intense et du confort aux peaux sèches, sensibles, sujettes aux rougeurs ou dont la barrière cutanée est fragilisée. Sa matrice hydrogel se transforme progressivement et devient transparente pendant la pose, maintenant les actifs au contact de la peau.",
    "benefits": [
      "Hydratation intense et prolongée",
      "Aide à soutenir la barrière cutanée et à limiter la perte en eau",
      "Contribue à apaiser les sensations d’inconfort et les rougeurs visibles",
      "Sensation rafraîchissante sans menthol",
      "Hydrogel sans trame textile, qui devient progressivement transparent",
      "Format adapté à une pose prolongée ou à une utilisation de jour"
    ],
    "keyIngredients": [
      "Complexe Cera-nol : D-Panthénol, 5 céramides et 10 formes d’oligo-acide hyaluronique",
      "D-Panthénol : contribue à apaiser la peau",
      "Céramides NP, NS, AS, AP et EOP : participent au soutien de la barrière cutanée",
      "10 formes d’oligo-acide hyaluronique : contribuent à l’hydratation",
      "Eau glaciaire à 50 000 ppm : apporte une base aqueuse riche en minéraux",
      "Extraits de fenouil, coriandre, cardamome et safran : associés à la sensation rafraîchissante non mentholée"
    ],
    "sourceUrl": "https://biodance.com/pages/hydro-cera-nol-real-deep-mask",
    "sourceName": "Biodance — fabricant",
    "usage": "Appliquer sur peau propre après les soins légers, puis laisser poser 3 à 4 heures ou toute la nuit selon le protocole choisi.",
    "skinTypes": [
      "Peaux sèches",
      "Peaux sensibles",
      "Peaux sujettes aux rougeurs",
      "Peaux dont la barrière cutanée est fragilisée"
    ],
    "usageSteps": [
      "Nettoyer le visage et sécher délicatement la peau.",
      "Appliquer le toner et, si souhaité, un sérum léger. Éviter les crèmes ou huiles épaisses juste avant le masque.",
      "Déplier les deux parties du masque hydrogel.",
      "Positionner la partie supérieure sur le front et le contour des yeux, puis la partie inférieure sur le menton et la mâchoire. Ajuster délicatement.",
      "En journée, laisser poser 3 à 4 heures ou jusqu’à ce que le masque devienne transparent.",
      "Pour une pose de nuit, laisser agir jusqu’à 8 heures, puis retirer le masque au réveil.",
      "Tapoter l’essence restante pour favoriser son absorption."
    ],
    "precautions": [
      "Ne pas appliquer sur une peau irritée ou lésée.",
      "Cesser l’utilisation en cas de réaction allergique ou d’irritation."
    ],
    "inci": "Water, Dipropylene Glycol, Glycerin, Cetyl Ethylhexanoate, Niacinamide, Xanthan Gum, Ceratonia Siliqua (Carob) Gum, Chondrus Crispus, Betaine, Panthenol, Hydroxyacetophenone, Ethylhexyl Olivate, Butyrospermum Parkii (Shea) Butter, Potassium Chloride, Caprylyl Glycol, Butylene Glycol, Cellulose Gum, 1,2-Hexanediol, Sucrose, Polyacrylate-13, Sodium Acrylates Copolymer, Glyceryl Stearate, Algin, Chondrus Crispus Extract, Glucomannan, Polyglyceryl-4 Oleate, Ethylhexylglycerin, Hydrolyzed Hyaluronic Acid, Hydrogenated Polyisobutene, Adenosine, Pyrus Communis (Pear) Fruit Extract, Disodium EDTA, Polyglyceryl-10 Laurate, Rosa Damascena Flower Water, Ethylhexyl Palmitate, Allantoin, Iris Florentina Root Extract, Sorbitan Isostearate, Cucumis Melo (Melon) Fruit Extract, Hydrogenated Lecithin, Hedera Helix (Ivy) Leaf/Stem Extract, Dextrin, Cetearyl Alcohol, Stearic Acid, Sodium Hyaluronate, Dipotassium Glycyrrhizate, Collagen Extract, Coriandrum Sativum (Coriander) Extract, Foeniculum Vulgare (Fennel) Seed Extract, Elettaria Cardamomum Seed Extract, Crocus Sativus Flower Extract, Hydroxypropyltrimonium Hyaluronate, Ceramide NP, Tocopherol, Ceramide NS, Cholesterol, Sodium Acetylated Hyaluronate, Phytosphingosine, Ceramide AP, Ceramide AS, Hyaluronic Acid, Hydrolyzed Sodium Hyaluronate, Sodium Hyaluronate Crosspolymer, Potassium Hyaluronate, Ceramide EOP",
    "packaging": "Masque hydrogel en deux parties — 34 g par masque, vendu à l’unité pour cette référence",
    "origin": "Corée du Sud"
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
    "description": "Sérum visage à la texture onctueuse et légèrement miellée, associant propolis, niacinamide et BHA. Il aide à maintenir l’équilibre entre sébum et hydratation, à améliorer l’apparence des pores et du grain de peau, et à apporter confort et éclat. Sa texture pénètre sans laisser de résidu collant.",
    "benefits": [
      "Hydrate et apaise la peau",
      "Aide à équilibrer l’apparence du sébum et de l’hydratation",
      "Contribue à affiner visuellement le grain de peau et l’apparence des pores",
      "Exfolie en douceur grâce au BHA",
      "Aide à raviver l’éclat du teint",
      "Texture onctueuse, absorption sans film collant"
    ],
    "keyIngredients": [
      "Propolis 60 % : aide à hydrater et apaiser la peau",
      "Niacinamide 2 % : contribue à équilibrer le sébum et l’hydratation",
      "BHA (Betaine Salicylate) : exfolie en douceur et aide à désobstruer l’apparence des pores",
      "Acide hyaluronique : contribue à maintenir l’hydratation",
      "Centella asiatica et Tea Tree : extraits végétaux associés au confort cutané"
    ],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/glow-serum-propolis-niacinamide",
    "sourceName": "Beauty of Joseon — fabricant",
    "usage": "Appliquer 2 à 3 gouttes sur le visage et le cou, puis tapoter jusqu’à absorption.",
    "skinTypes": [
      "Tous types de peau",
      "Peaux présentant des pores visibles",
      "Peaux réactives ou sujettes à l’excès de sébum"
    ],
    "usageSteps": [
      "Après le nettoyage et le toner, déposer 2 à 3 gouttes dans la paume de la main.",
      "Appliquer délicatement sur le visage et le cou, en insistant sur les zones qui nécessitent davantage d’hydratation ou d’éclat.",
      "Tapoter du bout des doigts jusqu’à absorption complète.",
      "Peut être utilisé le matin et le soir."
    ],
    "precautions": [
      "En cas de peau sensible ou d’allergie connue à la niacinamide, effectuer un test sur une petite zone avant une utilisation régulière.",
      "Le sérum contient du BHA : utiliser une protection solaire pendant la journée."
    ],
    "inci": "Aqua, Dipropylene Glycol, Glycerin, Butylene Glycol, Propolis Extract, Niacinamide, 1,2-Hexanediol, Betaine Salicylate, Sodium Polyacryloyldimethyl Taurate, Tromethamine, Polyglyceryl-10 Laurate, Xanthan Gum, Caprylyl Glycol, Carbomer, Ethylhexylglycerin, Melia Azadirachta Flower Extract, Ocimum Sanctum Leaf Extract, Melia Azadirachta Leaf Extract, Sodium Hyaluronate, Curcuma Longa (Turmeric) Root Extract, Dextrin, Theobroma Cacao (Cocoa) Extract, Corallina Officinalis Extract, Melaleuca Alternifolia (Tea Tree) Extract, Centella Asiatica Extract, Methylpropanediol, Lotus Corniculatus Seed Extract, Pentylene Glycol, Octanediol, Calophyllum Inophyllum Seed Oil, Tocopherol",
    "packaging": "Flacon compte-gouttes — 30 ml",
    "origin": "Corée du Sud"
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
    "description": "Protection solaire visage SPF50+ PA++++ à la texture crème légère, inspirée d’un soin hydratant. Enrichie en extrait de riz et en niacinamide, elle associe une protection UV à large spectre à une hydratation confortable. La formule s’étale facilement, pénètre rapidement et laisse un fini lumineux, sans effet blanc visible ni sensation collante.",
    "benefits": [
      "Protection solaire SPF50+ PA++++ à large spectre",
      "Hydratation et confort cutané",
      "Aide à apaiser la peau et à soutenir sa barrière d’hydratation",
      "Texture légère, non collante et facile à étaler",
      "Fini naturel et lumineux sans traces blanches visibles",
      "Testée cliniquement : effet hydratant de 24 heures et bonne tolérance sur peaux sensibles"
    ],
    "keyIngredients": [
      "Extrait de riz : riche en vitamines, acides aminés et minéraux ; contribue à hydrater",
      "Niacinamide : aide à soutenir la barrière d’hydratation et à équilibrer la peau",
      "Extraits fermentés de céréales : complètent le complexe de soin au riz",
      "Filtres UV : Ethylhexyl Triazone, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Diethylhexyl Butamido Triazone et Methylene Bis-Benzotriazolyl Tetramethylbutylphenol"
    ],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/relief-sun-rice-probiotics-spf50-pa-uk",
    "sourceName": "Beauty of Joseon — fabricant",
    "usage": "Appliquer généreusement et uniformément en dernière étape de la routine du matin sur toutes les zones exposées au soleil.",
    "skinTypes": [
      "Peaux normales",
      "Peaux sèches ou déshydratées",
      "Peaux sensibles",
      "Peaux mixtes selon le niveau d’hydratation recherché"
    ],
    "usageSteps": [
      "Appliquer en dernière étape de la routine de soin du matin.",
      "Répartir généreusement et uniformément sur le visage et les zones exposées au soleil.",
      "Renouveler l’application au moins toutes les deux heures.",
      "Après une baignade, une transpiration importante ou un essuyage à la serviette, réappliquer la protection."
    ],
    "precautions": [
      "En cas de baignade ou de transpiration, utiliser un écran solaire résistant à l’eau.",
      "Limiter l’exposition au soleil, notamment entre 10 h et 14 h, et compléter la protection par des vêtements, un chapeau et des lunettes de soleil.",
      "Éviter l’exposition directe des bébés et jeunes enfants au soleil ; l’utilisation d’un écran solaire chez les nourrissons de moins de 6 mois n’est pas recommandée.",
      "Pour les enfants de 6 mois à 6 ans, le fabricant recommande des protections solaires minérales adaptées."
    ],
    "inci": "Aqua, Dibutyl Adipate, Propanediol, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Polymethylsilsesquioxane, Ethylhexyl Triazone, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol (Nano), Niacinamide, Coco-Caprylate/Caprate, Caprylyl Methicone, Diethylhexyl Butamido Triazone, Glycerin, 1,2-Hexanediol, Butylene Glycol, Pentylene Glycol, Behenyl Alcohol, Poly C10-30 Alkyl Acrylate, Polyglyceryl-3 Methylglucose Distearate, Decyl Glucoside, Oryza Sativa (Rice) Extract, Tromethamine, Carbomer, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Stearoyl Glutamate, Polyacrylate Crosspolymer-6, Ethylhexylglycerin, Adenosine, Xanthan Gum, T-Butyl Alcohol, Tocopherol, Oryza Sativa (Rice) Germ Extract, Camellia Sinensis Leaf Extract, Saccharum Officinarum (Sugarcane) Extract, Macrocystis Pyrifera (Kelp) Extract, Lactobacillus/Pumpkin Ferment Extract, Bacillus/Soybean Ferment Extract, Aspergillus Ferment, Cocos Nucifera (Coconut) Fruit Extract, Panax Ginseng Root Extract, Monascus/Rice Ferment, Lactobacillus/Rice Ferment, Saccharomyces/Rice Ferment Filtrate",
    "packaging": "Tube de protection solaire visage — 50 ml",
    "origin": "Corée du Sud",
    "alternateName": "Relief Sun : Rice + Niacinamide"
  },
  "8809968130277": {
    "description": "Fluide solaire visage SPF50+ PA++++ à la texture ultra-légère, formulé avec de l’eau de riz et du panthénol (vitamine B5). Il apporte une hydratation fraîche tout en protégeant la peau des UVA et UVB. Sa texture pénètre rapidement, sans effet blanc ni fini collant, et convient particulièrement aux peaux mixtes à grasses.",
    "benefits": [
      "Protection solaire SPF50+ PA++++ à large spectre",
      "Hydratation légère et sensation de fraîcheur",
      "Absorption rapide et fini non collant",
      "Pas d’effet blanc visible",
      "Aide à apaiser la peau et à soutenir la barrière cutanée",
      "Non comédogène et testé pour les peaux sensibles selon la marque"
    ],
    "keyIngredients": [
      "Eau de graines de riz : apporte une hydratation légère, riche en acides aminés et minéraux",
      "Panthénol (vitamine B5) : hydrate, apaise et soutient la barrière cutanée",
      "Bêta-glucane : contribue au confort et à l’hydratation",
      "Céramide NP et phytosphingosine : composants de soutien de la barrière cutanée",
      "Filtres UV : Ethylhexyl Triazone, Drometrizole Trisiloxane, Terephthalylidene Dicamphor Sulfonic Acid, Diethylamino Hydroxybenzoyl Hexyl Benzoate et Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine"
    ],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/relief-sun-aqua-fresh-rice-b5-spf50-pa-uk",
    "sourceName": "Beauty of Joseon — fabricant",
    "usage": "Appliquer généreusement en dernière étape de la routine du matin sur les zones exposées au soleil.",
    "skinTypes": [
      "Peaux mixtes",
      "Peaux grasses",
      "Peaux sensibles",
      "Peaux à tendance acnéique"
    ],
    "usageSteps": [
      "Appliquer en dernière étape de la routine de soin du matin.",
      "Répartir généreusement et uniformément sur le visage et les zones exposées au soleil.",
      "Renouveler l’application au moins toutes les deux heures.",
      "Réappliquer après la baignade, une transpiration importante ou un essuyage à la serviette."
    ],
    "precautions": [
      "En cas de baignade ou de transpiration, utiliser un écran solaire résistant à l’eau.",
      "Limiter l’exposition au soleil, notamment entre 10 h et 14 h, et compléter la protection par des vêtements, un chapeau et des lunettes de soleil.",
      "Éviter l’exposition directe des bébés et jeunes enfants au soleil ; l’utilisation d’un écran solaire chez les nourrissons de moins de 6 mois n’est pas recommandée."
    ],
    "inci": "Aqua, Oryza Sativa (Rice) Seed Water, Dibutyl Adipate, Butyloctyl Salicylate, Ethylhexyl Triazone, Polyglyceryl-3 Distearate, Drometrizole Trisiloxane, Terephthalylidene Dicamphor Sulfonic Acid, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Polymethylsilsesquioxane, Tromethamine, 1,2-Hexanediol, Panthenol, Pentylene Glycol, Glyceryl Stearate, Caprylyl Methicone, Silica, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Propanediol, Potassium Cetyl Phosphate, Poly C10-30 Alkyl Acrylate, Methylpropanediol, Carbomer, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Ethylhexylglycerin, Xanthan Gum, Glycerin, Polyether-1, Avena Sativa (Oat) Kernel Extract, Cynara Scolymus (Artichoke) Leaf Extract, Polyquaternium-51, Camellia Sinensis Leaf Water, Hydrogenated Lecithin, Beta-Glucan, Inositol, Tocopherol, Biosaccharide Gum-1, Ferulic Acid, Oryza Sativa (Rice) Bran Oil, Citric Acid, Ceramide NP, Phytosphingosine, Sodium Hyaluronate, Rice Amino Acids, Rice SH-Oligopeptide-1",
    "packaging": "Fluide solaire visage — 50 ml",
    "origin": "Corée du Sud"
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
    "description": "Gel-crème quotidien à la texture légère, conçu pour hydrater et apaiser les peaux sensibles sujettes aux imperfections. Sa formule non comédogène aide à améliorer l’apparence des marques post-imperfections et du teint irrégulier, tout en soutenant la barrière cutanée sans fini lourd ni gras.",
    "benefits": [
      "Hydratation légère et durable sans sensation de lourdeur",
      "Apaise les peaux sensibilisées et sujettes aux rougeurs",
      "Aide à améliorer l’apparence des marques laissées par les imperfections",
      "Contribue à lisser visuellement le grain de peau",
      "Soutient la barrière d’hydratation cutanée",
      "Formule sans huiles ajoutées, testée non comédogène"
    ],
    "keyIngredients": [
      "Niacinamide : aide à améliorer l’apparence du teint irrégulier",
      "Panthénol : hydrate et apaise la peau",
      "Céramide NP : contribue au maintien de la barrière cutanée",
      "Eau de feuille de Tea Tree : participe au confort des peaux à imperfections",
      "Centella asiatica et madécassoside : actifs apaisants",
      "Sodium DNA : composant de la formule issu de la technologie PDRN"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/345-relief-cream",
    "sourceName": "Dr. Althea — fabricant",
    "usage": "Appliquer après le nettoyage, le toner et le sérum, en dernière ou avant-dernière étape de la routine.",
    "skinTypes": [
      "Tous types de peau",
      "Peaux sensibles",
      "Peaux à tendance acnéique ou sujettes aux imperfections"
    ],
    "usageSteps": [
      "Nettoyer le visage et appliquer les soins les plus fluides de la routine.",
      "Prélever une quantité adaptée de crème.",
      "Répartir uniformément sur le visage, puis presser délicatement jusqu’à absorption.",
      "Le matin, terminer la routine par une protection solaire.",
      "En association avec des actifs potentiellement irritants, la marque décrit une application en sandwich : une fine couche de crème, le soin actif, puis une seconde couche de crème."
    ],
    "inci": "Aqua (Water), Melaleuca Alternifolia (Tea Tree) Leaf Water, Propanediol, Glycerin, 1,2-Hexanediol, Hydrogenated Polydecene, Vinyl Dimethicone, C14-22 Alcohols, Niacinamide, Caprylic/Capric Triglyceride, Panthenol, Dicaprylyl Carbonate, Butylene Glycol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Caprylyl Methicone, Polymethylsilsesquioxane, C12-20 Alkyl Glucoside, Hydroxyacetophenone, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Polyquaternium-51, Ethylhexylglycerin, Tromethamine, Sodium Hyaluronate, Sodium Stearoyl Glutamate, Coptis Japonica Root Extract, Centella Asiatica Leaf Water, Beta-Glucan, Resveratrol, Hydrolyzed Hyaluronic Acid, Camellia Sinensis Leaf Water, Tocopherol, Madecassoside, Sodium DNA, Centella Asiatica Extract, Ceramide NP, Tannic Acid, Disodium EDTA, Sodium Phytate",
    "packaging": "Tube de crème visage — 50 ml",
    "origin": "Corée du Sud"
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
    "description": "Brume visage biphasée associant une phase aqueuse rafraîchissante et une phase crème légère. Elle apporte une hydratation rapide, aide à apaiser les sensations d’inconfort et laisse la peau douce et souple. Son format spray permet de l’utiliser après le nettoyage, entre les étapes de soin ou au cours de la journée, y compris par-dessus le maquillage.",
    "benefits": [
      "Hydratation et confort immédiats",
      "Association de deux phases : essence aqueuse et crème légère",
      "Aide à apaiser les sensations de tiraillement",
      "Texture légère et diffusion fine et homogène",
      "Peut s’utiliser avant ou après le maquillage",
      "Format nomade de 60 ml"
    ],
    "keyIngredients": [
      "Eau de son de riz : base hydratante de la formule",
      "Panthénol : contribue à hydrater et apaiser",
      "Acide hyaluronique et acide hyaluronique hydrolysé : agents hydratants",
      "Madécassoside et Centella asiatica : actifs apaisants",
      "Aloe vera et Houttuynia cordata : extraits végétaux de confort",
      "Ferments de Lactobacillus, Bifida et Aspergillus"
    ],
    "sourceUrl": "https://doctoraltheaglobal.com/products/345-relief-cream-mist",
    "sourceName": "Dr. Althea — fabricant",
    "usage": "Agiter pour mélanger les deux phases, puis vaporiser uniformément à environ 20 cm du visage.",
    "skinTypes": [
      "Tous types de peau",
      "Peaux déshydratées",
      "Peaux sujettes aux tiraillements ou à l’inconfort"
    ],
    "usageSteps": [
      "Agiter soigneusement le flacon afin de mélanger les phases crème et essence.",
      "Fermer les yeux et la bouche.",
      "Tenir le flacon à environ 20 cm du visage et vaporiser uniformément.",
      "Tapoter délicatement pour favoriser l’absorption ou laisser la brume se déposer.",
      "Utiliser après le nettoyage, entre les étapes de soin, avant ou après le maquillage, ou dès que la peau a besoin d’un apport d’hydratation."
    ],
    "precautions": [
      "Éviter de vaporiser directement dans les yeux ou la bouche."
    ],
    "inci": "Oryza Sativa (Rice) Bran Water, 1,2-Hexanediol, Triethylhexanoin, Glycerin, Hydrogenated Poly(C6-14 Olefin), Tocopherol, Water, Butylene Glycol, Methylpropanediol, Pentylene Glycol, Streptococcus Thermophilus Ferment, Pyrus Malus (Apple) Juice, Panthenol, Hydrolyzed Hyaluronic Acid, Polyquaternium-51, Betaine, Trilaurate-4 Phosphate, Cynanchum Atratum Extract, Althaea Rosea Flower Extract, Oryza Sativa (Rice) Extract, Sea Salt, Aspergillus Ferment, Sodium Phytate, Citric Acid, Madecassoside, Hydroxypropyltrimonium Hyaluronate, Centella Asiatica Leaf Extract, Houttuynia Cordata Extract, Aloe Barbadensis Leaf Water, Bifida Ferment Extract, Hyaluronic Acid, Silanetriol, Avena Sativa (Oat) Kernel Extract, Lactobacillus Ferment, Hydrolyzed Rice Protein, Rice Amino Acids",
    "packaging": "Flacon spray biphasé — 60 ml",
    "origin": "Corée du Sud"
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

// Compléments 2026 : accessoires solaires et lots (conditionnements conservés du catalogue fournisseur).
// Certaines sources sont explicitement des revendeurs, et ne constituent pas une confirmation par le fabricant.
export const additionalBeautyOfJoseonByEan: Record<string,OfficialEducation> = {
  "8809968135562": {
    "description": "Stick solaire courbe de 14 g conçu pour des retouches pratiques au fil de la journée, sans fini blanc visible selon la marque.",
    "benefits": [
      "Protection solaire nomade",
      "Retouches faciles",
      "Fini lumineux et non gras"
    ],
    "keyIngredients": [],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/glow-sun-stick-sunscreen",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer sur les zones exposées. Renouveler régulièrement et compléter la protection par les gestes habituels de photoprotection."
  },
  "8809968136026": {
    "description": "Lotion solaire corps SPF50+ de 150 ml à texture légère, résistante à l'eau selon le fabricant, destinée à hydrater sans traces blanches visibles.",
    "benefits": [
      "Protection UV SPF50+",
      "Hydratation sans fini collant",
      "Formule corps résistante à l’eau"
    ],
    "keyIngredients": [
      "Riz brun fermenté",
      "Céramides"
    ],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/hydra-shield-body-sun-lotion-spf-50-eu",
    "sourceName": "Beauty of Joseon (fabricant)",
    "usage": "Appliquer généreusement sur les zones exposées du corps avant le soleil et renouveler régulièrement."
  },
  "8809968136019": {
    "description": "Lotion solaire corps minérale SPF40, texture confortable pensée pour les peaux sensibles. La version SPF40 est celle du catalogue fournisseur et ne doit pas être confondue avec la SPF30 actuellement affichée sur d'autres pages du fabricant.",
    "benefits": [
      "Protection solaire minérale SPF40",
      "Confort cutané",
      "Hydratation"
    ],
    "keyIngredients": [
      "Riz brun fermenté"
    ],
    "sourceUrl": "https://beautyofjoseon.com/pages/tab-1-comfort-protection-relief-sun",
    "sourceName": "Beauty of Joseon (fabricant, fiche SPF40)",
    "usage": "Appliquer généreusement sur le corps et renouveler fréquemment lors de l'exposition."
  },
  "8809968134763": {
    "description": "Solaire visage SPF50+ PA++++ à effet correcteur de teint vert pour atténuer visuellement l'apparence des rougeurs.",
    "benefits": [
      "Protection solaire SPF50+ PA++++",
      "Correction optique des rougeurs",
      "Base de maquillage légère"
    ],
    "keyIngredients": [
      "Centella asiatica",
      "Céramide NP"
    ],
    "sourceUrl": "https://www.yesstyle.com/en/beauty-of-joseon-stay-fresh-tone-up-sunscreen-2-types-green/info.html/pid.1137750152",
    "sourceName": "YesStyle (revendeur, variante Green)",
    "usage": "Dernière étape des soins du matin, appliquer uniformément. Réappliquer régulièrement selon les recommandations de photoprotection."
  },
  "8809968133933": {
    "description": "Solaire visage SPF50+ PA++++ teinté violet destiné à corriger visuellement les tons jaunes et l'apparence d'un teint terne.",
    "benefits": [
      "Protection solaire SPF50+ PA++++",
      "Effet correcteur violet",
      "Base de maquillage légère"
    ],
    "keyIngredients": [
      "Centella asiatica",
      "Céramide NP"
    ],
    "sourceUrl": "https://www.yesstyle.com/fr/info.html/pid.1137750153",
    "sourceName": "YesStyle (revendeur, variante Purple)",
    "usage": "Dernière étape des soins du matin, appliquer uniformément. Réappliquer régulièrement selon les recommandations de photoprotection."
  },
  "8809975190561": {
    "description": "Coffret comprenant deux sérums contour des yeux Revive Ginseng + Retinal, 30 ml chacun, selon le conditionnement du fournisseur.",
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
    "sourceName": "Beauty of Joseon (fiche de la référence unitaire)",
    "usage": "Introduire progressivement, éviter le contact direct avec les yeux et porter une protection solaire en journée."
  },
  "8809782558905": {
    "description": "Lot de deux protections solaires visage Relief Sun Rice + Probiotics, tubes de 50 ml, selon le catalogue fournisseur.",
    "benefits": [
      "Protection solaire quotidienne",
      "Hydratation",
      "Texture confortable"
    ],
    "keyIngredients": [
      "Riz",
      "Extraits fermentés"
    ],
    "sourceUrl": "https://beautyofjoseon.com/collections/sunscreen",
    "sourceName": "Beauty of Joseon (gamme du produit unitaire)",
    "usage": "Appliquer en dernière étape de soin du matin ; renouveler régulièrement."
  },
  "8809968130864": {
    "description": "Lot de deux solaires visage Relief Sun Aqua-Fresh Rice + B5, tubes de 50 ml, selon le conditionnement fournisseur.",
    "benefits": [
      "Protection solaire quotidienne",
      "Hydratation légère",
      "Confort"
    ],
    "keyIngredients": [
      "Eau de riz",
      "Panthénol (vitamine B5)"
    ],
    "sourceUrl": "https://beautyofjoseon.com/products/relief-sun-aqua-fresh",
    "sourceName": "Beauty of Joseon (fiche du produit unitaire)",
    "usage": "Appliquer généreusement avant exposition et renouveler régulièrement."
  },
  "8809968130383": {
    "description": "Lot de deux sticks solaires Matte Sun Stick Mugwort + Camelia, 18 g chacun, selon le conditionnement fournisseur.",
    "benefits": [
      "Protection solaire nomade",
      "Fini mat",
      "Retouches pratiques"
    ],
    "keyIngredients": [
      "Armoise (mugwort)",
      "Thé vert"
    ],
    "sourceUrl": "https://fr.beautyofjoseon.com/products/matte-sun-stick-mugwort-camelia",
    "sourceName": "Beauty of Joseon (fiche du produit unitaire)",
    "usage": "Appliquer sur peau exposée puis renouveler régulièrement."
  }
};

// Compléments Dr. Althea recoupés avec fiches revendeurs, sans prix et avec provenance explicite.
export const additionalDrAltheaByEan: Record<string,OfficialEducation> = {
  "8809447255828": {
    "description": "Protection solaire visage Aqua Glowing Sunscreen 45 ml à texture crème légère, destinée à protéger des UV tout en apportant de l’hydratation.",
    "benefits": [
      "Protection UV quotidienne",
      "Hydratation",
      "Fini léger"
    ],
    "keyIngredients": [
      "Eau de bambou (Bambusa vulgaris)",
      "Panthénol",
      "Extrait de Caulerpa lentillifera",
      "Céramide NP"
    ],
    "sourceUrl": "https://www.superdrug.com/skin/sun-care/sun-protection-creams/dr-althea-aqua-glowing-sunscreen-45ml/p/mp-00333022",
    "sourceName": "Superdrug (revendeur, EAN recoupé)",
    "usage": "Appliquer généreusement avant l'exposition solaire et renouveler fréquemment."
  },
  "8809447255989": {
    "description": "Protection solaire visage Green Tea Fresh Sunscreen 45 ml SPF50+ PA++++, texture légère et rapidement absorbée.",
    "benefits": [
      "Protection solaire SPF50+ PA++++",
      "Confort des peaux sensibles",
      "Fini non gras"
    ],
    "keyIngredients": [
      "Eau de feuille de thé vert",
      "Centella asiatica",
      "Niacinamide",
      "Houttuynia cordata"
    ],
    "sourceUrl": "https://www.cosmeterie.fr/dr-althea/green-tea-fresh-sunscreen",
    "sourceName": "Cosmeterie (revendeur, EAN recoupé)",
    "usage": "Appliquer généreusement au dernier geste du matin. Renouveler toutes les deux heures en cas d’exposition prolongée."
  },
  "8809447255729": {
    "description": "Coffret de quatre masques en tissu Cushion Veil Calming Mask de 35 g chacun, à effet rafraîchissant pour les peaux en recherche de confort.",
    "benefits": [
      "Apaisement",
      "Hydratation",
      "Sensation rafraîchissante"
    ],
    "keyIngredients": [
      "Centella asiatica",
      "Camomille",
      "Panthénol",
      "Eau de bouleau"
    ],
    "sourceUrl": "https://b2b.cremile.com/products/dr-althea-cushion-veil-calming-mask-35g-4ea",
    "sourceName": "Cremile B2B (revendeur, EAN recoupé)",
    "usage": "Après nettoyage et lotion, appliquer une feuille 10 à 15 minutes puis tapoter l’excédent."
  },
  "8809447255743": {
    "description": "Coffret de quatre masques Jelly Seal Dewy Mask de 28 g chacun, à texture gel pour une peau hydratée et souple.",
    "benefits": [
      "Hydratation",
      "Confort de la barrière cutanée",
      "Aspect rebondi"
    ],
    "keyIngredients": [
      "Acide hyaluronique",
      "Allantoïne",
      "Extrait de lotus",
      "Sodium DNA (PhytoPDRN)"
    ],
    "sourceUrl": "https://se.iherb.com/pr/dr-althea-jelly-seal-dewy-beauty-mask-4-sheets-0-99-oz-28-g-each/159700",
    "sourceName": "iHerb (revendeur, EAN recoupé)",
    "usage": "Appliquer une feuille après nettoyage, laisser poser 10 à 15 minutes puis tapoter le sérum restant."
  },
  "8809447251998": {
    "description": "Coffret de cinq masques visage Marine Anti-Blemish destinés aux peaux à imperfections, chaque masque étant imprégné de sérum hydratant.",
    "benefits": [
      "Hydratation",
      "Confort des peaux à imperfections",
      "Soutien de la barrière cutanée"
    ],
    "keyIngredients": [
      "Crithmum maritimum",
      "Centella asiatica",
      "Extraits d’algues",
      "Céramide NP"
    ],
    "sourceUrl": "https://www.roverisland.com/products/dr-althea-marine-anti-blemish-sheet-mask",
    "sourceName": "Rover Island (revendeur, EAN recoupé)"
  },
  "8809447255040": {
    "description": "Crème visage Niathione 30 ml conçue pour un effet éclat et l’apparence d’un teint plus homogène, avec un fini léger.",
    "benefits": [
      "Éclat",
      "Teint visuellement plus uniforme",
      "Hydratation"
    ],
    "keyIngredients": [
      "Niacinamide",
      "Glutathion",
      "Panthénol",
      "Extrait de réglisse"
    ],
    "sourceUrl": "https://qudobeauty.com/product/dr-althea-niathione-cream-30ml/",
    "sourceName": "Qudo Beauty (revendeur, EAN recoupé)",
    "usage": "Appliquer sur peau propre comme dernière étape de la routine ; le matin, ajouter une protection solaire."
  }
};

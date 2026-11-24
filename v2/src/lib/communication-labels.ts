export const announcementCategories={news:"Actualité",offer:"Offre commerciale",launch:"Nouveauté produit",event:"Événement",training:"Formation",field_update:"Information terrain"} as const;
export const resourceCategories={catalogue:"Catalogue",product_sheet:"Fiche produit",argumentaire:"Argumentaire de vente",training:"Formation",plv:"PLV et merchandising",other:"Autre ressource"} as const;
export const audienceLabels={all:"Toutes les pharmacies",implanted:"Pharmacies ayant implanté cette marque",discovery:"Pharmacies n’ayant pas implanté cette marque",selected:"Pharmacies sélectionnées"} as const;
export const announcementCategoryLabel=(v:string)=>announcementCategories[v as keyof typeof announcementCategories]??v;
export const resourceCategoryLabel=(v:string)=>resourceCategories[v as keyof typeof resourceCategories]??v;
export const audienceLabel=(v:string)=>audienceLabels[v as keyof typeof audienceLabels]??v;

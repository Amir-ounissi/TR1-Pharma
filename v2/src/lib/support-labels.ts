export const categories={question:"Question commerciale / produit",appointment:"Rendez-vous",animation:"Animation / sell-out",training:"Formation équipe",resources:"Documentation / PLV",implantation:"Présentation / implantation",reorder:"Réassort / conditions",delivery:"Livraison / suivi",claim:"Litige / SAV",other:"Autre demande"} as const;
export const statuses={received:"Reçue",in_progress:"En cours",waiting_client:"En attente de votre retour",resolved:"Résolue"} as const;
export const statusLabel=(value:string)=>statuses[value as keyof typeof statuses]??value;
export const categoryLabel=(value:string)=>categories[value as keyof typeof categories]??value;
export const dateLabel=(value:string)=>new Date(value).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"});

export const pharmacyDetailTabs = [
  "overview",
  "activity",
  "orders",
  "performance",
  "contacts",
  "products",
  "history",
  "admin",
] as const;

export type PharmacyDetailTab = (typeof pharmacyDetailTabs)[number];

export function normalizePharmacyDetailTab(tab: string | undefined): PharmacyDetailTab {
  return pharmacyDetailTabs.includes(tab as PharmacyDetailTab) ? (tab as PharmacyDetailTab) : "overview";
}

export function getPharmacyDetailDataNeeds(tab: PharmacyDetailTab) {
  return {
    contacts: tab === "contacts" || tab === "activity",
    implantedProducts: tab === "products",
    productCatalog: tab === "products",
    territories: tab === "overview",
    agentMemberships: tab === "overview",
    commercialMemberships: tab === "activity",
    timeline: tab === "activity",
    assignments: tab === "activity",
    performance: tab === "overview" || tab === "performance",
    bookedOrders: tab === "performance",
    orders: tab === "orders" || tab === "activity",
    distribution: tab === "overview" || tab === "performance",
    activityHistory: tab === "performance",
    commercialHealth: tab === "overview",
    missions: tab === "overview" || tab === "activity" || tab === "performance",
    missionImpacts: tab === "overview" || tab === "performance",
  };
}

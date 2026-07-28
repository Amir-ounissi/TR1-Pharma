export const missionTypes = ["commercial_visit","prospecting_visit","animation","training","merchandising","pharmacy_audit","reactivation","product_launch","stock_check","relationship_visit","other"] as const;
export const missionStatuses = ["draft","requested","to_assign","assigned","accepted","scheduled","in_progress","report_pending","completed","cancelled","rejected","no_show"] as const;

export function reportFieldsFor(type: string) {
  if (type === "animation") return ["unitsSold", "durationMinutes", "customerContacts"] as const;
  if (type === "training") return ["participantCount", "durationMinutes"] as const;
  if (["commercial_visit", "prospecting_visit", "relationship_visit", "reactivation"].includes(type)) return ["contactMet", "meetingOutcome"] as const;
  return [] as const;
}

export function safeObjectName(brandId: string, missionId: string, originalName: string) {
  const extension = originalName.toLowerCase().match(/\.(jpe?g|png|webp|pdf)$/)?.[1] ?? "bin";
  return `${brandId}/${missionId}/${crypto.randomUUID()}.${extension === "jpeg" ? "jpg" : extension}`;
}

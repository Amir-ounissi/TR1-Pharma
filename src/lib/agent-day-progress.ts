/** Progress represents visits actually completed, never clicks or no-shows. */
export function getVisitProgress(visits: ReadonlyArray<{ status: string }>) {
  const statuses = visits.map((visit) => visit.status.trim().toLowerCase());
  const planned = statuses.filter((status) => !["cancelled", "rejected", "refunded"].includes(status)).length;
  const completed = statuses.filter((status) => status === "completed").length;
  const missed = statuses.filter((status) => status === "no_show").length;
  return { planned, completed, missed, percent: planned ? Math.round(completed / planned * 100) : 0 };
}

export function visitStatusLabel(status: string) {
  const labels: Record<string, string> = {
    planned: "Planifiée", scheduled: "Planifiée", confirmed: "Confirmée",
    in_progress: "En cours", completed: "Réalisée", no_show: "Non effectuée",
    cancelled: "Annulée", rejected: "Refusée", refunded: "Remboursée",
  };
  return labels[status.trim().toLowerCase()] ?? "Statut à vérifier";
}

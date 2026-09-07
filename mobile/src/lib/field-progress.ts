export type DayEvent = {
  event_key: string;
  source_kind: string;
  source_id: string;
  title: string;
  start_at: string;
  pharmacy_name: string | null;
  status: string;
  ownership: string;
  metadata?: { proposal_review_status?: string };
};

export function parisDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function personalDay(events: DayEvent[], reports: Record<string, string>) {
  const seen = new Set<string>();
  const actions = events.filter((event) => {
    if (event.ownership !== "mine" || !["field_visit", "mission"].includes(event.source_kind)) return false;
    if (["cancelled", "rejected", "no_show"].includes(event.status)) return false;
    const proposal = event.metadata?.proposal_review_status;
    if (proposal && !["approved", "not_applicable"].includes(proposal)) return false;
    const key = `${event.source_kind}:${event.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const state = (event: DayEvent) => {
    if (event.source_kind === "field_visit") return event.status === "completed" ? "done" : "todo";
    if (event.status === "completed" && reports[event.source_id] === "validated") return "done";
    if (reports[event.source_id] === "submitted") return "review";
    if (reports[event.source_id] === "rejected") return "rejected";
    if (event.status === "completed") return "unverified";
    return "todo";
  };
  const done = actions.filter((event) => state(event) === "done").length;
  const review = actions.filter((event) => state(event) === "review").length;
  const rejected = actions.filter((event) => state(event) === "rejected").length;
  return { actions, done, review, rejected, total: actions.length, next: actions.find((event) => state(event) === "todo"), state };
}

export function reportSuggestions(type: string | null) {
  if (type === "animation") return ["Animation réalisée", "Animation partiellement réalisée", "Animation non réalisée"];
  if (type === "training") return ["Formation réalisée", "Formation partiellement réalisée", "Formation à reprogrammer"];
  if (type === "merchandising") return ["Implantation vérifiée", "Correction merchandising réalisée", "Implantation à corriger"];
  if (type === "stock_check" || type === "pharmacy_audit") return ["Contrôle réalisé", "Écart constaté", "Contrôle incomplet"];
  return ["Commande prise", "À relancer", "Interlocuteur absent", "Offre refusée"];
}

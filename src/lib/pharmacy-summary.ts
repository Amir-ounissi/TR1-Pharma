import { labels } from "./reference-data";
import type { CommercialHealthRow } from "./commercial-health";
import { getPharmacyCockpit } from "./pharmacy-cockpit";

type RpcAwaitable<T> = PromiseLike<{ data: T | null; error: { message: string } | null }> | { then: (onfulfilled: (value: { data: T | null; error: { message: string } | null }) => unknown, onrejected?: (reason: unknown) => unknown) => unknown };
type RpcResult<T> = RpcAwaitable<T>;
type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }> | { then: (onfulfilled: (value: { data: T[] | null; error: { message: string } | null }) => unknown, onrejected?: (reason: unknown) => unknown) => unknown };

type SupabaseLike = {
  rpc<T = unknown>(name: string, parameters: Record<string, unknown>): RpcResult<T>;
  from(table: "brand_pharmacy_timeline"): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): QueryResult<BrandPharmacyTimelineRow>;
        };
      };
    };
  };
};

type PharmacySummaryRpc = {
  brand_pharmacy_id: string;
  brand_id: string;
  pharmacy_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
  priority: string | null;
  potential: string | null;
  last_interaction_at: string | null;
  last_order_at: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  primary_contact: {
    name?: string | null;
    phone?: string | null;
  } | null;
};

type BrandPharmacyTimelineRow = {
  brand_pharmacy_id: string;
  event_type: string;
  title: string | null;
  details: string | null;
  occurred_at: string;
};

export type PharmacyQuickEvent = {
  kind: "interaction" | "commercial_signal" | "status_change" | "task" | "mission" | "system";
  label: string;
  date: string | null;
  detail: string | null;
};

export type PharmacySummary = {
  pharmacy: {
    id: string;
    brandPharmacyId: string;
    name: string;
    address: string | null;
    city: string | null;
  };
  status: {
    commercial: string;
    activity: string;
    label: string;
    activityLabel: string;
  };
  potential: {
    level: string;
    label: string;
  };
  priority: {
    level: string;
    label: string;
  };
  assignee: string | null;
  situation: string;
  whyAct: string[];
  nextAction: {
    type: string | null;
    date: string | null;
    label: string;
  };
  lastInteraction: {
    label: string;
    date: string | null;
  };
  lastCommercialSignal: {
    label: string;
    date: string | null;
    detail: string | null;
  };
  recentEvents: PharmacyQuickEvent[];
};

function mapRpcError(message: string) {
  if (message.includes("forbidden") || message.includes("42501")) return "forbidden";
  return message;
}

async function unwrapRpc<T>(promise: RpcResult<T>) {
  const { data, error } = await Promise.resolve(promise as PromiseLike<{ data: T | null; error: { message: string } | null }>);
  if (error) throw new Error(mapRpcError(error.message));
  return data;
}

async function unwrapQuery<T>(promise: QueryResult<T>) {
  const { data, error } = await Promise.resolve(promise as PromiseLike<{ data: T[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function safeLabel<T extends string>(value: string | null | undefined, dictionary: Record<T, string>, fallback: string) {
  if (!value) return fallback;
  return dictionary[value as T] ?? fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function extractCityFromAddress(address: string | null) {
  if (!address) return null;
  const segments = address.split(",").map((segment) => segment.trim()).filter(Boolean);
  const last = segments.at(-1);
  if (!last) return null;
  const match = last.match(/^\d{4,5}\s+(.+)$/);
  return match?.[1] ?? last;
}

function dedupeReasons(reasons: string[]) {
  const normalized = new Set<string>();
  const output: string[] = [];
  for (const reason of reasons) {
    const key = reason.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim();
    if (!key || normalized.has(key)) continue;
    normalized.add(key);
    output.push(reason);
  }
  return output;
}

function normalizeReason(reason: string) {
  const value = reason.trim();
  if (!value) return null;
  const lower = value.toLocaleLowerCase("fr-FR");
  if (lower.includes("réassort en retard") || lower.includes("reassort en retard")) return "Cadence habituelle dépassée";
  if (lower.includes("premier réassort") || lower.includes("premier reassort")) return "Premier réassort attendu";
  if (lower.includes("aucune première commande") || lower.includes("aucune premiere commande")) return "Absence de première commande";
  if (lower.includes("aucun suivi programmé") || lower.includes("aucune prochaine action") || lower.includes("ajouter une prochaine action")) return "Aucune prochaine action prévue";
  if (lower.includes("compte stratégique") || lower.includes("compte strategique")) return "Compte stratégique à suivre";
  if (lower.includes("fort potentiel")) return "Fort potentiel commercial";
  if (lower.includes("assortiment stratégique est incomplet") || lower.includes("assortiment strategique est incomplet")) return "Assortiment stratégique incomplet";
  if (lower.includes("compte dormant")) return "Compte dormant à réactiver";
  if (lower.includes("fréquence de commande fortement dégradée") || lower.includes("frequence de commande fortement degradee") || lower.includes("intervalle habituel de commande mérite une attention") || lower.includes("intervalle habituel de commande merite une attention")) return "Compte à risque à suivre";
  if (lower.includes("mission récente sans suivi commercial") || lower.includes("mission recente sans suivi commercial")) return "Mission récente sans suivi";
  if (lower.includes("réassort bientôt attendu") || lower.includes("reassort bientot attendu")) return "Premier réassort attendu";
  if (lower.includes("chiffre d’affaires en baisse") || lower.includes("chiffre d'affaires en baisse")) return "Dynamique commerciale à surveiller";
  return value;
}

function buildWhyAct(health: CommercialHealthRow, cockpitReasons: string[]) {
  const bucketed = {
    risk: [] as string[],
    noAction: [] as string[],
    reorder: [] as string[],
    firstOrder: [] as string[],
    strategic: [] as string[],
    assortment: [] as string[],
    secondary: [] as string[],
  };

  const allReasons = dedupeReasons([
    ...(health.priority_reasons ?? []),
    ...cockpitReasons,
  ]
    .map(normalizeReason)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !(health.has_next_action && value === "Aucune prochaine action prévue")));

  for (const reason of allReasons) {
    const lower = reason.toLocaleLowerCase("fr-FR");
    if (lower.includes("dormant") || lower.includes("risque")) bucketed.risk.push(reason);
    else if (lower.includes("aucune prochaine action")) bucketed.noAction.push(reason);
    else if (lower.includes("premier réassort") || lower.includes("cadence habituelle dépassée") || lower.includes("compte à suivre")) bucketed.reorder.push(reason);
    else if (lower.includes("première commande") || lower.includes("premiere commande")) bucketed.firstOrder.push(reason);
    else if (lower.includes("compte stratégique") || lower.includes("fort potentiel")) bucketed.strategic.push(reason);
    else if (lower.includes("assortiment")) bucketed.assortment.push(reason);
    else bucketed.secondary.push(reason);
  }

  return dedupeReasons([
    ...bucketed.risk,
    ...bucketed.noAction,
    ...bucketed.reorder,
    ...bucketed.firstOrder,
    ...bucketed.strategic,
    ...bucketed.assortment,
    ...bucketed.secondary,
  ]).slice(0, 3);
}

function buildSituation(input: { health: CommercialHealthRow; summary: PharmacySummaryRpc }) {
  const parts: string[] = [];
  parts.push(safeLabel(input.summary.status, labels.commercialStatus, "Statut inconnu"));
  parts.push(safeLabel(input.health.health_status, labels.activityStatus, "Suivi à confirmer"));
  if (input.health.agent_name) parts.push(`Responsable : ${input.health.agent_name}`);
  if (input.health.last_order_at) {
    parts.push(`Dernière commande ${formatDate(input.health.last_order_at)?.toLocaleLowerCase("fr-FR")}`);
  }
  return parts.join(" · ");
}

function buildLastCommercialSignal(health: CommercialHealthRow) {
  if (!health.last_order_at) {
    return {
      label: "Aucune commande observée",
      date: null,
      detail: null,
    };
  }

  if (health.reorder_count > 0 && health.first_reorder_at) {
    return {
      label: "Dernier réassort observé",
      date: formatDate(health.last_order_at),
      detail: null,
    };
  }

  return {
    label: health.orders_count > 0 ? "Dernière commande observée" : "Aucune commande observée",
    date: formatDate(health.last_order_at),
    detail: null,
  };
}

function mapTimelineEvent(row: BrandPharmacyTimelineRow): PharmacyQuickEvent {
  if (row.event_type === "interaction") {
    return {
      kind: "interaction",
      label: row.title || "Interaction commerciale",
      date: formatDate(row.occurred_at),
      detail: row.details,
    };
  }
  if (row.event_type === "status_change") {
    return {
      kind: "status_change",
      label: row.title || "Changement de statut",
      date: formatDate(row.occurred_at),
      detail: row.details,
    };
  }
  if (row.event_type === "task" || row.event_type === "task_completed") {
    return {
      kind: "task",
      label: row.title || "Tâche commerciale",
      date: formatDate(row.occurred_at),
      detail: row.details,
    };
  }
  if (row.event_type === "assignment") {
    return {
      kind: "system",
      label: row.title || "Affectation mise à jour",
      date: formatDate(row.occurred_at),
      detail: row.details,
    };
  }
  return {
    kind: "system",
    label: row.title || "Événement récent",
    date: formatDate(row.occurred_at),
    detail: row.details,
  };
}

function appendCommercialSignalEvent(events: PharmacyQuickEvent[], signal: PharmacySummary["lastCommercialSignal"]) {
  if (!signal.date) return events;
  return dedupeRecentEvents([
    {
      kind: "commercial_signal",
      label: signal.label,
      date: signal.date,
      detail: signal.detail,
    },
    ...events,
  ]);
}

function dedupeRecentEvents(events: PharmacyQuickEvent[]) {
  const seen = new Set<string>();
  const output: PharmacyQuickEvent[] = [];
  for (const event of events) {
    const key = `${event.kind}:${event.label}:${event.date ?? "-"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(event);
  }
  return output.slice(0, 3);
}

export async function loadPharmacySummary(supabase: SupabaseLike, brandPharmacyId: string): Promise<PharmacySummary | null> {
  const [summaryPayload, healthRows, timelineRows] = await Promise.all([
    unwrapRpc(supabase.rpc<PharmacySummaryRpc>("get_field_pharmacy_summary", { target_brand_pharmacy_id: brandPharmacyId })),
    unwrapRpc(supabase.rpc<CommercialHealthRow[]>("get_commercial_health", { target_brand_pharmacy_id: brandPharmacyId })),
    unwrapQuery(
      supabase
        .from("brand_pharmacy_timeline")
        .select("brand_pharmacy_id,event_type,title,details,occurred_at")
        .eq("brand_pharmacy_id", brandPharmacyId)
        .order("occurred_at", { ascending: false })
        .limit(3),
    ),
  ]);

  if (!summaryPayload) return null;
  const health = healthRows?.[0];
  if (!health) return null;

  const cockpit = getPharmacyCockpit({
    firstOrderAt: health.first_order_at,
    validOrderCount: health.orders_count,
    reorderCount: health.reorder_count,
    expectedReorderAt: health.expected_reorder_at,
    hasNextAction: Boolean(summaryPayload.next_action_type || summaryPayload.next_action_at),
    strategicDistributionRate: 100,
    missingProducts: [],
    healthStatus: health.health_status,
    priorityReasons: health.priority_reasons,
    commercialStatus: summaryPayload.status,
  });

  const whyAct = buildWhyAct(health, cockpit.reasons);
  const lastCommercialSignal = buildLastCommercialSignal(health);
  const recentEvents = appendCommercialSignalEvent(timelineRows.map(mapTimelineEvent), lastCommercialSignal);

  return {
    pharmacy: {
      id: summaryPayload.pharmacy_id,
      brandPharmacyId: summaryPayload.brand_pharmacy_id,
      name: summaryPayload.name,
      address: summaryPayload.address,
      city: health.city || extractCityFromAddress(summaryPayload.address),
    },
    status: {
      commercial: summaryPayload.status ?? "unknown",
      activity: health.health_status,
      label: safeLabel(summaryPayload.status, labels.commercialStatus, "Statut inconnu"),
      activityLabel: safeLabel(health.health_status as keyof typeof labels.activityStatus, labels.activityStatus, "Suivi à confirmer"),
    },
    potential: {
      level: summaryPayload.potential ?? "unknown",
      label: safeLabel(summaryPayload.potential, labels.potentialLevel, "Inconnu"),
    },
    priority: {
      level: summaryPayload.priority ?? "normal",
      label: safeLabel(summaryPayload.priority, labels.priorityLevel, "Normale"),
    },
    assignee: health.agent_name ?? null,
    situation: buildSituation({ health, summary: summaryPayload }),
    whyAct,
    nextAction: {
      type: summaryPayload.next_action_type,
      date: formatDate(summaryPayload.next_action_at),
      label: summaryPayload.next_action_type ? summaryPayload.next_action_type : "Aucune prochaine action prévue",
    },
    lastInteraction: {
      label: summaryPayload.last_interaction_at ? "Dernière interaction enregistrée" : "Aucune interaction récente",
      date: formatDate(summaryPayload.last_interaction_at),
    },
    lastCommercialSignal,
    recentEvents,
  };
}

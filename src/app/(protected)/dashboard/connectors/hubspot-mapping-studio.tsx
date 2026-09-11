import { ArrowRight, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrandRole } from "@/lib/auth";
import {
  HUBSPOT_ACTIVITY_TYPE_OPTIONS,
  HUBSPOT_ORDER_TYPE_OPTIONS,
  TR1_ORDER_TYPE_KEYS,
  TR1_VISIT_KIND_KEYS,
  buildHubSpotRuntimeProfile,
} from "@/lib/integrations/hubspot/mapping-profile";
import {
  NAALI_HUBSPOT_CONFIGURATION,
  resolveNaaliHubSpotOrderType,
  resolveNaaliHubSpotVisitType,
} from "@/lib/integrations/hubspot/naali";
import { saveHubSpotFieldMappingFormAction } from "./actions";

type ConnectorMapping = {
  id: string;
  entity_type: string;
  mapping_profile_id: string | null;
  is_enabled: boolean;
  direction: string;
};

type MappingProfile = {
  id: string;
  entity_type: string;
  source_system: string;
  mapping: unknown;
  transforms: unknown;
};

const ORDER_FIELDS = [
  ["name", "Nom de la transaction", "dealname", true],
  ["orderNumber", "N° de commande", "Champ optionnel si différent du nom", false],
  ["orderDate", "Date de saisie", "Champ date HubSpot", false],
  ["orderType", "Type de commande", "type_de_commande", false],
  ["amountHt", "CA HT", "amount", true],
  ["taxAmount", "TVA", "Champ TVA HubSpot", false],
  ["amountTtc", "Montant TTC", "Champ TTC HubSpot", false],
  ["currency", "Devise", "deal_currency_code", false],
  ["ownerId", "Commercial", "hubspot_owner_id", true],
  ["origin", "Origine de la commande", "origine_de_la_commande", false],
  ["pipeline", "Pipeline", "pipeline", true],
  ["stage", "Étape", "dealstage", true],
] as const;

const VISIT_FIELDS = [
  ["name", "Titre de la visite", "hs_meeting_title", true],
  ["startAt", "Début de visite", "hs_meeting_start_time", true],
  ["endAt", "Fin de visite", "hs_meeting_end_time", true],
  ["timestamp", "Horodatage HubSpot", "hs_timestamp", false],
  ["outcome", "Statut / résultat", "hs_meeting_outcome", true],
  ["ownerId", "Commercial", "hubspot_owner_id", true],
  ["activityType", "Type de visite", "hs_activity_type", true],
  ["body", "Compte-rendu", "hs_meeting_body", true],
  ["internalNotes", "Notes internes", "hs_internal_meeting_notes", false],
] as const;

const ORDER_TYPE_LABELS: Record<(typeof TR1_ORDER_TYPE_KEYS)[number], string> = {
  initial: "Implantation",
  reorder: "Réassort",
  complementary: "Commande complémentaire",
  replacement: "Remplacement",
  sample: "Échantillons",
  return: "Retour",
  credit_note: "Avoir",
  other: "Autre",
};

const VISIT_KIND_LABELS: Record<(typeof TR1_VISIT_KIND_KEYS)[number], string> = {
  client_visit: "Visite client",
  prospecting: "Visite prospection",
  relationship: "Rendez-vous relationnel",
  training: "Formation",
  other: "Autre visite",
};

function profileFor(
  entityType: "orders" | "visits",
  mapping: ConnectorMapping | undefined,
  profiles: MappingProfile[],
) {
  const stored = mapping?.mapping_profile_id
    ? profiles.find((profile) => profile.id === mapping.mapping_profile_id && profile.source_system.toLowerCase() === "hubspot")
    : undefined;
  return buildHubSpotRuntimeProfile({
    baseConfig: NAALI_HUBSPOT_CONFIGURATION,
    entityType,
    mapping: stored?.mapping,
    transforms: stored?.transforms,
  });
}

export async function HubSpotMappingStudio({
  connectionId,
  mappings,
}: {
  connectionId: string;
  mappings: ConnectorMapping[];
}) {
  const { supabase, brand } = await requireActiveBrandRole(["tr1_manager", "brand_admin", "super_admin"] as const);
  const profileIds = mappings.map((mapping) => mapping.mapping_profile_id).filter((value): value is string => Boolean(value));
  let profiles: MappingProfile[] = [];

  if (profileIds.length) {
    const { data, error } = await supabase
      .from("data_mapping_profiles")
      .select("id,entity_type,source_system,mapping,transforms")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .in("id", profileIds);
    if (error) throw error;
    profiles = (data ?? []) as MappingProfile[];
  }

  const orderConnectorMapping = mappings.find((mapping) => mapping.entity_type === "orders");
  const visitConnectorMapping = mappings.find((mapping) => mapping.entity_type === "visits");
  const orders = profileFor("orders", orderConnectorMapping, profiles);
  const visits = profileFor("visits", visitConnectorMapping, profiles);

  return (
    <Card className="mt-4 border-[var(--tr1-orange)]/25">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Mapping HubSpot ↔ TR1</CardTitle>
          <Badge variant="secondary">HubSpot</Badge>
        </div>
        <CardDescription>
          Choisissez le champ HubSpot qui reçoit chaque donnée TR1. Les objets, les associations pharmacie et la logique produits/UG restent verrouillés pour éviter de casser la synchronisation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 text-xs sm:grid-cols-3">
          <LockedItem label="Commandes" value="Transaction (Deal)" />
          <LockedItem label="Visites" value="Meeting" />
          <LockedItem label="Pharmacie" value="Association Company" />
        </div>

        <MappingForm
          connectionId={connectionId}
          entityType="orders"
          title="Commandes"
          description="Ce que TR1 envoie dans la transaction HubSpot. Les valeurs de pipeline et d’étape continuent d’être routées selon le commercial ou l’agent."
          enabled={Boolean(orderConnectorMapping?.is_enabled && ["outbound", "bidirectional"].includes(orderConnectorMapping.direction))}
          fields={ORDER_FIELDS}
          propertyMap={orders.config.properties.order}
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold">Correspondance des types de commande</p>
            <p className="text-xs text-muted-foreground">Laisser « Ne pas envoyer » si HubSpot n’a pas d’équivalent métier.</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {TR1_ORDER_TYPE_KEYS.map((key) => {
                const configured = Object.prototype.hasOwnProperty.call(orders.transforms.orderTypeValues, key)
                  ? orders.transforms.orderTypeValues[key]
                  : resolveNaaliHubSpotOrderType(key) ?? "";
                return (
                  <ValueRow key={key} label={ORDER_TYPE_LABELS[key]}>
                    <select name={`value_${key}`} defaultValue={configured} className="w-full rounded-md border bg-background px-2 py-2 text-sm">
                      <option value="">Ne pas envoyer</option>
                      {HUBSPOT_ORDER_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </ValueRow>
                );
              })}
            </div>
          </div>
        </MappingForm>

        <MappingForm
          connectionId={connectionId}
          entityType="visits"
          title="Visites"
          description="Une visite clôturée dans TR1 reste un Meeting HubSpot. Le compte-rendu est envoyé dans le Meeting, jamais comme une note séparée."
          enabled={Boolean(visitConnectorMapping?.is_enabled && ["outbound", "bidirectional"].includes(visitConnectorMapping.direction))}
          fields={VISIT_FIELDS}
          propertyMap={visits.config.properties.meeting}
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold">Correspondance des types de visite</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {TR1_VISIT_KIND_KEYS.map((key) => {
                const configured = Object.prototype.hasOwnProperty.call(visits.transforms.visitTypeValues, key)
                  ? visits.transforms.visitTypeValues[key]
                  : resolveNaaliHubSpotVisitType(key);
                return (
                  <ValueRow key={key} label={VISIT_KIND_LABELS[key]}>
                    <select name={`value_${key}`} defaultValue={configured} className="w-full rounded-md border bg-background px-2 py-2 text-sm" required>
                      {HUBSPOT_ACTIVITY_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </ValueRow>
                );
              })}
            </div>
          </div>
        </MappingForm>
      </CardContent>
    </Card>
  );
}

function MappingForm({
  connectionId,
  entityType,
  title,
  description,
  enabled,
  fields,
  propertyMap,
  children,
}: {
  connectionId: string;
  entityType: "orders" | "visits";
  title: string;
  description: string;
  enabled: boolean;
  fields: readonly (readonly [string, string, string, boolean])[];
  propertyMap: Record<string, string | undefined>;
  children: React.ReactNode;
}) {
  return (
    <form action={saveHubSpotFieldMappingFormAction} className="space-y-4 rounded-xl border p-4">
      <input type="hidden" name="connectionId" value={connectionId} />
      <input type="hidden" name="entityType" value={entityType} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant={enabled ? "outline" : "secondary"}>{enabled ? "Flux actif" : "Flux à activer"}</Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Donnée TR1</th><th className="w-10 px-2"></th><th className="px-3 py-2">Champ HubSpot</th></tr>
          </thead>
          <tbody>
            {fields.map(([key, label, placeholder, required]) => (
              <tr key={key} className="border-t">
                <td className="px-3 py-2 font-medium">{label}</td>
                <td className="px-2"><ArrowRight className="size-4 text-muted-foreground" /></td>
                <td className="px-3 py-2">
                  <input
                    name={`property_${key}`}
                    defaultValue={propertyMap[key] ?? ""}
                    placeholder={placeholder}
                    required={required}
                    maxLength={160}
                    className="w-full rounded-md border bg-background px-2 py-2 font-mono text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {children}
      <div className="flex justify-end"><Button type="submit" disabled={!enabled}>Enregistrer le mapping {title.toLowerCase()}</Button></div>
    </form>
  );
}

function ValueRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-3 rounded-lg border p-2"><span className="text-sm">{label}</span>{children}</label>;
}

function LockedItem({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-2"><LockKeyhole className="size-3.5 text-muted-foreground" /><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

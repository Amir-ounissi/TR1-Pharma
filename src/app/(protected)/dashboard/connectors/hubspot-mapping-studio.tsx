import { PauseCircle, SlidersHorizontal } from "lucide-react";
import { saveHubSpotFieldMappingProfileAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConnectorConnectionStatus, ConnectorDirection } from "@/lib/connectors";
import {
  defaultHubSpotFieldMapping,
  HUBSPOT_FIELD_DEFINITIONS,
  isHubSpotFieldMappingEntity,
} from "@/lib/integrations/hubspot/mapping-profile";
import { NAALI_HUBSPOT_CONFIGURATION } from "@/lib/integrations/hubspot/naali";

type Mapping = {
  id: string;
  entity_type: string;
  external_object: string;
  direction: ConnectorDirection;
  mapping_profile_id: string | null;
  is_enabled: boolean;
};

type MappingProfile = {
  id: string;
  entity_type: string;
  name: string;
  source_system: string;
  mapping: Record<string, unknown>;
  transforms: Record<string, unknown>;
  version: number;
};

function entityTitle(entityType: string) {
  return ({ orders: "Commandes → Deals", visits: "Visites → Meetings", notes: "Notes → Notes" } as Record<string, string>)[entityType] ?? entityType;
}

export function HubSpotMappingStudio({
  connectionStatus,
  mappings,
  profiles,
}: {
  connectionStatus: ConnectorConnectionStatus;
  mappings: Mapping[];
  profiles: MappingProfile[];
}) {
  const editableMappings = mappings.filter((mapping) => isHubSpotFieldMappingEntity(mapping.entity_type));
  if (!editableMappings.length) return null;

  return (
    <section className="mt-5 border-t pt-5" aria-labelledby="hubspot-mapping-studio-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-[var(--tr1-navy)]" aria-hidden="true" />
            <h3 id="hubspot-mapping-studio-title" className="text-sm font-semibold">Mapping des champs HubSpot</h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Choisissez la propriété HubSpot alimentée par chaque donnée TR1. Les modifications sont versionnées et utilisées par le runtime lors des prochaines synchronisations.
          </p>
        </div>
        <Badge variant="outline">{editableMappings.length} objet{editableMappings.length > 1 ? "s" : ""}</Badge>
      </div>

      {connectionStatus === "paused" ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <PauseCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Synchronisation en pause</p>
            <p className="mt-1 text-xs leading-5 text-amber-900">Vous pouvez modifier et enregistrer les correspondances sans envoyer de donnée à HubSpot. Elles seront utilisées uniquement après réactivation du connecteur.</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {editableMappings.map((connectorMapping) => {
          if (!isHubSpotFieldMappingEntity(connectorMapping.entity_type)) return null;
          const profile = connectorMapping.mapping_profile_id
            ? profiles.find((item) => item.id === connectorMapping.mapping_profile_id) ?? null
            : null;
          const defaults = defaultHubSpotFieldMapping(NAALI_HUBSPOT_CONFIGURATION, connectorMapping.entity_type);
          const saved = profile?.mapping ?? {};
          const definitions = HUBSPOT_FIELD_DEFINITIONS[connectorMapping.entity_type];

          return (
            <details key={connectorMapping.id} className="group rounded-xl border bg-white/60" open>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--tr1-navy)]">{entityTitle(connectorMapping.entity_type)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Objet HubSpot : <span className="font-mono">{connectorMapping.external_object}</span>{profile ? ` · profil v${profile.version}` : " · mapping NAALI actuel"}</p>
                </div>
                <Badge variant={profile ? "secondary" : "outline"}>{profile ? "Personnalisé" : "Par défaut"}</Badge>
              </summary>

              <form action={saveHubSpotFieldMappingProfileAction} className="border-t p-4">
                <input type="hidden" name="connectorMappingId" value={connectorMapping.id} />
                <input type="hidden" name="entityType" value={connectorMapping.entity_type} />

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-4 font-semibold">Donnée TR1</th>
                        <th className="pb-2 pr-4 font-semibold">Propriété HubSpot</th>
                        <th className="pb-2 font-semibold">Utilisation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {definitions.map((definition) => {
                        const savedValue = saved[definition.key];
                        const value = typeof savedValue === "string" ? savedValue : defaults[definition.key] ?? "";
                        return (
                          <tr key={definition.key} className="border-b last:border-0">
                            <td className="py-3 pr-4 align-top">
                              <p className="font-medium">{definition.label}</p>
                              <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">{definition.key}</p>
                            </td>
                            <td className="py-3 pr-4 align-top">
                              <input
                                className="h-10 w-full rounded-md border bg-background px-3 font-mono text-xs"
                                name={`field:${definition.key}`}
                                defaultValue={value}
                                placeholder="nom_propriete_hubspot"
                                pattern="[a-zA-Z0-9_.-]{1,160}"
                                maxLength={160}
                                aria-label={`Propriété HubSpot pour ${definition.label}`}
                              />
                            </td>
                            <td className="py-3 align-top text-xs leading-5 text-muted-foreground">{definition.description}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">Laisser un champ vide désactive l’envoi de cette propriété. Aucun champ HubSpot n’est créé automatiquement.</p>
                  <Button type="submit" size="sm">Enregistrer le mapping</Button>
                </div>
              </form>
            </details>
          );
        })}
      </div>
    </section>
  );
}

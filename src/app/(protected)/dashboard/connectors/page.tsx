import { Cable, CheckCircle2, CircleAlert, Database, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import {
  archiveConnectorConnectionFormAction,
  saveConnectorConnectionFormAction,
  saveConnectorMappingFormAction,
  setConnectorStatusFormAction,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { requireActiveBrandRole } from "@/lib/auth";
import {
  CONNECTOR_ENTITY_TYPES,
  CONNECTOR_PROVIDERS,
  connectorCredentialLabel,
  connectorDirectionLabel,
  connectorProviderLabel,
  connectorStatusLabel,
  summarizeConnectorConnections,
  type ConnectorConnectionStatus,
  type ConnectorCredentialStatus,
  type ConnectorDirection,
  type ConnectorProvider,
} from "@/lib/connectors";

type Connection = {
  id: string;
  provider: ConnectorProvider;
  name: string;
  status: ConnectorConnectionStatus;
  credential_status: ConnectorCredentialStatus;
  credential_reference: string | null;
  external_account_id: string | null;
  base_url: string | null;
  configuration: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type Mapping = {
  id: string;
  connection_id: string;
  entity_type: string;
  external_object: string;
  direction: ConnectorDirection;
  mapping_profile_id: string | null;
  conflict_strategy: string;
  cursor_field: string | null;
  is_enabled: boolean;
};

type MappingProfile = { id: string; entity_type: string; name: string; source_system: string };
type SyncRun = {
  id: string;
  connection_id: string;
  entity_type: string;
  direction: "inbound" | "outbound";
  status: string;
  records_seen: number;
  records_succeeded: number;
  records_failed: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Jamais";
}

function entityLabel(value: string) {
  return ({ pharmacies: "Pharmacies", contacts: "Contacts", products: "Produits", orders: "Commandes" } as Record<string, string>)[value] ?? value;
}

export default async function ConnectorsPage() {
  const { supabase, brand } = await requireActiveBrandRole(["tr1_manager", "brand_admin", "super_admin"] as const);
  const [connectionsResult, mappingsResult, profilesResult, runsResult] = await Promise.all([
    supabase
      .from("connector_connections")
      .select("id,provider,name,status,credential_status,credential_reference,external_account_id,base_url,configuration,last_synced_at,last_error,updated_at")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("connector_entity_mappings")
      .select("id,connection_id,entity_type,external_object,direction,mapping_profile_id,conflict_strategy,cursor_field,is_enabled")
      .eq("brand_id", brand.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("data_mapping_profiles")
      .select("id,entity_type,name,source_system")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("connector_sync_runs")
      .select("id,connection_id,entity_type,direction,status,records_seen,records_succeeded,records_failed,started_at,completed_at,created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  for (const result of [connectionsResult, mappingsResult, profilesResult, runsResult]) {
    if (result.error) throw result.error;
  }

  const connections = (connectionsResult.data ?? []) as Connection[];
  const mappings = (mappingsResult.data ?? []) as Mapping[];
  const profiles = (profilesResult.data ?? []) as MappingProfile[];
  const runs = (runsResult.data ?? []) as SyncRun[];
  const summary = summarizeConnectorConnections(connections);

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Intégrations · ${brand.name}`}
        title="Connecteurs"
        description="Reliez TR1 à vos CRM, ERP ou API sans transformer TR1 en dépendance d’un fournisseur externe. Le modèle TR1 reste canonique et les synchronisations sont traçables."
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Synthèse connecteurs">
        <Metric label="Connexions" value={summary.total} icon={Cable} />
        <Metric label="Actives" value={summary.active} icon={CheckCircle2} />
        <Metric label="Prêtes" value={summary.ready} icon={RefreshCw} />
        <Metric label="En erreur" value={summary.errors} icon={CircleAlert} />
        <Metric label="Identifiants à configurer" value={summary.credentialsToConfigure} icon={KeyRound} />
      </section>

      <Card className="border-[var(--tr1-navy)]/15">
        <CardHeader>
          <CardTitle>Architecture découplée des fournisseurs</CardTitle>
          <CardDescription>Chaque fournisseur parle à un adaptateur. Les données sont ramenées vers le modèle canonique TR1 et les secrets restent hors de la configuration publique.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {(Object.keys(CONNECTOR_PROVIDERS) as ConnectorProvider[]).map((provider) => (
            <div key={provider} className="rounded-xl border p-3">
              <p className="font-semibold">{connectorProviderLabel(provider)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{CONNECTOR_PROVIDERS[provider].family.toUpperCase()} · {CONNECTOR_PROVIDERS[provider].auth === "oauth" ? "OAuth" : "secret externe"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Nouvelle connexion</CardTitle><CardDescription>Aucun token ou mot de passe n’est stocké ici. Utilisez uniquement une référence vers un secret géré par le runtime.</CardDescription></CardHeader>
          <CardContent>
            <form action={saveConnectorConnectionFormAction} className="space-y-4" data-testid="connector-create-form">
              <Field label="Nom"><input className="w-full rounded-md border bg-background px-3 py-2" name="name" placeholder="CRM France" required minLength={2} maxLength={120} /></Field>
              <Field label="Fournisseur">
                <select className="w-full rounded-md border bg-background px-3 py-2" name="provider" defaultValue="hubspot">
                  {(Object.keys(CONNECTOR_PROVIDERS) as ConnectorProvider[]).map((provider) => <option key={provider} value={provider}>{connectorProviderLabel(provider)}</option>)}
                </select>
              </Field>
              <Field label="Compte externe"><input className="w-full rounded-md border bg-background px-3 py-2" name="externalAccountId" placeholder="portal / org / tenant" maxLength={255} /></Field>
              <Field label="URL de base"><input className="w-full rounded-md border bg-background px-3 py-2" name="baseUrl" type="url" placeholder="https://api.example.com" /></Field>
              <Field label="Référence d’identifiants"><input className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" name="credentialReference" placeholder="oauth://hubspot/brand ou secret://project/key" maxLength={255} autoComplete="off" /></Field>
              <Field label="Configuration non sensible (JSON)"><textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" name="configuration" defaultValue="{}" aria-label="Configuration non sensible" /></Field>
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline size-4" />Les clés `access_token`, `refresh_token`, `api_key`, `client_secret`, `password` et autres secrets sont bloquées côté serveur et base.</div>
              <Button type="submit" className="w-full">Créer la connexion</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Connexions configurées</CardTitle><CardDescription>{connections.length ? `${connections.length} connexion(s) pour ${brand.name}.` : "Aucune connexion pour le moment."}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {connections.length ? connections.map((connection) => {
              const connectionMappings = mappings.filter((mapping) => mapping.connection_id === connection.id);
              return (
                <div key={connection.id} className="rounded-xl border p-4" data-testid="connector-connection-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{connection.name}</p><Badge variant="secondary">{connectorProviderLabel(connection.provider)}</Badge><Badge variant={connection.status === "error" ? "destructive" : "outline"}>{connectorStatusLabel(connection.status)}</Badge></div>
                      <p className="mt-1 text-xs text-muted-foreground">Identifiants : {connectorCredentialLabel(connection.credential_status)} · Dernière synchro : {dateTime(connection.last_synced_at)}</p>
                      {connection.credential_reference ? <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">{connection.credential_reference}</p> : null}
                      {connection.last_error ? <p className="mt-2 text-xs text-destructive">{connection.last_error}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {connection.status !== "active" ? <StatusButton connectionId={connection.id} status="active" label="Activer" disabled={connection.credential_status !== "configured"} /> : <StatusButton connectionId={connection.id} status="paused" label="Mettre en pause" />}
                      {connection.status === "draft" ? <StatusButton connectionId={connection.id} status="ready" label="Marquer prêt" /> : null}
                      <form action={archiveConnectorConnectionFormAction}><input type="hidden" name="connectionId" value={connection.id} /><Button size="sm" variant="ghost" type="submit">Archiver</Button></form>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Objets synchronisés</p><p className="text-xs text-muted-foreground">Le Mapping Studio traduit les champs externes vers le schéma TR1.</p></div><Badge variant="outline">{connectionMappings.length}</Badge></div>
                    {connectionMappings.length ? <div className="mb-4 grid gap-2 md:grid-cols-2">{connectionMappings.map((mapping) => (
                      <div key={mapping.id} className="rounded-lg bg-muted/30 p-3 text-xs">
                        <p className="font-semibold">{entityLabel(mapping.entity_type)} ← {mapping.external_object}</p>
                        <p className="mt-1 text-muted-foreground">{connectorDirectionLabel(mapping.direction)} · conflits {mapping.conflict_strategy} · {mapping.is_enabled ? "actif" : "désactivé"}</p>
                      </div>
                    ))}</div> : null}

                    <form action={saveConnectorMappingFormAction} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4" data-testid="connector-mapping-form">
                      <input type="hidden" name="connectionId" value={connection.id} />
                      <select className="rounded-md border bg-background px-2 py-2 text-sm" name="entityType" defaultValue="pharmacies">{CONNECTOR_ENTITY_TYPES.map((entity) => <option key={entity} value={entity}>{entityLabel(entity)}</option>)}</select>
                      <input className="rounded-md border bg-background px-2 py-2 text-sm" name="externalObject" placeholder="companies" required />
                      <select className="rounded-md border bg-background px-2 py-2 text-sm" name="direction" defaultValue="inbound"><option value="inbound">Vers TR1</option><option value="outbound">Depuis TR1</option><option value="bidirectional">Bidirectionnel</option></select>
                      <select className="rounded-md border bg-background px-2 py-2 text-sm" name="mappingProfileId" defaultValue=""><option value="">Mapping à définir</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{entityLabel(profile.entity_type)} · {profile.name}</option>)}</select>
                      <select className="rounded-md border bg-background px-2 py-2 text-sm" name="conflictStrategy" defaultValue="manual"><option value="manual">Conflits : revue humaine</option><option value="external_wins">Source externe prioritaire</option><option value="tr1_wins">TR1 prioritaire</option><option value="newest_wins">Le plus récent</option></select>
                      <input className="rounded-md border bg-background px-2 py-2 text-sm" name="cursorField" placeholder="updatedAt (optionnel)" />
                      <input type="hidden" name="enabled" value="true" />
                      <Button size="sm" type="submit">Ajouter le mapping</Button>
                    </form>
                  </div>
                </div>
              );
            }) : <p className="py-10 text-center text-sm text-muted-foreground">Créez une première connexion pour préparer les échanges de données.</p>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Journal des synchronisations</CardTitle><CardDescription>Chaque exécution conserve le sens du flux, l’objet, les compteurs et le résultat. Les appels fournisseurs seront exécutés uniquement par le backend de confiance.</CardDescription></CardHeader>
        <CardContent>
          {runs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-muted-foreground"><th className="py-2">Connexion</th><th>Objet</th><th>Flux</th><th>Statut</th><th>Traités</th><th>Succès</th><th>Erreurs</th><th>Démarrage</th></tr></thead><tbody>{runs.map((run) => {
            const connection = connections.find((item) => item.id === run.connection_id);
            return <tr key={run.id} className="border-b"><td className="py-3 font-medium">{connection?.name ?? "Connexion archivée"}</td><td>{entityLabel(run.entity_type)}</td><td>{connectorDirectionLabel(run.direction)}</td><td><Badge variant={run.status === "failed" ? "destructive" : "outline"}>{run.status}</Badge></td><td>{run.records_seen}</td><td>{run.records_succeeded}</td><td>{run.records_failed}</td><td>{dateTime(run.started_at || run.created_at)}</td></tr>;
          })}</tbody></table></div> : <div className="flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground"><Database className="size-5" />Aucune synchronisation exécutée. Ce lot pose l’architecture et la gouvernance avant l’activation des adaptateurs fournisseurs.</div>}
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Cable }) {
  return <Card><CardContent className="flex items-start justify-between gap-3 pt-5"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><Icon className="size-4 text-[var(--tr1-orange)]" /></CardContent></Card>;
}

function StatusButton({ connectionId, status, label, disabled = false }: { connectionId: string; status: "draft" | "ready" | "active" | "paused" | "error"; label: string; disabled?: boolean }) {
  return <form action={setConnectorStatusFormAction}><input type="hidden" name="connectionId" value={connectionId} /><input type="hidden" name="status" value={status} /><Button size="sm" variant="outline" type="submit" disabled={disabled}>{label}</Button></form>;
}

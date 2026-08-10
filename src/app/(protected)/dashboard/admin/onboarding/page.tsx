import { CheckCircle2, CircleDashed, CircleX, Download, Printer, RotateCcw, Rocket } from "lucide-react";
import Link from "next/link";
import {
  activateBrandAction,
  executeOnboardingImportAction,
  rollbackOnboardingImportAction,
  updateOnboardingSettingsAction,
} from "@/app/(protected)/dashboard/admin/onboarding/actions";
import { OnboardingAdminInviteForm } from "@/components/onboarding/onboarding-admin-invite-form";
import { OnboardingCreateForm } from "@/components/onboarding/onboarding-create-form";
import { OnboardingImportPanel } from "@/components/onboarding/onboarding-import-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportType } from "@/lib/imports/import-types";
import { requirePlatformAdmin } from "@/lib/auth";

const lifecycleLabels: Record<string, string> = {
  uploaded: "Fichier reçu",
  parsing: "Analyse en cours",
  review: "À corriger",
  ready: "Prêt à exécuter",
  executing: "Exécution en cours",
  completed: "Terminé",
  completed_with_warnings: "Terminé avec avertissements",
  failed: "Échec",
  cancelled: "Annulé",
  rolled_back: "Annulé proprement",
};

const importLabels: Record<string, string> = {
  products: "Produits",
  pharmacies: "Pharmacies",
  orders: "Commandes",
  users: "Utilisateurs",
  territories: "Territoires",
};

type ChecklistItem = {
  check_key: string;
  label: string;
  completed: boolean;
  blocking: boolean;
};

type ImportJob = {
  id: string;
  file_name: string;
  entity_type: string;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  lifecycle_status: string;
  rollback_status: string;
};

type AuditEntry = {
  event_name: string;
  occurred_at: string;
};

function StatusIcon({ completed, blocking }: { completed: boolean; blocking: boolean }) {
  if (completed) return <CheckCircle2 className="size-5 text-emerald-600" />;
  if (blocking) return <CircleX className="size-5 text-destructive" />;
  return <CircleDashed className="size-5 text-amber-600" />;
}

export default async function BrandOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { supabase } = await requirePlatformAdmin();
  const params = await searchParams;
  const [{ data: sessions }, { data: templates }] = await Promise.all([
    supabase.from("brand_onboarding_sessions").select("*").order("created_at", { ascending: false }),
    supabase.from("import_templates").select("import_type,documentation").eq("is_active", true).order("import_type"),
  ]);
  const selectedSession = sessions?.find((session) => session.brand_id === params.brand) ?? sessions?.[0] ?? null;
  const brandIds = (sessions ?? []).map((session) => session.brand_id);
  const organizationIds = (sessions ?? []).map((session) => session.organization_id);
  const [{ data: brands }, { data: organizations }] = await Promise.all([
    brandIds.length ? supabase.from("brands").select("id,name,code,status,organization_id,activated_at").in("id", brandIds) : Promise.resolve({ data: [] }),
    organizationIds.length ? supabase.from("organizations").select("id,legal_name,trade_name,status").in("id", organizationIds) : Promise.resolve({ data: [] }),
  ]);
  const selectedBrand = brands?.find((brand) => brand.id === selectedSession?.brand_id) ?? null;
  const selectedOrganization = organizations?.find((organization) => organization.id === selectedSession?.organization_id) ?? null;

  const [{ data: settings }, { data: checklist }, { data: jobs }, { data: audits }] = selectedSession
    ? await Promise.all([
      supabase.from("brand_settings").select("*").eq("brand_id", selectedSession.brand_id).single(),
      supabase.rpc("get_brand_activation_checklist", { target_brand_id: selectedSession.brand_id }),
      supabase.from("import_batches").select("*").eq("brand_id", selectedSession.brand_id).order("created_at", { ascending: false }).limit(30),
      supabase.from("onboarding_audit_logs").select("event_name,occurred_at,metadata").eq("brand_id", selectedSession.brand_id).order("occurred_at", { ascending: false }).limit(20),
    ])
    : [{ data: null }, { data: [] }, { data: [] }, { data: [] }];
  const checklistItems = (checklist ?? []) as ChecklistItem[];
  const importJobs = (jobs ?? []) as ImportJob[];
  const auditEntries = (audits ?? []) as AuditEntry[];
  const blockingCount = checklistItems.filter((item) => item.blocking && !item.completed).length;
  const completedChecks = checklistItems.filter((item) => item.completed).length;
  const totalChecks = checklistItems.length;
  const progress = totalChecks ? Math.round((completedChecks / totalChecks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Console de déploiement</p>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding d’une marque</h1>
          <p className="text-muted-foreground">Créez, contrôlez et activez un tenant sans manipulation SQL.</p>
        </div>
        {selectedSession ? (
          <div className="flex gap-2 print:hidden">
            <Button asChild variant="outline"><a href={`/api/onboarding/export/${selectedSession.brand_id}/summary`}><Download className="size-4" />Rapport CSV</a></Button>
            <Button variant="outline" onClick={undefined} asChild><Link href="#rapport"><Printer className="size-4" />Version imprimable</Link></Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Nouvelle organisation et première marque</CardTitle>
          <CardDescription>Réservé aux administrateurs TR1. La marque reste inactive jusqu’au contrôle final.</CardDescription>
        </CardHeader>
        <CardContent><OnboardingCreateForm /></CardContent>
      </Card>

      {(sessions ?? []).length ? (
        <Card>
          <CardHeader><CardTitle>Déploiements en cours</CardTitle><CardDescription>Sélectionnez la marque à préparer.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(sessions ?? []).map((session) => {
              const brand = brands?.find((item) => item.id === session.brand_id);
              return (
                <Button asChild key={session.id} variant={session.id === selectedSession?.id ? "default" : "outline"}>
                  <Link href={`/dashboard/admin/onboarding?brand=${session.brand_id}`}>{brand?.name ?? "Marque"} · {session.status === "completed" ? "Activée" : "En préparation"}</Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {selectedSession && selectedBrand ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Progression de {selectedBrand.name}</CardTitle>
              <CardDescription>{selectedOrganization?.legal_name} · {progress}% du contrôle terminé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="grid gap-3 md:grid-cols-2">
                {checklistItems.map((item) => (
                  <div className="flex items-center gap-3 rounded-lg border p-3" key={item.check_key}>
                    <StatusIcon completed={item.completed} blocking={item.blocking} />
                    <div><p className="font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.completed ? "Contrôle réussi" : item.blocking ? "Action requise" : "Étape facultative"}</p></div>
                  </div>
                ))}
              </div>
              <Alert variant={blockingCount ? "destructive" : "default"}>
                <AlertTitle>{blockingCount ? `${blockingCount} élément(s) bloquant(s)` : "Prête à être activée"}</AlertTitle>
                <AlertDescription>{blockingCount ? "Terminez les contrôles requis avant l’activation." : "Tous les contrôles obligatoires sont satisfaits."}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Paramètres commerciaux</CardTitle><CardDescription>Valeurs initiales simples, réutilisées par la santé commerciale et la performance missions.</CardDescription></CardHeader>
            <CardContent>
              <form action={updateOnboardingSettingsAction} className="grid gap-4 md:grid-cols-3">
                <input type="hidden" name="brandId" value={selectedBrand.id} />
                {[
                  ["defaultReorderIntervalDays", "Intervalle de réassort (jours)", settings?.default_reorder_interval_days, "Cadence standard entre deux commandes."],
                  ["firstReorderTargetDays", "Premier réassort cible (jours)", settings?.first_reorder_target_days, "Délai attendu après la première commande."],
                  ["reorderDueSoonDays", "Préavis réassort (jours)", settings?.reorder_due_soon_days, "Fenêtre d’alerte avant échéance."],
                  ["atRiskMultiplier", "Multiplicateur à risque", settings?.at_risk_multiplier, "Seuil relatif pour signaler un compte à risque."],
                  ["dormantMultiplier", "Multiplicateur dormant", settings?.dormant_multiplier, "Seuil relatif pour qualifier un compte dormant."],
                  ["reorderEligibilityDays", "Éligibilité réassort (jours)", settings?.reorder_eligibility_days, "Ancienneté minimale avant suggestion."],
                  ["postMissionFollowupDays", "Suivi post-mission (jours)", settings?.post_mission_followup_days, "Délai avant la prochaine action terrain."],
                ].map(([name, label, value, help]) => (
                  <div className="space-y-2" key={String(name)}>
                    <Label htmlFor={String(name)}>{label}</Label>
                    <Input id={String(name)} name={String(name)} type="number" step="0.1" defaultValue={String(value ?? "")} required />
                    <p className="text-xs text-muted-foreground">{help}</p>
                  </div>
                ))}
                <div className="space-y-2"><Label htmlFor="settingsCurrency">Devise</Label><Input id="settingsCurrency" name="currencyCode" defaultValue={settings?.currency_code ?? "EUR"} required maxLength={3} /></div>
                <div className="space-y-2"><Label htmlFor="settingsTimezone">Fuseau horaire</Label><Input id="settingsTimezone" name="timezone" defaultValue={settings?.timezone ?? "Europe/Paris"} required /></div>
                <Button className="md:col-span-3">Enregistrer les paramètres</Button>
              </form>
            </CardContent>
          </Card>

          <Card data-testid="onboarding-import-card">
            <CardHeader><CardTitle>3. Imports contrôlés</CardTitle><CardDescription>Le fichier reste privé. Toute ligne invalide bloque l’exécution du lot.</CardDescription></CardHeader>
            <CardContent><OnboardingImportPanel brandId={selectedBrand.id} templates={(templates ?? []) as Array<{ import_type: ImportType; documentation: string }>} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>4. Administrateur de marque</CardTitle><CardDescription>L’invitation est envoyée sans mot de passe en clair.</CardDescription></CardHeader>
            <CardContent>
              <OnboardingAdminInviteForm brandId={selectedBrand.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>5. Lots préparés</CardTitle><CardDescription>Exécution explicite, idempotente et rollback limité aux enregistrements créés par le lot.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Fichier</TableHead><TableHead>Données</TableHead><TableHead>Contrôle</TableHead><TableHead>Résultat</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {importJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.file_name}</TableCell>
                      <TableCell>{importLabels[job.entity_type] ?? "Référentiel"}</TableCell>
                      <TableCell>{job.valid_rows} valides · {job.warning_rows} avert. · <span className={job.error_rows ? "text-destructive" : ""}>{job.error_rows} erreurs</span></TableCell>
                      <TableCell><Badge variant={job.lifecycle_status === "failed" ? "destructive" : "secondary"}>{lifecycleLabels[job.lifecycle_status] ?? "En attente"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {job.lifecycle_status === "ready" ? (
                            <form action={executeOnboardingImportAction}><input type="hidden" name="jobId" value={job.id} /><Button size="sm">Exécuter l’import</Button></form>
                          ) : null}
                          {["completed", "completed_with_warnings"].includes(job.lifecycle_status) && job.rollback_status === "rollback_available" ? (
                            <form action={rollbackOnboardingImportAction}><input type="hidden" name="jobId" value={job.id} /><Button size="sm" variant="outline"><RotateCcw className="size-4" />Rollback</Button></form>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!importJobs.length ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucun lot préparé.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card id="rapport">
            <CardHeader><CardTitle>6. Rapport et activation</CardTitle><CardDescription>Contrôle final de l’environnement avant ouverture aux utilisateurs.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Organisation</p><p className="font-medium">{selectedOrganization?.legal_name}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Marque</p><p className="font-medium">{selectedBrand.name}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Imports terminés</p><p className="font-medium">{importJobs.filter((job) => job.lifecycle_status.startsWith("completed")).length}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Activation</p><p className="font-medium">{selectedBrand.status === "active" ? "Active" : "En attente"}</p></div>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                {(["products", "pharmacies", "orders", "users", "territories"] as const).map((type) => (
                  <Button asChild variant="outline" size="sm" key={type}><a href={`/api/onboarding/export/${selectedBrand.id}/${type}`}><Download className="size-4" />{importLabels[type]}</a></Button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="font-medium">Dernières opérations auditées</p>
                {auditEntries.slice(0, 8).map((audit) => <p className="text-sm text-muted-foreground" key={`${audit.event_name}-${audit.occurred_at}`}>{new Date(audit.occurred_at).toLocaleString("fr-FR")} · {audit.event_name.replaceAll("_", " ")}</p>)}
              </div>
              {selectedBrand.status !== "active" ? (
                <form action={activateBrandAction}>
                  <input type="hidden" name="brandId" value={selectedBrand.id} />
                  <Button disabled={blockingCount > 0}><Rocket className="size-4" />Activer la marque</Button>
                </form>
              ) : <Badge>Marque activée</Badge>}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

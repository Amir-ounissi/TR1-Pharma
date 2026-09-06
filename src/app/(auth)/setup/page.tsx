import { CheckCircle2, CircleDashed, CircleX, Rocket } from "lucide-react";
import { AutonomousOnboardingStartForm } from "@/components/onboarding/autonomous-onboarding-start-form";
import { AutonomousTeamInviteForm } from "@/components/onboarding/autonomous-team-invite-form";
import { OnboardingImportPanel } from "@/components/onboarding/onboarding-import-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activateAutonomousOnboardingAction,
  executeAutonomousOnboardingImportAction,
  markAutonomousStepAction,
  stageAutonomousOnboardingImportAction,
  updateAutonomousSettingsAction,
} from "@/app/(auth)/setup/actions";
import type { ImportType } from "@/lib/imports/import-types";
import { getMySelfServiceOnboarding } from "@/lib/onboarding/self-service";

type ChecklistItem = {
  check_key: string;
  label: string;
  completed: boolean;
  blocking: boolean;
  detail?: string | null;
};

type ImportJob = {
  id: string;
  file_name: string;
  entity_type: ImportType;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  lifecycle_status: string;
};

const stepLabels: Record<string, string> = {
  organization: "Entreprise",
  brand: "Marque",
  users: "Équipe",
  territories: "Territoires",
  pharmacies: "Pharmacies",
  products: "Produits",
  settings: "Configuration",
  verification: "Vérification",
  activation: "Activation",
};

const importLabels: Partial<Record<ImportType, string>> = {
  users: "Équipe",
  territories: "Territoires",
  pharmacies: "Pharmacies",
  products: "Produits",
};

function StepBadge({ status }: { status?: string }) {
  if (status === "completed") return <Badge>Terminé</Badge>;
  if (status === "skipped") return <Badge variant="secondary">Ignoré</Badge>;
  if (status === "in_progress") return <Badge variant="secondary">En cours</Badge>;
  if (status === "blocked") return <Badge variant="destructive">Bloqué</Badge>;
  return <Badge variant="outline">À faire</Badge>;
}

function ChecklistIcon({ completed, blocking }: { completed: boolean; blocking: boolean }) {
  if (completed) return <CheckCircle2 className="size-5 text-emerald-600" />;
  if (blocking) return <CircleX className="size-5 text-destructive" />;
  return <CircleDashed className="size-5 text-amber-600" />;
}

export default async function AutonomousOnboardingPage() {
  const { supabase, userId, onboarding } = await getMySelfServiceOnboarding();

  if (!onboarding) {
    const [{ data: accessRequest }, { data: capabilityRows }] = await Promise.all([
      supabase
        .from("access_requests")
        .select("requested_profile_type,requested_access,status")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("saas_plan_capabilities")
        .select("plan_id")
        .eq("capability_key", "autonomous_onboarding")
        .eq("enabled", true),
    ]);

    const planIds = [...new Set((capabilityRows ?? []).map((row) => row.plan_id))];
    const { data: plans } = planIds.length
      ? await supabase
          .from("saas_plans")
          .select("key,name,description")
          .in("id", planIds)
          .eq("is_public", true)
          .eq("is_active", true)
          .order("sort_order")
      : { data: [] as Array<{ key: string; name: string; description: string }> };

    const requestedAccess = accessRequest?.requested_access && typeof accessRequest.requested_access === "object"
      ? accessRequest.requested_access as Record<string, unknown>
      : {};
    const defaultCompanyName = typeof requestedAccess.company_name === "string" ? requestedAccess.company_name : "";
    const eligible = accessRequest?.requested_profile_type === "brand" && accessRequest.status === "pending";

    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Mise en route TR1</p>
          <h1 className="text-3xl font-semibold tracking-tight">Créer votre espace marque</h1>
          <p className="max-w-3xl text-muted-foreground">
            Votre espace reste isolé et en brouillon tant que les contrôles d’activation ne sont pas validés.
          </p>
        </div>

        {!eligible ? (
          <Alert variant="destructive">
            <AlertTitle>Onboarding autonome indisponible</AlertTitle>
            <AlertDescription>
              Ce compte n’a pas de demande marque en attente compatible avec la création autonome d’un espace.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Entreprise, marque et plan</CardTitle>
              <CardDescription>Ces informations créent votre tenant brouillon et votre accès administrateur initial.</CardDescription>
            </CardHeader>
            <CardContent>
              <AutonomousOnboardingStartForm plans={plans ?? []} defaultCompanyName={defaultCompanyName} />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const brandId = onboarding.brand_id;
  const [brandResult, organizationResult, settingsResult, templatesResult, checklistResult, jobsResult] = await Promise.all([
    supabase
      .from("brands")
      .select("id,name,slug,code,status,organization_id,country_code,currency_code,commercial_email,order_email,phone,address_line_1,postal_code,city,short_description")
      .eq("id", brandId)
      .single(),
    supabase
      .from("organizations")
      .select("legal_name,trade_name,status")
      .eq("id", onboarding.organization_id)
      .single(),
    supabase.from("brand_settings").select("*").eq("brand_id", brandId).single(),
    supabase
      .from("import_templates")
      .select("import_type,documentation")
      .eq("is_active", true)
      .in("import_type", ["users", "territories", "pharmacies", "products"])
      .order("import_type"),
    supabase.rpc("get_brand_activation_checklist", { target_brand_id: brandId }),
    supabase
      .from("import_batches")
      .select("id,file_name,entity_type,valid_rows,warning_rows,error_rows,lifecycle_status")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const brand = brandResult.data;
  const organization = organizationResult.data;
  const settings = settingsResult.data;
  if (!brand || !organization || !settings) {
    throw new Error("La configuration de l’espace autonome est incomplète.");
  }

  const templates = (templatesResult.data ?? []) as Array<{ import_type: ImportType; documentation: string }>;
  const checklist = (checklistResult.data ?? []) as ChecklistItem[];
  const jobs = (jobsResult.data ?? []) as ImportJob[];
  const blockingCount = checklist.filter((item) => item.blocking && !item.completed).length;
  const completedChecks = checklist.filter((item) => item.completed).length;
  const progress = checklist.length ? Math.round((completedChecks / checklist.length) * 100) : 0;
  const stepStatuses = onboarding.step_statuses ?? {};

  const orderedSteps = ["organization", "brand", "users", "territories", "pharmacies", "products", "settings", "verification", "activation"];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Onboarding autonome · {onboarding.selected_plan_key}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Configurer {brand.name}</h1>
        <p className="max-w-3xl text-muted-foreground">
          {organization.legal_name} · l’espace reste en brouillon jusqu’à l’activation finale.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Progression</CardTitle>
              <CardDescription>Étape actuelle : {stepLabels[onboarding.current_step] ?? onboarding.current_step}</CardDescription>
            </div>
            <Badge variant={blockingCount ? "secondary" : "default"}>{progress}% prêt</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {orderedSteps.map((step) => (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2" key={step}>
                <span className="text-sm font-medium">{stepLabels[step]}</span>
                <StepBadge status={stepStatuses[step]} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>1. Équipe</CardTitle>
              <CardDescription>Invitez vos administrateurs, commerciaux et intervenants. Cette étape peut être complétée plus tard.</CardDescription>
            </div>
            <StepBadge status={stepStatuses.users} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <AutonomousTeamInviteForm brandId={brandId} />
          <div className="border-t pt-6">
            <p className="mb-4 text-sm font-medium">Ou importer plusieurs utilisateurs</p>
            <OnboardingImportPanel
              brandId={brandId}
              templates={templates}
              stageAction={stageAutonomousOnboardingImportAction}
              allowedTypes={["users"]}
              initialType="users"
              idPrefix="autonomous-users"
            />
          </div>
          <form action={markAutonomousStepAction} className="flex justify-end">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="step" value="users" />
            <input type="hidden" name="status" value="skipped" />
            <Button variant="outline">Continuer sans ajouter d’autre membre</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>2. Territoires</CardTitle>
              <CardDescription>Structurez les secteurs commerciaux si votre organisation en utilise.</CardDescription>
            </div>
            <StepBadge status={stepStatuses.territories} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <OnboardingImportPanel
            brandId={brandId}
            templates={templates}
            stageAction={stageAutonomousOnboardingImportAction}
            allowedTypes={["territories"]}
            initialType="territories"
            idPrefix="autonomous-territories"
          />
          <form action={markAutonomousStepAction} className="flex justify-end">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="step" value="territories" />
            <input type="hidden" name="status" value="skipped" />
            <Button variant="outline">Je n’utilise pas de territoires</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>3. Pharmacies</CardTitle>
              <CardDescription>Importez au moins une pharmacie pour préparer l’activation de l’espace.</CardDescription>
            </div>
            <StepBadge status={stepStatuses.pharmacies} />
          </div>
        </CardHeader>
        <CardContent>
          <OnboardingImportPanel
            brandId={brandId}
            templates={templates}
            stageAction={stageAutonomousOnboardingImportAction}
            allowedTypes={["pharmacies"]}
            initialType="pharmacies"
            idPrefix="autonomous-pharmacies"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>4. Produits</CardTitle>
              <CardDescription>Importez le catalogue initial de la marque. Au moins un produit actif est requis.</CardDescription>
            </div>
            <StepBadge status={stepStatuses.products} />
          </div>
        </CardHeader>
        <CardContent>
          <OnboardingImportPanel
            brandId={brandId}
            templates={templates}
            stageAction={stageAutonomousOnboardingImportAction}
            allowedTypes={["products"]}
            initialType="products"
            idPrefix="autonomous-products"
          />
        </CardContent>
      </Card>

      {jobs.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Imports préparés</CardTitle>
            <CardDescription>Une prévisualisation ne modifie pas les données. Exécutez explicitement chaque lot prêt.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead>Contrôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.file_name}</TableCell>
                    <TableCell>{importLabels[job.entity_type] ?? job.entity_type}</TableCell>
                    <TableCell>{job.valid_rows} valides · {job.warning_rows} avert. · {job.error_rows} erreurs</TableCell>
                    <TableCell><Badge variant={job.lifecycle_status === "failed" ? "destructive" : "secondary"}>{job.lifecycle_status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {job.lifecycle_status === "ready" ? (
                        <form action={executeAutonomousOnboardingImportAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button size="sm">Exécuter</Button>
                        </form>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>5. Configuration commerciale</CardTitle>
              <CardDescription>Ces paramètres alimentent les règles déterministes de suivi commercial de TR1.</CardDescription>
            </div>
            <StepBadge status={stepStatuses.settings} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={updateAutonomousSettingsAction} className="grid gap-4 md:grid-cols-3">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="space-y-2"><Label htmlFor="setup-brand-name">Nom de marque</Label><Input id="setup-brand-name" name="brandName" defaultValue={brand.name} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-brand-code">Code marque</Label><Input id="setup-brand-code" name="brandCode" defaultValue={brand.code ?? ""} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-brand-slug">Slug</Label><Input id="setup-brand-slug" name="brandSlug" defaultValue={brand.slug} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-country">Pays</Label><Input id="setup-country" name="countryCode" defaultValue={brand.country_code ?? "FR"} maxLength={2} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-currency">Devise</Label><Input id="setup-currency" name="currencyCode" defaultValue={brand.currency_code ?? settings.currency_code ?? "EUR"} maxLength={3} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-timezone">Fuseau horaire</Label><Input id="setup-timezone" name="timezone" defaultValue={settings.timezone ?? "Europe/Paris"} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-commercial-email">Email commercial</Label><Input id="setup-commercial-email" name="commercialEmail" type="email" defaultValue={brand.commercial_email ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="setup-order-email">Email commandes</Label><Input id="setup-order-email" name="orderEmail" type="email" defaultValue={brand.order_email ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="setup-phone">Téléphone</Label><Input id="setup-phone" name="phone" defaultValue={brand.phone ?? ""} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="setup-address">Adresse</Label><Input id="setup-address" name="addressLine1" defaultValue={brand.address_line_1 ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="setup-postal-code">Code postal</Label><Input id="setup-postal-code" name="postalCode" defaultValue={brand.postal_code ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="setup-city">Ville</Label><Input id="setup-city" name="city" defaultValue={brand.city ?? ""} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="setup-description">Description courte</Label><Input id="setup-description" name="description" defaultValue={brand.short_description ?? ""} maxLength={300} /></div>
            <div className="space-y-2"><Label htmlFor="setup-reorder">Intervalle de réassort</Label><Input id="setup-reorder" name="defaultReorderIntervalDays" type="number" defaultValue={settings.default_reorder_interval_days ?? 60} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-first-reorder">Premier réassort cible</Label><Input id="setup-first-reorder" name="firstReorderTargetDays" type="number" defaultValue={settings.first_reorder_target_days ?? 45} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-due-soon">Préavis réassort</Label><Input id="setup-due-soon" name="reorderDueSoonDays" type="number" defaultValue={settings.reorder_due_soon_days ?? 10} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-risk">Multiplicateur à risque</Label><Input id="setup-risk" name="atRiskMultiplier" type="number" step="0.1" defaultValue={settings.at_risk_multiplier ?? 1.5} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-dormant">Multiplicateur dormant</Label><Input id="setup-dormant" name="dormantMultiplier" type="number" step="0.1" defaultValue={settings.dormant_multiplier ?? 2.5} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-eligibility">Éligibilité réassort</Label><Input id="setup-eligibility" name="reorderEligibilityDays" type="number" defaultValue={settings.reorder_eligibility_days ?? 21} required /></div>
            <div className="space-y-2"><Label htmlFor="setup-followup">Suivi post-mission</Label><Input id="setup-followup" name="postMissionFollowupDays" type="number" defaultValue={settings.post_mission_followup_days ?? 7} required /></div>
            <Button className="md:col-span-3">Enregistrer la configuration</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Vérification et activation</CardTitle>
          <CardDescription>TR1 n’active l’espace que lorsque les prérequis bloquants sont réellement présents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            {checklist.map((item) => (
              <div className="flex items-start gap-3 rounded-lg border p-3" key={item.check_key}>
                <ChecklistIcon completed={item.completed} blocking={item.blocking} />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.completed ? "Validé" : item.blocking ? "Requis avant activation" : "Optionnel"}</p>
                </div>
              </div>
            ))}
          </div>

          <Alert variant={blockingCount ? "destructive" : "default"}>
            <AlertTitle>{blockingCount ? `${blockingCount} prérequis restent à compléter` : "Votre espace est prêt"}</AlertTitle>
            <AlertDescription>
              {blockingCount
                ? "Complétez les éléments signalés avant d’activer la marque."
                : "L’activation ouvre le tenant et rend la marque accessible depuis le sélecteur TR1."}
            </AlertDescription>
          </Alert>

          <form action={activateAutonomousOnboardingAction} className="flex justify-end">
            <input type="hidden" name="brandId" value={brandId} />
            <Button disabled={blockingCount > 0}><Rocket className="size-4" />Activer mon espace</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

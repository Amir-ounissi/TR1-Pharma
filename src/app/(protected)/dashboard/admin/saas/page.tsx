import Link from "next/link";
import {
  clearCapabilityOverrideAction,
  setBrandPlanAction,
  setCapabilityOverrideAction,
  updateBrandTerminologyAction,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth";
import { resolveBrandTerminology } from "@/lib/saas/capabilities";

type CapabilityRow = {
  key: string;
  label: string;
  description: string;
  category: string;
};

type EffectiveCapability = {
  capability_key: string;
  enabled: boolean;
  source: "override" | "plan" | "legacy_full" | "none";
};

type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  is_public: boolean;
};

type EntitlementRow = {
  brand_id: string;
  status: "trialing" | "active" | "suspended";
  seat_limit: number | null;
  starts_at: string;
  ends_at: string | null;
  saas_plans: PlanRow | PlanRow[] | null;
};

type OverrideRow = {
  capability_key: string;
  enabled: boolean;
  reason: string | null;
  expires_at: string | null;
};

function relatedPlan(value: EntitlementRow["saas_plans"]) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function sourceLabel(source: EffectiveCapability["source"]) {
  if (source === "override") return "Override";
  if (source === "legacy_full") return "Compatibilité";
  if (source === "plan") return "Plan";
  return "Non inclus";
}

function statusLabel(status: EntitlementRow["status"] | undefined) {
  if (status === "trialing") return "Essai";
  if (status === "suspended") return "Suspendu";
  return "Actif";
}

export default async function SaasAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { supabase } = await requirePlatformAdmin();
  const params = await searchParams;
  const [
    { data: brands, error: brandsError },
    { data: plans, error: plansError },
    { data: capabilities, error: capabilitiesError },
    { data: entitlements, error: entitlementError },
  ] = await Promise.all([
    supabase.from("brands").select("id,name,slug,status,is_active,organization_id").order("name"),
    supabase.from("saas_plans").select("id,key,name,description,is_public").eq("is_active", true).order("sort_order"),
    supabase.from("saas_capabilities").select("key,label,description,category").eq("is_active", true).order("category").order("key"),
    supabase.from("brand_saas_entitlements").select("brand_id,status,seat_limit,starts_at,ends_at,saas_plans(id,key,name,description,is_public)"),
  ]);

  if (brandsError || plansError || capabilitiesError || entitlementError) {
    throw new Error("Impossible de charger la configuration SaaS.");
  }

  const selectedBrand =
    (brands ?? []).find((brand) => brand.id === params.brand) ?? (brands ?? [])[0] ?? null;
  const selectedEntitlement = (entitlements ?? []).find(
    (item) => item.brand_id === selectedBrand?.id,
  ) as EntitlementRow | undefined;
  const selectedPlan = relatedPlan(selectedEntitlement?.saas_plans ?? null);

  const [effectiveResult, overridesResult, settingsResult] = selectedBrand
    ? await Promise.all([
        supabase.rpc("get_my_brand_capabilities", { target_brand_id: selectedBrand.id }),
        supabase
          .from("brand_capability_overrides")
          .select("capability_key,enabled,reason,expires_at")
          .eq("brand_id", selectedBrand.id),
        supabase
          .from("brand_saas_settings")
          .select("terminology,configuration,updated_at")
          .eq("brand_id", selectedBrand.id)
          .maybeSingle(),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null },
      ];

  if (effectiveResult.error || overridesResult.error || settingsResult.error) {
    throw new Error("Impossible de charger les capacités de la marque.");
  }

  const effectiveByKey = new Map(
    ((effectiveResult.data ?? []) as EffectiveCapability[]).map((item) => [item.capability_key, item]),
  );
  const overridesByKey = new Map(
    ((overridesResult.data ?? []) as OverrideRow[]).map((item) => [item.capability_key, item]),
  );
  const terminology = resolveBrandTerminology(settingsResult.data?.terminology);
  const publicPlans = ((plans ?? []) as PlanRow[]).filter((plan) => plan.is_public);
  const allPlans = (plans ?? []) as PlanRow[];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Plateforme TR1</p>
        <h1 className="text-2xl font-semibold tracking-tight">SaaS & capacités</h1>
        <p className="text-muted-foreground">
          Plans, modules et vocabulaire sont configurés par marque sans règle spécifique dans le code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marques</CardTitle>
          <CardDescription>Sélectionnez un tenant à administrer.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(brands ?? []).map((brand) => (
            <Button
              asChild
              key={brand.id}
              variant={selectedBrand?.id === brand.id ? "default" : "outline"}
            >
              <Link href={`/dashboard/admin/saas?brand=${brand.id}`}>{brand.name}</Link>
            </Button>
          ))}
          {!brands?.length ? <p className="text-sm text-muted-foreground">Aucune marque.</p> : null}
        </CardContent>
      </Card>

      {selectedBrand ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Abonnement de {selectedBrand.name}</CardTitle>
                    <CardDescription>
                      Le billing est volontairement hors de ce lot. Ici, TR1 contrôle uniquement les droits produit.
                    </CardDescription>
                  </div>
                  <Badge variant={selectedEntitlement?.status === "suspended" ? "destructive" : "outline"}>
                    {statusLabel(selectedEntitlement?.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan actuel</p>
                  <p className="mt-1 text-xl font-semibold">{selectedPlan?.name ?? "Non configuré"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedPlan?.key === "legacy_full"
                      ? "Compatibilité intégrale : aucune fonction existante n’est retirée."
                      : selectedPlan?.description ?? "Aucun entitlement actif."}
                  </p>
                </div>

                <form action={setBrandPlanAction} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="brandId" value={selectedBrand.id} />
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="planKey">Plan</Label>
                    <select
                      id="planKey"
                      name="planKey"
                      defaultValue={selectedPlan?.key ?? "core"}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {allPlans.map((plan) => (
                        <option key={plan.id} value={plan.key}>
                          {plan.name}{plan.is_public ? "" : " — interne"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entitlementStatus">État</Label>
                    <select
                      id="entitlementStatus"
                      name="status"
                      defaultValue={selectedEntitlement?.status ?? "active"}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="trialing">Essai</option>
                      <option value="active">Actif</option>
                      <option value="suspended">Suspendu</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seatLimit">Limite de sièges</Label>
                    <Input
                      id="seatLimit"
                      name="seatLimit"
                      type="number"
                      min="1"
                      max="100000"
                      placeholder="Illimité"
                      defaultValue={selectedEntitlement?.seat_limit ?? ""}
                    />
                  </div>
                  <Button className="sm:col-span-2">Enregistrer le plan</Button>
                </form>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Plans commercialisables</p>
                  <div className="flex flex-wrap gap-2">
                    {publicPlans.map((plan) => (
                      <Badge key={plan.id} variant="secondary">{plan.name}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vocabulaire marque</CardTitle>
                <CardDescription>
                  TR1 conserve son modèle canonique ; seule la présentation utilisateur change.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateBrandTerminologyAction} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="brandId" value={selectedBrand.id} />
                  {[
                    ["fieldRepSingular", "Commercial — singulier", terminology.field_rep_singular],
                    ["fieldRepPlural", "Commercial — pluriel", terminology.field_rep_plural],
                    ["managerSingular", "Manager — singulier", terminology.manager_singular],
                    ["managerPlural", "Manager — pluriel", terminology.manager_plural],
                    ["pharmacySingular", "Pharmacie — singulier", terminology.pharmacy_singular],
                    ["pharmacyPlural", "Pharmacie — pluriel", terminology.pharmacy_plural],
                    ["customerSingular", "Client — singulier", terminology.customer_singular],
                    ["customerPlural", "Client — pluriel", terminology.customer_plural],
                    ["initialOrder", "Première commande", terminology.initial_order],
                    ["reorder", "Commande suivante", terminology.reorder],
                    ["missionSingular", "Mission — singulier", terminology.mission_singular],
                    ["missionPlural", "Mission — pluriel", terminology.mission_plural],
                  ].map(([name, label, value]) => (
                    <div className="space-y-2" key={name}>
                      <Label htmlFor={name}>{label}</Label>
                      <Input id={name} name={name} defaultValue={value} maxLength={80} required />
                    </div>
                  ))}
                  <Button className="sm:col-span-2">Enregistrer le vocabulaire</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Matrice des capacités</CardTitle>
              <CardDescription>
                Un override actif est prioritaire sur le plan. Un abonnement suspendu désactive toutes les capacités.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>État effectif</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="min-w-[360px]">Override plateforme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((capabilities ?? []) as CapabilityRow[]).map((capability) => {
                    const effective = effectiveByKey.get(capability.key);
                    const override = overridesByKey.get(capability.key);
                    return (
                      <TableRow key={capability.key}>
                        <TableCell>
                          <p className="font-medium">{capability.label}</p>
                          <p className="max-w-md text-xs text-muted-foreground">{capability.description}</p>
                          <code className="mt-1 block text-[11px] text-muted-foreground">{capability.key}</code>
                        </TableCell>
                        <TableCell><Badge variant="outline">{capability.category}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={effective?.enabled ? "default" : "secondary"}>
                            {effective?.enabled ? "Activée" : "Désactivée"}
                          </Badge>
                        </TableCell>
                        <TableCell>{sourceLabel(effective?.source ?? "none")}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <form action={setCapabilityOverrideAction} className="grid gap-2 sm:grid-cols-[110px_1fr_auto]">
                              <input type="hidden" name="brandId" value={selectedBrand.id} />
                              <input type="hidden" name="capabilityKey" value={capability.key} />
                              <select
                                name="enabled"
                                defaultValue={override?.enabled === false ? "false" : "true"}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                aria-label={`Override ${capability.label}`}
                              >
                                <option value="true">Forcer ON</option>
                                <option value="false">Forcer OFF</option>
                              </select>
                              <Input
                                name="reason"
                                defaultValue={override?.reason ?? ""}
                                maxLength={500}
                                placeholder="Motif de l’exception"
                                className="h-9"
                              />
                              <Button size="sm" variant="outline">Appliquer</Button>
                            </form>
                            {override ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>
                                  Override {override.enabled ? "ON" : "OFF"}
                                  {override.expires_at
                                    ? ` · expire ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(override.expires_at))}`
                                    : " · sans expiration"}
                                </span>
                                <form action={clearCapabilityOverrideAction}>
                                  <input type="hidden" name="brandId" value={selectedBrand.id} />
                                  <input type="hidden" name="capabilityKey" value={capability.key} />
                                  <Button size="sm" variant="ghost">Revenir au plan</Button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

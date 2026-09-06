import Link from "next/link";
import {
  clearBrandQuotaOverrideAction,
  setBillingAccountAction,
  setBrandQuotaOverrideAction,
  setPlanQuotaAction,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatSaasLimit } from "@/lib/saas/commercial";

type PlanRow = {
  id: string;
  key: string;
  name: string;
  is_public: boolean;
};

type QuotaDefinitionRow = {
  key: string;
  label: string;
  description: string;
  unit: string;
  capability_key: string | null;
};

type PlanQuotaRow = {
  plan_id: string;
  quota_key: string;
  limit_value: number | null;
};

type BrandQuotaOverrideRow = {
  quota_key: string;
  limit_value: number | null;
  reason: string | null;
  expires_at: string | null;
};

type BillingRow = {
  billing_mode: "manual" | "external";
  provider_key: string | null;
  external_customer_ref: string | null;
  external_subscription_ref: string | null;
  billing_email: string | null;
};

type SubscriptionRow = {
  plan_key: string;
  plan_name: string;
  entitlement_status: string;
  seat_limit: number | null;
  seats_used: number;
  seats_remaining: number | null;
  billing_mode: string;
  billing_ready: boolean;
};

type UsageRow = {
  quota_key: string;
  limit_value: number | null;
  used_value: number;
  source: string;
};

function unitLabel(unit: string) {
  if (unit === "rows") return "lignes";
  if (unit === "documents") return "documents";
  if (unit === "runs") return "exécutions";
  if (unit === "requests") return "requêtes";
  return unit;
}

export default async function SaasCommercialAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { supabase } = await requirePlatformAdmin();
  const params = await searchParams;
  const [brandsResult, plansResult, definitionsResult, planQuotasResult] = await Promise.all([
    supabase.from("brands").select("id,name,slug").eq("is_active", true).order("name"),
    supabase.from("saas_plans").select("id,key,name,is_public").eq("is_active", true).order("sort_order"),
    supabase.from("saas_quota_definitions").select("key,label,description,unit,capability_key").eq("is_active", true).order("key"),
    supabase.from("saas_plan_quotas").select("plan_id,quota_key,limit_value"),
  ]);

  if (brandsResult.error || plansResult.error || definitionsResult.error || planQuotasResult.error) {
    throw new Error("Impossible de charger la gouvernance SaaS commerciale.");
  }

  const brands = brandsResult.data ?? [];
  const plans = (plansResult.data ?? []) as PlanRow[];
  const definitions = (definitionsResult.data ?? []) as QuotaDefinitionRow[];
  const planQuotas = (planQuotasResult.data ?? []) as PlanQuotaRow[];
  const selectedBrand = brands.find((brand) => brand.id === params.brand) ?? brands[0] ?? null;

  const [overrideResult, billingResult, subscriptionResult, usageResult] = selectedBrand
    ? await Promise.all([
        supabase
          .from("brand_saas_quota_overrides")
          .select("quota_key,limit_value,reason,expires_at")
          .eq("brand_id", selectedBrand.id),
        supabase
          .from("brand_billing_accounts")
          .select("billing_mode,provider_key,external_customer_ref,external_subscription_ref,billing_email")
          .eq("brand_id", selectedBrand.id)
          .maybeSingle(),
        supabase.rpc("get_brand_saas_subscription", { target_brand_id: selectedBrand.id }),
        supabase.rpc("get_brand_saas_usage", { target_brand_id: selectedBrand.id }),
      ])
    : [
        { data: [], error: null },
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (overrideResult.error || billingResult.error || subscriptionResult.error || usageResult.error) {
    throw new Error("Impossible de charger la configuration commerciale du tenant.");
  }

  const overrides = (overrideResult.data ?? []) as BrandQuotaOverrideRow[];
  const overridesByKey = new Map(overrides.map((row) => [row.quota_key, row]));
  const billing = billingResult.data as BillingRow | null;
  const subscription = ((subscriptionResult.data ?? []) as SubscriptionRow[])[0] ?? null;
  const usageByKey = new Map(((usageResult.data ?? []) as UsageRow[]).map((row) => [row.quota_key, row]));
  const planQuotaByKey = new Map(planQuotas.map((row) => [`${row.plan_id}:${row.quota_key}`, row.limit_value]));

  return (
    <main className="space-y-6" data-testid="saas-commercial-admin">
      <PageHeader
        eyebrow="Plateforme TR1"
        title="Quotas & billing"
        description="Les droits fonctionnels restent dans SaaS & capacités. Ici, la plateforme gouverne séparément les limites, la consommation, les sièges et la préparation de facturation."
        tone="dark"
      />

      <Card>
        <CardHeader>
          <CardTitle>Quotas par plan</CardTitle>
          <CardDescription>
            Une valeur vide signifie illimité. Les seuils commerciaux peuvent évoluer sans modifier le code ni les capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Module lié</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.flatMap((plan) =>
                definitions.map((quota) => {
                  const limitValue = planQuotaByKey.get(`${plan.id}:${quota.key}`) ?? null;
                  return (
                    <TableRow key={`${plan.id}:${quota.key}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{plan.name}</span>
                          {!plan.is_public ? <Badge variant="outline">interne</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{quota.label}</p>
                        <p className="text-xs text-muted-foreground">{quota.description}</p>
                      </TableCell>
                      <TableCell><code className="text-xs">{quota.capability_key ?? "—"}</code></TableCell>
                      <TableCell>{formatSaasLimit(limitValue, unitLabel(quota.unit))}</TableCell>
                      <TableCell>
                        <form action={setPlanQuotaAction} className="ml-auto flex max-w-sm items-center justify-end gap-2" data-testid="plan-quota-form">
                          <input type="hidden" name="planKey" value={plan.key} />
                          <input type="hidden" name="quotaKey" value={quota.key} />
                          <Input
                            aria-label={`Limite ${plan.name} ${quota.label}`}
                            className="h-9 w-36"
                            defaultValue={limitValue ?? ""}
                            min="1"
                            name="limitValue"
                            placeholder="Illimité"
                            type="number"
                          />
                          <Button size="sm" variant="outline">Enregistrer</Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                }),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
          <CardDescription>Sélectionnez une marque pour piloter ses exceptions et son mode de facturation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <Button asChild key={brand.id} variant={selectedBrand?.id === brand.id ? "default" : "outline"}>
              <Link href={`/dashboard/admin/saas-commercial?brand=${brand.id}`}>{brand.name}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {selectedBrand && subscription ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Plan effectif</CardDescription>
                <CardTitle>{subscription.plan_name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {subscription.entitlement_status} · clé {subscription.plan_key}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Sièges</CardDescription>
                <CardTitle>{subscription.seats_used} / {formatSaasLimit(subscription.seat_limit)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {subscription.seats_remaining == null ? "Illimité" : `${subscription.seats_remaining} disponible(s)`}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Billing readiness</CardDescription>
                <CardTitle>{subscription.billing_ready ? "Prêt" : "À configurer"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Mode : {subscription.billing_mode}
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Exceptions de quota · {selectedBrand.name}</CardTitle>
                <CardDescription>
                  Une exception tenant remplace la valeur du plan. Une valeur vide force explicitement l’illimité.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {definitions.map((quota) => {
                  const override = overridesByKey.get(quota.key);
                  const effective = usageByKey.get(quota.key);
                  return (
                    <div className="rounded-xl border p-4" key={quota.key}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{quota.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Effectif : {effective ? formatSaasLimit(effective.limit_value, unitLabel(quota.unit)) : "module inactif"}
                            {effective ? ` · source ${effective.source}` : ""}
                          </p>
                        </div>
                        {override ? <Badge>Override</Badge> : <Badge variant="outline">Plan</Badge>}
                      </div>
                      <form action={setBrandQuotaOverrideAction} className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_170px_auto]">
                        <input type="hidden" name="brandId" value={selectedBrand.id} />
                        <input type="hidden" name="quotaKey" value={quota.key} />
                        <Input
                          aria-label={`Override ${quota.label}`}
                          defaultValue={override?.limit_value ?? ""}
                          min="1"
                          name="limitValue"
                          placeholder="Illimité"
                          type="number"
                        />
                        <Input defaultValue={override?.reason ?? ""} maxLength={500} name="reason" placeholder="Motif de l’exception" />
                        <Input
                          aria-label={`Expiration ${quota.label}`}
                          defaultValue={override?.expires_at?.slice(0, 10) ?? ""}
                          name="expiresAt"
                          type="date"
                        />
                        <Button variant="outline">Appliquer</Button>
                      </form>
                      {override ? (
                        <form action={clearBrandQuotaOverrideAction} className="mt-2">
                          <input type="hidden" name="brandId" value={selectedBrand.id} />
                          <input type="hidden" name="quotaKey" value={quota.key} />
                          <Button size="sm" variant="ghost">Revenir au plan</Button>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Facturation · {selectedBrand.name}</CardTitle>
                <CardDescription>
                  Aucun fournisseur n’est imposé : mode manuel ou références d’un prestataire externe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={setBillingAccountAction} className="space-y-4" data-testid="billing-readiness-form">
                  <input type="hidden" name="brandId" value={selectedBrand.id} />
                  <div className="space-y-2">
                    <Label htmlFor="billingMode">Mode</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      defaultValue={billing?.billing_mode ?? "manual"}
                      id="billingMode"
                      name="billingMode"
                    >
                      <option value="manual">Manuel</option>
                      <option value="external">Prestataire externe</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingEmail">E-mail de facturation</Label>
                    <Input defaultValue={billing?.billing_email ?? ""} id="billingEmail" name="billingEmail" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="providerKey">Clé prestataire</Label>
                    <Input defaultValue={billing?.provider_key ?? ""} id="providerKey" name="providerKey" placeholder="ex. provider_x" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalCustomerRef">Référence client externe</Label>
                    <Input defaultValue={billing?.external_customer_ref ?? ""} id="externalCustomerRef" name="externalCustomerRef" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="externalSubscriptionRef">Référence abonnement externe</Label>
                    <Input defaultValue={billing?.external_subscription_ref ?? ""} id="externalSubscriptionRef" name="externalSubscriptionRef" />
                  </div>
                  <Button>Enregistrer le billing</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </main>
  );
}

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { requireActiveBrandRole } from "@/lib/auth";
import {
  formatSaasLimit,
  resolveSaasUsageProgress,
  saasUsageStateLabel,
} from "@/lib/saas/commercial";

 type SubscriptionRow = {
  plan_key: string;
  plan_name: string;
  entitlement_status: "trialing" | "active" | "suspended";
  starts_at: string;
  ends_at: string | null;
  seat_limit: number | null;
  seats_used: number;
  seats_remaining: number | null;
  billing_mode: "manual" | "external" | "unconfigured";
  billing_ready: boolean;
};

type UsageRow = {
  quota_key: string;
  label: string;
  unit: string;
  period: string;
  period_start: string;
  period_end: string;
  limit_value: number | null;
  used_value: number;
  remaining_value: number | null;
  exceeded: boolean;
  source: "plan" | "override" | "legacy_full" | "none";
};

function entitlementStatusLabel(status: SubscriptionRow["entitlement_status"]) {
  if (status === "trialing") return "Essai";
  if (status === "suspended") return "Suspendu";
  return "Actif";
}

function billingLabel(subscription: SubscriptionRow) {
  if (!subscription.billing_ready) return "À configurer";
  if (subscription.billing_mode === "external") return "Facturation externe prête";
  return "Facturation manuelle prête";
}

function quotaSourceLabel(source: UsageRow["source"]) {
  if (source === "override") return "Exception tenant";
  if (source === "legacy_full") return "Compatibilité historique";
  if (source === "plan") return "Plan";
  return "Non gouverné";
}

function unitLabel(unit: string) {
  if (unit === "rows") return "lignes";
  if (unit === "documents") return "documents";
  if (unit === "runs") return "exécutions";
  if (unit === "requests") return "requêtes";
  return unit;
}

export default async function SubscriptionPage() {
  const { supabase, brand } = await requireActiveBrandRole(
    ["brand_admin", "tr1_manager", "super_admin"] as const,
  );

  const [subscriptionResult, usageResult] = await Promise.all([
    supabase.rpc("get_brand_saas_subscription", { target_brand_id: brand.id }),
    supabase.rpc("get_brand_saas_usage", { target_brand_id: brand.id }),
  ]);

  if (subscriptionResult.error || usageResult.error) {
    throw new Error("Impossible de charger l’abonnement SaaS de la marque.");
  }

  const subscription = ((subscriptionResult.data ?? []) as SubscriptionRow[])[0] ?? null;
  const usage = (usageResult.data ?? []) as UsageRow[];
  if (!subscription) throw new Error("Aucun abonnement SaaS n’est configuré pour cette marque.");

  const seatProgress = resolveSaasUsageProgress(subscription.seats_used, subscription.seat_limit);

  return (
    <main className="space-y-6" data-testid="saas-subscription-overview">
      <PageHeader
        eyebrow={`SaaS · ${brand.name}`}
        title="Abonnement & usage"
        description="Votre plan, vos sièges et vos consommations sont séparés des droits fonctionnels pour garder une gouvernance claire et prévisible."
        tone="dark"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Plan actuel</CardDescription>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{subscription.plan_name}</CardTitle>
              <Badge variant={subscription.entitlement_status === "suspended" ? "destructive" : "outline"}>
                {entitlementStatusLabel(subscription.entitlement_status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {subscription.plan_key === "legacy_full"
                ? "Compatibilité intégrale des marques historiques."
                : "Les modules disponibles sont déterminés par votre plan et ses éventuelles exceptions."}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="saas-seat-usage">
          <CardHeader className="pb-3">
            <CardDescription>Sièges</CardDescription>
            <CardTitle>
              {new Intl.NumberFormat("fr-FR").format(subscription.seats_used)} / {formatSaasLimit(subscription.seat_limit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-[width]"
                style={{ width: `${seatProgress.percent ?? 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{saasUsageStateLabel(seatProgress.state)}</span>
              <span>
                {subscription.seats_remaining == null
                  ? "Aucune limite configurée"
                  : `${subscription.seats_remaining} siège(s) disponible(s)`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Facturation</CardDescription>
            <CardTitle>{billingLabel(subscription)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {subscription.billing_mode === "external"
                ? "TR1 est prêt à être relié à un prestataire de facturation sans modifier vos droits produit."
                : "La facturation reste découplée du produit et peut être gérée manuellement."}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Usage & quotas</CardTitle>
          <CardDescription>
            Seules les consommations liées aux modules actifs de votre marque sont affichées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {usage.map((row) => {
                const progress = resolveSaasUsageProgress(row.used_value, row.limit_value);
                return (
                  <article className="rounded-xl border p-4" data-testid="saas-quota-card" key={row.quota_key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{row.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{quotaSourceLabel(row.source)} · période mensuelle</p>
                      </div>
                      <Badge variant={progress.state === "exceeded" ? "destructive" : "secondary"}>
                        {saasUsageStateLabel(progress.state)}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold tabular-nums">
                        {new Intl.NumberFormat("fr-FR").format(row.used_value)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        sur {formatSaasLimit(row.limit_value, unitLabel(row.unit))}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground transition-[width]"
                        style={{ width: `${progress.percent ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.remaining_value == null
                        ? "Consommation non plafonnée actuellement."
                        : `${new Intl.NumberFormat("fr-FR").format(row.remaining_value)} ${unitLabel(row.unit)} restant(e)s sur la période.`}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucun quota de consommation ne s’applique aux modules actifs de ce plan.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

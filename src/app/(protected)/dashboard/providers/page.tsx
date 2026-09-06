import { BriefcaseBusiness, CalendarClock, CircleDollarSign, PauseCircle, PlayCircle, Star, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { requireActiveBrandRole } from "@/lib/auth";
import {
  FIELD_PROVIDER_ACTIVITIES,
  FIELD_PROVIDER_TYPES,
  PROVIDER_CONTRACT_STATUSES,
  brandProviderStatusLabel,
  fieldProviderActivityLabel,
  fieldProviderTypeLabel,
  providerContractIsCurrent,
  providerContractStatusLabel,
  summarizeBrandProviderPortfolio,
  type BrandProviderPortfolioRow,
} from "@/lib/field-providers";
import { saveBrandProviderFormAction, setBrandProviderStatusFormAction } from "./actions";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function formatDate(value: string | null) {
  return value ? date.format(new Date(`${value}T12:00:00`)) : "—";
}

export default async function ProvidersPage() {
  const { supabase, brand } = await requireActiveBrandRole(["tr1_manager", "brand_admin", "super_admin"] as const);
  const { data, error } = await supabase.rpc("get_brand_field_provider_portfolio", { target_brand_id: brand.id });
  if (error) throw error;

  const providers = (data ?? []) as BrandProviderPortfolioRow[];
  const summary = summarizeBrandProviderPortfolio(providers);

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Réseau terrain · ${brand.name}`}
        title="Prestataires terrain"
        description="Pilotez plusieurs animateurs, formateurs, freelances ou agences par marque, avec contrat, tarifs, priorité et charge terrain explicites."
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Synthèse prestataires">
        <Metric label="Prestataires" value={summary.total} icon={UsersRound} />
        <Metric label="Actifs" value={summary.active} icon={BriefcaseBusiness} />
        <Metric label="Préférés" value={summary.preferred} icon={Star} />
        <Metric label="Missions à venir" value={summary.upcomingMissions} icon={CalendarClock} />
        <Metric label="Coût 90 jours" value={euro.format(summary.cost90d)} icon={CircleDollarSign} />
      </section>

      <Card className="border-[var(--tr1-navy)]/15">
        <CardHeader>
          <CardTitle>Un portefeuille par marque, un intervenant réutilisable</CardTitle>
          <CardDescription>
            Un même prestataire peut travailler pour plusieurs marques de son organisation, tandis que chaque marque conserve ses propres activités, tarifs, contrat et priorité.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un prestataire</CardTitle>
            <CardDescription>L’adresse e-mail rapproche automatiquement un intervenant déjà connu dans la même organisation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveBrandProviderFormAction} className="space-y-4" data-testid="provider-create-form">
              <Field label="Nom"><input className="w-full rounded-md border bg-background px-3 py-2" name="displayName" required minLength={2} maxLength={160} placeholder="Agence Sud Pharma" /></Field>
              <Field label="E-mail"><input className="w-full rounded-md border bg-background px-3 py-2" name="email" type="email" required placeholder="terrain@agence.test" /></Field>
              <Field label="Téléphone"><input className="w-full rounded-md border bg-background px-3 py-2" name="phone" type="tel" maxLength={40} /></Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select className="w-full rounded-md border bg-background px-3 py-2" name="providerType" defaultValue="agency">
                    {FIELD_PROVIDER_TYPES.map((type) => <option key={type} value={type}>{fieldProviderTypeLabel(type)}</option>)}
                  </select>
                </Field>
                <Field label="Contrat">
                  <select className="w-full rounded-md border bg-background px-3 py-2" name="contractStatus" defaultValue="pending">
                    {PROVIDER_CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{providerContractStatusLabel(status)}</option>)}
                  </select>
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Activités autorisées</legend>
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                  {FIELD_PROVIDER_ACTIVITIES.map((activity) => (
                    <label key={activity} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="activities" value={activity} defaultChecked={activity === "animation"} />
                      {fieldProviderActivityLabel(activity)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tarif journée HT"><input className="w-full rounded-md border bg-background px-3 py-2" name="dailyRateHt" type="number" min="0" step="0.01" placeholder="350" /></Field>
                <Field label="Tarif demi-journée HT"><input className="w-full rounded-md border bg-background px-3 py-2" name="halfDayRateHt" type="number" min="0" step="0.01" placeholder="220" /></Field>
              </div>
              <Field label="Frais de déplacement"><input className="w-full rounded-md border bg-background px-3 py-2" name="travelRateType" maxLength={120} placeholder="Forfait 45 € / mission" /></Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Début contrat"><input className="w-full rounded-md border bg-background px-3 py-2" name="validFrom" type="date" /></Field>
                <Field label="Fin contrat"><input className="w-full rounded-md border bg-background px-3 py-2" name="validUntil" type="date" /></Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Priorité"><input className="w-full rounded-md border bg-background px-3 py-2" name="priority" type="number" min="1" max="999" defaultValue="100" /></Field>
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" name="preferred" value="true" />Prestataire préféré</label>
              </div>

              <Field label="Notes"><textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2" name="notes" maxLength={4000} placeholder="Conditions, zones, spécialités…" /></Field>
              <Button type="submit" className="w-full">Ajouter au portefeuille</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portefeuille prestataires</CardTitle>
            <CardDescription>{providers.length ? `${providers.length} prestataire(s) rattaché(s) à ${brand.name}.` : "Aucun prestataire configuré pour cette marque."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.length ? providers.map((provider) => (
              <article key={provider.relation_id} className="rounded-xl border p-4" data-testid="provider-card">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{provider.display_name}</h3>
                      <Badge variant="secondary">{fieldProviderTypeLabel(provider.provider_type)}</Badge>
                      <Badge variant={provider.relation_status === "paused" ? "secondary" : "outline"}>{brandProviderStatusLabel(provider.relation_status)}</Badge>
                      {provider.preferred ? <Badge variant="outline">Préféré</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{provider.email}{provider.phone ? ` · ${provider.phone}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {provider.activities.map((activity) => <Badge key={activity} variant="outline">{fieldProviderActivityLabel(activity)}</Badge>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {provider.relation_status === "active" ? (
                      <StatusButton relationId={provider.relation_id} status="paused" label="Mettre en pause" icon={PauseCircle} />
                    ) : (
                      <StatusButton relationId={provider.relation_id} status="active" label="Réactiver" icon={PlayCircle} />
                    )}
                    <StatusButton relationId={provider.relation_id} status="archived" label="Retirer" variant="ghost" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniMetric label="Missions totales" value={provider.missions_total} />
                  <MiniMetric label="À venir" value={provider.upcoming_missions} />
                  <MiniMetric label="Terminées 90 j" value={provider.completed_90d} />
                  <MiniMetric label="Coût 90 j" value={euro.format(Number(provider.cost_90d || 0))} />
                </div>

                <div className="mt-4 grid gap-3 rounded-lg bg-muted/30 p-3 text-xs md:grid-cols-2">
                  <div><p className="font-semibold">Contrat</p><p className="mt-1 text-muted-foreground">{providerContractStatusLabel(provider.contract_status)} · {formatDate(provider.valid_from)} → {formatDate(provider.valid_until)}</p><p className="mt-1">{providerContractIsCurrent(provider) ? "Contrat actuellement valide" : "Contrat hors période active ou non activé"}</p></div>
                  <div><p className="font-semibold">Conditions marque</p><p className="mt-1 text-muted-foreground">Journée {provider.daily_rate_ht == null ? "—" : euro.format(provider.daily_rate_ht)} · ½ journée {provider.half_day_rate_ht == null ? "—" : euro.format(provider.half_day_rate_ht)}</p><p className="mt-1 text-muted-foreground">Priorité {provider.priority}{provider.travel_rate_type ? ` · ${provider.travel_rate_type}` : ""}</p></div>
                </div>
                {provider.notes ? <p className="mt-3 text-xs text-muted-foreground">{provider.notes}</p> : null}
              </article>
            )) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Ajoutez un premier prestataire pour constituer le réseau terrain de la marque.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-muted p-2"><Icon className="size-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div></CardContent></Card>;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border p-3"><p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function StatusButton({ relationId, status, label, variant = "outline", icon: Icon }: { relationId: string; status: "active" | "paused" | "archived"; label: string; variant?: "outline" | "ghost"; icon?: React.ComponentType<{ className?: string }> }) {
  return <form action={setBrandProviderStatusFormAction}><input type="hidden" name="relationId" value={relationId} /><input type="hidden" name="status" value={status} /><Button type="submit" size="sm" variant={variant}>{Icon ? <Icon className="mr-1.5 size-4" /> : null}{label}</Button></form>;
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ux/page-header";
import { requirePlatformAdmin } from "@/lib/auth";
import { createCommercialEngagementAction } from "./actions";

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  active: "Active",
  paused: "En pause",
  completed: "Terminée",
  cancelled: "Annulée",
};

export default async function CommercialServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requirePlatformAdmin();

  const [
    { data: engagements, error: engagementsError },
    { data: brands, error: brandsError },
    { data: organizations, error: organizationsError },
    { data: objectives, error: objectivesError },
  ] = await Promise.all([
    supabase
      .from("commercial_engagements")
      .select("id,provider_organization_id,client_organization_id,brand_id,name,scope_summary,territory_summary,status,start_date,end_date,created_at")
      .is("archived_at", null)
      .order("start_date", { ascending: false }),
    supabase
      .from("brands")
      .select("id,name,organization_id,managed_by_organization_id,status")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("organizations")
      .select("id,name,legal_name,trade_name,is_platform_owner")
      .order("name"),
    supabase
      .from("commercial_engagement_objectives")
      .select("commercial_engagement_id,metric_key,label,target_value,unit,is_primary")
      .order("is_primary", { ascending: false }),
  ]);

  if (engagementsError) throw engagementsError;
  if (brandsError) throw brandsError;
  if (organizationsError) throw organizationsError;
  if (objectivesError) throw objectivesError;

  const brandMap = new Map((brands ?? []).map((brand) => [brand.id, brand]));
  const organizationMap = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  const objectivesByEngagement = new Map<string, NonNullable<typeof objectives>>();
  for (const objective of objectives ?? []) {
    const list = objectivesByEngagement.get(objective.commercial_engagement_id) ?? [];
    list.push(objective);
    objectivesByEngagement.set(objective.commercial_engagement_id, list);
  }

  const activeEngagements = (engagements ?? []).filter((engagement) => engagement.status === "active");
  const activeBrands = new Set(activeEngagements.map((engagement) => engagement.brand_id)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TR1 Pharma · Du sell-in au sell-out"
        title="Prestations commerciales"
        description="Pilotez les mandats de développement commercial confiés à TR1 Pharma. Une prestation est la couche client au-dessus des visites, commandes, animations et autres actions terrain."
        tone="dark"
      />

      {params.created ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          La prestation commerciale a été créée.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Synthèse des prestations">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prestations actives</CardDescription>
            <CardTitle className="text-3xl">{activeEngagements.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Marques accompagnées</CardDescription>
            <CardTitle className="text-3xl">{activeBrands}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total des dossiers</CardDescription>
            <CardTitle className="text-3xl">{engagements?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle prestation</CardTitle>
          <CardDescription>
            Le client et l’organisation prestataire sont déduits automatiquement de la marque. L’exécution terrain existante reste inchangée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCommercialEngagementAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brandId">Marque cliente</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                id="brandId"
                name="brandId"
                required
              >
                <option value="">Sélectionner une marque</option>
                {(brands ?? []).map((brand) => {
                  const client = organizationMap.get(brand.organization_id);
                  return (
                    <option key={brand.id} value={brand.id}>
                      {brand.name} · {client?.trade_name || client?.legal_name || client?.name || "Client"}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom de la prestation</Label>
              <Input id="name" name="name" placeholder="VK Swiss — Développement PACA" required maxLength={180} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Début</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Fin prévue</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="territorySummary">Secteur</Label>
              <Input id="territorySummary" name="territorySummary" placeholder="PACA · 13 / 83 / 84" maxLength={500} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut initial</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" id="status" name="status" defaultValue="draft">
                <option value="draft">Brouillon</option>
                <option value="active">Active</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetRevenueHt">Objectif sell-in (€ HT)</Label>
              <Input id="targetRevenueHt" name="targetRevenueHt" inputMode="decimal" placeholder="25000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetImplantations">Objectif implantations</Label>
              <Input id="targetImplantations" name="targetImplantations" inputMode="numeric" placeholder="80" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="scopeSummary">Périmètre de la prestation</Label>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                id="scopeSummary"
                name="scopeSummary"
                placeholder="Prospection, implantation, suivi des pharmacies, formation et coordination des actions sell-out."
                maxLength={2000}
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">Créer la prestation</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="commercial-engagement-list">
        <div>
          <h2 className="text-xl font-semibold" id="commercial-engagement-list">Portefeuille de prestations</h2>
          <p className="text-sm text-muted-foreground">
            Cette vue devient progressivement le point d’entrée TR1 Pharma avant d’entrer dans le cockpit de chaque marque.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {(engagements ?? []).map((engagement) => {
            const brand = brandMap.get(engagement.brand_id);
            const client = organizationMap.get(engagement.client_organization_id);
            const provider = organizationMap.get(engagement.provider_organization_id);
            const engagementObjectives = objectivesByEngagement.get(engagement.id) ?? [];
            return (
              <Card key={engagement.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tr1-orange)]">
                        {brand?.name ?? "Marque"}
                      </p>
                      <CardTitle className="mt-1">{engagement.name}</CardTitle>
                      <CardDescription>
                        {client?.trade_name || client?.legal_name || client?.name || "Client"} · piloté par {provider?.trade_name || provider?.name || "TR1 Pharma"}
                      </CardDescription>
                    </div>
                    <Badge variant={engagement.status === "active" ? "secondary" : "outline"}>
                      {statusLabel[engagement.status] ?? engagement.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Période</p>
                      <p className="font-medium">
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(engagement.start_date))}
                        {engagement.end_date ? ` → ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(engagement.end_date))}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Secteur</p>
                      <p className="font-medium">{engagement.territory_summary || "À définir"}</p>
                    </div>
                  </div>

                  {engagement.scope_summary ? (
                    <p className="leading-6 text-muted-foreground">{engagement.scope_summary}</p>
                  ) : null}

                  {engagementObjectives.length ? (
                    <div className="flex flex-wrap gap-2">
                      {engagementObjectives.map((objective) => (
                        <span className="rounded-full border px-3 py-1 text-xs font-medium" key={objective.metric_key}>
                          {objective.label} : {Number(objective.target_value).toLocaleString("fr-FR")} {objective.unit}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucun objectif chiffré défini.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!engagements?.length ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Aucune prestation commerciale n’est encore créée. Le cockpit terrain actuel continue de fonctionner normalement.
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

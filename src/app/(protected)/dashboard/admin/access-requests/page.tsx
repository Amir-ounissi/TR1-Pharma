import { AccessRequestReviewCard, type AccessRequestCardData } from "@/components/access-requests/access-request-review-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { requirePlatformAdmin } from "@/lib/auth";

type JoinedValue<T> = T | T[] | null;

export default async function AccessRequestsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: requests, error: requestsError }, { data: brands, error: brandsError }, { data: territories, error: territoriesError }, { data: brandPharmacies, error: pharmaciesError }] = await Promise.all([
    supabase
      .from("access_requests")
      .select("id,requested_profile_type,requested_access,status,reviewer_note,created_at,target_brand:brands!access_requests_target_brand_id_fkey(name),users!access_requests_user_id_fkey(email,user_profiles(full_name)),reviewer:users!access_requests_reviewed_by_fkey(email,user_profiles(full_name))")
      .order("created_at", { ascending: false }),
    supabase
      .from("brands")
      .select("id,name,status,is_active")
      .order("name"),
    supabase
      .from("territories")
      .select("id,brand_id,name")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("brand_pharmacies")
      .select("id,brand_id,territory_id,pharmacies(trade_name,legal_name,city)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const loadingError = requestsError ?? brandsError ?? territoriesError ?? pharmaciesError;
  if (loadingError) {
    return (
      <main className="space-y-6">
        <PageHeader eyebrow="Plateforme TR1" title="Demandes d’accès" description="Le chargement de l’espace d’administration a rencontré un problème." tone="dark" />
        <Card className="border-destructive/40"><CardContent className="py-8 text-sm text-destructive">{loadingError.message}</CardContent></Card>
      </main>
    );
  }

  const normalizedRequests = (requests ?? []).map((request) => {
    const user = first(request.users);
    const profile = first(user?.user_profiles);
    const reviewer = first(request.reviewer);
    const reviewerProfile = first(reviewer?.user_profiles);
    const targetBrand = first(request.target_brand);
    return {
      id: request.id,
      fullName: profile?.full_name || "Compte sans nom",
      email: user?.email || "Email indisponible",
      profileType: request.requested_profile_type as AccessRequestCardData["profileType"],
      requestedAccess: (request.requested_access ?? {}) as Record<string, unknown>,
      createdAt: request.created_at,
      status: request.status,
      reviewerNote: request.reviewer_note,
      reviewedBy: reviewerProfile?.full_name || reviewer?.email || null,
      targetBrandName: targetBrand?.name || null,
    };
  });
  const pendingRequests = normalizedRequests.filter((request) => request.status === "pending");
  const processedRequests = normalizedRequests.filter((request) => request.status !== "pending");
  const pharmacyCountByTerritory = new Map<string, number>();
  for (const relation of brandPharmacies ?? []) {
    if (relation.territory_id) pharmacyCountByTerritory.set(relation.territory_id, (pharmacyCountByTerritory.get(relation.territory_id) ?? 0) + 1);
  }
  const normalizedTerritories = (territories ?? []).map((territory) => ({
    id: territory.id,
    brandId: territory.brand_id,
    name: territory.name,
    pharmacyCount: pharmacyCountByTerritory.get(territory.id) ?? 0,
  }));
  const onboardingRequests = pendingRequests.filter((request) => {
    if (request.profileType !== "brand") return false;
    const matchedBrand = findBrandMatch(request.requestedAccess, brands ?? []);
    return Boolean(matchedBrand && (!matchedBrand.is_active || matchedBrand.status !== "active"));
  });

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Plateforme TR1"
        title="Demandes d’accès"
        description="Validez chaque demande avec le bon rôle, la bonne marque et le périmètre réellement utilisable."
        tone="dark"
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="À traiter" value={pendingRequests.length} tone="warning" />
        <Summary label="En onboarding" value={onboardingRequests.length} tone="muted" />
        <Summary label="Approuvées" value={processedRequests.filter((request) => request.status === "approved").length} tone="success" />
        <Summary label="Refusées" value={processedRequests.filter((request) => request.status === "rejected").length} tone="muted" />
      </div>

      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">À traiter</h2><p className="text-sm text-muted-foreground">Une approbation crée les rattachements nécessaires. Elle ne repose jamais sur le rôle déclaré par la personne.</p></div>
        {pendingRequests.map((request) => (
          <AccessRequestReviewCard
            key={request.id}
            request={request}
            brands={brands ?? []}
            territories={normalizedTerritories}
            matchedBrand={request.profileType === "brand" ? findBrandMatch(request.requestedAccess, brands ?? []) : null}
          />
        ))}
        {!pendingRequests.length ? <EmptyCard>Il n’y a aucune demande en attente.</EmptyCard> : null}
      </section>

      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">Historique récent</h2><p className="text-sm text-muted-foreground">Les décisions restent traçables avec leur note interne.</p></div>
        <Card className="overflow-x-auto">
          <CardContent className="divide-y p-0">
            <div className="grid min-w-[56rem] grid-cols-[9rem_1.5fr_8rem_1fr_1fr_8rem_1fr] gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground"><span>Date</span><span>Utilisateur</span><span>Profil</span><span>Marque</span><span>Périmètre</span><span>Décision</span><span>Traité par</span></div>
            {processedRequests.slice(0, 20).map((request) => (
              <div className="grid min-w-[56rem] grid-cols-[9rem_1.5fr_8rem_1fr_1fr_8rem_1fr] gap-3 px-5 py-4 text-sm" key={request.id}>
                <span>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(request.createdAt))}</span><span><span className="block font-medium">{request.fullName}</span><span className="text-muted-foreground">{request.email}</span></span><span>{profileLabels[request.profileType]}</span><span>{request.targetBrandName || "—"}</span><span>{String(request.requestedAccess.territory || request.requestedAccess.organization || request.requestedAccess.company_name || "—")}</span><span><Badge variant={request.status === "approved" ? "default" : "outline"}>{statusLabel(request.status)}</Badge></span><span className="text-muted-foreground">{request.reviewedBy || "—"}</span>
              </div>
            ))}
            {!processedRequests.length ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune décision enregistrée.</div> : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "muted" }) {
  const className = tone === "warning" ? "border-orange-200 bg-orange-50" : tone === "success" ? "border-emerald-200 bg-emerald-50" : "border-border bg-card";
  return <Card className={className}><CardHeader className="py-4"><p className="text-sm text-muted-foreground">{label}</p><CardTitle className="text-3xl">{value}</CardTitle></CardHeader></Card>;
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function statusLabel(status: string) {
  return ({ approved: "Approuvée", rejected: "Refusée", cancelled: "Annulée" } as Record<string, string>)[status] ?? status;
}

const profileLabels = { brand: "Marque", agent: "Agent", facilitator: "Intervenant" } as const;

function findBrandMatch(requestedAccess: Record<string, unknown>, brands: { id: string; name: string; status: string; is_active: boolean }[]) {
  const companyName = typeof requestedAccess.company_name === "string" ? normalizeBrandName(requestedAccess.company_name) : "";
  if (!companyName) return null;
  return brands.find((brand) => normalizeBrandName(brand.name) === companyName) ?? null;
}

function normalizeBrandName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function first<T>(value: JoinedValue<T>) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

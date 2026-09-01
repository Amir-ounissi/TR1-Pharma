import { AccessRequestReviewCard, type AccessRequestCardData } from "@/components/access-requests/access-request-review-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { requirePlatformAdmin } from "@/lib/auth";

type JoinedValue<T> = T | T[] | null;

export default async function AccessRequestsPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: requests, error: requestsError }, { data: brands, error: brandsError }, { data: brandPharmacies, error: pharmaciesError }] = await Promise.all([
    supabase
      .from("access_requests")
      .select("id,requested_profile_type,requested_access,status,reviewer_note,created_at,users!access_requests_user_id_fkey(email,user_profiles(full_name))")
      .order("created_at", { ascending: false }),
    supabase
      .from("brands")
      .select("id,name")
      .eq("is_active", true)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("brand_pharmacies")
      .select("id,brand_id,pharmacies(trade_name,legal_name,city)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const loadingError = requestsError ?? brandsError ?? pharmaciesError;
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
    return {
      id: request.id,
      fullName: profile?.full_name || "Compte sans nom",
      email: user?.email || "Email indisponible",
      profileType: request.requested_profile_type as AccessRequestCardData["profileType"],
      requestedAccess: (request.requested_access ?? {}) as Record<string, unknown>,
      createdAt: request.created_at,
      status: request.status,
      reviewerNote: request.reviewer_note,
    };
  });
  const pendingRequests = normalizedRequests.filter((request) => request.status === "pending");
  const processedRequests = normalizedRequests.filter((request) => request.status !== "pending");
  const normalizedPharmacies = (brandPharmacies ?? []).map((relation) => {
    const pharmacy = first(relation.pharmacies);
    return {
      id: relation.id,
      brandId: relation.brand_id,
      name: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
      city: pharmacy?.city ?? null,
    };
  });

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Plateforme TR1"
        title="Demandes d’accès"
        description="Validez chaque demande avec le bon rôle, la bonne marque et le périmètre réellement utilisable."
        tone="dark"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="À traiter" value={pendingRequests.length} tone="warning" />
        <Summary label="Accès activés" value={processedRequests.filter((request) => request.status === "approved").length} tone="success" />
        <Summary label="Refusées" value={processedRequests.filter((request) => request.status === "rejected").length} tone="muted" />
      </div>

      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">À traiter</h2><p className="text-sm text-muted-foreground">Une approbation crée les rattachements nécessaires. Elle ne repose jamais sur le rôle déclaré par la personne.</p></div>
        {pendingRequests.map((request) => (
          <AccessRequestReviewCard
            key={request.id}
            request={request}
            brands={brands ?? []}
            pharmacies={normalizedPharmacies}
          />
        ))}
        {!pendingRequests.length ? <EmptyCard>Il n’y a aucune demande en attente.</EmptyCard> : null}
      </section>

      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">Historique récent</h2><p className="text-sm text-muted-foreground">Les décisions restent traçables avec leur note interne.</p></div>
        <Card>
          <CardContent className="divide-y p-0">
            {processedRequests.slice(0, 20).map((request) => (
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" key={request.id}>
                <div><p className="font-medium">{request.fullName} <span className="font-normal text-muted-foreground">· {request.email}</span></p><p className="mt-1 text-sm text-muted-foreground">{request.reviewerNote || "Aucune note interne."}</p></div>
                <Badge variant={request.status === "approved" ? "default" : "outline"}>{statusLabel(request.status)}</Badge>
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
  return ({ approved: "Accès activé", rejected: "Refusée", cancelled: "Annulée" } as Record<string, string>)[status] ?? status;
}

function first<T>(value: JoinedValue<T>) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

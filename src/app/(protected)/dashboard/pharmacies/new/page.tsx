import { PharmacyCreateForm } from "@/components/reference/pharmacy-create-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";

export default async function NewPharmacyPage() {
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: groups }, { data: territories }, { data: memberships }, { data: pharmacies }, { data: activeRelations }] = await Promise.all([
    supabase.from("pharmacy_groups").select("id,name").is("archived_at", null).order("name"),
    supabase.from("territories").select("id,name").eq("brand_id", brand.id).is("archived_at", null).order("name"),
    supabase.from("memberships").select("user_id,roles!inner(key),users!memberships_user_id_fkey(user_profiles(full_name))").eq("brand_id", brand.id).eq("status", "active").eq("roles.key", "agent"),
    supabase.from("pharmacies").select("id,legal_name,trade_name,city,postal_code").is("archived_at", null).order("trade_name"),
    supabase.from("brand_pharmacies").select("pharmacy_id").eq("brand_id", brand.id).is("archived_at", null),
  ]);
  const agents = (memberships ?? []).map((membership) => {
    const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
    const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
    return { id: membership.user_id, name: profile?.full_name ?? "Agent" };
  });
  const linkedPharmacyIds = new Set((activeRelations ?? []).map((relation) => relation.pharmacy_id));
  const existingPharmacies = (pharmacies ?? []).filter((pharmacy) => !linkedPharmacyIds.has(pharmacy.id)).map((pharmacy) => ({ id: pharmacy.id, name: `${pharmacy.trade_name || pharmacy.legal_name} — ${pharmacy.postal_code || ""} ${pharmacy.city || ""}`.trim() }));
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Nouvelle pharmacie</h1><p className="text-muted-foreground">Créez l’établissement physique et sa relation avec {brand.name}.</p></div><Card><CardHeader><CardTitle>Informations officinales</CardTitle><CardDescription>Les identifiants administratifs identiques sont bloquants. Les rapprochements par nom ou adresse demandent confirmation.</CardDescription></CardHeader><CardContent><PharmacyCreateForm groups={groups ?? []} territories={territories ?? []} agents={agents} existingPharmacies={existingPharmacies} /></CardContent></Card></div>;
}

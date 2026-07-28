import { MissionForm } from "@/components/missions/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";

export default async function NewMissionPage() {
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: relations }, { data: products }, { data: members }] = await Promise.all([
    supabase.from("brand_pharmacies").select("id,pharmacies(legal_name,trade_name,city)").eq("brand_id", brand.id).is("archived_at", null),
    supabase.from("products").select("id,name,sku").eq("brand_id", brand.id).eq("is_active", true),
    supabase.from("memberships").select("user_id").eq("brand_id", brand.id).eq("status", "active"),
  ]);
  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("user_profiles").select("user_id,full_name").in("user_id", memberIds).order("full_name")
    : { data: [] };
  const pharmacies = (relations ?? []).map((relation) => {
    const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
    return { id: relation.id, label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie", detail: pharmacy?.city };
  });
  const users = (profiles ?? []).map((profile) => ({ id: profile.user_id, label: profile.full_name || "Intervenant" }));

  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Nouvelle mission</h1><p className="text-muted-foreground">Le contrôle marque, intervenant et chevauchement est imposé en base.</p></div><Card><CardHeader><CardTitle>Brief terrain</CardTitle></CardHeader><CardContent><MissionForm pharmacies={pharmacies} users={users} products={(products ?? []).map((product) => ({ id: product.id, label: `${product.name} · ${product.sku}` }))} /></CardContent></Card></div>;
}

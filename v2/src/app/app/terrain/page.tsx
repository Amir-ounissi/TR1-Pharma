import { requireOwner } from "@/lib/auth";
export default async function TerrainPage() {
  const { db } = await requireOwner();
  const [activities, missions] = await Promise.all([
    db.from("activities").select("id,kind,note,occurred_at").order("occurred_at", { ascending: false }).limit(50),
    db.from("missions").select("id,kind,status,scheduled_at").order("scheduled_at", { ascending: false }).limit(50),
  ]);
  if (activities.error || missions.error) throw new Error("Impossible de charger l'activité terrain.");
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Terrain et missions</h1><p className="mt-2 text-sm text-[#69717d]">Visites, relances, animations et formations. Les intervenants seront ajoutés après validation du modèle métier.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-bold">Activités récentes</h2>
        {activities.data?.length ? activities.data.map(x=><p className="border-b py-2 text-sm" key={x.id}>{x.kind} · {new Date(x.occurred_at).toLocaleDateString("fr-FR")}</p>) :
          <p className="text-sm text-[#69717d]">Aucune activité.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-bold">Missions</h2>
        {missions.data?.length ? missions.data.map(x=><p className="border-b py-2 text-sm" key={x.id}>{x.kind} · {x.status}</p>) :
          <p className="text-sm text-[#69717d]">Aucune mission.</p>}</section>
    </div>
  </div>;
}

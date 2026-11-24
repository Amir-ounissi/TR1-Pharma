import Link from "next/link";
import { requireOwner } from "@/lib/auth";
export default async function CockpitHome() {
  const { db } = await requireOwner();
  const [brands, pharmacies, requests, missions, support] = await Promise.all([
    db.from("brands").select("id", { count: "exact", head: true }),
    db.from("pharmacies").select("id", { count: "exact", head: true }),
    db.from("order_requests").select("id", { count: "exact", head: true }).eq("status", "received"),
    db.from("missions").select("id", { count: "exact", head: true }).neq("status", "closed"),
    db.from("pharmacy_support_requests").select("id",{count:"exact",head:true}).neq("status","resolved"),
  ]);
  const indicators = [
    { label: "Demandes clients ouvertes", value: support.count ?? "—", href: "/app/relation-client" },
    { label: "Marques", value: brands.count ?? "—", href: "/app/marques" },
    { label: "Pharmacies", value: pharmacies.count ?? "—", href: "/app/pharmacies" },
    { label: "Demandes reçues", value: requests.count ?? "—", href: "/app/commandes" },
    { label: "Missions à suivre", value: missions.count ?? "—", href: "/app/terrain" },
  ];
  return <div className="space-y-7">
    <div><p className="text-xs font-bold uppercase tracking-widest text-[#ad4b08]">Mon cockpit</p>
      <h1 className="mt-2 text-3xl font-bold">Piloter mon activité TR1</h1>
      <p className="mt-2 text-sm text-[#69717d]">Priorité à la relation avec les officines, à l’accompagnement et à la présentation des marques.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {indicators.map(i=><Link href={i.href} key={i.label} className="rounded-xl border bg-white p-5 hover:border-[#ea7015]">
        <p className="text-xs font-semibold text-[#69717d]">{i.label}</p>
        <p className="mt-3 text-3xl font-extrabold">{i.value}</p>
      </Link>)}
    </div>
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-bold">Accès rapides</h2>
      <p className="mt-2 text-sm text-[#69717d]">Répondre aux demandes, accompagner les pharmacies et coordonner les marques.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/app/relation-client" className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Centre de demandes clients</Link><Link href="/app/pharmacies" className="rounded-lg border px-4 py-3 text-sm font-bold">Mes pharmacies</Link>
        <Link href="/app/marques" className="rounded-lg border px-4 py-3 text-sm font-bold">Mes marques</Link>
        <Link href="/app/commandes" className="rounded-lg border px-4 py-3 text-sm font-bold">Demandes reçues</Link>
        <Link href="/app/demo" className="rounded-lg border border-[#e4c89f] bg-[#fff8ec] px-4 py-3 text-sm font-bold">Pilote Vitalora · TEST</Link>
      </div>
    </section>
  </div>;
}

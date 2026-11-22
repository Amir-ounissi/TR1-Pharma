import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { saveBrandTermsAction } from "../catalogue-actions";
const fieldStyle = "mt-1 w-full rounded-lg border border-[#d3d7da] bg-white px-3 py-3 text-sm";

export default async function BrandTermsPage({searchParams}:{searchParams:Promise<{marque?:string,enregistre?:string}>}) {
  const { db } = await requireOwner();
  const query = await searchParams;
  const [b,t]=await Promise.all([
    db.from("brands").select("id,name,active").order("name"),
    db.from("brand_trade_terms").select("*"),
  ]);
  if(b.error||t.error)throw new Error("Impossible de charger les conditions commerciales.");
  const brands=b.data||[],selected=brands.find(x=>x.id===query.marque)||brands[0],term=t.data?.find(x=>x.brand_id===selected?.id);
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Conditions commerciales</h1>
      <p className="mt-2 text-sm text-[#69717d]">Conditions fournisseurs et logistique par marque. Elles restent privées : aucun tarif fournisseur ne s'affiche automatiquement dans le catalogue pharmacie.</p></div>
    {query.enregistre==="1"?<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Conditions enregistrées.</p>:null}
    <nav aria-label="Choisir la marque" className="flex flex-wrap gap-2">
      {brands.map(x=><Link key={x.id} href={"/app/conditions?marque="+x.id} className={"rounded-lg px-3 py-2 text-sm font-bold "+(selected?.id===x.id?"bg-[#142941] text-white":"border bg-white")}>{x.name}</Link>)}
    </nav>
    {selected ? <form action={saveBrandTermsAction} className="space-y-5 rounded-xl border bg-white p-6">
      <input type="hidden" name="brand_id" value={selected.id}/>
      <div><h2 className="text-xl font-bold">{selected.name}</h2>
        <p className="mt-1 text-xs text-[#69717d]">{term?.verified?"Conditions vérifiées":"Informations en attente de vérification"}</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold">Minimum de commande (unités)
          <input name="minimum_order_units" type="number" min="1" step="1" defaultValue={term?.minimum_order_units??""} className={fieldStyle}/></label>
        <label className="text-xs font-semibold">Minimum de commande (€ HT)
          <input name="minimum_order_ht" type="number" min="0" step="0.01" defaultValue={term?.minimum_order_ht??""} className={fieldStyle}/></label>
        <label className="text-xs font-semibold">Frais de port (€ HT)
          <input name="shipping_fee_ht" type="number" min="0" step="0.01" defaultValue={term?.shipping_fee_ht??""} className={fieldStyle}/></label>
        <label className="text-xs font-semibold">Franco de port à partir de (€ HT)
          <input name="free_shipping_from_ht" type="number" min="0" step="0.01" defaultValue={term?.free_shipping_from_ht??""} className={fieldStyle}/></label>
        <label className="text-xs font-semibold md:col-span-2">Email de transmission des commandes
          <input name="order_email" type="email" defaultValue={term?.order_email??""} className={fieldStyle}/></label>
      </div>
      <label className="block text-xs font-semibold">Notes contractuelles / livraison / UG
        <textarea name="notes" rows={5} defaultValue={term?.notes??""} className={fieldStyle}/></label>
      <label className="flex items-start gap-2 text-sm"><input name="confirmed_terms" type="checkbox" value="yes" className="mt-1"/>
        Je confirme avoir contrôlé ces conditions auprès du fournisseur ou de la marque.</label>
      <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Enregistrer les conditions</button>
    </form>:<div className="rounded-xl border bg-white p-6 text-sm text-[#69717d]">Créer d'abord une marque depuis « Mes marques ».</div>}
    <p className="text-xs text-[#69717d]">Les prix de vente du catalogue B2B se gèrent séparément, dans la fiche de chaque produit et ses paliers de quantité.</p>
  </div>;
}

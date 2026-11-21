import Link from "next/link";
import { requirePharmacy } from "@/lib/auth";
import { submitProductRequest } from "./request-actions";
export default async function PharmacyCatalogue() {
  const { db, user } = await requirePharmacy();
  const { data: memberships, error: membershipError } = await db.from("pharmacy_memberships")
    .select("pharmacy_id,pharmacies(name,city)").eq("user_id", user.id).eq("active", true).limit(1);
  if (membershipError) throw new Error("Impossible de vérifier votre pharmacie.");
  const membership = memberships?.[0];
  if (!membership) return <section className="rounded-xl border bg-white p-8">
    <h1 className="text-2xl font-bold">Accès en attente</h1>
    <p className="mt-3 text-sm text-[#69717d]">Votre compte doit être rattaché à une pharmacie validée avant de consulter les produits.</p>
  </section>;

  const pharmacyId = membership.pharmacy_id;
  const { data: grants, error: grantError } = await db.from("pharmacy_brand_access")
    .select("brand_id").eq("pharmacy_id", pharmacyId).eq("active", true);
  if (grantError) throw new Error("Impossible de charger les autorisations.");
  const brandIds = (grants ?? []).map(g => g.brand_id);
  const [productsResult, brandsResult] = await Promise.all([
    brandIds.length ? db.from("products").select("id,brand_id,name,sku,description,format,image_url,price_ht,min_qty,qty_step,published").eq("published", true).in("brand_id", brandIds).order("name").limit(200) : Promise.resolve({ data: [], error: null }),
    brandIds.length ? db.from("brands").select("id,name").in("id", brandIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error || brandsResult.error) throw new Error("Impossible de charger le catalogue.");
  const products = productsResult.data ?? [];
  const { data: tiers, error: priceError } = products.length
    ? await db.from("price_rules").select("product_id,min_qty,price_ht")
      .eq("pharmacy_id", pharmacyId).in("product_id", products.map(p=>p.id))
    : { data: [], error: null };
  if (priceError) throw new Error("Impossible de charger vos tarifs.");
  const names = new Map((brandsResult.data??[]).map(b=>[b.id,b.name]));
  const rulePrice = (id:string, qty:number, fallback:number) => {
    const rules = (tiers??[]).filter(t=>t.product_id===id && t.min_qty<=qty).sort((a,b)=>b.min_qty-a.min_qty);
    return rules.length? Number(rules[0].price_ht):fallback;
  };
  return <div className="space-y-7">
    <div><p className="text-xs font-bold uppercase tracking-wider text-[#ad4b08]">Espace réservé · TR1 PHARMA</p>
      <h1 className="mt-2 text-3xl font-bold">Votre catalogue professionnel</h1>
      <p className="mt-2 text-sm text-[#69717d]">Consultez les marques autorisées et préparez vos demandes de réassort.</p>
      <Link href="/catalogue/mes-demandes" className="mt-3 inline-block text-sm font-bold underline">Voir mes demandes</Link>
    </div>
    {products.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map(p=>{
        const price = rulePrice(p.id,p.min_qty,Number(p.price_ht));
        return <article key={p.id} className="overflow-hidden rounded-xl border bg-white">
          <div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#ad4b08]">{names.get(p.brand_id)??"Marque"}</p>
            <h2 className="mt-2 text-lg font-bold">{p.name}</h2>
            <p className="mt-1 text-xs text-[#69717d]">{p.format||p.sku}</p>
            {p.description?<p className="mt-3 line-clamp-3 text-sm text-[#69717d]">{p.description}</p>:null}
            <p className="mt-4 text-xl font-bold">{price.toFixed(2)} € <span className="text-xs font-normal">HT / unité au minimum</span></p>
          </div>
          <form action={submitProductRequest} className="flex flex-wrap items-end gap-3 border-t bg-[#f7f7f6] p-4">
            <input type="hidden" name="pharmacy_id" value={pharmacyId}/>
            <input type="hidden" name="product_id" value={p.id}/>
            <label className="grid gap-1 text-xs font-bold">Quantité
              <input name="quantity" type="number" min={p.min_qty} step={p.qty_step} defaultValue={p.min_qty} required className="w-24 rounded-lg border bg-white p-2 text-sm"/>
            </label>
            <button className="min-h-10 flex-1 rounded-lg bg-[#142941] px-4 text-xs font-bold text-white">Demander un réassort</button>
          </form>
        </article>;
      })}
    </div> : <p className="rounded-xl border bg-white p-8 text-sm text-[#69717d]">Aucun produit publié pour les marques actuellement autorisées.</p>}
    <p className="text-xs leading-5 text-[#69717d]">Une demande ne vaut pas achat confirmé : TR1 doit vérifier et transmettre les conditions et disponibilités à la marque concernée.</p>
  </div>;
}

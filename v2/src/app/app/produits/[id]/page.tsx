import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { saveProductAction, saveQuantityTierAction, deleteQuantityTierAction } from "../../catalogue-actions";
import { setProductPublishedAction } from "../../actions";

const inputClass = "mt-1 w-full rounded-lg border border-[#d3d7da] bg-white p-3 text-sm";
function TextField({label,name,value,required=false}:{label:string,name:string,value?:string|null,required?:boolean}) {
  return <label className="block text-xs font-semibold">{label}
    <input name={name} defaultValue={value??""} required={required} className={inputClass}/>
  </label>;
}
function LongField({label,name,value,rows=3}:{label:string,name:string,value?:string|null,rows?:number}) {
  return <label className="block text-xs font-semibold">{label}
    <textarea name={name} rows={rows} defaultValue={value??""} className={inputClass}/>
  </label>;
}
export default async function ProductDetails({
  params,searchParams
}:{
  params:Promise<{id:string}>;
  searchParams:Promise<{enregistre?:string,palier?:string,palier_supprime?:string}>;
}) {
  const { db } = await requireOwner();
  const { id } = await params;
  const status = await searchParams;
  const [p,t,b] = await Promise.all([
    db.from("products").select("*").eq("id",id).maybeSingle(),
    db.from("product_quantity_tiers").select("min_qty,price_ht,verified,source_note").eq("product_id",id).order("min_qty"),
    db.from("brands").select("id,name,active"),
  ]);
  if(p.error || t.error || b.error) throw new Error("Impossible de charger la fiche produit.");
  if(!p.data)notFound();
  const product=p.data;
  const brand=b.data?.find(x=>x.id===product.brand_id);
  const ready=!product.requires_review && product.price_verified
    && !!product.ean && !!product.image_url && (product.description||"").trim().length>=10
    && product.fr_market_checked && product.fr_label_checked
    && (product.fr_market_document||"").trim().length>=6;
  return <div className="space-y-6">
    <Link href="/app/produits" className="text-sm font-semibold underline">← Retour aux produits</Link>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-wider text-[#ad4b08]">{brand?.name??"Marque"}</p>
        <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>
        <p className="mt-2 text-xs text-[#69717d]">{product.sku} · {product.published?"Publié":"Non publié"} · {ready?"Fiche vérifiée":"À compléter / valider"}</p></div>
      <form action={setProductPublishedAction} className="rounded-lg border bg-white p-3">
        <input type="hidden" name="product_id" value={id}/>
        <input type="hidden" name="published" value={product.published?"false":"true"}/>
        <button disabled={!ready && !product.published}
          className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#d6d9dc] disabled:text-[#69717d]">
          {product.published?"Retirer du catalogue":"Publier la fiche"}
        </button>
        {!ready?<p className="mt-2 max-w-xs text-xs text-[#69717d]">EAN, description, visuel HTTPS, prix, dossier réglementaire et étiquette française doivent être vérifiés avant publication.</p>:null}
      </form>
    </div>
    {status.enregistre==="1" ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Fiche enregistrée en brouillon.</p>:null}
    {status.palier==="1" ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Palier enregistré.</p>:null}
    {status.palier_supprime==="1" ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Palier supprimé.</p>:null}
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Traçabilité du catalogue</h2>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p><strong>Source :</strong> {product.source_catalog||"Création V2"}</p>
        <p><strong>Document :</strong> {product.source_document||"Non renseigné"}</p>
        <p><strong>Ancien statut :</strong> {product.source_active===null?"Non applicable":product.source_active?"Actif":"Inactif"}</p>
        <p><strong>Vérification prix :</strong> {product.price_verified?"Confirmée":"À effectuer"}</p>
        <p><strong>Fiche officielle :</strong> {product.editorial_source_url
          ? <a href={product.editorial_source_url} target="_blank" rel="noopener noreferrer" className="underline">Consulter la source</a>
          : "Non renseignée"}</p>
        <p><strong>Justificatif marché français :</strong> {product.fr_market_document||"Non renseigné"}</p>
        <p><strong>Étiquette française :</strong> {product.fr_label_checked?"Vérifiée par TR1":"À vérifier"}</p>
      </div>
      <p className="mt-3 text-xs text-[#69717d]">Les données importées ne constituent pas une autorisation de publication. Le tarif saisi doit être vérifié auprès du partenaire avant validation.</p>
    </section>
    <form action={saveProductAction} className="space-y-6 rounded-xl border bg-white p-5">
      <input type="hidden" name="product_id" value={id}/>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Fiche produit B2B</h2>
        {product.image_url?<img src={product.image_url} alt={product.name} className="h-24 w-24 rounded-lg border object-contain" />:null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="name" label="Nom" required value={product.name}/>
        <TextField name="sku" label="Référence fournisseur / SKU" required value={product.sku}/>
        <TextField name="ean" label="EAN / GTIN" value={product.ean}/>
        <TextField name="format" label="Format" value={product.format}/>
        <TextField name="category" label="Catégorie" value={product.category}/>
        <TextField name="image_url" label="URL visuel produit (HTTPS)" value={product.image_url}/>
        <label className="text-xs font-semibold">Prix HT unitaire (€)
          <input name="price_ht" type="number" min="0" max="999999" step="0.01" defaultValue={Number(product.price_ht)} required className={inputClass}/>
        </label>
        <label className="text-xs font-semibold">TVA (%)
          <input name="vat_rate" type="number" min="0" max="100" step="0.01" defaultValue={Number(product.vat_rate)} required className={inputClass}/>
        </label>
        <label className="text-xs font-semibold">Minimum de commande
          <input name="min_qty" type="number" min="1" step="1" defaultValue={product.min_qty} required className={inputClass}/>
        </label>
        <label className="text-xs font-semibold">Pas de commande
          <input name="qty_step" type="number" min="1" step="1" defaultValue={product.qty_step} required className={inputClass}/>
        </label>
      </div>
      <LongField label="Description professionnelle" name="description" value={product.description}/>
      <div className="grid gap-4 md:grid-cols-2">
        <LongField label="Bénéfices" name="benefits" value={product.benefits}/>
        <LongField label="Actifs" name="actives" value={product.actives}/>
        <LongField label="INCI / Composition" name="inci" value={product.inci}/>
        <LongField label="Conseils d'utilisation" name="usage_advice" value={product.usage_advice}/>
        <LongField label="Précautions" name="precautions" value={product.precautions}/>
      </div>
      <section className="space-y-3 rounded-xl border border-[#eadcc2] bg-[#fffcf7] p-4">
        <h3 className="text-base font-bold">Contrôle réglementaire — marché français</h3>
        <p className="text-sm text-[#69717d]">Pour les compléments alimentaires : vérifier la déclaration de mise sur le marché, les allégations autorisées et l'étiquette française. Pour les cosmétiques : vérifier les obligations applicables, notamment la personne responsable et la notification CPNP. Le site du fournisseur seul ne constitue pas un justificatif.</p>
        <label className="block text-xs font-semibold">Référence ou dossier justificatif contrôlé
          <input name="fr_market_document" defaultValue={product.fr_market_document||""} placeholder="Référence Compl'Alim, CPNP ou dossier réglementaire" className="mt-1 w-full rounded-lg border bg-white p-3 text-sm"/>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="fr_market_checked" value="yes" defaultChecked={product.fr_market_checked} className="mt-1"/>
          Je confirme avoir vérifié les justificatifs du marché français et les allégations commerciales applicables.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="fr_label_checked" value="yes" defaultChecked={product.fr_label_checked} className="mt-1"/>
          Je confirme avoir vérifié l'étiquetage destiné au marché français.
        </label>
        <p className="text-xs text-[#ad4b08]">Aucun de ces contrôles n'est effectué automatiquement : une validation manuelle et documentée reste indispensable.</p>
      </section>
      <div className="space-y-3 border-t pt-5">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm_review" value="yes" className="mt-1"/>
          Je confirme avoir contrôlé la fiche, son EAN, son descriptif et son visuel.</label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm_price" value="yes" className="mt-1"/>
          Je confirme que le prix HT saisi est valable pour les pharmacies ciblées.</label>
        <p className="text-xs text-[#69717d]">Enregistrer dépublie toujours la fiche ; il faut cliquer ensuite sur « Publier » pour la rendre visible.</p>
        <button className="rounded-lg bg-[#142941] px-6 py-3 text-sm font-bold text-white">Enregistrer la fiche</button>
      </div>
    </form>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold">Paliers de prix HT</h2>
      <p className="mt-2 text-sm text-[#69717d]">Exemple : 6, 12, 18, 24, 48 unités selon les conditions réelles. La remise par quantité ne s'applique qu'après vérification explicite. Le prix spécifique d'une pharmacie reste prioritaire.</p>
      <div className="mt-5 divide-y rounded-lg border">
        {(t.data??[]).length ? t.data?.map(tier=><div key={tier.min_qty} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span><strong>Dès {tier.min_qty} unités</strong> · {Number(tier.price_ht).toFixed(2)} € HT/unité</span>
          <div className="flex items-center gap-3">
            <span className={tier.verified?"text-green-700":"text-[#ad4b08]"}>{tier.verified?"Vérifié":"À vérifier"}</span>
            <form action={deleteQuantityTierAction}>
              <input type="hidden" name="product_id" value={id}/>
              <input type="hidden" name="min_qty" value={tier.min_qty}/>
              <button className="rounded-md border px-3 py-2 text-xs">Supprimer</button>
            </form>
          </div>
        </div>):<p className="p-4 text-sm text-[#69717d]">Aucun palier renseigné : le prix de base s'appliquera.</p>}
      </div>
      <form action={saveQuantityTierAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="product_id" value={id}/>
        <label className="text-xs font-semibold">À partir de (unités)
          <input type="number" name="min_qty" min={product.min_qty} step={product.qty_step} defaultValue={product.min_qty} required className={inputClass}/>
        </label>
        <label className="text-xs font-semibold">Prix unitaire HT (€)
          <input type="number" name="price_ht" min="0" max="999999" step="0.01" required className={inputClass}/>
        </label>
        <button className="self-end rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Enregistrer</button>
        <label className="flex gap-2 text-xs md:col-span-3"><input type="checkbox" name="confirmed_price" value="yes"/>
          Je confirme que ce tarif par quantité est vérifié et peut être utilisé pour calculer les demandes.</label>
      </form>
    </section>
  </div>;
}

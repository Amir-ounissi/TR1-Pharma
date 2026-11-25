"use client";

import { useEffect, useMemo, useState } from "react";
import { submitPublicCatalogueRequestAction } from "@/app/(public)/vitrine/actions";
import { useFormStatus } from "react-dom";
import { InvitationLogin } from "@/components/auth/invitation-login";
import { ArrowRight, BadgeCheck, Check, ChevronDown, PackageOpen, Search, ShoppingBag, ShieldCheck, Trash2 } from "lucide-react";

type PriceTier = { min_qty: number; price_ht: number | string };
type OfferLine = { product_id: string; product_name: string; paid_units: number; free_units: number; line_note: string | null };
type BrandOffer = {
  id: string; title: string; offer_kind: string; summary: string | null;
  min_distinct_references: number | null; min_units_per_reference: number | null;
  free_units_per_reference: number; min_total_paid_units: number | null;
  min_order_ht: number | string | null; fixed_pack_ht: number | string | null;
  discount_pct: number | string | null; offer_conditions: string | null;
  plv_commitment: string | null; training_commitment: string | null;
  shipping_terms: string | null; valid_from: string | null; valid_until: string | null;
  lines: OfferLine[];
};
type BrandTerms = {
  minimum_order_units: number | null; minimum_order_ht: number | string | null;
  shipping_fee_ht: number | string | null; free_shipping_from_ht: number | string | null;
};
type PublicBrand = {
  id: string; name: string; slug: string; catalogue_active: boolean; short_description: string | null;
  catalogue_note: string | null; terms: BrandTerms | null; offers: BrandOffer[];
};
type PublicProduct = {
  id: string; brand_id: string; brand: string; brand_slug: string; name: string;
  sku: string; ean: string | null; description: string; format: string | null;
  category: string | null; image_url: string | null; price_ht: number | string;
  vat_rate: number | string; min_qty: number; qty_step: number;
  benefits: string | null; actives: string | null; inci: string | null;
  usage_advice: string | null; precautions: string | null;
  retail_ttc: number | string | null; tiers: PriceTier[];
};
export type PublicCatalogueData = { brands: PublicBrand[]; products: PublicProduct[] };

const money = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "—" :
  Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const unitPrice = (product: PublicProduct, quantity: number) => {
  const tier = [...(product.tiers ?? [])].filter(x => Number(x.min_qty) <= quantity)
    .sort((a,b) => Number(b.min_qty)-Number(a.min_qty))[0];
  return Number(tier?.price_ht ?? product.price_ht);
};
const clampQuantity = (product: PublicProduct, raw: number) => {
  const min = Number(product.min_qty), step = Math.max(1, Number(product.qty_step));
  const value = Number.isFinite(raw) ? Math.max(min, Math.min(5000, raw)) : min;
  return min + Math.floor((value-min)/step)*step;
};

function SendSelection({disabled,activated}:{disabled:boolean;activated:boolean}){const {pending}=useFormStatus();return <button type="submit" disabled={disabled||pending} className="min-h-12 rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{pending?"Transmission…":activated?"Envoyer ma sélection à TR1":"Activer mon compte et valider ma demande"}</button>;}
export function PublicCatalogueClient({ data, error, token, pharmacy, authEmail, activated, signedIn }: { data: PublicCatalogueData; error: string; token:string; pharmacy:{name:string;city:string|null};authEmail:string|null;activated:boolean;signedIn:boolean }) {
  const products = data.products ?? [];
  const brands = data.brands ?? [];
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("tr1-private-cart-"+token);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        const valid: Record<string, number> = {};
        for (const p of products) {
          const qty = Number(parsed?.[p.id]);
          if (Number.isFinite(qty) && qty >= p.min_qty) valid[p.id] = clampQuantity(p, qty);
        }
        setCart(valid);
      }
    } catch {
      // A blocked session storage should not prevent browsing the catalogue.
    }
    setCartReady(true);
  }, [products,token]);

  useEffect(() => {
    if (!cartReady) return;
    try { window.localStorage.setItem("tr1-private-cart-"+token, JSON.stringify(cart)); }
    catch { /* The basket remains usable in memory if storage is unavailable. */ }
  }, [cart, cartReady,token]);

  const categories = useMemo(() =>
    [...new Set(products.map(p => p.category || "Autres"))].sort((a,b) => a.localeCompare(b,"fr")),
    [products]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return products.filter(p =>
      (brandFilter === "all" || p.brand_id === brandFilter) &&
      (categoryFilter === "all" || (p.category || "Autres") === categoryFilter) &&
      (!q || [p.name,p.brand,p.sku,p.ean,p.format,p.category,p.description,p.actives]
        .filter(Boolean).join(" ").toLocaleLowerCase("fr").includes(q))
    );
  }, [products, query, brandFilter, categoryFilter]);

  const cartLines = useMemo(() => products.filter(p => Number(cart[p.id]) > 0).map(p => {
    const quantity = Number(cart[p.id]), price = unitPrice(p, quantity);
    return { ...p, quantity, price, total: Math.round(quantity*price*100)/100 };
  }), [products, cart]);
  const cartCount = cartLines.reduce((sum,x) => sum+x.quantity, 0);
  const cartTotal = cartLines.reduce((sum,x) => sum+x.total, 0);
  const itemsJson = JSON.stringify(cartLines.map(x => ({ product_id: x.id, quantity: x.quantity })));

  function addToCart(product: PublicProduct) {
    const qty = clampQuantity(product, draftQty[product.id] ?? product.min_qty);
    setCart(current => ({
      ...current,
      [product.id]: current[product.id] ? clampQuantity(product, current[product.id] + product.qty_step) : qty,
    }));
  }
  function changeCartQuantity(product: PublicProduct, raw: number) {
    setCart(current => ({ ...current, [product.id]: clampQuantity(product, raw) }));
  }

  return (
    <div className="space-y-7 pb-24">
      {error ? <p role="alert" className="rounded-xl border border-[#e8c6b7] bg-[#fff5f0] p-4 text-sm text-[#8b3922]">
        {error === "panier" ? "Le panier est incomplet. Vérifie les quantités puis réessaie." :
         error === "coordonnees" ? "Certaines coordonnées sont manquantes ou invalides." :
         error === "indisponible" ? "Le service est momentanément indisponible." :
         "La demande n'a pas pu être enregistrée. Vérifie les quantités minimales et les conditions des produits."}
      </p> : null}

      <section className="overflow-hidden rounded-2xl bg-[#142941] text-white">
        <div className="grid gap-7 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#efbf91]">TR1 PHARMA · Catalogue privé officine</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Votre catalogue professionnel</h1>
            <p className="mt-2 font-semibold text-[#efbf91]">{pharmacy.name}{pharmacy.city?" · "+pharmacy.city:""}</p><p className="mt-4 max-w-2xl text-sm leading-7 text-[#d7e0e7]">Consultez vos tarifs indicatifs, composez votre sélection puis transmettez-la à TR1. Les conditions, la disponibilité et la conformité des références sont confirmées par la marque avant toute commande ferme. Consultation sans compte. Votre espace personnel s’active à la première demande validée. Aucun paiement en ligne.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#produits" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#142941] hover:bg-[#edf2f4]">Explorer les produits <ArrowRight size={16}/></a>
              <a href="#panier" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"><ShoppingBag size={16}/> Mon panier ({cartCount})</a>
            </div>
          </div>
          <aside className="rounded-xl border border-white/20 bg-white/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#eac49f]">Votre sélection</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{cartCount} <span className="text-sm font-medium">unité(s)</span></p>
            <p className="mt-1 text-xs text-white/75">{cartLines.length} référence(s) · {money(cartTotal)} HT indicatifs</p>
            <a href="#panier" className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">Voir le panier <ArrowRight size={15}/></a>
          </aside>
        </div>
      </section>

      <section className="rounded-xl border border-[#dce5e9] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-[#9b5d2e]">Les marques</p><h2 className="mt-1 text-xl font-extrabold text-[#142941]">Un catalogue multimarque</h2></div>
          <span className="text-xs text-[#6a7b87]">{brands.length} marque(s) · {products.length} référence(s) accessibles sur demande</span>
        </div>
        {brands.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {brands.map(brand => <article key={brand.id} className="rounded-xl border border-[#e5e9eb] p-4">
            <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-[#142941]">{brand.name}</h3>{products.some(p=>p.brand_id===brand.id) ? <BadgeCheck size={17} className="shrink-0 text-[#35765e]"/> : <PackageOpen size={17} className="shrink-0 text-[#9a7b56]"/>}</div>
            <p className={"mt-2 text-[11px] font-semibold " + (products.some(p=>p.brand_id===brand.id) ? "text-[#35765e]" : "text-[#94683e]")}>{products.some(p=>p.brand_id===brand.id) ? "Sélection commerciale disponible" : "Présentation disponible · références en préparation"}</p>
            {!products.some(p=>p.brand_id===brand.id) ? <p className="mt-2 text-xs leading-5 text-[#6e7d88]">Contactez TR1 pour une proposition de référencement.</p> : null}
            {brand.short_description ? <p className="mt-2 text-sm leading-6 text-[#657784]">{brand.short_description}</p> : null}
            {brand.catalogue_note ? <p className="mt-2 text-xs leading-5 text-[#657784]">{brand.catalogue_note}</p> : null}
            {brand.terms ? <div className="mt-3 space-y-1 border-t pt-3 text-xs text-[#526878]">
              <p className="font-bold text-[#142941]">Conditions commerciales vérifiées</p>
              {brand.terms.minimum_order_units ? <p>Minimum : {brand.terms.minimum_order_units} unités</p> : null}
              {brand.terms.minimum_order_ht ? <p>Minimum de commande : {money(brand.terms.minimum_order_ht)} HT</p> : null}
              {brand.terms.shipping_fee_ht ? <p>Frais de port : {money(brand.terms.shipping_fee_ht)} HT</p> : null}
              {brand.terms.free_shipping_from_ht ? <p>Franco à partir de : {money(brand.terms.free_shipping_from_ht)} HT</p> : null}
            </div> : <p className="mt-3 border-t pt-3 text-xs text-[#8a6a4a]">Conditions de marque à confirmer auprès de TR1.</p>}
            {brand.offers?.length ? <div className="mt-3 space-y-3 border-t pt-3">
              <p className="text-xs font-bold text-[#142941]">Offres d'implantation publiées</p>
              {brand.offers.map(offer => <div key={offer.id} className="rounded-lg bg-[#f7f8f7] p-3">
                <p className="text-sm font-bold text-[#142941]">{offer.title}</p>
                {offer.summary ? <p className="mt-1 text-xs leading-5 text-[#667884]">{offer.summary}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#526878]">
                  {offer.min_distinct_references ? <span>{offer.min_distinct_references} réf. minimum</span> : null}
                  {offer.min_units_per_reference ? <span>{offer.min_units_per_reference} u./réf.</span> : null}
                  {offer.free_units_per_reference ? <span>{offer.free_units_per_reference} u. offertes/réf.</span> : null}
                  {offer.min_total_paid_units ? <span>{offer.min_total_paid_units} u. payantes</span> : null}
                  {offer.fixed_pack_ht ? <span>Pack : {money(offer.fixed_pack_ht)} HT</span> : null}
                  {offer.discount_pct ? <span>{Number(offer.discount_pct)} % de remise</span> : null}
                </div>
                {offer.lines.length ? <ul className="mt-2 space-y-1 text-xs text-[#526878]">
                  {offer.lines.map(line => <li key={line.product_id}>{line.product_name} · {line.paid_units} payée(s) + {line.free_units} offerte(s)</li>)}
                </ul> : null}
                {offer.offer_conditions ? <p className="mt-2 text-xs leading-5 text-[#667884]">{offer.offer_conditions}</p> : null}
                {offer.plv_commitment ? <p className="mt-1 text-xs text-[#667884]">PLV : {offer.plv_commitment}</p> : null}
                {offer.training_commitment ? <p className="mt-1 text-xs text-[#667884]">Formation : {offer.training_commitment}</p> : null}
                {offer.shipping_terms ? <p className="mt-1 text-xs text-[#667884]">Livraison : {offer.shipping_terms}</p> : null}
                {offer.valid_until ? <p className="mt-2 text-[11px] font-semibold text-[#8b572a]">Valable jusqu'au {new Date(offer.valid_until+"T12:00:00").toLocaleDateString("fr-FR")}</p> : null}
              </div>)}
            </div> : null}
          </article>)}
        </div> : <p className="mt-5 rounded-lg bg-[#f7f8f8] p-5 text-sm leading-6 text-[#647582]">Demandez à TR1 une présentation commerciale.</p>}
      </section>

      <section id="produits" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-[#9b5d2e]">Catalogue produits</p><h2 className="mt-1 text-2xl font-extrabold text-[#142941]">Les références disponibles</h2><p className="mt-1 text-sm text-[#6b7a86]">{visible.length} résultat(s) sur {products.length}</p></div>
        </div>
        <div className="grid gap-3 rounded-xl border border-[#dce5e9] bg-white p-4 md:grid-cols-[minmax(0,1fr)_210px_210px]">
          <label className="relative block"><span className="mb-1.5 block text-xs font-semibold text-[#596f7e]">Rechercher une référence</span>
            <Search size={16} className="absolute bottom-3.5 left-3 text-[#7b8b95]"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, actif, EAN, référence…" className="h-11 w-full rounded-lg border border-[#d5dfe4] pl-10 pr-3 text-sm outline-none focus:border-[#456c82]"/>
          </label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#596f7e]">Marque</span>
            <select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)} className="h-11 w-full rounded-lg border border-[#d5dfe4] bg-white px-3 text-sm">
              <option value="all">Toutes les marques</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#596f7e]">Rayon</span>
            <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="h-11 w-full rounded-lg border border-[#d5dfe4] bg-white px-3 text-sm">
              <option value="all">Tous les rayons</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(product => {
            const qty = clampQuantity(product, draftQty[product.id] ?? product.min_qty);
            const price = unitPrice(product, qty);
            const coefficient = product.retail_ttc && price > 0 ? Number(product.retail_ttc)/price : null;
            const inCart = cart[product.id] ?? 0;
            return <article key={product.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e0e7e9] bg-white shadow-[0_2px_12px_rgb(14_29_49/0.035)]">
              <div className="flex h-48 items-center justify-center border-b bg-[#f7f9f9] p-5">{product.image_url?<img src={product.image_url} alt={product.name} loading="lazy" referrerPolicy="no-referrer" className="h-full max-w-full object-contain"/>:<div className="text-center text-xs text-[#69717d]"><PackageOpen size={30} className="mx-auto mb-2"/>Visuel à confirmer</div>}</div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#5e7c90]">{product.brand}</p>
                <h3 className="mt-2 text-lg font-extrabold text-[#142941]">{product.name}</h3>
                <p className="mt-1 text-xs text-[#72818b]">{product.format || "Format non précisé"} · {product.ean ? "EAN " + product.ean : "Réf. " + product.sku}</p>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#637581]">{product.description}</p>
                {product.benefits ? <p className="mt-3 text-xs leading-5 text-[#526a7b]"><strong>Bénéfices :</strong> {product.benefits}</p> : null}
                {product.actives ? <p className="mt-2 text-xs leading-5 text-[#526a7b]"><strong>Actifs :</strong> {product.actives}</p> : null}
                {product.usage_advice ? <p className="mt-2 text-xs leading-5 text-[#526a7b]"><strong>Conseils :</strong> {product.usage_advice}</p> : null}
                {product.precautions ? <p className="mt-2 text-xs leading-5 text-[#8a5b38]"><strong>Précautions :</strong> {product.precautions}</p> : null}
                {product.inci ? <details className="mt-3 text-xs text-[#637581]"><summary className="flex cursor-pointer items-center gap-1 font-semibold">Composition / INCI <ChevronDown size={13}/></summary><p className="mt-2 whitespace-pre-line leading-5">{product.inci}</p></details> : null}
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-[11px] text-[#72818b]">Prix d'achat indicatif HT</p><p className="mt-1 text-xl font-extrabold text-[#142941]">{money(price)}</p></div>
                    <div className="text-right text-[11px] text-[#72818b]"><p>TVA : {Number(product.vat_rate)} %</p>{coefficient ? <p>Coeff. PVC TTC / PA HT : × {coefficient.toFixed(2).replace(".",",")}</p> : null}</div>
                  </div>
                  {product.tiers.length ? <p className="mt-2 text-[11px] text-[#526b7b]">Paliers indicatifs : {product.tiers.map(t=>t.min_qty + " u. · " + money(t.price_ht)).join("  |  ")}</p> : null}
                  <p className="mt-2 text-[11px] text-[#657783]">Minimum : {product.min_qty} unité(s) · Multiple : {product.qty_step}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-end gap-2 pt-4">
                  <label className="grid gap-1 text-[11px] font-semibold text-[#5d7180]">Quantité
                    <input type="number" min={product.min_qty} max="5000" step={product.qty_step} value={qty}
                      onChange={e=>setDraftQty(current=>({...current,[product.id]:clampQuantity(product,Number(e.target.value))}))}
                      className="h-10 w-24 rounded-lg border border-[#d5dfe4] px-2 text-center text-sm"/>
                  </label>
                  <button type="button" onClick={()=>addToCart(product)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#142941] px-3 py-2 text-xs font-bold text-white hover:bg-[#203d5a]"><ShoppingBag size={15}/>{inCart ? "Ajouter encore · " + inCart + " au panier" : "Ajouter au panier"}</button>
                </div>
                {inCart ? <p className="mt-2 text-[11px] font-semibold text-[#32735a]"><Check size={12} className="mr-1 inline"/> {inCart} unité(s) déjà sélectionnée(s)</p> : null}
              </div>
            </article>;
          })}
        </div> : <div className="rounded-xl border border-dashed border-[#cfdadd] bg-white p-8 text-center">
          <PackageOpen size={30} className="mx-auto text-[#82939d}"/>
          <p className="mt-3 font-bold text-[#142941]">{products.length ? "Aucune référence ne correspond à votre recherche." : "Le catalogue est en cours de préparation."}</p>
          <p className="mt-2 text-sm leading-6 text-[#687b88]">{products.length ? "Modifiez vos filtres pour élargir la sélection." : "Contactez TR1 pour obtenir une proposition."}</p>
        </div>}
      </section>

      <section id="panier" className="scroll-mt-24 rounded-2xl border border-[#dce5e9] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-[#9b5d2e]">Votre sélection</p><h2 className="mt-1 text-2xl font-extrabold text-[#142941]">Panier multimarque</h2><p className="mt-1 text-sm text-[#6b7a86]">Une seule demande, séparée automatiquement par marque pour le traitement TR1.</p></div>
          <span className="rounded-full bg-[#edf3f5] px-3 py-1.5 text-xs font-bold text-[#31556b]">{cartLines.length} référence(s) · {cartCount} unité(s)</span>
        </div>
        {cartLines.length ? <div className="mt-5 space-y-3">
          {cartLines.map(line=><article key={line.id} className="grid gap-3 rounded-xl border border-[#e3e9eb] p-4 sm:grid-cols-[minmax(0,1fr)_115px_120px_35px] sm:items-center">
            <div><p className="text-xs font-bold text-[#5c788b]">{line.brand}</p><h3 className="mt-1 font-bold text-[#142941]">{line.name}</h3><p className="mt-1 text-xs text-[#72818b]">{line.sku} · {money(line.price)} HT / unité</p></div>
            <label className="grid gap-1 text-[11px] font-semibold text-[#5d7180]">Quantité
              <input type="number" min={line.min_qty} max="5000" step={line.qty_step} value={line.quantity} onChange={e=>changeCartQuantity(line,Number(e.target.value))} className="h-10 rounded-lg border px-2 text-sm"/>
            </label>
            <div className="text-right"><p className="text-[11px] text-[#72818b]">Total HT indicatif</p><p className="font-extrabold text-[#142941]">{money(line.total)}</p></div>
            <button type="button" onClick={()=>setCart(current=>{const next={...current};delete next[line.id];return next;})} aria-label={"Retirer " + line.name} className="rounded-lg p-2 text-[#a24d31] hover:bg-[#fff3ee]"><Trash2 size={17}/></button>
          </article>)}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-[#697b86]">Total estimatif HT, hors UG, remises complémentaires, packs et éventuels frais de port. Le fournisseur confirme les conditions définitives.</p><p className="text-xl font-extrabold text-[#142941]">{money(cartTotal)} HT</p></div>
        </div> : <p className="mt-5 rounded-lg bg-[#f6f8f8] p-5 text-sm text-[#687b88]">Votre panier est vide. Ajoutez les références qui vous intéressent pour préparer une demande.</p>}
      </section>

      {cartLines.length ? <section id="transmission" className="scroll-mt-24 rounded-2xl border border-[#dce5e9] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-[#9b5d2e]">Dernière étape</p>
        <h2 className="mt-1 text-2xl font-extrabold text-[#142941]">Transmettre ma demande à TR1</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687b88]">Renseignez les coordonnées de l'officine. TR1 reprend contact si nécessaire, vérifie les conditions et transmet chaque demande à la marque concernée.</p>
        {!authEmail?<div className="mt-5 rounded-xl border bg-[#f5f8f8] p-5"><h3 className="font-bold">Vérifiez votre e-mail professionnel</h3><p className="mt-2 text-sm text-[#69717d]">Votre sélection est conservée dans ce navigateur. Connectez-vous avec le lien reçu par e-mail puis validez votre demande. Votre compte sera activé sans mot de passe à la première demande acceptée par la plateforme.</p><InvitationLogin token={token} signedIn={signedIn}/></div>:<form action={submitPublicCatalogueRequestAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="items_json" value={itemsJson}/><input type="hidden" name="token" value={token}/>
          <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label>Ne pas remplir<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
          <label className="grid gap-1.5 text-xs font-semibold text-[#4e6575]">Nom et prénom du contact *
            <input name="contact_name" required minLength={2} maxLength={120} autoComplete="name" className="h-12 rounded-lg border border-[#d5dfe4] px-3 text-sm"/>
          </label>
          <div className="rounded-lg bg-[#f5f8f8] p-3 text-sm"><span className="block text-xs text-[#69717d]">Officine déjà renseignée</span><strong>{pharmacy.name}</strong></div>
          <label className="grid gap-1.5 text-xs font-semibold text-[#4e6575]">E-mail professionnel vérifié
            <input name="email" type="email" readOnly value={authEmail} required maxLength={254} autoComplete="email" className="h-12 rounded-lg border border-[#d5dfe4] px-3 text-sm"/>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[#4e6575]">Téléphone
            <input name="phone" type="tel" maxLength={30} autoComplete="tel" className="h-12 rounded-lg border border-[#d5dfe4] px-3 text-sm"/>
          </label>
          {pharmacy.city?<input type="hidden" name="city" value={pharmacy.city}/>:<label className="grid gap-1.5 text-xs font-semibold">Ville *<input name="city" required minLength={2} maxLength={120} autoComplete="address-level2" className="h-12 rounded-lg border px-3 text-sm"/></label>}
          
          
          <label className="grid gap-1.5 text-xs font-semibold text-[#4e6575] md:col-span-2">Précision ou demande particulière
            <textarea name="note" rows={3} maxLength={1500} className="rounded-lg border border-[#d5dfe4] p-3 text-sm"/>
          </label>
          <div className="rounded-xl bg-[#f5f8f8] p-4 text-xs leading-5 text-[#566e7d] md:col-span-2"><p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0"/> Cette transmission n'est pas une commande ferme ni un paiement. TR1 est l'intermédiaire commercial ; chaque marque confirme la commande, la disponibilité, la livraison et la facturation.</p></div>
          <SendSelection disabled={!cartReady||cartLines.length===0} activated={activated}/>
          <p className="text-[11px] leading-5 text-[#788691] md:col-span-2">Les coordonnées transmises sont utilisées par TR1 pour traiter votre demande et peuvent être communiquées à la marque concernée uniquement pour son traitement. Consultez la <a href="/politique-de-confidentialite" className="underline">politique de confidentialité</a>.</p>
        </form>}
      </section> : null}

      {cartLines.length>0&&<div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-lg sm:hidden"><a href="#transmission" className="mx-auto flex max-w-lg items-center justify-between rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white"><span>{cartLines.length} réf. · {money(cartTotal)} HT</span><span>Envoyer ma sélection →</span></a></div>}
      <section className="flex flex-col gap-3 rounded-xl border border-[#e9dfcf] bg-[#fffaf2] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="flex items-center gap-2 text-sm font-bold text-[#74502f]"><ShieldCheck size={17}/> Le rôle de TR1 PHARMA</p><p className="mt-1 max-w-3xl text-xs leading-5 text-[#80684e]">TR1 présente les gammes, accompagne le pharmacien et transmet les demandes. Les marques restent responsables de la confirmation, de la logistique, de la livraison et de la facturation.</p></div>
        <span className="shrink-0 text-xs font-semibold text-[#74502f]">TR1 reste votre interlocuteur pour le suivi.</span>
      </section>
    </div>
  );
}

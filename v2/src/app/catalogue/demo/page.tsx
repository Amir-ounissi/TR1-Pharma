import Link from "next/link";
import { ArrowRight, ClipboardList, PackageSearch, Search, ShoppingBag, ShieldCheck } from "lucide-react";
import { requireVitaloraDemo } from "@/lib/vitalora-demo";
import { DemoProductCard, type DemoProductCardData } from "@/components/demo/demo-product-card";
import { normalizedSearch } from "@/lib/demo-display";

type Filters = { q?: string; categorie?: string; tri?: string; erreur?: string };
export default async function VitaloraDemo({ searchParams }: {searchParams: Promise<Filters>}) {
  const { db, authorized, brandId, pharmacyId } = await requireVitaloraDemo();
  const filters = await searchParams;
  if (!authorized || !pharmacyId) return <section className="rounded-xl border bg-white p-8">
    <p className="text-xs font-bold uppercase tracking-widest text-[#995219]">Espace de démonstration</p>
    <h1 className="mt-3 text-2xl font-bold">Accès non activé</h1>
    <p className="mt-3 text-sm text-[#69717d]">Seules les pharmacies pilotes autorisées peuvent consulter les références de test.</p>
  </section>;

  const [productsResult, tiersResult, cartResult] = await Promise.all([
    db.from("demo_products")
      .select("id,name,sku,ean,format,category,description,image_url,demo_price_ht,min_qty,qty_step")
      .eq("brand_id", brandId).eq("active", true).order("name"),
    db.from("demo_price_tiers").select("product_id,min_qty,price_ht").order("min_qty"),
    db.from("demo_cart_items").select("product_id,quantity").eq("pharmacy_id",pharmacyId),
  ]);
  if (productsResult.error || tiersResult.error || cartResult.error)
    throw new Error("Impossible de charger le catalogue de démonstration.");

  const products = (productsResult.data ?? []) as DemoProductCardData[];
  const tiers = tiersResult.data ?? [];
  const categories = [...new Set(products.map(p => p.category || "Autres"))]
    .sort((a,b) => a.localeCompare(b,"fr"));
  const search = (filters.q ?? "").trim().slice(0,100);
  const category = categories.includes(filters.categorie ?? "") ? filters.categorie ?? "" : "";
  const sort = ["nom","prix-croissant","prix-decroissant"].includes(filters.tri ?? "")
    ? filters.tri ?? "nom" : "nom";
  const keyword = normalizedSearch(search);
  const visible = products.filter(p =>
    (!category || (p.category || "Autres") === category) &&
    (!keyword || normalizedSearch([p.name,p.sku,p.ean,p.format,p.category,p.description].filter(Boolean).join(" ")).includes(keyword))
  ).sort((a,b) => sort === "prix-croissant"
    ? Number(a.demo_price_ht)-Number(b.demo_price_ht)
    : sort === "prix-decroissant"
      ? Number(b.demo_price_ht)-Number(a.demo_price_ht)
      : a.name.localeCompare(b.name,"fr"));

  const cart = cartResult.data ?? [];
  const units = cart.reduce((acc,x) => acc + x.quantity, 0);
  const cartUrl = "/catalogue/demo/panier";
  const categoryUrl = (value: string) => {
    const params = new URLSearchParams();
    if (search) params.set("q",search);
    if (value) params.set("categorie",value);
    if (sort !== "nom") params.set("tri",sort);
    return "/catalogue/demo" + (params.size ? "?" + params.toString() : "");
  };

  return <div className="space-y-6 pb-14">
    <nav aria-label="Fil d'Ariane" className="text-xs text-[#6a7783]">
      <Link href="/catalogue" className="hover:underline">Espace professionnel</Link>
      <span className="mx-2">/</span><span className="font-semibold text-[#152b40]">Vitalora · démonstration</span>
    </nav>

    <section className="relative overflow-hidden rounded-2xl bg-[#142941] px-6 py-7 text-white sm:px-9">
      <div className="absolute -right-12 -top-20 h-60 w-60 rounded-full border border-white/10 bg-white/[0.035]" aria-hidden="true"/>
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f6b97e]">TR1 PHARMA / ESPACE OFFICINE</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Catalogue Vitalora <span className="text-[#f7b474]">· Test</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#d7e0e7]">
            {products.length} références à explorer pour préparer un référencement.
            Catalogue, paliers et demandes exclusivement simulés.
          </p>
        </div>
        <Link href={cartUrl} className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white px-5 py-3 font-semibold text-[#142941] transition hover:bg-[#f4f5f6]">
          <ShoppingBag size={19} aria-hidden="true"/> Panier test
          <span className="rounded-full bg-[#e7edf0] px-2 py-0.5 text-xs">{units} u.</span>
        </Link>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ebdfca] bg-[#fffbf4] px-4 py-3">
      <p className="flex items-start gap-2 text-xs leading-5 text-[#805121]">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>
        <span><strong>Environnement non commercial.</strong> Prix fictifs, stocks inconnus. Aucun paiement ni commande fournisseur.</span>
      </p>
      <Link href="/catalogue/demo/demandes" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#8a511e] hover:underline">
        <ClipboardList size={15} aria-hidden="true"/> Historique test
      </Link>
    </div>

    {filters.erreur && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
      Impossible d'ajouter ce produit : vérifie l'accès et le multiple de commande.
    </p>}

    <section className="rounded-xl border border-[#e1e7eb] bg-white p-4 shadow-[0_2px_10px_rgb(14_29_49/0.03)]">
      <form method="GET" action="/catalogue/demo" role="search" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_175px_auto]">
        <label className="relative block">
          <span className="mb-1.5 block text-xs font-semibold text-[#586978]">Rechercher un produit</span>
          <Search size={17} aria-hidden="true" className="absolute bottom-[14px] left-3 text-[#758590]"/>
          <input name="q" type="search" defaultValue={search} placeholder="Nom, ingrédient, EAN, référence..."
            className="h-11 w-full rounded-lg border border-[#d5dde2] bg-[#fcfdfd] pl-10 pr-3 text-sm outline-none focus:border-[#52718a] focus:ring-2 focus:ring-[#c9dce6]"/>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[#586978]">Catégorie</span>
          <select name="categorie" defaultValue={category} className="h-11 w-full rounded-lg border border-[#d5dde2] bg-white px-3 text-sm text-[#142941]">
            <option value="">Toutes les catégories</option>
            {categories.map(c => <option value={c} key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[#586978]">Trier par</span>
          <select name="tri" defaultValue={sort} className="h-11 w-full rounded-lg border border-[#d5dde2] bg-white px-3 text-sm text-[#142941]">
            <option value="nom">Nom A → Z</option>
            <option value="prix-croissant">Prix test croissant</option>
            <option value="prix-decroissant">Prix test décroissant</option>
          </select>
        </label>
        <button className="min-h-11 self-end rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#26425b]">Appliquer</button>
      </form>
      {(search || category || sort !== "nom") && <Link href="/catalogue/demo" className="mt-3 inline-block text-xs font-semibold text-[#5d7385] underline underline-offset-2">Réinitialiser tous les filtres</Link>}
    </section>

    <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="hidden self-start rounded-xl border border-[#e1e7eb] bg-white p-4 lg:sticky lg:top-5 lg:block">
        <h2 className="text-sm font-bold text-[#142941]">Rayons</h2>
        <nav aria-label="Catégories produits" className="mt-3 space-y-1">
          <Link href={categoryUrl("")} aria-current={!category?"page":undefined}
            className={`flex justify-between rounded-lg px-3 py-2.5 text-xs transition ${!category?"bg-[#eaf0f3] font-bold text-[#142941]":"text-[#687783] hover:bg-[#f4f7f8]"}`}>
            <span>Toutes les références</span><span>{products.length}</span>
          </Link>
          {categories.map(c => <Link key={c} href={categoryUrl(c)}
            aria-current={category===c?"page":undefined}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs transition ${category===c?"bg-[#eaf0f3] font-bold text-[#142941]":"text-[#687783] hover:bg-[#f4f7f8]"}`}>
            <span>{c}</span><span>{products.filter(p => (p.category||"Autres")===c).length}</span>
          </Link>)}
        </nav>
        <div className="mt-5 border-t pt-4 text-xs leading-5 text-[#71808b]">
          <PackageSearch size={20} className="mb-2 text-[#8a98a3]" aria-hidden="true"/>
          <p><strong>Réassort simplifié</strong></p>
          <p className="mt-1">Paliers 3, 6 et 12 unités fictifs. Disponibilité et livraison à confirmer.</p>
        </div>
      </aside>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#75828e]">Référencement Vitalora</p>
            <h2 className="mt-1 text-xl font-bold text-[#142941]">
              {visible.length} {visible.length===1?"produit":"produits"} {keyword?"trouvés":"disponibles en démo"}
            </h2>
          </div>
          <Link href="/catalogue/demo/panier" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4864] hover:underline">
            Voir le panier ({cart.length} réf.) <ArrowRight size={14} />
          </Link>
        </div>
        {visible.length ? <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map(product => <DemoProductCard key={product.id} product={product}
            tiers={tiers.filter(t => t.product_id===product.id)} />)}
        </div> : <div className="rounded-xl border border-[#e1e7eb] bg-white px-6 py-12 text-center">
          <PackageSearch size={35} className="mx-auto text-[#97a5af]" aria-hidden="true"/>
          <h3 className="mt-3 text-lg font-bold text-[#142941]">Aucun produit trouvé</h3>
          <p className="mt-2 text-sm text-[#697782]">Essaie un autre nom, ingrédient, EAN ou catégorie.</p>
          <Link href="/catalogue/demo" className="mt-4 inline-block rounded-lg bg-[#142941] px-5 py-3 text-sm font-semibold text-white">Voir toutes les références</Link>
        </div>}
      </div>
    </div>
    <p className="text-xs leading-5 text-[#6e7b86]">
      Données produit issues du catalogue historique et non vérifiées pour la commercialisation en France.
      Prix, marges, disponibilité, franco et délais réels ne sont pas validés.
    </p>
  </div>;
}

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  createCommercialSupplier,
  linkSupplierToBrand,
  saveCommercialSupplierTerms,
} from "../actions";

const field = "w-full min-h-10 rounded-lg border border-[#dce3ea] bg-white px-3 text-sm";
const label = "block space-y-1 text-xs font-bold text-[#69717d]";
const action = "inline-flex min-h-10 items-center justify-center rounded-lg bg-[#142941] px-4 text-xs font-bold text-white hover:bg-[#1e405f]";

export default async function ConditionsCommercialesAdmin({
  searchParams,
}: { searchParams: Promise<{ enregistre?: string }> }) {
  const { supabase } = await requirePlatformAdmin();
  const { enregistre } = await searchParams;
  const [suppliersResult, brandsResult, mapsResult, termsResult] = await Promise.all([
    supabase.from("private_catalog_suppliers").select("id,display_name,active").order("display_name"),
    supabase.from("private_catalog_brands").select("id,name,active").order("name"),
    supabase.from("private_catalog_supplier_brands").select("brand_id,supplier_id"),
    supabase.from("private_catalog_supplier_terms").select(
      "supplier_id,active,verified_at,minimum_order_units,minimum_order_ht,shipping_fee_ht,free_shipping_from_ht,gift_rules,source_note"
    ),
  ]);
  const error = suppliersResult.error ?? brandsResult.error ?? mapsResult.error ?? termsResult.error;
  if (error) throw error;
  const suppliers = suppliersResult.data ?? [];
  const brands = brandsResult.data ?? [];
  const mappings = mapsResult.data ?? [];
  const terms = termsResult.data ?? [];
  return (
    <main className="space-y-7">
      <Link href="/catalogue/administration"
        className="text-xs font-bold text-[#69717d] underline underline-offset-4">
        ← Retour à l’administration
      </Link>
      <header className="rounded-xl bg-[#142941] px-6 py-6 text-white sm:px-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ffa460]">TR1 PHARMA · Conditions commerciales</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Paramétrer les fournisseurs</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d5dde7]">
          Associez les marques à leur fournisseur réel. Configurez uniquement les minimums,
          les gratuités et les frais de port confirmés par écrit.
          Sans validation, aucune condition n’est présentée comme acquise à la pharmacie.
        </p>
      </header>
      {enregistre === "1" ? <p role="status" className="rounded-lg border border-[#bdd7c4] bg-[#f0f8f2] p-3 text-sm font-semibold text-[#326448]">
        Paramétrage enregistré.
      </p> : null}

      <section className="grid gap-4 rounded-xl border border-[#e2e7ec] bg-white p-5 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-lg font-black text-[#142941]">Nouveau fournisseur</h2>
          <p className="mt-2 text-xs text-[#69717d]">Identifiez le fournisseur qui facture et livre, pas seulement la marque du produit.</p>
        </div>
        <form action={createCommercialSupplier} className="space-y-2">
          <label className={label}>Dénomination vérifiée
            <input required name="display_name" minLength={2} maxLength={180}
              placeholder="Nom de la société fournisseur" className={field} />
          </label>
          <button type="submit" className={action}>Créer le fournisseur</button>
        </form>
      </section>

      <section className="rounded-xl border border-[#e2e7ec] bg-white p-5">
        <h2 className="text-lg font-black text-[#142941]">Rattachement des marques</h2>
        <p className="mt-2 text-xs leading-5 text-[#69717d]">Les conditions de livraison se cumulent par fournisseur lorsque plusieurs marques sont rattachées.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {brands.map((brand) => (
            <form key={brand.id} action={linkSupplierToBrand} className="rounded-lg border border-[#edf0f1] p-3">
              <input type="hidden" name="brand_id" value={brand.id}/>
              <p className="mb-2 text-sm font-bold text-[#142941]">{brand.name}</p>
              <div className="flex flex-wrap gap-2">
                <select name="supplier_id" className={field + " min-w-[170px] flex-1"}
                  defaultValue={mappings.find((x) => x.brand_id===brand.id)?.supplier_id ?? "__none"}>
                  <option value="__none">Fournisseur non confirmé</option>
                  {suppliers.filter((x) => x.active).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.display_name}</option>
                  ))}
                </select>
                <button type="submit" className={action}>Associer</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      {suppliers.map((supplier) => {
        const termsForSupplier = terms.find((t) => t.supplier_id === supplier.id);
        const mapped = mappings.filter((x) => x.supplier_id===supplier.id)
          .map((map) => brands.find((brand) => brand.id===map.brand_id)?.name).filter(Boolean);
        return (
          <section key={supplier.id} className="rounded-xl border border-[#e2e7ec] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#142941]">{supplier.display_name}</h2>
                <p className="mt-1 text-xs text-[#69717d]">Marques : {mapped.length ? mapped.join(", ") : "Aucune marque associée"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${termsForSupplier?.active
                ? "bg-[#eaf1eb] text-[#325842]" : "bg-[#f4f5f5] text-[#69717d]"}`}>
                {termsForSupplier?.active ? "Conditions vérifiées" : "Brouillon non publié"}
              </span>
            </div>
            <form action={saveCommercialSupplierTerms} className="mt-5 space-y-4">
              <input type="hidden" name="supplier_id" value={supplier.id}/>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className={label}>Minimum global (unités)
                  <input name="minimum_order_units" type="number" min="1" step="1" className={field}
                    defaultValue={termsForSupplier?.minimum_order_units ?? ""} placeholder="Non renseigné"/>
                </label>
                <label className={label}>Minimum global (€ HT)
                  <input name="minimum_order_ht" type="number" min="0" step="0.01" className={field}
                    defaultValue={termsForSupplier?.minimum_order_ht ?? ""} placeholder="Non renseigné"/>
                </label>
                <label className={label}>Port (€ HT)
                  <input name="shipping_fee_ht" type="number" min="0" step="0.01" className={field}
                    defaultValue={termsForSupplier?.shipping_fee_ht ?? ""} placeholder="À confirmer"/>
                </label>
                <label className={label}>Franco dès (€ HT)
                  <input name="free_shipping_from_ht" type="number" min="0" step="0.01" className={field}
                    defaultValue={termsForSupplier?.free_shipping_from_ht ?? ""} placeholder="À confirmer"/>
                </label>
              </div>
              <label className={label}>Paliers d'unités gratuites (facultatif)
                <textarea name="gift_rules" rows={3} spellCheck={false}
                  defaultValue={JSON.stringify(termsForSupplier?.gift_rules ?? [],null,2)}
                  className="w-full rounded-lg border border-[#dce3ea] p-3 font-mono text-xs"/>
                <span className="block font-normal normal-case tracking-normal text-[#69717d]">
                  Tableau JSON. Exemple illustratif, à ne pas activer sans justificatif :
                  {String.raw` [{"minimum_order_units":12,"free_units":1,"description":"Produit à confirmer"}]`}
                </span>
              </label>
              <label className={label}>Justificatif et date des conditions
                <textarea name="source_note" rows={2} maxLength={1000} className="w-full rounded-lg border border-[#dce3ea] p-3 text-sm"
                  placeholder="Document / offre fournisseur, date, validation écrite..."
                  defaultValue={termsForSupplier?.source_note ?? ""}/>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-start gap-2 text-xs font-bold text-[#142941]">
                  <input name="active" value="true" type="checkbox" className="mt-0.5"
                    defaultChecked={termsForSupplier?.active ?? false}/>
                  Conditions vérifiées et publiables aux officines
                </label>
                <button type="submit" className={action}>Enregistrer les conditions</button>
              </div>
            </form>
          </section>
        );
      })}
      {!suppliers.length ? <p className="text-sm text-[#69717d]">Aucun fournisseur enregistré. Les conditions de livraison resteront à confirmer dans le panier.</p> : null}
    </main>
  );
}

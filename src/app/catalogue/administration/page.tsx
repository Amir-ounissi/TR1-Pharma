import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { euroHT } from "@/lib/private-catalogue";
import {
  authorizePrivateCatalogueBrand,
  createPrivateCatalogueBrand,
  createPrivateCataloguePharmacy,
  createPrivateCatalogueProduct,
  invitePrivateCatalogueUser,
  setPrivateCatalogueBrandPublished,
  setPrivateCataloguePrice,
  updatePrivateCatalogueRequestStatus,
} from "./actions";

const field = "w-full rounded-md border border-[#0e1d31]/20 bg-white px-3 py-2 text-sm";
const button = "rounded-md bg-[#0e1d31] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#162a45]";
const label = "block text-xs font-bold uppercase tracking-wide text-[#69717d]";
const statuses = [
  ["received", "Reçue"], ["verifying", "En vérification"],
  ["forwarded", "Transmise"], ["confirmed", "Confirmée"],
  ["closed", "Clôturée"], ["declined", "Refusée"],
] as const;

export default async function CatalogueAdministration({
  searchParams,
}: { searchParams: Promise<{ succes?: string }> }) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const [
    { data: pharmacies, error: pharmaciesError },
    { data: brands, error: brandsError },
    { data: products, error: productsError },
    { data: requests, error: requestsError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    admin.from("private_catalog_pharmacies").select("id,name,city,contact_email").order("name"),
    admin.from("private_catalog_brands").select("id,name,slug,active").order("name"),
    admin.from("private_catalog_products").select("id,brand_id,name,sku,price_ht").order("name"),
    admin.from("private_catalog_requests").select("id,pharmacy_id,brand_id,total_ht,status,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("private_catalog_memberships").select("user_id,pharmacy_id,invited_email,active").limit(200),
  ]);
  const queryError = pharmaciesError ?? brandsError ?? productsError ?? requestsError ?? membershipsError;
  if (queryError) throw queryError;
  const pharmacyRows = pharmacies ?? [];
  const brandRows = brands ?? [];
  const productRows = products ?? [];
  const requestRows = requests ?? [];
  const memberRows = memberships ?? [];
  const { succes } = await searchParams;

  return (
    <div className="space-y-9">
      <header className="rounded-2xl bg-[#0e1d31] p-7 text-white sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ffac78]">Administration TR1 PHARMA · Accès super-administrateur</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Piloter le catalogue privé.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Publiez les marques, invitez les officines et contrôlez leurs demandes. Ces données restent séparées du CRM et des commandes existantes.</p>
      </header>
      {succes === "1" ? <div role="status" className="rounded-lg border border-[#4f7a58]/30 bg-[#edf7ee] p-4 text-sm font-semibold text-[#315638]">Action enregistrée.</div> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Pharmacies", pharmacyRows.length],
          ["Marques publiées", brandRows.filter((b) => b.active).length],
          ["Références", productRows.length],
          ["Demandes reçues", requestRows.length],
        ].map(([title, count]) => (
          <div key={title} className="rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <p className="text-xs font-semibold text-[#69717d]">{title}</p>
            <p className="mt-2 text-3xl font-black">{count}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="setup" className="space-y-5">
        <h2 id="setup" className="text-2xl font-black">1. Alimenter le catalogue</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <form action={createPrivateCatalogueBrand} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Créer une marque</h3>
            <div><label htmlFor="brand_name" className={label}>Nom</label><input id="brand_name" name="name" required maxLength={180} className={field} placeholder="VK SWISS" /></div>
            <div><label htmlFor="brand_slug" className={label}>Identifiant URL</label><input id="brand_slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={field} placeholder="vk-swiss" /></div>
            <div><label htmlFor="brand_description" className={label}>Présentation</label><textarea id="brand_description" name="description" rows={3} className={field} maxLength={1000} /></div>
            <p className="text-xs text-[#69717d]">La marque est créée en brouillon, non visible aux officines.</p>
            <button type="submit" className={button}>Créer le brouillon</button>
          </form>

          <form action={createPrivateCataloguePharmacy} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Ajouter une officine</h3>
            <div><label htmlFor="pharmacy_name" className={label}>Raison sociale</label><input id="pharmacy_name" name="name" required className={field} /></div>
            <div><label htmlFor="pharmacy_siret" className={label}>SIRET (à vérifier)</label><input id="pharmacy_siret" name="siret" pattern="[0-9]{14}" maxLength={14} className={field} /></div>
            <div><label htmlFor="pharmacy_city" className={label}>Ville</label><input id="pharmacy_city" name="city" className={field} /></div>
            <div><label htmlFor="pharmacy_email" className={label}>Email professionnel</label><input id="pharmacy_email" name="email" type="email" className={field} /></div>
            <button type="submit" className={button}>Enregistrer l’officine</button>
          </form>

          <form action={createPrivateCatalogueProduct} className="space-y-3 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Ajouter une référence</h3>
            <div><label htmlFor="product_brand" className={label}>Marque</label>
              <select id="product_brand" name="brand_id" required className={field}>{brandRows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </div>
            <div><label htmlFor="product_sku" className={label}>Référence SKU</label><input id="product_sku" name="sku" required className={field} /></div>
            <div><label htmlFor="product_name" className={label}>Produit</label><input id="product_name" name="name" required className={field} /></div>
            <div><label htmlFor="product_format" className={label}>Format</label><input id="product_format" name="format" className={field} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="product_price" className={label}>Prix HT (€)</label><input id="product_price" name="price_ht" type="number" min="0" step="0.01" required className={field} /></div>
              <div><label htmlFor="product_vat" className={label}>TVA (%)</label><input id="product_vat" name="vat_rate" type="number" min="0" max="100" step="0.01" required className={field} /></div>
              <div><label htmlFor="product_min" className={label}>Minimum</label><input id="product_min" name="min_quantity" type="number" min="1" defaultValue="1" className={field} /></div>
              <div><label htmlFor="product_step" className={label}>Pas quantité</label><input id="product_step" name="quantity_step" type="number" min="1" defaultValue="1" className={field} /></div>
            </div>
            <button type="submit" className={button} disabled={!brandRows.length}>Ajouter le produit</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="rights" className="space-y-5">
        <h2 id="rights" className="text-2xl font-black">2. Contrôler les accès et les tarifs</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <form action={authorizePrivateCatalogueBrand} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Autoriser une marque</h3>
            <div><label className={label} htmlFor="access_pharmacy">Pharmacie</label><select id="access_pharmacy" name="pharmacy_id" className={field} required>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className={label} htmlFor="access_brand">Marque</label><select id="access_brand" name="brand_id" className={field} required>{brandRows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <button className={button} disabled={!pharmacyRows.length || !brandRows.length}>Donner accès</button>
          </form>
          <form action={invitePrivateCatalogueUser} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Inviter un professionnel</h3>
            <p className="text-xs text-[#69717d]">Ce formulaire enverra réellement un email à l’adresse saisie. Vérifiez d’abord l’identité et l’habilitation du destinataire.</p>
            <div><label htmlFor="invite_pharmacy" className={label}>Pharmacie</label><select id="invite_pharmacy" name="pharmacy_id" required className={field}>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label htmlFor="invite_email" className={label}>Email du professionnel</label><input id="invite_email" name="email" type="email" required className={field} /></div>
            <button type="submit" className={button} disabled={!pharmacyRows.length}>Envoyer l’invitation</button>
          </form>
          <form action={setPrivateCataloguePrice} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Prix spécifique</h3>
            <div><label htmlFor="price_pharmacy" className={label}>Pharmacie</label><select id="price_pharmacy" name="pharmacy_id" required className={field}>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label htmlFor="price_product" className={label}>Produit</label><select id="price_product" name="product_id" required className={field}>{productRows.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></div>
            <div><label htmlFor="price_override" className={label}>Prix HT personnalisé</label><input id="price_override" name="price_ht" type="number" min="0" step="0.01" required className={field} /></div>
            <button type="submit" className={button} disabled={!pharmacyRows.length || !productRows.length}>Appliquer le prix</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="publish" className="space-y-4">
        <h2 id="publish" className="text-2xl font-black">3. Publication des marques</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brandRows.map((b) => (
            <form key={b.id} action={setPrivateCatalogueBrandPublished} className="flex items-center justify-between gap-3 rounded-xl border border-[#0e1d31]/10 bg-white p-4">
              <div><p className="font-bold">{b.name}</p><p className="mt-1 text-xs text-[#69717d]">{b.active ? "Publiée · Accès selon les pharmacies" : "Brouillon · Invisible"}</p></div>
              <input type="hidden" name="brand_id" value={b.id} /><input type="hidden" name="published" value={b.active ? "false" : "true"} />
              <button type="submit" className={button}>{b.active ? "Masquer" : "Publier"}</button>
            </form>
          ))}
          {!brandRows.length ? <p className="text-sm text-[#69717d]">Aucune marque créée.</p> : null}
        </div>
      </section>

      <section aria-labelledby="requests" className="space-y-4">
        <h2 id="requests" className="text-2xl font-black">4. Demandes des pharmacies</h2>
        <p className="text-sm text-[#69717d]">Ces demandes n’alimentent pas automatiquement les commandes internes ou les laboratoires.</p>
        <div className="space-y-3">
          {requestRows.map((r) => (
            <form action={updatePrivateCatalogueRequestStatus} key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#0e1d31]/10 bg-white p-4">
              <div>
                <p className="text-sm font-bold">{pharmacyRows.find((p) => p.id === r.pharmacy_id)?.name ?? "Pharmacie"} · {brandRows.find((b) => b.id === r.brand_id)?.name ?? "Laboratoire"}</p>
                <p className="mt-1 text-xs text-[#69717d]">{new Date(r.created_at).toLocaleDateString("fr-FR")} · {r.id.slice(0, 8).toUpperCase()}</p>
                <p className="mt-1 font-black">{euroHT(Number(r.total_ht))} HT</p>
              </div>
              <input name="request_id" type="hidden" value={r.id} />
              <div className="flex items-center gap-2">
                <select name="status" className={field} defaultValue={r.status}>
                  {statuses.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
                </select>
                <button type="submit" className={button}>Enregistrer</button>
              </div>
            </form>
          ))}
          {!requestRows.length ? <p className="rounded-xl bg-white p-6 text-sm text-[#69717d]">Aucune demande reçue.</p> : null}
        </div>
      </section>
      <p className="text-xs text-[#69717d]">{memberRows.filter((m) => m.active).length} accès utilisateur actif(s). L’activation des accès doit rester réservée aux professionnels vérifiés.</p>
    </div>
  );
}

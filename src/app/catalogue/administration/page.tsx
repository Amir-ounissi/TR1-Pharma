import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogueAccessLinkManager } from "@/components/catalogue/catalogue-access-link-manager";
import { euroHT } from "@/lib/private-catalogue";
import {
  authorizePrivateCatalogueBrand,
  createPrivateCatalogueBrand,
  createPrivateCataloguePharmacy,
  createPrivateCatalogueProduct,
  updatePrivateCatalogueProduct,
  setPrivateCatalogueProductPublished,
  invitePrivateCatalogueUser,
  setPrivateCatalogueBrandPublished,
  setPrivateCataloguePrice,
  setPrivateCatalogueIndicativeTier,
  setPrivateCatalogueContractTier,
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
  // The dashboard uses the authenticated user session plus strict super-admin RLS.
  // A shared service key must never be required to render this administration.
  const { supabase: admin } = await requirePlatformAdmin();
  const service = createAdminClient();
  const [
    { data: pharmacies, error: pharmaciesError },
    { data: brands, error: brandsError },
    { data: products, error: productsError },
    { data: requests, error: requestsError },
    { data: memberships, error: membershipsError },
    { data: indicativeTiers, error: indicativeError },
    { data: contractTiers, error: contractError },
    { data: brandAccess, error: accessError },
    { data: invitations, error: invitationsError },
    { data: accessLinks, error: accessLinksError },
    { data: requestItems, error: requestItemsError },
  ] = await Promise.all([
    admin.from("private_catalog_pharmacies").select("id,name,city,contact_email").order("name"),
    admin.from("private_catalog_brands").select("id,name,slug,active").order("name"),
    admin.from("private_catalog_products").select("id,brand_id,name,sku,category,description,format,ean,image_url,price_ht,vat_rate,min_quantity,quantity_step,active,requires_review").order("name"),
    admin.from("private_catalog_requests").select("id,pharmacy_id,brand_id,total_ht,request_kind,status,created_at,requester_name,requester_email,access_link_id").order("created_at", { ascending: false }).limit(100),
    admin.from("private_catalog_memberships").select("user_id,pharmacy_id,invited_email,active").limit(200),
    admin.from("private_catalog_indicative_tiers").select("product_id,min_quantity,price_min_ht,price_max_ht").order("min_quantity"),
    admin.from("private_catalog_contract_tiers").select("pharmacy_id,product_id,min_quantity,price_ht").order("min_quantity"),
    admin.from("private_catalog_access").select("pharmacy_id,brand_id,active,pricing_mode"),
    admin.from("private_catalog_invitations").select("id,pharmacy_id,email,created_at,expires_at,claimed_at,active").order("created_at", { ascending: false }).limit(200),
    service.from("private_catalog_access_links").select("id,pharmacy_id,expires_at,last_used_at,active").eq("active", true),
    service.from("private_catalog_request_items").select("request_id,product_name,sku,quantity,unit_price_ht,line_total_ht").limit(5000),
  ]);
  const queryError = pharmaciesError ?? brandsError ?? productsError ?? requestsError ?? membershipsError ?? indicativeError ?? contractError ?? accessError ?? invitationsError ?? accessLinksError ?? requestItemsError;
  if (queryError) throw queryError;
  const pharmacyRows = pharmacies ?? [];
  const brandRows = brands ?? [];
  const productRows = products ?? [];
  const requestRows = requests ?? [];
  const memberRows = memberships ?? [];
  const indicativeRows = indicativeTiers ?? [];
  const contractRows = contractTiers ?? [];
  const accessRows = brandAccess ?? [];
  const invitationRows = invitations ?? [];
  const accessLinkRows = accessLinks ?? [];
  const requestItemRows = requestItems ?? [];
  const requestItemsById = new Map<string, typeof requestItemRows>();
  for (const item of requestItemRows) {
    const current = requestItemsById.get(item.request_id) ?? [];
    current.push(item);
    requestItemsById.set(item.request_id, current);
  }
  const { succes } = await searchParams;

  return (
    <div className="space-y-9">
      <header className="rounded-2xl bg-[#0e1d31] p-7 text-white sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ffac78]">Administration TR1 PHARMA · Accès super-administrateur</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Piloter le catalogue privé.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Publiez les marques, invitez les officines et contrôlez leurs demandes. Ces données restent séparées du CRM et des commandes existantes.</p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e2e7ec] bg-white p-4">
        <div>
          <p className="text-sm font-extrabold">Imports fournisseurs</p>
          <p className="mt-1 text-xs text-[#69717d]">Retrouvez les références importées, les données à vérifier et les paliers fournisseurs confidentiels dans le contrôle des imports.</p>
        </div>
        <Link href="/catalogue/administration/imports"
          className="rounded-md bg-[#ea7015] px-4 py-2.5 text-sm font-extrabold text-[#0e1d31]">
          Consulter les imports
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e2e7ec] bg-white p-4">
        <div>
          <p className="text-sm font-extrabold">Conditions commerciales fournisseurs</p>
          <p className="mt-1 text-xs text-[#69717d]">Associer marques et fournisseurs réels, confirmer les minimums, les paliers, les gratuités et les frais de livraison.</p>
        </div>
        <Link href="/catalogue/administration/conditions"
          className="rounded-md bg-[#142941] px-4 py-2.5 text-sm font-extrabold text-white">
          Paramétrer les conditions
        </Link>
      </div>
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
            <div><label htmlFor="product_description" className={label}>Présentation du produit</label><textarea id="product_description" name="description" rows={2} maxLength={1800} className={field} /></div>
            <div><label htmlFor="product_ean" className={label}>Code EAN (facultatif)</label><input id="product_ean" name="ean" pattern="[0-9]{8,14}" className={field} /></div>
            <div><label htmlFor="product_image" className={label}>URL image (facultative)</label><input id="product_image" name="image_url" type="url" className={field} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="product_price" className={label}>Prix de référence HT (€) · interne</label><input id="product_price" name="price_ht" type="number" min="0" step="0.01" required className={field} /></div>
              <div><label htmlFor="product_vat" className={label}>TVA (%)</label><input id="product_vat" name="vat_rate" type="number" min="0" max="100" step="0.01" required className={field} /></div>
              <div><label htmlFor="product_min" className={label}>Minimum de commande (u.)</label><input id="product_min" name="min_quantity" type="number" min="1" defaultValue="6" className={field} /></div>
              <div><label htmlFor="product_step" className={label}>Pas des boutons + / − (u.)</label><input id="product_step" name="quantity_step" type="number" min="1" defaultValue="6" className={field} /></div>
            </div>
            <p className="text-xs text-[#69717d]">Par défaut : 6 unités au premier ajout, puis +6 / −6. Modifiez librement minimum et pas pour chaque référence. Le prix de référence reste confidentiel.</p>
            <button type="submit" className={button} disabled={!brandRows.length}>Créer la fiche en brouillon</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="edit-products" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="edit-products" className="text-2xl font-black">Fiches produits et publication</h2>
          <p className="text-xs leading-5 text-[#576879]">
            Défaut : minimum 6 unités, boutons +6/−6. Exception fournisseur :
            les masques hydrogel Biodance sont commandables librement par référence,
            avec boutons +4/−4 et un minimum de 12 masques cumulés, total par multiples de 4.
            Le minimum et le pas individuel de validation restent configurables par fiche.
          </p>
          <span className="text-xs text-[#69717d]">{productRows.filter((p) => p.active).length} références actives</span>
        </div>
        {productRows.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {productRows.map((product) => (
              <div key={product.id} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#b66635]">{brandRows.find((b) => b.id === product.brand_id)?.name ?? "Marque"} · {product.sku}</p>
                    <h3 className="mt-1 text-lg font-extrabold">{product.name}</h3>
                    <p className="text-xs text-[#69717d]">{product.format} · Prix référence interne {Number(product.price_ht).toLocaleString("fr-FR", {minimumFractionDigits:2,maximumFractionDigits:4})} € HT</p>
                    {product.requires_review ? <p className="mt-1 text-xs font-bold text-[#ad4b08]">Import en attente de validation</p> : null}
                  </div>
                  <form action={setPrivateCatalogueProductPublished}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="active" value={product.active ? "false" : "true"} />
                    <button disabled={!product.active && (product.requires_review || product.vat_rate === null)}
                      title={!product.active && (product.requires_review || product.vat_rate === null)
                        ? "Valider les conditions, les EAN et la TVA avant publication" : undefined}
                      className={product.active
                      ? "rounded-md border border-[#c9d4dc] bg-white px-3 py-2 text-xs font-bold"
                      : "rounded-md bg-[#0e1d31] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"}>
                      {product.active ? "Masquer" : "Activer"}
                    </button>
                  </form>
                </div>
                <details className="rounded-lg border border-[#0e1d31]/10 p-3">
                  <summary className="cursor-pointer text-sm font-extrabold">Modifier la fiche et ses conditions de base</summary>
                  <form action={updatePrivateCatalogueProduct} className="mt-4 space-y-3">
                    <input type="hidden" name="id" value={product.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className={label}>Référence SKU</label><input name="sku" required defaultValue={product.sku} className={field} /></div>
                      <div><label className={label}>Nom du produit</label><input name="name" required defaultValue={product.name} className={field} /></div>
                    </div>
                    <div><label className={label}>Catégorie</label><input name="category" defaultValue={product.category ?? ""} maxLength={160} className={field} /></div>
                    <div><label className={label}>Description</label><textarea name="description" defaultValue={product.description} rows={3} maxLength={1800} className={field} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className={label}>Format</label><input name="format" defaultValue={product.format} className={field} /></div>
                      <div><label className={label}>EAN</label><input name="ean" pattern="[0-9]{8,14}" defaultValue={product.ean ?? ""} className={field} /></div>
                    </div>
                    <div><label className={label}>URL image</label><input name="image_url" type="url" defaultValue={product.image_url ?? ""} className={field} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className={label}>Prix référence HT (confidentiel)</label><input name="price_ht" type="number" min="0" step="0.0001" required defaultValue={Number(product.price_ht)} className={field} /></div>
                      <div><label className={label}>TVA (%)</label><input name="vat_rate" type="number" min="0" max="100" step="0.01" required defaultValue={product.vat_rate === null ? "" : Number(product.vat_rate)} className={field} /></div>
                      <div><label className={label}>Minimum unités</label><input name="min_quantity" type="number" min="1" max="5000" required defaultValue={product.min_quantity} className={field} /></div>
                      <div><label className={label}>Pas individuel de commande (u.) · défaut 6</label><input name="quantity_step" type="number" min="1" max="5000" required defaultValue={product.quantity_step} className={field} /><p className="mt-1 text-[11px] text-[#69717d]">Pas individuel actuel : {product.quantity_step} u. Les groupes fournisseurs peuvent proposer un pas de boutons différent (ex. Biodance +4/−4 collectif).</p></div>
                    </div>
                    <button type="submit" className={button}>Enregistrer les modifications</button>
                  </form>
                </details>
              </div>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-[#0e1d31]/15 bg-white p-7 text-sm text-[#69717d]">Aucune fiche produit créée. Utilisez le formulaire ci-dessus pour préparer les références.</p>}
      </section>

      <section aria-labelledby="rights" className="space-y-5">
        <h2 id="rights" className="text-2xl font-black">2. Contrôler les accès et les tarifs</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <form action={authorizePrivateCatalogueBrand} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Autoriser une marque</h3>
            <div><label className={label} htmlFor="access_pharmacy">Pharmacie</label><select id="access_pharmacy" name="pharmacy_id" className={field} required>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className={label} htmlFor="access_brand">Marque</label><select id="access_brand" name="brand_id" className={field} required>{brandRows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={label} htmlFor="access_mode">Visibilité tarifaire</label><select id="access_mode" name="pricing_mode" className={field}><option value="indicative">Fourchettes indicatives</option><option value="contractual">Accord contractuel (prix exacts configurés uniquement)</option></select></div>
            <button className={button} disabled={!pharmacyRows.length || !brandRows.length}>Donner accès</button>
          </form>
          <form action={invitePrivateCatalogueUser} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Préparer une invitation</h3>
            <p className="text-xs leading-5 text-[#69717d]">Autorisez l’adresse professionnelle d’une officine pendant 30 jours. Aucun email n’est envoyé depuis ce formulaire : communiquez ensuite le lien d’inscription à votre contact.</p>
            <div><label htmlFor="invite_pharmacy" className={label}>Pharmacie</label><select id="invite_pharmacy" name="pharmacy_id" required className={field}>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label htmlFor="invite_email" className={label}>Email du professionnel</label><input id="invite_email" name="email" type="email" required className={field} /></div>
            <button type="submit" className={button} disabled={!pharmacyRows.length}>Préautoriser cette adresse</button>
            <Link href="/catalogue/inscription" target="_blank" rel="noopener noreferrer" className="block text-sm font-bold text-[#0e1d31] underline">Ouvrir le lien d’inscription à transmettre</Link>
          </form>
          <form action={setPrivateCataloguePrice} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Prix contractuel fixe (ancien modèle)</h3>
            <div><label htmlFor="price_pharmacy" className={label}>Pharmacie</label><select id="price_pharmacy" name="pharmacy_id" required className={field}>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label htmlFor="price_product" className={label}>Produit</label><select id="price_product" name="product_id" required className={field}>{productRows.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></div>
            <div><label htmlFor="price_override" className={label}>Prix HT personnalisé</label><input id="price_override" name="price_ht" type="number" min="0" step="0.01" required className={field} /></div>
            <p className="text-xs text-[#69717d]">Ce prix est visible uniquement par l&apos;officine autorisée. Les nouveaux paliers ci-dessous prennent priorité si renseignés.</p>
            <button type="submit" className={button} disabled={!pharmacyRows.length || !productRows.length}>Appliquer le prix</button>
          </form>
        </div>
      </section>


      <section aria-labelledby="guest-access" className="space-y-4">
        <div>
          <h2 id="guest-access" className="text-2xl font-black">3. Accès catalogue sans compte</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#69717d]">
            Générez un lien privé par pharmacie. Le pharmacien consulte ses marques et tarifs, prépare son panier et transmet une demande avec son nom et son email, sans inscription ni mot de passe. Chaque renouvellement révoque le lien précédent.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {pharmacyRows.map((pharmacy) => {
            const link = accessLinkRows.find((row) => row.pharmacy_id === pharmacy.id);
            return (
              <article key={pharmacy.id} className="flex flex-col justify-between gap-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="font-extrabold text-[#0e1d31]">{pharmacy.name}</p>
                  <p className="mt-1 text-xs text-[#69717d]">{pharmacy.city || "Ville non renseignée"}{pharmacy.contact_email ? " · " + pharmacy.contact_email : ""}</p>
                </div>
                <div className="w-full max-w-sm">
                  <CatalogueAccessLinkManager
                    pharmacyId={pharmacy.id}
                    activeExpiresAt={link?.expires_at ?? null}
                    lastUsedAt={link?.last_used_at ?? null}
                  />
                </div>
              </article>
            );
          })}
          {!pharmacyRows.length ? <p className="rounded-lg bg-white p-5 text-sm text-[#69717d]">Ajoutez d’abord une pharmacie pour créer un lien privé.</p> : null}
        </div>
      </section>

      <section aria-labelledby="invitations" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="invitations" className="text-2xl font-black">Invitations préparées</h2>
          <p className="text-xs text-[#69717d]">Aucun email automatiquement envoyé</p>
        </div>
        <div className="divide-y divide-[#0e1d31]/10 overflow-hidden rounded-xl border border-[#0e1d31]/10 bg-white">
          {invitationRows.length ? invitationRows.map((invitation) => (
            <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-bold">{invitation.email}</p>
                <p className="mt-1 text-xs text-[#69717d]">{pharmacyRows.find((p) => p.id === invitation.pharmacy_id)?.name ?? "Pharmacie"} · expiration {new Date(invitation.expires_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <span className="rounded-full bg-[#f5f6f8] px-3 py-1 text-xs font-bold">
                {invitation.claimed_at ? "Accès activé" : !invitation.active || new Date(invitation.expires_at) <= new Date() ? "Expirée" : "À activer"}
              </span>
            </div>
          )) : <p className="p-5 text-sm text-[#69717d]">Aucune invitation préparée.</p>}
        </div>
      </section>

      <section aria-labelledby="tiers" className="space-y-5">
        <h2 id="tiers" className="text-2xl font-black">4. Barèmes par volume</h2>
        <p className="max-w-3xl text-sm leading-6 text-[#69717d]">Les fourchettes sont des indications commerciales indépendantes des prix de référence. Ne publiez pas un plancher confidentiel : saisissez uniquement les intervalles validés par le laboratoire. Les prix contractuels sont propres à chaque officine et restent invisibles aux autres.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <form action={setPrivateCatalogueIndicativeTier} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Fourchette indicative · visible aux invités</h3>
            <div><label htmlFor="band_product" className={label}>Référence</label><select id="band_product" name="product_id" required className={field}>{productRows.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></div>
            <div><label htmlFor="band_quantity" className={label}>À partir de (unités)</label><input id="band_quantity" name="min_quantity" type="number" min="1" max="5000" defaultValue="12" required className={field} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="band_min" className={label}>Borne basse HT / unité</label><input id="band_min" name="price_min_ht" type="number" min="0" step="0.01" required className={field} /></div>
              <div><label htmlFor="band_max" className={label}>Borne haute HT / unité</label><input id="band_max" name="price_max_ht" type="number" min="0" step="0.01" required className={field} /></div>
            </div>
            <p className="text-xs text-[#69717d]">Même produit + seuil identique : le palier est mis à jour. Les seuils suivants s&apos;affichent en fonction des quantités sélectionnées.</p>
            <button type="submit" className={button} disabled={!productRows.length}>Enregistrer la fourchette</button>
          </form>
          <form action={setPrivateCatalogueContractTier} className="space-y-4 rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="text-lg font-extrabold">Prix exact · accord officine</h3>
            <div><label htmlFor="contract_pharmacy" className={label}>Pharmacie</label><select id="contract_pharmacy" name="pharmacy_id" required className={field}>{pharmacyRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label htmlFor="contract_product" className={label}>Référence</label><select id="contract_product" name="product_id" required className={field}>{productRows.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></div>
            <div><label htmlFor="contract_quantity" className={label}>À partir de (unités)</label><input id="contract_quantity" name="min_quantity" type="number" min="1" max="5000" defaultValue="12" required className={field} /></div>
            <div><label htmlFor="contract_price" className={label}>Prix contractuel HT / unité</label><input id="contract_price" name="price_ht" type="number" min="0" step="0.01" required className={field} /></div>
            <p className="text-xs text-[#69717d]">La marque doit d&apos;abord être autorisée pour la pharmacie. Ce prix n&apos;est accessible qu&apos;à son compte et active le mode contractuel pour cette marque.</p>
            <button type="submit" className={button} disabled={!pharmacyRows.length || !productRows.length}>Enregistrer le palier contractuel</button>
          </form>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="mb-3 text-lg font-extrabold">Fourchettes publiables</h3>
            {indicativeRows.map((t) => <div key={t.product_id + t.min_quantity} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#0e1d31]/10 py-3 text-sm">
              <span>{productRows.find((p) => p.id === t.product_id)?.name ?? "Référence"} · dès {t.min_quantity} unités</span>
              <strong>{euroHT(Number(t.price_min_ht))} – {euroHT(Number(t.price_max_ht))} HT/u.</strong>
            </div>)}
            {!indicativeRows.length ? <p className="text-sm text-[#69717d]">Aucune fourchette configurée : les officines verront « Tarif sur demande ».</p> : null}
          </div>
          <div className="rounded-xl border border-[#0e1d31]/10 bg-white p-5">
            <h3 className="mb-3 text-lg font-extrabold">Conditions confidentielles</h3>
            {contractRows.map((t) => <div key={t.pharmacy_id + t.product_id + t.min_quantity} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#0e1d31]/10 py-3 text-sm">
              <span>{pharmacyRows.find((p) => p.id === t.pharmacy_id)?.name ?? "Pharmacie"} · {productRows.find((p) => p.id === t.product_id)?.name ?? "Référence"} · dès {t.min_quantity} unités</span>
              <strong>{euroHT(Number(t.price_ht))} HT/u.</strong>
            </div>)}
            {!contractRows.length ? <p className="text-sm text-[#69717d]">Aucun prix contractuel par volume.</p> : null}
          </div>
        </div>
        <div className="rounded-xl border border-[#0e1d31]/10 bg-white p-5">
          <h3 className="mb-3 text-lg font-extrabold">Visibilité par pharmacie et marque</h3>
          {accessRows.filter((a) => a.active).map((a) => <div key={a.pharmacy_id + a.brand_id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0e1d31]/10 py-3 text-sm">
            <span>{pharmacyRows.find((p) => p.id === a.pharmacy_id)?.name ?? "Pharmacie"} · {brandRows.find((b) => b.id === a.brand_id)?.name ?? "Marque"}</span>
            <strong>{a.pricing_mode === "contractual" ? "Contractuelle · si prix renseignés" : "Indicative"}</strong>
          </div>)}
          {!accessRows.length ? <p className="text-sm text-[#69717d]">Aucun accès de marque accordé.</p> : null}
        </div>
      </section>

      <section aria-labelledby="publish" className="space-y-4">
        <h2 id="publish" className="text-2xl font-black">5. Publication des marques</h2>
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
        <h2 id="requests" className="text-2xl font-black">6. Demandes des pharmacies</h2>
        <p className="text-sm text-[#69717d]">Ces demandes n’alimentent pas automatiquement les commandes internes ou les laboratoires.</p>
        <div className="space-y-3">
          {requestRows.map((r) => (
            <form action={updatePrivateCatalogueRequestStatus} key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#0e1d31]/10 bg-white p-4">
              <div>
                <p className="text-sm font-bold">{pharmacyRows.find((p) => p.id === r.pharmacy_id)?.name ?? "Pharmacie"} · {brandRows.find((b) => b.id === r.brand_id)?.name ?? "Laboratoire"}</p>
                <p className="mt-1 text-xs text-[#69717d]">{new Date(r.created_at).toLocaleDateString("fr-FR")} · {r.id.slice(0, 8).toUpperCase()}</p>
                {r.requester_name && r.requester_email ? (
                  <p className="mt-1 text-xs text-[#526071]">
                    Demandeur : <strong>{r.requester_name}</strong> · <a className="underline" href={"mailto:" + r.requester_email}>{r.requester_email}</a>
                  </p>
                ) : null}
                <p className="mt-1 font-black">{r.request_kind === "quote" ? "Demande de conditions · À chiffrer" : r.total_ht === null ? "Montant à confirmer" : euroHT(Number(r.total_ht)) + " HT"}</p>
                {(requestItemsById.get(r.id) ?? []).length ? (
                  <details className="mt-3 rounded-lg border border-[#e5e9eb] bg-[#faf9f6] p-3">
                    <summary className="cursor-pointer text-xs font-bold text-[#142941]">
                      Voir {(requestItemsById.get(r.id) ?? []).length} références demandées
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-[#526071]">
                      {(requestItemsById.get(r.id) ?? []).map((item, index) => (
                        <li key={r.id + "-" + index}>
                          {item.product_name} · Réf. {item.sku} · {item.quantity} unité{item.quantity > 1 ? "s" : ""}
                          {item.unit_price_ht !== null ? " · " + euroHT(Number(item.unit_price_ht)) + " HT/u." : " · Tarif à confirmer"}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
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

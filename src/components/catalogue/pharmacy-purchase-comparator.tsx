"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, FileSpreadsheet, Info, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import type { PharmacyProductWithVisuals } from "@/lib/catalogue-private-product-visuals";
import type { CommercialQuantityGroup } from "@/lib/catalogue-commercial";
import { firstOrderQuantity } from "@/lib/private-catalogue-format";
import {
  buildPharmacyCsvRecords,
  detectCsvColumn,
  findProductMatch,
  parseCsvContent,
  normalizeCsvText,
  normalizeCsvFormat,
  type CsvColumnMapping,
  type ParsedCsvContent,
} from "@/lib/catalogue-csv-comparison";

type ComparisonLine = ReturnType<typeof buildPharmacyCsvRecords>[number] & {
  productId: string | null;
  suggestedProductId: string | null;
  matchMethod: "ean" | "exact" | "suggested" | "none" | "manual";
};

type DisplayPrice =
  | { kind: "contractual"; price: number; threshold: number; thresholdLabel: string }
  | { kind: "indicative"; min: number; max: number; threshold: number; thresholdLabel: string }
  | { kind: "none" };

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_ROWS = 5000;

function decodeCsvFile(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function money(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getDisplayPrice(
  product: PharmacyProductWithVisuals,
  groups: CommercialQuantityGroup[],
): DisplayPrice {
  const tiers = [...product.pricing.tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const first = tiers[0];
  if (!first) return { kind: "none" };

  const collective = groups.find((group) => group.product_ids.includes(product.id));
  const threshold = collective
    ? firstOrderQuantity(Math.max(first.min_quantity, collective.minimum_total_units, product.min_quantity), collective.quantity_multiple)
    : firstOrderQuantity(Math.max(first.min_quantity, product.min_quantity), product.quantity_step);

  if (!threshold) return { kind: "none" };
  const thresholdLabel = collective
    ? "dès " + threshold + " unités cumulées sur la gamme"
    : "dès " + threshold + " unités";

  if ("price_ht" in first) {
    const price = Number(first.price_ht);
    return Number.isFinite(price) && price >= 0
      ? { kind: "contractual", price, threshold, thresholdLabel }
      : { kind: "none" };
  }

  const min = Number(first.price_min_ht);
  const max = Number(first.price_max_ht);
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min
    ? { kind: "indicative", min, max, threshold, thresholdLabel }
    : { kind: "none" };
}

function hasFormatMismatch(importedFormat: string | null, catalogueFormat: string | null): boolean {
  return Boolean(importedFormat && catalogueFormat
    && normalizeCsvFormat(importedFormat) !== normalizeCsvFormat(catalogueFormat));
}

function priceComparison(currentPrice: number | null, price: DisplayPrice, formatMismatch: boolean): string {
  if (formatMismatch) return "Conditionnement différent : écart non calculé";
  if (currentPrice === null) return "Prix d’achat HT manquant dans le fichier";
  if (price.kind === "none") return "Tarif TR1 à confirmer";

  if (price.kind === "contractual") {
    const difference = currentPrice - price.price;
    if (difference > 0.005) return "TR1 moins cher de " + money(difference) + " HT / unité";
    if (difference < -0.005) return "TR1 plus cher de " + money(Math.abs(difference)) + " HT / unité";
    return "Prix équivalents";
  }

  if (currentPrice > price.max + 0.005) {
    const low = currentPrice - price.max;
    const high = currentPrice - price.min;
    return "Écart potentiellement favorable : " + money(low) + " à " + money(high) + " HT / unité";
  }
  if (currentPrice < price.min - 0.005) {
    const low = price.min - currentPrice;
    const high = price.max - currentPrice;
    return "TR1 plus cher selon la fourchette : " + money(low) + " à " + money(high) + " HT / unité";
  }
  return "Votre prix se situe dans la fourchette TR1";
}

function matchLabel(method: ComparisonLine["matchMethod"]): string {
  if (method === "ean") return "EAN reconnu";
  if (method === "exact") return "Désignation exacte";
  if (method === "manual") return "Vérifié manuellement";
  if (method === "suggested") return "Suggestion à vérifier";
  return "Non rapproché";
}

export function PharmacyPurchaseComparator({
  products,
  quantityGroups,
}: {
  products: PharmacyProductWithVisuals[];
  quantityGroups: CommercialQuantityGroup[];
}) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsvContent | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    name: null,
    price: null,
    ean: null,
    brand: null,
    format: null,
  });
  const [lines, setLines] = useState<ComparisonLine[]>([]);
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);

  const matchableProducts = useMemo(() => products.map((product) => ({
    id: product.id,
    name: product.name,
    brand_name: product.brand_name,
    ean: product.ean,
    format: product.format,
    normalizedName: normalizeCsvText(product.name),
    normalizedBrand: normalizeCsvText(product.brand_name),
    normalizedFormat: normalizeCsvFormat(product.format),
  })), [products]);

  const summary = useMemo(() => {
    const matched = lines.filter((line) => line.productId !== null);
    const exact = matched.filter((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? getDisplayPrice(product, quantityGroups).kind === "contractual" : false;
    });
    const indicative = matched.filter((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? getDisplayPrice(product, quantityGroups).kind === "indicative" : false;
    });
    const cheaper = exact.filter((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product || line.purchasePriceHt === null || hasFormatMismatch(line.format, product.format)) return false;
      const price = getDisplayPrice(product, quantityGroups);
      return price.kind === "contractual" && line.purchasePriceHt - price.price > 0.005;
    });
    return {
      total: lines.length,
      matched: matched.length,
      exact: exact.length,
      indicative: indicative.length,
      cheaper: cheaper.length,
      toReview: lines.length - matched.length,
    };
  }, [lines, products, quantityGroups]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setLines([]);
    setParsed(null);
    if (file.size > MAX_FILE_SIZE) {
      setError("Le fichier dépasse 8 Mo. Exportez votre catalogue en plusieurs fichiers plus petits.");
      event.target.value = "";
      return;
    }

    setIsReading(true);
    try {
      const content = decodeCsvFile(await file.arrayBuffer());
      const result = parseCsvContent(content);
      if (result.rows.length > MAX_ROWS) {
        throw new Error("Le fichier contient plus de 5 000 lignes. Fractionnez votre export pour conserver une comparaison fiable et fluide.");
      }
      setFileName(file.name);
      setParsed(result);
      setMapping({
        name: detectCsvColumn(result.headers, "name"),
        price: detectCsvColumn(result.headers, "price"),
        ean: detectCsvColumn(result.headers, "ean"),
        brand: detectCsvColumn(result.headers, "brand"),
        format: detectCsvColumn(result.headers, "format"),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de lire ce fichier CSV.");
      setFileName("");
      setParsed(null);
    } finally {
      setIsReading(false);
      event.target.value = "";
    }
  }

  function updateColumn(key: keyof CsvColumnMapping, value: string) {
    setMapping((current) => ({
      ...current,
      [key]: value === "" ? null : Number(value),
    }));
    setLines([]);
  }

  function analyseCatalogue() {
    if (!parsed) return;
    if (mapping.name === null || mapping.price === null) {
      setError("Sélectionnez au minimum la colonne Désignation et la colonne Prix d’achat HT.");
      return;
    }
    const records = buildPharmacyCsvRecords(parsed.rows, mapping);
    if (!records.length) {
      setError("Aucune ligne produit exploitable. Vérifiez la colonne Désignation.");
      return;
    }
    const compared = records.map((record) => {
      const match = findProductMatch(record, matchableProducts);
      return {
        ...record,
        productId: match.productId,
        suggestedProductId: match.suggestedProductId,
        matchMethod: match.method,
      } satisfies ComparisonLine;
    });
    setLines(compared);
    setError("");
  }

  function selectProduct(lineId: string, productId: string) {
    setLines((current) => current.map((line) => line.id === lineId ? {
      ...line,
      productId: productId || null,
      suggestedProductId: null,
      matchMethod: productId ? "manual" : "none",
    } : line));
  }

  function resetComparison() {
    setFileName("");
    setParsed(null);
    setLines([]);
    setError("");
    setMapping({ name: null, price: null, ean: null, brand: null, format: null });
  }

  const fieldClass = "mt-1 min-h-11 w-full rounded-lg border border-[#dce3e8] bg-white px-3 text-sm text-[#142941] outline-offset-2";
  const selectColumn = (
    label: string,
    key: keyof CsvColumnMapping,
    required: boolean,
  ) => (
    <label className="block text-xs font-bold text-[#526173]">
      {label}{required ? " *" : " · facultatif"}
      <select
        className={fieldClass}
        value={mapping[key] === null ? "" : String(mapping[key])}
        onChange={(event) => updateColumn(key, event.target.value)}
      >
        <option value="">{required ? "Choisir une colonne" : "Non renseigné"}</option>
        {parsed?.headers.map((header, index) => (
          <option key={index} value={String(index)}>{header || "Colonne " + (index + 1)}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <Link href="/catalogue" className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#69717d] hover:text-[#ad4b08]">
        <ArrowLeft size={16} aria-hidden="true" /> Retour à Mes produits
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ad4b08]">Espace pharmacie · outil d’aide à l’achat</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#0e1d31] sm:text-4xl">Comparer mes achats</h1>
        <p className="mt-3 text-sm leading-6 text-[#69717d]">
          Importez votre export CSV pour rapprocher vos références de la sélection TR1 PHARMA et comparer les prix d’achat unitaires HT.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-[#cbd9e7] bg-[#f2f6fa] p-4">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#315b7a]" aria-hidden="true" />
        <div className="text-xs leading-5 text-[#40566a]">
          <p className="font-extrabold">Confidentialité de votre fichier</p>
          <p className="mt-1">Le CSV est lu et comparé directement dans votre navigateur. Il n’est pas envoyé à TR1 PHARMA, ni enregistré dans votre compte. Fermer ou actualiser cette page efface les données importées.</p>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-[#e2e7ec] bg-white p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#edf3ef] text-[#315b47]">
            <FileSpreadsheet size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#142941]">1. Importer le catalogue de votre pharmacie</h2>
            <p className="mt-1 text-xs text-[#69717d]">Format CSV · 8 Mo maximum · 5 000 lignes maximum</p>
          </div>
        </div>

        <label htmlFor="pharmacy-catalogue-csv" className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd6dd] bg-[#fafbfa] px-5 py-7 text-center transition hover:border-[#9aabaf] hover:bg-[#f5f8f6]">
          <UploadCloud size={30} className="text-[#526d61]" aria-hidden="true" />
          <span className="mt-3 text-sm font-extrabold text-[#142941]">{isReading ? "Lecture du fichier…" : "Choisir un fichier CSV"}</span>
          <span className="mt-1 text-xs text-[#69717d]">Exportez vos références avec leur code EAN, leur désignation et leur prix d’achat HT</span>
          <input id="pharmacy-catalogue-csv" type="file" accept=".csv,text/csv,.txt,text/plain" onChange={handleFileChange} disabled={isReading} className="sr-only" />
        </label>

        {fileName ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dce8df] bg-[#f5faf6] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#315b47]">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span className="truncate">{fileName}</span>
              <span className="text-xs font-medium text-[#687d70]">· {parsed?.rows.length ?? 0} lignes</span>
            </div>
            <button type="button" onClick={resetComparison} className="text-xs font-bold text-[#69717d] underline underline-offset-4">Effacer</button>
          </div>
        ) : null}
      </section>

      {parsed ? (
        <section className="space-y-5 rounded-2xl border border-[#e2e7ec] bg-white p-5 sm:p-7">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#ad4b08]">Configuration de l’import</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#142941]">2. Vérifier les colonnes détectées</h2>
            <p className="mt-2 text-xs leading-5 text-[#69717d]">Les colonnes sont proposées automatiquement. Vérifiez surtout que le prix sélectionné correspond bien à votre prix d’achat net unitaire HT, et non au prix de vente.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {selectColumn("Désignation produit", "name", true)}
            {selectColumn("Prix d’achat unitaire HT", "price", true)}
            {selectColumn("Code EAN / code-barres", "ean", false)}
            {selectColumn("Marque / laboratoire", "brand", false)}
            {selectColumn("Conditionnement / format", "format", false)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#f7f8f7] p-4">
            <p className="text-xs text-[#69717d]">Les lignes sans prix resteront visibles, mais ne pourront pas être comparées.</p>
            <button type="button" onClick={analyseCatalogue} disabled={mapping.name === null || mapping.price === null || !products.length}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#142941] px-5 text-sm font-extrabold text-white transition hover:bg-[#213c5c] disabled:cursor-not-allowed disabled:opacity-40">
              <RefreshCw size={16} aria-hidden="true" /> Lancer la comparaison
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#e9c8b8] bg-[#fff6f1] p-4 text-sm text-[#874b2c]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
        </div>
      ) : null}

      {lines.length > 0 ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#ad4b08]">Résultats de l’analyse</p>
              <h2 className="mt-1 text-2xl font-black text-[#142941]">Votre comparaison</h2>
            </div>
            <button type="button" onClick={resetComparison} className="text-xs font-bold text-[#69717d] underline underline-offset-4">Nouvelle analyse</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Références importées", value: summary.total },
              { label: "Rapprochées", value: summary.matched },
              { label: "Tarifs contractuels", value: summary.exact },
              { label: "Tarifs indicatifs", value: summary.indicative },
              { label: "À rapprocher", value: summary.toReview },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#e2e7ec] bg-white p-4">
                <p className="text-[11px] font-bold text-[#69717d]">{item.label}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-[#142941]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e2e7ec] bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e2e7ec] p-4 sm:p-5">
              <div>
                <h3 className="font-extrabold text-[#142941]">Comparaison par référence</h3>
                <p className="mt-1 text-xs text-[#69717d]">{summary.cheaper} référence(s) avec un tarif TR1 contractuel inférieur à votre prix importé.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#69717d]">
                <Info size={15} aria-hidden="true" /> Écart unitaire HT
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f8f7] text-[10px] uppercase tracking-wide text-[#69717d]">
                  <tr>
                    <th className="px-4 py-3 font-extrabold">Votre référence</th>
                    <th className="px-4 py-3 font-extrabold">Votre prix d’achat HT</th>
                    <th className="px-4 py-3 font-extrabold">Correspondance TR1</th>
                    <th className="px-4 py-3 font-extrabold">Prix TR1 HT / unité</th>
                    <th className="px-4 py-3 font-extrabold">Écart constaté</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f1]">
                  {lines.map((line) => {
                    const product = products.find((item) => item.id === line.productId) ?? null;
                    const suggestion = products.find((item) => item.id === line.suggestedProductId) ?? null;
                    const displayPrice = product ? getDisplayPrice(product, quantityGroups) : { kind: "none" as const };
                    const formatMismatch = product ? hasFormatMismatch(line.format, product.format) : false;
                    const difference = !formatMismatch && line.purchasePriceHt !== null && displayPrice.kind === "contractual"
                      ? line.purchasePriceHt - displayPrice.price
                      : null;
                    const comparison = product
                      ? priceComparison(line.purchasePriceHt, displayPrice, formatMismatch)
                      : "Sélectionnez une correspondance TR1 pour comparer";
                    return (
                      <tr key={line.id} className="align-top">
                        <td className="max-w-[230px] px-4 py-4">
                          <p className="font-extrabold text-[#142941]">{line.name}</p>
                          <p className="mt-1 text-[10px] text-[#7b8790]">{line.brand || "Marque non renseignée"}{line.ean ? " · EAN " + line.ean : ""}</p>
                          {line.format ? <p className="mt-1 text-[10px] text-[#7b8790]">Format importé : {line.format}</p> : null}
                          <p className="mt-1 text-[10px] text-[#8b969e]">Ligne CSV {line.lineNumber}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums text-[#142941]">
                          {line.purchasePriceHt === null ? "Non renseigné" : money(line.purchasePriceHt)}
                        </td>
                        <td className="min-w-[270px] px-4 py-4">
                          {product ? (
                            <div>
                              <p className="font-extrabold text-[#142941]">{product.brand_name}</p>
                              <p className="mt-1 font-semibold text-[#405267]">{product.name}</p>
                              <p className="mt-1 text-[10px] text-[#7b8790]">{product.format || "Format non renseigné"} · Réf. {product.sku}{product.ean ? " · EAN " + product.ean : ""}</p>
                              <span className="mt-2 inline-flex rounded-full bg-[#edf5ef] px-2 py-1 text-[10px] font-bold text-[#426a4e]">{matchLabel(line.matchMethod)}</span>
                              {formatMismatch ? <span className="mt-2 ml-1 inline-flex rounded-full bg-[#fff2e8] px-2 py-1 text-[10px] font-bold text-[#92552e]">Format à vérifier</span> : null}
                              {product.product_detail_href ? <Link href={product.product_detail_href} className="ml-2 text-[10px] font-bold text-[#ad4b08] underline underline-offset-2">Fiche produit</Link> : null}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {suggestion ? (
                                <p className="text-[11px] leading-5 text-[#8a5a26]">Suggestion : <strong>{suggestion.brand_name} · {suggestion.name}</strong>. Vérifiez avant de valider.</p>
                              ) : <p className="text-[11px] text-[#8b969e]">Aucune correspondance automatique fiable.</p>}
                              <select
                                aria-label={"Choisir la correspondance TR1 pour " + line.name}
                                className="min-h-10 w-full rounded-lg border border-[#dce3e8] bg-white px-2 text-[11px] text-[#142941]"
                                value=""
                                onChange={(event) => selectProduct(line.id, event.target.value)}
                              >
                                <option value="">Rapprocher manuellement…</option>
                                {products.map((item) => (
                                  <option key={item.id} value={item.id}>{item.brand_name} · {item.name}{item.ean ? " · " + item.ean : ""}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {product ? (
                            <label className="mt-2 block text-[10px] font-semibold text-[#69717d]">
                              Modifier le rapprochement
                              <select
                                aria-label={"Modifier la correspondance TR1 pour " + line.name}
                                className="mt-1 min-h-9 w-full rounded-lg border border-[#dce3e8] bg-white px-2 text-[11px] text-[#142941]"
                                value={product.id}
                                onChange={(event) => selectProduct(line.id, event.target.value)}
                              >
                                <option value="">Retirer la correspondance</option>
                                {products.map((item) => (
                                  <option key={item.id} value={item.id}>{item.brand_name} · {item.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {!product ? <p className="text-[#7b8790]">Aucune référence rapprochée</p> : displayPrice.kind === "contractual" ? (
                            <>
                              <p className="font-extrabold tabular-nums text-[#142941]">{money(displayPrice.price)}</p>
                              <p className="mt-1 text-[10px] text-[#69717d]">Contractuel · {displayPrice.thresholdLabel}</p>
                            </>
                          ) : displayPrice.kind === "indicative" ? (
                            <>
                              <p className="font-extrabold tabular-nums text-[#142941]">{money(displayPrice.min)} – {money(displayPrice.max)}</p>
                              <p className="mt-1 text-[10px] text-[#69717d]">Indicatif · {displayPrice.thresholdLabel}</p>
                            </>
                          ) : <p className="text-[#7b8790]">Tarif sur demande</p>}
                        </td>
                        <td className="max-w-[240px] px-4 py-4">
                          <p className={
                            difference !== null && difference > 0.005
                              ? "font-extrabold leading-5 text-[#39714a]"
                              : difference !== null && difference < -0.005
                                ? "font-bold leading-5 text-[#9a5b34]"
                                : "font-semibold leading-5 text-[#596879]"
                          }>{comparison}</p>
                          {displayPrice.kind === "indicative" ? <p className="mt-1 text-[10px] leading-4 text-[#8b7a65]">Fourchette non garantie : demandez confirmation des conditions.</p> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[#e6dfd2] bg-[#fbf8f2] p-4 text-xs leading-5 text-[#6e604e]">
            <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Comparaison indicative à l’unité, à partir du prix d’achat HT renseigné dans votre fichier. Si vous importez aussi le conditionnement, les formats différents bloquent le calcul de l’écart. Les tarifs TR1 dépendent des quantités minimales et des paliers indiqués. Les fourchettes indicatives ne sont pas des prix garantis. Les frais de port, remises différées, ristournes et conditions particulières ne sont pas intégrés.</p>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Link href="/catalogue" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#dce3e8] bg-white px-4 text-sm font-bold text-[#142941] hover:bg-[#f7f8f7]">Retour au catalogue</Link>
            <Link href="/catalogue/mes-demandes" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#142941] px-4 text-sm font-bold text-white hover:bg-[#213c5c]">Voir mes demandes</Link>
          </div>
        </section>
      ) : null}

      {!parsed && !lines.length ? (
        <p className="text-center text-xs text-[#7b8790]">Conseil : exportez un fichier contenant au minimum la désignation et le prix d’achat net HT. Le code EAN améliore fortement la fiabilité du rapprochement.</p>
      ) : null}
    </div>
  );
}

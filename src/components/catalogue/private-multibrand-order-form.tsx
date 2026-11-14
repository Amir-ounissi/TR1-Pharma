"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, LayoutGrid, List, Minus, Package, Plus, RotateCcw, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import { savePharmacyCart, sendMultiBrandCatalogueRequest } from "@/app/catalogue/actions";
import type { ReorderRequest, SavedCartLine } from "@/lib/catalogue-buyer-workspace";
import type { CatalogProduct } from "@/lib/private-catalogue";
import type { PharmacyProductWithVisuals } from "@/lib/catalogue-private-product-visuals";
import type { CommercialContext, CommercialQuantityGroup } from "@/lib/catalogue-commercial";
import { euroHT, indicativeRange, isAllowedQuantity, tierSavingsCents, nextTierDiscountCents } from "@/lib/private-catalogue-format";

export type PrivateMultiBrandProduct = PharmacyProductWithVisuals;

type ProductTier = CatalogProduct["pricing"]["tiers"][number];

function priceRangeForTier(tier: ProductTier | null) {
  if (!tier) return null;
  if ("price_ht" in tier) return { min: Number(tier.price_ht), max: Number(tier.price_ht) };
  return { min: Number(tier.price_min_ht), max: Number(tier.price_max_ht) };
}

function formatPriceRange(min: number, max: number) {
  const low = euroHT(min);
  const high = euroHT(max);
  return low === high ? low : `${low} – ${high}`;
}

function lineTotalHT(range: { min: number; max: number } | null, quantity: number): string | null {
  if (!range || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  return formatPriceRange(
    Math.round(range.min * 100) * quantity / 100,
    Math.round(range.max * 100) * quantity / 100,
  );
}

function findTierForQuantity(tiers: readonly ProductTier[], quantity: number): ProductTier | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  return tiers.reduce<ProductTier | null>(
    (selected, tier) =>
      tier.min_quantity <= quantity && (!selected || tier.min_quantity > selected.min_quantity)
        ? tier : selected,
    null,
  );
}

function nextTierForQuantity(tiers: readonly ProductTier[], quantity: number) {
  return [...tiers].filter((tier) => tier.min_quantity > quantity)
    .sort((a, b) => a.min_quantity - b.min_quantity)[0] ?? null;
}

type TierUpsellOffer = {
  missingUnits: number;
  targetQuantity: number | null;
  nextUnitPrice: string | null;
  currentSavingsCents: number | null;
  nextDiscountCents: number | null;
  grouped: boolean;
  minimumToReach: boolean;
  needsPackingMultiple: boolean;
};

function ProductQuantityControl({
  product,
  quantity,
  maxReferencesReached,
  compact = false,
  tierOffer,
  onAdd,
  onSubtract,
  onSetQuantity,
}: {
  product: PrivateMultiBrandProduct;
  quantity: number;
  maxReferencesReached: boolean;
  compact?: boolean;
  tierOffer?: TierUpsellOffer | null;
  onAdd: () => void;
  onSubtract: () => void;
  onSetQuantity: (next: number) => void;
}) {
  const invalid = quantity > 0 && !isAllowedQuantity(quantity, product.min_quantity);
  return (
    <>
      <div className={`flex flex-wrap items-start gap-2 ${compact ? "justify-end" : "w-full"}`}>
        {quantity === 0 ? (
          <button type="button" onClick={onAdd} disabled={maxReferencesReached}
            className={`shop-primary-action inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "w-auto min-w-[112px]" : "w-full"}`}>
            <Plus size={15} aria-hidden="true" /> {maxReferencesReached ? "Limite atteinte" : "Ajouter"}
            {!maxReferencesReached && <span className="font-medium opacity-80">· {product.min_quantity} u.</span>}
          </button>
        ) : (
          <div className="flex min-h-10 items-center overflow-hidden rounded-lg border border-[#dce3ea]">
            <button type="button" onClick={onSubtract} aria-label={"Diminuer " + product.name}
              className="flex h-10 w-9 items-center justify-center text-[#162a45] hover:bg-[#fff1e6]">
              <Minus size={16} />
            </button>
            <input type="number" inputMode="numeric" name={"quantity_" + product.id}
              min={0} max={5000} step={1} value={quantity}
              aria-label={"Quantité pour " + product.name}
              onChange={(event) => onSetQuantity(event.target.value === "" ? 0 : Number(event.target.value))}
              className="h-10 w-14 border-x border-[#e8ecee] text-center text-sm font-extrabold text-[#0e1d31] outline-none" />
            <button type="button" onClick={onAdd} aria-label={"Augmenter " + product.name}
              disabled={quantity >= 5000}
              className="flex h-10 w-9 items-center justify-center text-[#162a45] hover:bg-[#fff1e6] disabled:opacity-30">
              <Plus size={16} />
            </button>
          </div>
        )}
        {quantity === 0 ? <input type="hidden" name={"quantity_" + product.id} value="0" /> : null}
        {tierOffer && quantity > 0 ? (
          <div className={`min-w-[175px] flex-1 rounded-lg border border-[#f0dfc6] bg-[#fffaf2] px-3 py-2.5 text-[11px] leading-5 text-[#523b2b] ${compact ? "text-left" : ""}`}>
            {tierOffer.targetQuantity !== null ? (
              <>
                <p className="font-semibold">
                  {tierOffer.minimumToReach ? "Pour atteindre le minimum :" :
                    tierOffer.needsPackingMultiple ? "Pour compléter le colisage :" :
                    "Prochain palier :"}
                  {" "}<strong className="text-[#9c4a12]">+{tierOffer.missingUnits} u.</strong>
                </p>
                <p>
                  {tierOffer.grouped ? "Total gamme" : "Total référence"} : {tierOffer.targetQuantity} u.
                  {tierOffer.nextUnitPrice ? <> · <strong>{tierOffer.nextUnitPrice} HT/u.</strong></> : null}
                </p>
              </>
            ) : <p className="font-bold text-[#527156]">Meilleur palier atteint</p>}
            {tierOffer.currentSavingsCents !== null && tierOffer.currentSavingsCents > 0 ? (
              <p className="font-semibold text-[#487255]">Déjà économisé sur cette ligne : {euroHT(tierOffer.currentSavingsCents / 100)} HT</p>
            ) : null}
            {tierOffer.nextDiscountCents !== null && tierOffer.nextDiscountCents > 0 ? (
              <p className="font-semibold text-[#487255]">
                Remise supplémentaire sur le volume futur{tierOffer.grouped ? " de la gamme" : ""} : {euroHT(tierOffer.nextDiscountCents / 100)} HT
              </p>
            ) : null}
            {tierOffer.targetQuantity !== null ? (
              <button type="button"
                onClick={() => onSetQuantity(quantity + tierOffer.missingUnits)}
                className="mt-1.5 inline-flex min-h-8 items-center gap-1 rounded-md border border-[#d8a26c] bg-white px-2.5 text-[10px] font-extrabold text-[#8b3f0c] hover:bg-[#ffeddb]"
                aria-label={`Ajouter ${tierOffer.missingUnits} unités de ${product.name} pour atteindre ${tierOffer.targetQuantity} unités`}>
                <Plus size={12} aria-hidden="true" /> Ajouter +{tierOffer.missingUnits} u.
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {invalid ? (
        <p role="alert" className="mt-2 text-[11px] font-bold text-red-700">
          {!Number.isSafeInteger(quantity)
            ? "Saisissez un nombre entier."
            : quantity < product.min_quantity
              ? `Minimum de commande : ${product.min_quantity} unités.`
              : "Maximum : 5 000 unités par référence."}
        </p>
      ) : null}
    </>
  );
}

export function PrivateMultiBrandOrderForm({
  products,
  initialBrandSlug,
  initialProductId,
  initialCartLines = [],
  reorderHistory = [],
  initialReorderId,
  commercialConditions,
}: {
  products: PrivateMultiBrandProduct[];
  initialBrandSlug?: string;
  initialProductId?: string;
  initialCartLines?: SavedCartLine[];
  reorderHistory?: ReorderRequest[];
  initialReorderId?: string;
  commercialConditions: CommercialContext;
}) {
  const [state, action, pending] = useActionState(sendMultiBrandCatalogueRequest, { error: "" });
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const allowed = new Map(products.map((product) => [product.id, product]));
    const restored: Record<string, number> = {};
    for (const line of initialCartLines.slice(0, 40)) {
      const product = allowed.get(line.product_id);
      if (product && Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 5000) {
        restored[product.id] = line.quantity;
      }
    }
    const restoreRequest = reorderHistory.find((request) => request.id === initialReorderId);
    for (const line of restoreRequest?.items ?? []) {
      const product = allowed.get(line.product_id);
      if (product && Number.isSafeInteger(line.quantity) && line.quantity > 0
        && (restored[product.id] || Object.keys(restored).length < 40)) {
        restored[product.id] = Math.max(product.min_quantity, Math.min(5000, line.quantity));
      }
    }
    const target = allowed.get(initialProductId ?? "");
    if (target && (restored[target.id] || Object.keys(restored).length < 40)) {
      restored[target.id] = restored[target.id] || target.min_quantity;
    }
    return restored;
  });
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState(initialBrandSlug ?? "all");
  const [sort, setSort] = useState("brand");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [buyerView, setBuyerView] = useState<"reorder" | "catalogue">(
    reorderHistory.length && !initialProductId && !initialReorderId ? "reorder" : "catalogue",
  );
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [reorderMessage, setReorderMessage] = useState("");

  // Le nombre total d'une collection mutualisée (ex. cinq masques Biodance)
  // détermine les paliers de toutes ses références.
  const volumeGroups = commercialConditions.quantity_groups;
  const groupByProduct = useMemo(() => {
    const index = new Map<string, CommercialQuantityGroup>();
    for (const group of volumeGroups) {
      for (const productId of group.product_ids) index.set(productId, group);
    }
    return index;
  }, [volumeGroups]);

  const groupTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const group of volumeGroups) {
      totals.set(group.id, group.product_ids.reduce(
        (total, id) => total + (quantities[id] ?? 0), 0
      ));
    }
    return totals;
  }, [volumeGroups, quantities]);

  const effectiveTierQuantity = (product: PrivateMultiBrandProduct, quantity: number) => {
    const group = groupByProduct.get(product.id);
    if (!group) return quantity;
    return Math.max(group.minimum_total_units, groupTotals.get(group.id) ?? 0);
  };
  const groupErrors = volumeGroups.flatMap((group) => {
    const total = groupTotals.get(group.id) ?? 0;
    if (!total) return [];
    if (total < group.minimum_total_units) {
      return [`${group.name} : encore ${group.minimum_total_units - total} unité(s) pour atteindre le minimum de ${group.minimum_total_units}.`];
    }
    if (total % group.quantity_multiple !== 0) {
      return [`${group.name} : ${total} masques sélectionnés, le total doit être un multiple de ${group.quantity_multiple}.`];
    }
    return [];
  });
  // Ne pas annoncer une economie acquise si le groupe ne respecte pas son minimum ou son multiple.
  const savingsForProduct = (product: PrivateMultiBrandProduct, quantity: number, tier: ProductTier | null) => {
    const group = groupByProduct.get(product.id);
    if (group) {
      const total = groupTotals.get(group.id) ?? 0;
      if (total < group.minimum_total_units || total % group.quantity_multiple !== 0) return null;
    }
    return tierSavingsCents(product.pricing.tiers, tier, quantity);
  };

  const didMount = useRef(false);

  // Persistance cote serveur entre les pages, appareils et sessions.
  // Debounce pour ne pas declencher un appel reseau a chaque clic +/−.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      // La reprise depuis un lien d'historique ajoute des lignes au panier initial.
      if (!initialReorderId) return;
    }
    if (pending) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const lines = Object.entries(quantities)
        .filter(([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity }));
      const result = await savePharmacyCart(lines);
      if (!cancelled) setSaveStatus(result.saved ? "saved" : "error");
    }, 700);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [quantities, pending, initialReorderId]);

  const brandOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const product of products) unique.set(product.brand_slug, product.brand_name);
    return [...unique.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products]);

  const selected = useMemo(
    () => products.filter((product) => (quantities[product.id] ?? 0) > 0),
    [products, quantities],
  );

  // L'incitation concerne seulement les produits disposant de plusieurs paliers.
  // Sur une gamme mutualisee (Biodance), le seuil et le gain portent sur tout le
  // groupe ; le bouton ajoute les unites a la seule reference choisie.
  const tierOfferForProduct = (product: PrivateMultiBrandProduct, quantity: number): TierUpsellOffer | null => {
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || product.pricing.tiers.length < 2) return null;
    const group = groupByProduct.get(product.id);
    const volume = group ? groupTotals.get(group.id) ?? 0 : quantity;
    const minimum = group ? group.minimum_total_units : product.min_quantity;
    const minimumToReach = volume < minimum;
    const needsPackingMultiple = Boolean(group && volume >= minimum && volume % group.quantity_multiple !== 0);
    const nextTier = nextTierForQuantity(product.pricing.tiers, volume);
    let target: number | null = minimumToReach ? minimum : (nextTier?.min_quantity ?? null);

    // Si le dernier palier est atteint, guider vers le prochain multiple valide
    // sans inventer une nouvelle remise.
    if (target === null && needsPackingMultiple && group) {
      target = Math.ceil(volume / group.quantity_multiple) * group.quantity_multiple;
    }
    if (target !== null && group) {
      target = Math.ceil(target / group.quantity_multiple) * group.quantity_multiple;
    }
    const missingUnits = target === null ? 0 : target - volume;
    if (target !== null && (missingUnits < 1 || quantity + missingUnits > 5000)) {
      target = null;
    }

    const currentTier = findTierForQuantity(product.pricing.tiers, volume);
    const currentSavingsCents = savingsForProduct(product, quantity, currentTier);
    const nextPrice = target === null ? null :
      priceRangeForTier(findTierForQuantity(product.pricing.tiers, target));
    const extraSavingEligible = target !== null && !minimumToReach && !needsPackingMultiple;
    const relevantProducts = group
      ? selected.filter((line) => group.product_ids.includes(line.id))
      : [product];
    const nextDiscountCents = extraSavingEligible && target !== null
      ? nextTierDiscountCents(relevantProducts.map((line) => ({
          tiers: line.pricing.tiers,
          quantity: quantities[line.id] ?? 0,
          addedQuantity: line.id === product.id ? missingUnits : 0,
        })), volume, target)
      : null;

    return {
      missingUnits: target === null ? 0 : target - volume,
      targetQuantity: target,
      nextUnitPrice: nextPrice ? formatPriceRange(nextPrice.min, nextPrice.max) : null,
      currentSavingsCents,
      nextDiscountCents,
      grouped: Boolean(group),
      minimumToReach,
      needsPackingMultiple,
    };
  };

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return products
      .filter((product) => (
        (brandFilter === "all" || product.brand_slug === brandFilter) &&
        [
          product.brand_name, product.name, product.sku, product.ean ?? "",
          product.description, product.format,
        ].some((value) => value.toLocaleLowerCase("fr").includes(normalized))
      ))
      .sort((a, b) => sort === "name"
        ? a.name.localeCompare(b.name, "fr")
        : a.brand_name.localeCompare(b.brand_name, "fr") || a.name.localeCompare(b.name, "fr"));
  }, [products, query, brandFilter, sort]);

  const supplierSummaries = commercialConditions.suppliers
    .map((supplier) => {
      const items = selected.filter((product) => supplier.brand_slugs.includes(product.brand_slug));
      const units = items.reduce((sum,product) => sum + (quantities[product.id] ?? 0), 0);
      let minHt = 0;
      let maxHt = 0;
      let allPriced = items.length > 0;
      let allFirm = items.length > 0;
      for (const product of items) {
        const quantity = quantities[product.id] ?? 0;
        const tier = findTierForQuantity(product.pricing.tiers,effectiveTierQuantity(product,quantity));
        const range = priceRangeForTier(tier);
        if (!range) { allPriced = false; allFirm = false; continue; }
        if (product.pricing.mode !== "contractual" || !tier || !("price_ht" in tier)) allFirm = false;
        minHt += Math.round(range.min * 100) * quantity / 100;
        maxHt += Math.round(range.max * 100) * quantity / 100;
      }
      const gift = [...(supplier.conditions_verified ? supplier.gift_rules : [])]
        .filter((rule) => units >= rule.minimum_order_units)
        .sort((a,b)=>b.minimum_order_units-a.minimum_order_units)[0] ?? null;
      const missingUnits = supplier.conditions_verified && supplier.minimum_order_units
        ? Math.max(0,supplier.minimum_order_units-units) : 0;
      const missingHt = supplier.conditions_verified && supplier.minimum_order_ht && allFirm
        ? Math.max(0,supplier.minimum_order_ht-maxHt) : 0;
      const shipping = supplier.conditions_verified && allFirm
        ? supplier.free_shipping_from_ht !== null && minHt >= supplier.free_shipping_from_ht
          ? "Franco atteint"
          : supplier.shipping_fee_ht !== null
            ? "Port indicatif : "+euroHT(supplier.shipping_fee_ht)+" HT"
            : "Frais de livraison à confirmer"
        : "Frais de livraison à confirmer";
      return { ...supplier,items,units,minHt,maxHt,allPriced,allFirm,gift,missingUnits,missingHt,shipping };
    })
    .filter((summary) => summary.items.length > 0);
  const supplierErrors = supplierSummaries.flatMap((supplier) => [
    ...(supplier.missingUnits > 0
      ? [`${supplier.name} : encore ${supplier.missingUnits} unité(s) pour atteindre le minimum fournisseur.`] : []),
    ...(supplier.missingHt > 0
      ? [`${supplier.name} : encore ${euroHT(supplier.missingHt)} HT pour atteindre le minimum fournisseur.`] : []),
  ]);
  const valid = groupErrors.length === 0 && supplierErrors.length === 0 && selected.every((product) =>
    isAllowedQuantity(quantities[product.id], product.min_quantity),
  );
  const allContractual = selected.length > 0 && selected.every((product) => {
    const tier = findTierForQuantity(product.pricing.tiers,
      effectiveTierQuantity(product, quantities[product.id]));
    return product.pricing.mode === "contractual" && tier !== null && "price_ht" in tier;
  });

  const priceSummary = useMemo(() => {
    let minCents = 0;
    let maxCents = 0;
    let unpriced = 0;
    let priced = 0;
    let savingsCents = 0;
    for (const product of selected) {
      const quantity = quantities[product.id] ?? 0;
      const tier = findTierForQuantity(product.pricing.tiers,
        effectiveTierQuantity(product, quantity));
      const range = priceRangeForTier(tier);
      if (!range) {
        unpriced += 1;
        continue;
      }
      priced += 1;
      minCents += Math.round(range.min * 100) * quantity;
      maxCents += Math.round(range.max * 100) * quantity;
      savingsCents += savingsForProduct(product, quantity, tier) ?? 0;
    }
    return { minCents, maxCents, unpriced, priced, savingsCents };
  }, [selected, quantities]);

  const selectedByBrand = useMemo(() => {
    const groups = new Map<string, { brandName: string; items: PrivateMultiBrandProduct[] }>();
    for (const product of selected) {
      const group = groups.get(product.brand_slug) ?? {
        brandName: product.brand_name,
        items: [],
      };
      group.items.push(product);
      groups.set(product.brand_slug, group);
    }
    return [...groups.entries()]
      .map(([slug, group]) => ({ slug, ...group }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName, "fr"));
  }, [selected]);

  const quantityTotal = selected.reduce((sum, product) => sum + (quantities[product.id] ?? 0), 0);
  const maxReferencesReached = selected.length >= 40;
  const priceSummaryTitle = selected.length === 0
    ? "Total estimé HT"
    : allContractual ? "Total HT" : "Estimation HT";
  const priceSummaryValue = selected.length === 0
    ? "—"
    : priceSummary.priced > 0
      ? `${formatPriceRange(priceSummary.minCents / 100, priceSummary.maxCents / 100)} HT${priceSummary.unpriced > 0 ? ` + ${priceSummary.unpriced} référence(s) à chiffrer` : ""}`
      : "À chiffrer";

  const setQuantity = (product: PrivateMultiBrandProduct, next: number) => {
    const safeNext = Number.isFinite(next) ? Math.max(0, Math.min(5000, next)) : 0;
    setSaveStatus("saving");
    setQuantities((previous) => ({ ...previous, [product.id]: safeNext }));
  };

  const reorder = (request: ReorderRequest) => {
    const allowed = new Map(products.map((product) => [product.id, product]));
    const next = { ...quantities };
    let eligible = 0;
    for (const line of request.items) {
      const product = allowed.get(line.product_id);
      if (!product || !Number.isSafeInteger(line.quantity) || line.quantity < 1) continue;
      if (!next[product.id] && Object.values(next).filter((v) => v > 0).length >= 40) {
        setReorderMessage("Le panier est limité à 40 références. Retirez des produits avant ce réassort.");
        return;
      }
      next[product.id] = Math.max(product.min_quantity, Math.min(5000, line.quantity));
      eligible++;
    }
    if (!eligible) {
      setReorderMessage("Aucune référence de cette demande n'est encore disponible.");
      return;
    }
    setQuantities(next);
    setSaveStatus("saving");
    setReorderMessage(`${eligible} référence${eligible > 1 ? "s" : ""} reprise${eligible > 1 ? "s" : ""} dans le panier. Les tarifs actuels ont été recalculés.`);
  };

  const add = (product: PrivateMultiBrandProduct) => {
    const current = quantities[product.id] ?? 0;
    if (current === 0 && selected.length >= 40) return;
    setQuantity(product, current === 0 ? product.min_quantity : current + 1);
  };

  const subtract = (product: PrivateMultiBrandProduct) => {
    const current = quantities[product.id] ?? 0;
    setQuantity(product, current <= product.min_quantity ? 0 : current - 1);
  };

  return (
    <form action={action} className="space-y-5 pb-24 lg:pb-0">
      <section id="reassort" className="scroll-mt-6 rounded-xl border border-[#dce3e5] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#ad4b08]">Votre approvisionnement</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#142941]">Réassort express ou catalogue</h2>
            <p className="mt-1 text-xs text-[#69717d]">
              {saveStatus === "saving" ? "Enregistrement automatique du panier…" :
                saveStatus === "error" ? "La sauvegarde a échoué. Vérifiez votre connexion." :
                selected.length ? "Panier sauvegardé · retrouvez-le à votre prochaine connexion." :
                "Vos sélections sont sauvegardées automatiquement."}
            </p>
          </div>
          <div role="group" aria-label="Choisir le parcours d'achat" className="inline-flex rounded-lg border border-[#e2e7ec] bg-[#f8f9f9] p-1">
            <button type="button" onClick={() => setBuyerView("reorder")}
              aria-pressed={buyerView === "reorder"}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-bold ${buyerView === "reorder" ? "bg-[#142941] text-white" : "text-[#142941] hover:bg-white"}`}>
              <RotateCcw size={15} /> Réassort express
            </button>
            <button type="button" onClick={() => setBuyerView("catalogue")}
              aria-pressed={buyerView === "catalogue"}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-bold ${buyerView === "catalogue" ? "bg-[#142941] text-white" : "text-[#142941] hover:bg-white"}`}>
              <LayoutGrid size={15} /> Catalogue
            </button>
          </div>
        </div>
      </section>

      <div className={buyerView === "catalogue"
        ? "grid gap-3 rounded-xl border border-[#e2e7ec] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px_150px] sm:p-4"
        : "hidden"}>
        <label className="flex items-center gap-3 rounded-lg border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <Search size={18} className="shrink-0 text-[#69717d]" aria-hidden="true" />
          <span className="sr-only">Rechercher un produit, EAN ou référence</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Produit, marque, EAN, référence…"
            className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#69717d]" />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <span className="sr-only">Filtrer par marque</span>
          <select className="min-h-11 w-full bg-transparent text-xs font-bold outline-none"
            value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
            <option value="all">Toutes les marques</option>
            {brandOptions.map((brand) => <option key={brand.slug} value={brand.slug}>{brand.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[#e2e7ec] bg-[#faf9f6] px-3">
          <SlidersHorizontal size={16} className="shrink-0 text-[#69717d]" aria-hidden="true" />
          <span className="sr-only">Trier les produits</span>
          <select className="min-h-11 w-full bg-transparent text-xs font-bold outline-none"
            value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="brand">Par marque</option>
            <option value="name">Nom A–Z</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-[#e7c8b4] bg-[#fff5ee] p-3 text-xs font-semibold text-[#884c2b]">{state.error}</p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {buyerView === "reorder" ? (
          <section className="min-w-0 space-y-3 rounded-xl border border-[#e2e7ec] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[#142941]">Reprendre une sélection</h3>
                <p className="mt-1 text-xs leading-5 text-[#69717d]">
                  Les quantités sont reprises. Les tarifs et les conditions sont recalculés avec les prix actuels.
                </p>
              </div>
              <span className="rounded-full bg-[#f5f6f6] px-3 py-1 text-[10px] font-semibold text-[#69717d]">
                {reorderHistory.length} demande{reorderHistory.length > 1 ? "s" : ""} récente{reorderHistory.length > 1 ? "s" : ""}
              </span>
            </div>
            {reorderMessage ? (
              <p role="status" className="rounded-lg border border-[#bfd7c5] bg-[#f0f8f2] p-3 text-xs font-semibold text-[#325842]">
                {reorderMessage} <a href="#panier" className="ml-1 underline underline-offset-2">Voir le panier</a>
              </p>
            ) : null}
            {reorderHistory.length ? (
              <div className="space-y-3">
                {reorderHistory.map((request) => (
                  <article key={request.id} className="rounded-lg border border-[#e2e7ec] p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#142941]">{request.brand_name}</p>
                        <p className="mt-1 text-[10px] text-[#69717d]">
                          {new Date(request.created_at).toLocaleDateString("fr-FR")} · {request.items.length} référence{request.items.length > 1 ? "s" : ""}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#4e5c66]">
                          {request.items.slice(0, 3).map((item) => `${item.name} × ${item.quantity}`).join(" · ")}
                          {request.items.length > 3 ? ` · +${request.items.length - 3} autre${request.items.length - 3 > 1 ? "s" : ""}` : ""}
                        </p>
                      </div>
                      <button type="button" onClick={() => reorder(request)}
                        className="shop-primary-action inline-flex min-h-10 items-center gap-2 px-3 text-xs font-bold">
                        <RotateCcw size={15} /> Reprendre cette sélection
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#dce3ea] bg-[#f9faf9] px-5 py-8 text-center">
                <ShoppingBag size={27} className="mx-auto text-[#a2aeb6]" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-[#142941]">Vos réassorts apparaîtront ici après votre première demande.</p>
                <p className="mt-2 text-xs text-[#69717d]">En attendant, sélectionnez vos produits dans le catalogue.</p>
                <button type="button" onClick={() => setBuyerView("catalogue")}
                  className="shop-primary-action mt-4 inline-flex min-h-10 items-center gap-2 px-4 text-xs">
                  Parcourir les produits <ArrowRight size={15}/>
                </button>
              </div>
            )}
          </section>
        ) : (
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#69717d]">
            <div>
              <p className="font-semibold">{visible.length} références affichées · {selected.length} sélectionnées · 40 maximum</p>
              <p className="mt-1">Tarifs HT · Minimum par référence</p>
            </div>
            <div role="group" aria-label="Mode d'affichage des produits"
              className="inline-flex items-center rounded-lg border border-[#dce3ea] bg-white p-1">
              <button type="button" onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"}
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${viewMode === "cards" ? "bg-[#0e1d31] text-white shadow-sm" : "text-[#526071] hover:bg-[#f3f5f6]"}`}>
                <LayoutGrid size={15} aria-hidden="true" /> Cartes
              </button>
              <button type="button" onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"}
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${viewMode === "list" ? "bg-[#0e1d31] text-white shadow-sm" : "text-[#526071] hover:bg-[#f3f5f6]"}`}>
                <List size={16} aria-hidden="true" /> Liste
              </button>
            </div>
          </div>

          <div id="liste-produits" className="space-y-2">
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visible.map((product) => {
                  const quantity = quantities[product.id] ?? 0;
                  const referenceQuantity = quantity || product.min_quantity;
                  const tier = findTierForQuantity(product.pricing.tiers, effectiveTierQuantity(product, referenceQuantity));
                  const lineTotal = lineTotalHT(priceRangeForTier(tier), quantity);
                  const price = product.pricing.mode === "contractual" && tier && "price_ht" in tier
                    ? euroHT(tier.price_ht) + " HT / unité"
                    : indicativeRange(tier && "price_min_ht" in tier ? tier : null);

                  return (
                    <article key={product.id}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e2e7ec] bg-white transition hover:border-[#cbd5d6] hover:shadow-[0_12px_28px_-24px_rgba(14,29,49,.45)]">
                      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[#f5f2ec] p-4">
                        {product.image_url ? (
                          <Image src={product.image_url} width={420} height={320} unoptimized alt={product.name}
                            className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" />
                        ) : <Package size={42} strokeWidth={1.1} className="text-[#a9b0b3]" aria-hidden="true" />}
                        <span className="absolute left-3 top-3 max-w-[80%] truncate rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#ad4b08] backdrop-blur">
                          {product.brand_name}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-3.5">
                        <div className="min-h-[86px]">
                          <h3 className="text-sm font-extrabold leading-5 text-[#0e1d31]">{product.name}</h3>
                          <p className="mt-1.5 text-[11px] text-[#69717d]">{product.format || "Format non renseigné"}</p>
                          <p className="mt-1 break-all text-[10px] text-[#89939b]">
                            Réf. {product.sku}{product.ean ? " · EAN " + product.ean : ""}
                          </p>
                        </div>

                        <div className="mt-3 border-t border-[#edf0f1] pt-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#7a8790]">
                                {product.pricing.mode === "contractual" ? "Votre tarif HT" : "Prix indicatif HT"}
                              </p>
                              <p className="mt-1 text-sm font-black leading-5 text-[#0e1d31]">{price}</p>
                              <p className="mt-1 text-[10px] text-[#69717d]">
                                {tier ? "Palier dès " + tier.min_quantity + " u." : "Tarif à confirmer"} · {groupByProduct.has(product.id) ? "Minimum collectif " + groupByProduct.get(product.id)!.minimum_total_units + " u." : "Min. " + product.min_quantity + " u."}
                              </p>
                              {lineTotal ? <p className="mt-1 text-[11px] font-bold text-[#142941]">Total ligne : {lineTotal} HT</p> : null}
                            </div>
                            <span className="shrink-0 rounded-md bg-[#f5f6f6] px-2 py-1 text-[9px] font-semibold text-[#69717d]">
                              TVA {product.vat_rate} %
                            </span>
                          </div>
                        </div>

                        <div className="mt-auto space-y-3 pt-4">
                          {product.product_detail_href ? (
                            <Link href={product.product_detail_href}
                              className="inline-flex min-h-8 items-center text-xs font-bold text-[#142941] underline underline-offset-4 hover:text-[#a14e14]">
                              Fiche produit
                            </Link>
                          ) : null}
                          <ProductQuantityControl
                            product={product}
                            quantity={quantity}
                            maxReferencesReached={maxReferencesReached}
                            tierOffer={tierOfferForProduct(product, quantity)}
                            onAdd={() => add(product)}
                            onSubtract={() => subtract(product)}
                            onSetQuantity={(next) => setQuantity(product, next)}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden items-center gap-3 rounded-lg bg-[#f4f5f5] px-4 py-2 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7a8790] md:grid md:grid-cols-[64px_minmax(0,1fr)_140px_260px]">
                  <span>Visuel</span>
                  <span>Produit / référence</span>
                  <span>Tarif HT</span>
                  <span className="text-right">Quantité</span>
                </div>
                {visible.map((product) => {
                  const quantity = quantities[product.id] ?? 0;
                  const referenceQuantity = quantity || product.min_quantity;
                  const tier = findTierForQuantity(product.pricing.tiers, effectiveTierQuantity(product, referenceQuantity));
                  const lineTotal = lineTotalHT(priceRangeForTier(tier), quantity);
                  const price = product.pricing.mode === "contractual" && tier && "price_ht" in tier
                    ? euroHT(tier.price_ht) + " HT / unité"
                    : indicativeRange(tier && "price_min_ht" in tier ? tier : null);

                  return (
                    <article key={product.id}
                      className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border border-[#e2e7ec] bg-white p-3 transition hover:border-[#cbd5d6] md:grid-cols-[64px_minmax(0,1fr)_140px_260px] md:gap-3 md:px-4">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-[#f5f2ec] md:h-14 md:w-14">
                        {product.image_url ? (
                          <Image src={product.image_url} width={112} height={112} unoptimized alt={product.name}
                            className="h-full w-full object-contain p-1.5" />
                        ) : <Package size={25} strokeWidth={1.2} className="text-[#a9b0b3]" aria-hidden="true" />}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-extrabold uppercase tracking-[.12em] text-[#ad4b08]">{product.brand_name}</p>
                        <h3 className="mt-0.5 text-xs font-extrabold leading-4 text-[#0e1d31]">{product.name}</h3>
                        <p className="mt-1 text-[10px] leading-4 text-[#69717d]">
                          {product.format || "Format non renseigné"} · Réf. {product.sku}
                        </p>
                        <p className="break-all text-[9px] leading-4 text-[#89939b]">
                          {product.ean ? "EAN " + product.ean + " · " : ""}{groupByProduct.has(product.id) ? "Minimum groupe "+groupByProduct.get(product.id)!.minimum_total_units+" u." : "Min. "+product.min_quantity+" u."} · TVA {product.vat_rate} %
                        </p>
                        {product.product_detail_href ? (
                          <Link href={product.product_detail_href}
                            className="mt-1 inline-flex min-h-6 items-center text-[10px] font-bold text-[#142941] underline underline-offset-2 hover:text-[#a14e14]">
                            Fiche produit
                          </Link>
                        ) : null}
                      </div>

                      <div className="col-span-2 flex items-center justify-between gap-3 border-t border-[#edf0f1] pt-2 md:col-span-1 md:block md:border-0 md:pt-0">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wide text-[#7a8790]">
                            {product.pricing.mode === "contractual" ? "Votre tarif HT" : "Prix indicatif HT"}
                          </p>
                          <p className="mt-0.5 text-xs font-black text-[#0e1d31]">{price}</p>
                          {tier ? <p className="mt-0.5 text-[9px] text-[#69717d]">Palier dès {tier.min_quantity} u.</p> : null}
                          {lineTotal ? <p className="mt-1 text-[10px] font-bold text-[#142941]">Total : {lineTotal} HT</p> : null}
                        </div>
                      </div>

                      <div className="col-span-2 flex min-w-0 items-center justify-end md:col-span-1">
                        <ProductQuantityControl
                          product={product}
                          quantity={quantity}
                          maxReferencesReached={maxReferencesReached}
                          compact
                          tierOffer={tierOfferForProduct(product, quantity)}
                          onAdd={() => add(product)}
                          onSubtract={() => subtract(product)}
                          onSetQuantity={(next) => setQuantity(product, next)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {selected.filter((product) => !visible.some((item) => item.id === product.id)).map((product) => (
              <input key={product.id} type="hidden" name={"quantity_" + product.id} value={quantities[product.id]} />
            ))}
          </div>

          {!visible.length ? (
            <div className="rounded-xl border border-dashed border-[#dce3ea] bg-white px-5 py-12 text-center">
              <Package size={30} className="mx-auto text-[#b4b8b7]" aria-hidden="true" />
              <p className="mt-3 text-sm font-extrabold">Aucune référence trouvée.</p>
              <button type="button" onClick={() => { setQuery(""); setBrandFilter("all"); }}
                className="mt-3 text-xs font-semibold underline">Afficher toutes les références</button>
            </div>
          ) : null}

          {!products.length ? <p className="rounded-lg bg-white p-6 text-sm">Aucune référence disponible pour le moment.</p> : null}
        </div>
        )}
        {buyerView === "reorder" ? selected.map((product) => (
          <input key={product.id} type="hidden" name={"quantity_" + product.id} value={quantities[product.id]} />
        )) : null}

        <aside id="panier" aria-label="Panier multimarque" className="scroll-mt-6 overflow-hidden rounded-xl border border-[#e2e7ec] bg-white shadow-[0_16px_35px_-25px_rgba(20,52,40,.3)] lg:sticky lg:top-6">
          <div className="flex items-center gap-3 bg-[#0e1d31] px-5 py-5 text-white">
            <ShoppingBag size={23} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black">Mon panier</h2>
              <p className="text-xs text-[#d5dde7]">{selected.length} référence{selected.length > 1 ? "s" : ""} · {quantityTotal} unité{quantityTotal > 1 ? "s" : ""} · {selectedByBrand.length} marque{selectedByBrand.length > 1 ? "s" : ""}</p>
            </div>
            {selected.length ? (
              <button type="button" onClick={() => { setSaveStatus("saving"); setQuantities({}); }}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Vider le panier">
                <Trash2 size={18} />
              </button>
            ) : null}
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {selected.length ? (
              <div className="max-h-[55vh] space-y-4 overflow-auto">
                {selectedByBrand.map((group) => {
                  const firm = group.items.every((product) => {
                    const tier = findTierForQuantity(product.pricing.tiers, effectiveTierQuantity(product, quantities[product.id]));
                    return product.pricing.mode === "contractual" && tier !== null && "price_ht" in tier;
                  });
                  return (
                    <section key={group.slug} className="space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7ec] pb-2">
                        <h3 className="text-xs font-extrabold text-[#0e1d31]">{group.brandName}</h3>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#ad4b08]">
                          {firm ? "Commande à confirmer" : "Conditions à confirmer"}
                        </span>
                      </div>
                      {group.items.map((product) => {
                        const quantity = quantities[product.id];
                        const tier = findTierForQuantity(product.pricing.tiers,effectiveTierQuantity(product,quantity));
                        const range = priceRangeForTier(tier);
                        const savings = savingsForProduct(product, quantity, tier);
                        return (
                          <div key={product.id} className="border-b border-[#f0f1f1] pb-2 text-xs last:border-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-[#0e1d31]">{product.name}</p>
                                <p className="mt-1 text-[#69717d]">{quantity} unité{quantity > 1 ? "s" : ""} · Réf. {product.sku}</p>
                                <p className="mt-1 text-[10px] text-[#69717d]">
                                  {range ? formatPriceRange(range.min, range.max) + " HT / unité" : "Tarif à confirmer"}
                                </p>
                                {savings !== null && savings > 0 ? (
                                  <p className="mt-1 text-[10px] font-semibold text-[#54705e]">Économie estimée : {euroHT(savings / 100)} HT</p>
                                ) : null}
                              </div>
                              <strong className="shrink-0 text-right">
                                {lineTotalHT(range, quantity) ? lineTotalHT(range, quantity) + " HT" : "Sur devis"}
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ShoppingCart size={31} strokeWidth={1.5} className="text-[#b4b8b7]" aria-hidden="true" />
                <p className="text-sm font-bold text-[#69717d]">Votre panier est vide.</p>
                <p className="text-xs text-[#69717d]">Ajoutez des références de plusieurs marques sans quitter cette page.</p>
              </div>
            )}

            {selected.length ? (
              <section className="space-y-2 rounded-xl border border-[#dce3ea] bg-[#f9faf9] p-3" aria-label="Conditions commerciales du panier">
                <h3 className="text-xs font-black text-[#142941]">Conditions commerciales</h3>
                {volumeGroups.filter((group) => (groupTotals.get(group.id) ?? 0)>0).map((group) => {
                  const total = groupTotals.get(group.id) ?? 0;
                  const nextTier = [...new Set(group.product_ids.flatMap((productId) =>
                    products.find((product) => product.id===productId)?.pricing.tiers
                      .map((tier) => tier.min_quantity) ?? []
                  ))].filter((threshold) => threshold>total).sort((a,b)=>a-b)[0];
                  return (
                    <div key={group.id} className="text-[11px] leading-5 text-[#586672]">
                      <p className="font-bold">{group.name} : {total} / {group.minimum_total_units} masques minimum</p>
                      <p>Paliers cumulés sur les références du groupe · multiple de {group.quantity_multiple} masques au total</p>
                      {nextTier ? <p>Prochain palier : {nextTier} masques ({nextTier-total} supplémentaires).</p> : null}
                    </div>
                  );
                })}
                {supplierSummaries.map((supplier) => (
                  <div key={supplier.id} className="border-t border-[#e2e7ec] pt-2 text-[11px] leading-5 text-[#586672]">
                    <p className="font-bold text-[#142941]">{supplier.name} · {supplier.units} unités</p>
                    {supplier.conditions_verified ? (
                      <>
                        {supplier.minimum_order_units !== null ? <p>Minimum : {supplier.minimum_order_units} unités cumulées</p> : null}
                        {supplier.minimum_order_ht !== null ? (
                          <p>Minimum de commande : {euroHT(supplier.minimum_order_ht)} HT{supplier.allFirm ? "" : " · à confirmer lors du devis"}</p>
                        ) : null}
                        <p>{supplier.shipping}</p>
                        {supplier.free_shipping_from_ht !== null ? <p>Franco dès {euroHT(supplier.free_shipping_from_ht)} HT</p> : null}
                        {supplier.gift ? <p>Offre indicative : {supplier.gift.free_units} unité(s) offerte(s){supplier.gift.description ? " · "+supplier.gift.description : ""}</p> : null}
                      </>
                    ) : <p>Conditions fournisseur non confirmées : livraison, franco et gratuités à valider.</p>}
                  </div>
                ))}
                {supplierSummaries.length === 0 ? (
                  <p className="text-[11px] text-[#69717d]">Livraison, franco et unités gratuites : conditions fournisseurs à confirmer. Aucune offre non vérifiée n'est appliquée.</p>
                ) : null}
                {[...groupErrors,...supplierErrors].map((message) => (
                  <p key={message} role="alert" className="rounded-md bg-[#fff1e6] p-2 text-[11px] font-bold text-[#8c4212]">{message}</p>
                ))}
              </section>
            ) : null}

            <div className="flex items-start justify-between gap-2 border-t border-[#e2e7ec] pt-4">
              <div>
                <p className="text-xs text-[#69717d]">{priceSummaryTitle}</p>
                <p className="mt-1 text-xl font-black text-[#0e1d31]" aria-live="polite">{priceSummaryValue}</p>
                {priceSummary.savingsCents > 0 ? (
                  <p className="mt-1 text-xs font-bold text-[#54705e]" aria-live="polite">Économie estimée sur les paliers : {euroHT(priceSummary.savingsCents / 100)} HT</p>
                ) : null}
              </div>
              <span className="rounded-full bg-[#fff1e6] px-2.5 py-1 text-[10px] font-bold text-[#162a45]">B2B</span>
            </div>

            <button type="submit" disabled={pending || !selected.length || !valid}
              className="shop-primary-action inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm">
              {pending ? "Transmission en cours…" : "Transmettre mes demandes"}
              {!pending && <ShoppingBag size={17} aria-hidden="true" />}
            </button>
            <p className="text-[11px] leading-5 text-[#69717d]">
              Économies calculées à quantité égale par rapport au premier palier de chaque référence, hors livraison. Une demande est créée par marque ; les prix indicatifs et disponibilités sont confirmés avant validation.
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dce3ea] bg-white/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-20px_rgba(14,29,49,.35)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold text-[#0e1d31]">
              {selected.length} réf. · {quantityTotal} unité{quantityTotal > 1 ? "s" : ""}
            </p>
            <p className="truncate text-[11px] text-[#69717d]">{priceSummaryValue}</p>
            {priceSummary.savingsCents > 0 ? <p className="truncate text-[10px] font-semibold text-[#54705e]">Économie estimée : {euroHT(priceSummary.savingsCents / 100)} HT</p> : null}
          </div>
          <a href="#panier" className="shrink-0 px-2 py-2 text-xs font-bold text-[#0e1d31] underline underline-offset-4">Panier</a>
          <button type="submit" disabled={pending || !selected.length || !valid}
            aria-label="Transmettre mes demandes"
            className="shop-primary-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-xs">
            {pending ? "Envoi…" : "Transmettre"}
            {!pending && <ShoppingBag size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </form>
  );
}

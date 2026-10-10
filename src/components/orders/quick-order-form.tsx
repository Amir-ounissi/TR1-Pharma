"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Minus, PackagePlus, Plus, RotateCcw, Search, X } from "lucide-react";
import {
  createOrderAction,
  searchOrderPharmaciesAction,
  type OrderPharmacySearchResult,
} from "@/app/(protected)/dashboard/orders/actions";
import { getOrderPharmacyPricingAction } from "@/app/(protected)/dashboard/orders/pricing-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { useLocalOrderDraft } from "@/components/orders/use-local-order-draft";
import { OrderSubmittingStatus } from "@/components/orders/order-submitting-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uiLabel } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

type ProductOption = {
  id: string;
  name: string;
  detail?: string;
  ean?: string | null;
  price?: number | null;
  taxRate?: number | null;
  unitsPerCase?: number | null;
  minimumOrderQuantity?: number | null;
};

type FreeUnitsRule = {
  paidQuantity: number;
  freeQuantity: number;
  label: string;
};

export type QuickOrderItem = {
  productId: string;
  quantity: number;
  freeQuantity: number;
  unitPriceHt: number | string;
  discountRate?: number | string | null;
};

type DraftLine = {
  key: string;
  productId: string;
  quantity: number;
  freeQuantity: number;
  commercialFreeQuantity: number;
  manualFreeQuantity: number;
  freeClassification: string;
  unitPriceHt: string;
  discountRate: string;
};

const NAALI_UG_CLASSIFICATIONS = [
  "compensation opé promo",
  "offre exceptionnelle sell-in",
  "geste commercial",
  "échange périmé",
  "échange déféctueux",
  "litige logistique",
  "cadeau challenge",
  "ne pas renseigner",
] as const;

function localDateTimeNow() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function freeQuantityFor(quantity: number, rule: FreeUnitsRule | null) {
  if (!rule || quantity <= 0) return 0;
  return Math.floor(quantity / rule.paidQuantity) * rule.freeQuantity;
}

function PharmacyAutocomplete({
  initialPharmacy,
  onSelectionChange,
}: {
  initialPharmacy?: OrderPharmacySearchResult;
  onSelectionChange: (
    changedFromInitial: boolean,
    pharmacy?: OrderPharmacySearchResult,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderPharmacySearchResult[]>([]);
  const [selected, setSelected] = useState<OrderPharmacySearchResult | undefined>(
    initialPharmacy,
  );
  const [loading, setLoading] = useState(false);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      setResults(await searchOrderPharmaciesAction(value));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="quick-order-pharmacy">Pharmacie</Label>
      <Input
        id="quick-order-pharmacy"
        value={selected ? selected.name : query}
        placeholder="Nom, ville, CIP ou SIRET…"
        autoComplete="off"
        onChange={(event) => {
          if (selected) onSelectionChange(Boolean(initialPharmacy), undefined);
          setSelected(undefined);
          void search(event.target.value);
        }}
      />
      <input
        type="hidden"
        name="brandPharmacyId"
        value={selected?.brandPharmacyId ?? ""}
      />
      <input
        type="hidden"
        name="pharmacyId"
        value={selected?.brandPharmacyId ? "" : selected?.pharmacyId ?? ""}
      />
      {selected ? (
        <p className="text-xs text-muted-foreground">
          {selected.detail}
          {selected.relationStatus === "existing_brand_relation"
            ? " · Déjà cliente"
            : " · Nouvelle pour la marque"}
        </p>
      ) : null}
      {!selected && results.length ? (
        <div className="max-h-56 overflow-auto rounded-xl border bg-popover p-1 shadow-sm">
          {results.map((result) => (
            <button
              key={result.pharmacyId}
              type="button"
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                setSelected(result);
                setQuery("");
                setResults([]);
                onSelectionChange(
                  Boolean(
                    initialPharmacy &&
                      result.brandPharmacyId !== initialPharmacy.brandPharmacyId,
                  ),
                  result,
                );
              }}
            >
              <span className="font-semibold">{result.name}</span>
              <span className="block text-xs text-muted-foreground">
                {result.detail}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <p className="text-xs text-muted-foreground">Recherche…</p>
      ) : null}
    </div>
  );
}

export function QuickOrderForm({
  products,
  initialPharmacy,
  lastOrderItems = [],
  initialProductId,
  initialOrderType = "other",
  initialDiscountRate = null,
  initialPotential = null,
  initialFreeUnitsRule = null,
  isAgent = false,
  draftScope,
}: {
  products: ProductOption[];
  initialPharmacy?: OrderPharmacySearchResult;
  lastOrderItems?: QuickOrderItem[];
  initialProductId?: string;
  initialOrderType?: string;
  initialDiscountRate?: number | null;
  initialPotential?: string | null;
  initialFreeUnitsRule?: FreeUnitsRule | null;
  isAgent?: boolean;
  draftScope: string;
}) {
  const [state, action, pending] = useActionState(createOrderAction, {});
  const initialProduct = products.find((product) => product.id === initialProductId);
  const initialMinimum = Math.max(1, initialProduct?.minimumOrderQuantity ?? 1);
  const [defaultDiscountRate, setDefaultDiscountRate] = useState<number | null>(
    initialDiscountRate,
  );
  const [potential, setPotential] = useState<string | null>(initialPotential);
  const [freeUnitsRule, setFreeUnitsRule] = useState<FreeUnitsRule | null>(
    initialFreeUnitsRule,
  );
  const [pricingLoading, setPricingLoading] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() => [
    {
      key: "line-1",
      productId: initialProduct?.id ?? "",
      quantity: initialProduct ? initialMinimum : 1,
      freeQuantity: initialProduct
        ? freeQuantityFor(initialMinimum, initialFreeUnitsRule)
        : 0,
      commercialFreeQuantity: initialProduct
        ? freeQuantityFor(initialMinimum, initialFreeUnitsRule)
        : 0,
      manualFreeQuantity: 0,
      freeClassification: "",
      unitPriceHt:
        initialProduct?.price == null ? "" : String(initialProduct.price),
      discountRate:
        initialDiscountRate == null ? "" : String(initialDiscountRate),
    },
  ]);
  const [orderType, setOrderType] = useState(initialOrderType);
  const [initialContextChanged, setInitialContextChanged] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [draftPharmacyId, setDraftPharmacyId] = useState(
    initialPharmacy?.brandPharmacyId ?? initialPharmacy?.pharmacyId ?? "unselected",
  );
  const { restored } = useLocalOrderDraft({
    scope: `${draftScope}:${draftPharmacyId}`,
    mode: "desktop",
    productIds: products.map((item) => item.id),
    lines,
    setLines,
    orderType,
    setOrderType,
    completed: Boolean(state.success && state.orderId),
  });


  function defaultDiscountValue() {
    return defaultDiscountRate == null ? "" : String(defaultDiscountRate);
  }

  function openProductPicker() {
    setPickerQuery("");
    setPickerSelection(
      lines.map((line) => line.productId).filter((productId) => Boolean(productId)),
    );
    setPickerOpen(true);
  }

  function toggleProduct(productId: string) {
    setPickerSelection((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function applyProductSelection() {
    setLines((current) => {
      const byProduct = new Map(
        current
          .filter((line) => line.productId)
          .map((line) => [line.productId, line]),
      );

      return products
        .filter((product) => pickerSelection.includes(product.id))
        .map((product) => {
          const existing = byProduct.get(product.id);
          if (existing) return existing;

          const quantity = Math.max(1, product.minimumOrderQuantity ?? 1);
          const commercialFreeQuantity = freeQuantityFor(quantity, freeUnitsRule);
          return {
            key: crypto.randomUUID(),
            productId: product.id,
            quantity,
            freeQuantity: commercialFreeQuantity,
            commercialFreeQuantity,
            manualFreeQuantity: 0,
            freeClassification: "",
            unitPriceHt: product.price == null ? "" : String(product.price),
            discountRate: defaultDiscountValue(),
          };
        });
    });
    setPickerOpen(false);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function updateLineQuantity(index: number, quantity: number) {
    const commercialFreeQuantity = freeQuantityFor(quantity, freeUnitsRule);
    setLines((current) => current.map((line, lineIndex) =>
      lineIndex === index
        ? { ...line, quantity, commercialFreeQuantity, freeQuantity: commercialFreeQuantity + line.manualFreeQuantity }
        : line,
    ));
  }

  function updateCommercialFreeQuantity(index: number, commercialFreeQuantity: number) {
    setLines((current) => current.map((line, lineIndex) =>
      lineIndex === index
        ? { ...line, commercialFreeQuantity, freeQuantity: commercialFreeQuantity + line.manualFreeQuantity }
        : line,
    ));
  }

  function updateManualFreeQuantity(index: number, manualFreeQuantity: number) {
    setLines((current) => current.map((line, lineIndex) =>
      lineIndex === index
        ? { ...line, manualFreeQuantity, freeQuantity: line.commercialFreeQuantity + manualFreeQuantity, freeClassification: manualFreeQuantity > 0 ? line.freeClassification : "" }
        : line,
    ));
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    const quantity = Math.max(1, product?.minimumOrderQuantity ?? 1);
    updateLine(index, {
      productId,
      quantity,
      freeQuantity: freeQuantityFor(quantity, freeUnitsRule),
      commercialFreeQuantity: freeQuantityFor(quantity, freeUnitsRule),
      manualFreeQuantity: 0,
      freeClassification: "",
      unitPriceHt: product?.price == null ? "" : String(product.price),
      discountRate: defaultDiscountValue(),
    });
  }

  function resumeLastOrder() {
    if (!lastOrderItems.length || initialContextChanged) return;
    setLines(
      lastOrderItems.map((item, index) => ({
        key: `last-${index}-${item.productId}`,
        productId: item.productId,
        quantity: Math.max(1, Number(item.quantity)),
        freeQuantity: freeQuantityFor(Math.max(1, Number(item.quantity)), freeUnitsRule),
        commercialFreeQuantity: freeQuantityFor(Math.max(1, Number(item.quantity)), freeUnitsRule),
        manualFreeQuantity: 0,
        freeClassification: "",
        unitPriceHt: String(item.unitPriceHt ?? ""),
        discountRate:
          item.discountRate == null ? defaultDiscountValue() : String(item.discountRate),
      })),
    );
    setOrderType("reorder");
  }

  async function loadPharmacyPricing(pharmacy: OrderPharmacySearchResult) {
    setPricingLoading(true);
    try {
      const pricing = await getOrderPharmacyPricingAction(pharmacy.pharmacyId);
      setDefaultDiscountRate(pricing.discountRate);
      setPotential(pricing.potential);
      setFreeUnitsRule(pricing.freeUnitsRule);
      setLines((current) =>
        current.map((line) => ({
          ...line,
          discountRate:
            pricing.discountRate == null ? "" : String(pricing.discountRate),
          commercialFreeQuantity: freeQuantityFor(line.quantity, pricing.freeUnitsRule),
          freeQuantity: freeQuantityFor(line.quantity, pricing.freeUnitsRule) + line.manualFreeQuantity,
        })),
      );
    } finally {
      setPricingLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const query = pickerQuery.trim().toLocaleLowerCase("fr");
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.detail, product.ean]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("fr").includes(query),
        ),
    );
  }, [pickerQuery, products]);

  const totalHt = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const price = Number(line.unitPriceHt);
        const discount = Number(line.discountRate || 0);
        if (!line.productId || !Number.isFinite(price)) return sum;
        return sum + line.quantity * price * (1 - discount / 100);
      }, 0),
    [lines],
  );

  const totalUnits = lines.reduce(
    (sum, line) => sum + (line.productId ? line.quantity + line.freeQuantity : 0),
    0,
  );
  const validLines = lines.filter((line) => line.productId).length;

  return (
    <>
      <form action={action} className="space-y-5">
      <ActionFeedback {...state} />
      <OrderSubmittingStatus />
      {restored ? <p role="status" className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Brouillon local récupéré. Vérifiez les prix et les conditions commerciales avant validation.</p> : null}
      {isAgent ? <input type="hidden" name="orderStatus" value="pending" /> : null}

      <div className="rounded-2xl border bg-muted/20 p-4">
        <PharmacyAutocomplete
          initialPharmacy={initialPharmacy}
          onSelectionChange={(changed, pharmacy) => {
              setDraftPharmacyId(pharmacy?.brandPharmacyId ?? pharmacy?.pharmacyId ?? "unselected");
            setInitialContextChanged(changed);
            if (!pharmacy) {
              setDefaultDiscountRate(null);
              setPotential(null);
              setFreeUnitsRule(null);
            }
            if (changed) {
              setLines([
                {
                  key: crypto.randomUUID(),
                  productId: "",
                  quantity: 1,
                  freeQuantity: 0,
                  commercialFreeQuantity: 0,
                  manualFreeQuantity: 0,
                  freeClassification: "",
                  unitPriceHt: "",
                  discountRate: "",
                },
              ]);
              setOrderType("other");
            }
            if (pharmacy) void loadPharmacyPricing(pharmacy);
          }}
        />
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {pricingLoading ? (
            <span className="text-muted-foreground">Conditions HubSpot…</span>
          ) : (
            <>
              {potential ? <Badge variant="outline">Potentiel {potential}</Badge> : null}
              {defaultDiscountRate != null ? (
                <Badge variant="secondary">Remise pharmacie {defaultDiscountRate}%</Badge>
              ) : null}
              {freeUnitsRule ? (
                <Badge variant="secondary">UG {freeUnitsRule.label} à la ligne</Badge>
              ) : null}
            </>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[var(--tr1-navy)]">Produits</h2>
            <p className="text-xs text-muted-foreground">
              Prix catalogue, remise pharmacie, TVA et UG client sont préchargés automatiquement quand la condition est structurée.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lastOrderItems.length && !initialContextChanged ? (
              <Button type="button" variant="outline" onClick={resumeLastOrder}>
                <RotateCcw className="size-4" /> Reprendre la dernière
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={openProductPicker}>
              <PackagePlus className="size-4" /> Choisir les références
            </Button>
          </div>
        </div>

        {lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId);
          const minimum = Math.max(1, product?.minimumOrderQuantity ?? 1);
          const unitPrice = Number(line.unitPriceHt);
          const discount = Number(line.discountRate || 0);
          const lineTotal =
            Number.isFinite(unitPrice) && line.productId
              ? line.quantity * unitPrice * (1 - discount / 100)
              : null;

          return (
            <div
              key={line.key}
              className="rounded-2xl border bg-background p-3 shadow-sm sm:p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`quick-product-${index}`}>Produit</Label>
                  <Select
                    name="productId"
                    required
                    value={line.productId}
                    onValueChange={(value) => selectProduct(index, value)}
                  >
                    <SelectTrigger id={`quick-product-${index}`} className="w-full">
                      <SelectValue placeholder="Choisir une référence" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {product ? (
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {product.price != null ? (
                        <Badge variant="secondary">{money(Number(product.price))} HT</Badge>
                      ) : null}
                      {product.taxRate != null ? (
                        <Badge variant="outline">TVA {Number(product.taxRate)}%</Badge>
                      ) : null}
                      {discount > 0 ? <Badge variant="outline">Remise {discount}%</Badge> : null}
                      {product.unitsPerCase ? (
                        <span>Colisage {product.unitsPerCase}</span>
                      ) : null}
                      {product.minimumOrderQuantity ? (
                        <span>Minimum {product.minimumOrderQuantity}</span>
                      ) : null}
                      {line.freeQuantity > 0 ? (
                        <Badge variant="outline">+{line.freeQuantity} UG</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`quick-quantity-${index}`}>Quantité</Label>
                    <div className="flex h-11 items-center overflow-hidden rounded-xl border bg-background">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 rounded-none"
                        disabled={line.quantity <= minimum}
                        onClick={() =>
                          updateLineQuantity(index, Math.max(minimum, line.quantity - 1))
                        }
                        aria-label={`Retirer une unité de ${product?.name ?? "la référence"}`}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <Input
                        id={`quick-quantity-${index}`}
                        name="quantity"
                        type="number"
                        min={minimum}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLineQuantity(
                            index,
                            Math.max(minimum, Number(event.target.value) || minimum),
                          )
                        }
                        className="h-11 w-16 rounded-none border-0 text-center font-bold shadow-none focus-visible:ring-0"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 rounded-none"
                        onClick={() => updateLineQuantity(index, line.quantity + 1)}
                        aria-label={`Ajouter une unité de ${product?.name ?? "la référence"}`}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>UG conditions</Label>
                    <Input
                      name="commercialFreeQuantity"
                      type="number"
                      min="0"
                      step="1"
                      value={line.commercialFreeQuantity}
                      onChange={(event) =>
                        updateCommercialFreeQuantity(
                          index,
                          Math.max(0, Number(event.target.value) || 0),
                        )
                      }
                      className="h-11 w-full min-w-16 text-center font-bold"
                    />
                    <input type="hidden" name="freeQuantity" value={line.freeQuantity} />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`quick-manual-free-${index}`}>UG exceptionnelle</Label>
                  <Input id={`quick-manual-free-${index}`} name="manualFreeQuantity" type="number" min="0" step="1" value={line.manualFreeQuantity}
                    onChange={(event) => updateManualFreeQuantity(index, Math.max(0, Number(event.target.value) || 0))} />
                </div>
                {line.manualFreeQuantity > 0 ? (
                  <div className="space-y-2">
                    <Label>Classification UG/UP</Label>
                    <Select name="freeClassification" required value={line.freeClassification} onValueChange={(value) => updateLine(index, { freeClassification: value })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Choisir la classification" /></SelectTrigger>
                      <SelectContent>
                        {NAALI_UG_CLASSIFICATIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : <input type="hidden" name="freeClassification" value="" />}
              </div>
              {line.commercialFreeQuantity > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{line.commercialFreeQuantity} UG · conditions commerciales client</p>
              ) : null}

                            <input type="hidden" name="discountRate" value={line.discountRate} />

              {!isAgent || !line.unitPriceHt ? (
                <div className="mt-3 max-w-xs space-y-2">
                  <Label htmlFor={`quick-price-${index}`}>
                    {isAgent ? "Prix HT nécessaire" : "Prix unitaire HT"}
                  </Label>
                  <Input
                    id={`quick-price-${index}`}
                    name="unitPriceHt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPriceHt}
                    onChange={(event) =>
                      updateLine(index, { unitPriceHt: event.target.value })
                    }
                    required
                  />
                </div>
              ) : (
                <input type="hidden" name="unitPriceHt" value={line.unitPriceHt} />
              )}

              <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {lineTotal == null ? "Prix à compléter" : money(lineTotal)}
                  {line.commercialFreeQuantity > 0 ? ` · ${line.commercialFreeQuantity} UG conditions commerciales` : ""}{line.manualFreeQuantity > 0 ? ` · ${line.manualFreeQuantity} UG ${line.freeClassification || "à classifier"}` : ""}
                </span>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, lineIndex) => lineIndex !== index),
                      )
                    }
                  >
                    Retirer
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <details open={!isAgent} className="rounded-2xl border bg-muted/15 p-4">
        <summary className="cursor-pointer font-semibold text-[var(--tr1-navy)]">
          Plus de détails
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Facultatif dans la majorité des prises de commande terrain.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-order-date">Date de commande</Label>
            <Input
              id="quick-order-date"
              name="orderDate"
              type="datetime-local"
              defaultValue={localDateTimeNow()}
              required
            />
          </div>

          {!isAgent ? (
            <div className="space-y-2">
              <Label htmlFor="quick-order-status">Statut</Label>
              <Select name="orderStatus" defaultValue="confirmed">
                <SelectTrigger id="quick-order-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="confirmed">Validée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="quick-order-type">Type demandé</Label>
            <Select name="orderType" value={orderType} onValueChange={setOrderType}>
              <SelectTrigger id="quick-order-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "initial",
                  "reorder",
                  "complementary",
                  "replacement",
                  "sample",
                  "return",
                  "credit_note",
                  "other",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {uiLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-external-order">Référence externe</Label>
            <Input id="quick-external-order" name="externalOrderId" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-order-number">Numéro de commande</Label>
            <Input id="quick-order-number" name="orderNumber" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-shipping">Port HT</Label>
            <Input
              id="quick-shipping"
              name="shippingAmountHt"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="quick-notes">Notes</Label>
            <Textarea id="quick-notes" name="notes" rows={3} />
          </div>
        </div>
      </details>

      <div className="sticky bottom-3 z-20 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="mb-3 sm:mb-0">
          <p className="font-bold text-[var(--tr1-navy)]">
            {totalUnits} unité{totalUnits > 1 ? "s" : ""} · {money(totalHt)} HT
          </p>
          <p className="text-xs text-muted-foreground">
            {validLines} référence{validLines > 1 ? "s" : ""}
            {lastOrderItems.length && !initialContextChanged
              ? " · dernière commande réutilisable"
              : ""}
          </p>
        </div>
        <Button
          disabled={pending || validLines === 0}
          className="h-12 w-full rounded-xl bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)] sm:w-auto sm:min-w-52"
        >
          {pending
            ? "Enregistrement…"
            : isAgent
              ? "Envoyer à la marque"
              : "Créer la commande"}
        </Button>
      </div>
      </form>

      {pickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choisir les références"
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-[1px] sm:p-8"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPickerOpen(false);
          }}
        >
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="sticky top-0 z-20 border-b bg-background/95 p-4 backdrop-blur sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--tr1-orange)]">
                    Catalogue
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[var(--tr1-navy)]">
                    Choisir plusieurs références
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cochez toutes les références de la commande, puis validez la sélection.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  aria-label="Fermer le catalogue"
                  onClick={() => setPickerOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                    placeholder="Rechercher un produit, SKU ou EAN…"
                    className="h-11 pl-9"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {pickerSelection.length} sélectionnée
                    {pickerSelection.length > 1 ? "s" : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setPickerSelection(products.map((product) => product.id))
                    }
                  >
                    Tout
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPickerSelection([])}
                  >
                    Effacer
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => {
                  const selected = pickerSelection.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={cn(
                        "flex min-h-24 w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                        selected
                          ? "border-[var(--tr1-orange)] bg-[var(--tr1-orange)]/7 shadow-sm"
                          : "border-[var(--tr1-line-strong)] bg-background hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border",
                          selected
                            ? "border-[var(--tr1-orange)] bg-[var(--tr1-orange)] text-white"
                            : "border-[var(--tr1-line-strong)] bg-background",
                        )}
                      >
                        {selected ? <Check className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-tight text-[var(--tr1-navy)]">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {[product.detail, product.ean ? `EAN ${product.ean}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {product.price != null ? (
                            <Badge variant="outline">
                              {money(Number(product.price))} HT
                            </Badge>
                          ) : null}
                          {product.unitsPerCase ? (
                            <Badge variant="outline">x{product.unitsPerCase}</Badge>
                          ) : null}
                          {product.minimumOrderQuantity ? (
                            <span className="self-center text-muted-foreground">
                              min. {product.minimumOrderQuantity}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {!filteredProducts.length ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Aucune référence trouvée.
                </p>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Les quantités et UG déjà saisies sont conservées pour les références qui restent sélectionnées.
              </p>
              <Button
                type="button"
                className="h-11 bg-[var(--tr1-orange)] text-white hover:bg-[var(--tr1-orange)]/90 sm:min-w-56"
                onClick={applyProductSelection}
              >
                Valider {pickerSelection.length} référence
                {pickerSelection.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

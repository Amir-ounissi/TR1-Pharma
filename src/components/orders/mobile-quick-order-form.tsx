"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Minus, PackagePlus, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  createOrderAction,
  searchOrderPharmaciesAction,
  type OrderPharmacySearchResult,
} from "@/app/(protected)/dashboard/orders/actions";
import { getOrderPharmacyPricingAction } from "@/app/(protected)/dashboard/orders/pricing-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uiLabel } from "@/lib/ui-copy";

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

type QuickOrderItem = {
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
  unitPriceHt: string;
  discountRate: string;
};

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
      <Label htmlFor="mobile-order-pharmacy">Pharmacie</Label>
      <Input
        id="mobile-order-pharmacy"
        value={selected ? selected.name : query}
        placeholder="Nom, ville, CIP ou SIRET…"
        autoComplete="off"
        className="h-12 rounded-xl bg-background text-base"
        onChange={(event) => {
          if (selected) onSelectionChange(Boolean(initialPharmacy), undefined);
          setSelected(undefined);
          void search(event.target.value);
        }}
      />
      <input type="hidden" name="brandPharmacyId" value={selected?.brandPharmacyId ?? ""} />
      <input type="hidden" name="pharmacyId" value={selected?.brandPharmacyId ? "" : selected?.pharmacyId ?? ""} />
      {selected ? (
        <div className="rounded-xl border bg-background px-3 py-2.5">
          <p className="font-semibold text-[var(--tr1-navy)]">{selected.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selected.detail}
            {selected.relationStatus === "existing_brand_relation"
              ? " · Déjà cliente"
              : " · Nouvelle pour la marque"}
          </p>
        </div>
      ) : null}
      {!selected && results.length ? (
        <div className="max-h-60 overflow-auto rounded-xl border bg-popover p-1 shadow-lg">
          {results.map((result) => (
            <button
              key={result.pharmacyId}
              type="button"
              className="block min-h-14 w-full rounded-lg px-3 py-2.5 text-left active:bg-muted"
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
              <span className="block text-xs text-muted-foreground">{result.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p className="text-xs text-muted-foreground">Recherche…</p> : null}
    </div>
  );
}

export function MobileQuickOrderForm({
  products,
  initialPharmacy,
  lastOrderItems = [],
  initialProductId,
  initialOrderType = "other",
  initialDiscountRate = null,
  initialPotential = null,
  initialFreeUnitsRule = null,
  isAgent = false,
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
}) {
  const [state, action, pending] = useActionState(createOrderAction, {});
  const initialProduct = products.find((product) => product.id === initialProductId);
  const [defaultDiscountRate, setDefaultDiscountRate] = useState<number | null>(initialDiscountRate);
  const [potential, setPotential] = useState<string | null>(initialPotential);
  const [freeUnitsRule, setFreeUnitsRule] = useState<FreeUnitsRule | null>(initialFreeUnitsRule);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [orderType, setOrderType] = useState(initialOrderType);
  const [initialContextChanged, setInitialContextChanged] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!initialProduct) return [];
    const minimum = Math.max(1, initialProduct.minimumOrderQuantity ?? 1);
    return [
      {
        key: `initial-${initialProduct.id}`,
        productId: initialProduct.id,
        quantity: minimum,
        freeQuantity: freeQuantityFor(minimum, initialFreeUnitsRule),
        unitPriceHt: initialProduct.price == null ? "" : String(initialProduct.price),
        discountRate: initialDiscountRate == null ? "" : String(initialDiscountRate),
      },
    ];
  });

  const filteredProducts = useMemo(() => {
    const query = pickerQuery.trim().toLocaleLowerCase("fr");
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.detail, product.ean]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("fr").includes(query)),
    );
  }, [pickerQuery, products]);

  const totalHt = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const price = Number(line.unitPriceHt);
        const discount = Number(line.discountRate || 0);
        if (!Number.isFinite(price)) return sum;
        return sum + line.quantity * price * (1 - discount / 100);
      }, 0),
    [lines],
  );

  const totalUnits = lines.reduce(
    (sum, line) => sum + line.quantity + line.freeQuantity,
    0,
  );

  function defaultDiscountValue() {
    return defaultDiscountRate == null ? "" : String(defaultDiscountRate);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  }

  function updateLineQuantity(index: number, quantity: number) {
    updateLine(index, {
      quantity,
      freeQuantity: freeQuantityFor(quantity, freeUnitsRule),
    });
  }

  function openProductPicker() {
    setPickerQuery("");
    setPickerSelection(lines.map((line) => line.productId));
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
      const byProduct = new Map(current.map((line) => [line.productId, line]));
      return products
        .filter((product) => pickerSelection.includes(product.id))
        .map((product) => {
          const existing = byProduct.get(product.id);
          if (existing) return existing;
          const minimum = Math.max(1, product.minimumOrderQuantity ?? 1);
          return {
            key: crypto.randomUUID(),
            productId: product.id,
            quantity: minimum,
            freeQuantity: freeQuantityFor(minimum, freeUnitsRule),
            unitPriceHt: product.price == null ? "" : String(product.price),
            discountRate: defaultDiscountValue(),
          };
        });
    });
    setPickerOpen(false);
  }

  function resumeLastOrder() {
    if (!lastOrderItems.length || initialContextChanged) return;
    setLines(
      lastOrderItems.map((item, index) => ({
        key: `last-${index}-${item.productId}`,
        productId: item.productId,
        quantity: Math.max(1, Number(item.quantity)),
        freeQuantity:
          freeUnitsRule == null
            ? Math.max(0, Number(item.freeQuantity ?? 0))
            : freeQuantityFor(Math.max(1, Number(item.quantity)), freeUnitsRule),
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
          discountRate: pricing.discountRate == null ? "" : String(pricing.discountRate),
          freeQuantity: freeQuantityFor(line.quantity, pricing.freeUnitsRule),
        })),
      );
    } finally {
      setPricingLoading(false);
    }
  }

  return (
    <>
      <form action={action} className="space-y-4">
        <ActionFeedback {...state} />
        {isAgent ? <input type="hidden" name="orderStatus" value="pending" /> : null}

        <div className="rounded-2xl border bg-muted/20 p-3.5">
          <PharmacyAutocomplete
            initialPharmacy={initialPharmacy}
            onSelectionChange={(changed, pharmacy) => {
              setInitialContextChanged(changed);
              if (!pharmacy) {
                setDefaultDiscountRate(null);
                setPotential(null);
                setFreeUnitsRule(null);
              }
              if (changed) {
                setLines([]);
                setOrderType("other");
              }
              if (pharmacy) void loadPharmacyPricing(pharmacy);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {pricingLoading ? (
              <span className="text-muted-foreground">Conditions client…</span>
            ) : (
              <>
                {potential ? (
                  <Badge
                    variant="outline"
                    className="border-[var(--tr1-orange)]/35 bg-[var(--tr1-orange)]/10 text-[var(--tr1-orange)]"
                  >
                    {potential}
                  </Badge>
                ) : null}
                {defaultDiscountRate != null ? (
                  <Badge
                    variant="outline"
                    className="border-[var(--tr1-blue)]/35 bg-[var(--tr1-blue)]/10 text-[var(--tr1-blue)]"
                  >
                    Remise {defaultDiscountRate}%
                  </Badge>
                ) : null}
                {freeUnitsRule ? (
                  <Badge
                    variant="outline"
                    className="border-[var(--tr1-success)]/35 bg-[var(--tr1-success)]/10 text-[var(--tr1-success)]"
                  >
                    UG {freeUnitsRule.label}
                  </Badge>
                ) : null}
              </>
            )}
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--tr1-orange)]">
                Références
              </p>
              <h2 className="text-lg font-black text-[var(--tr1-navy)]">
                {lines.length
                  ? `${lines.length} sélectionnée${lines.length > 1 ? "s" : ""}`
                  : "Choisir les produits"}
              </h2>
            </div>
            <Button
              type="button"
              className="h-11 rounded-xl bg-[var(--tr1-orange)] text-white hover:bg-[var(--tr1-orange)]/90"
              onClick={openProductPicker}
            >
              <PackagePlus className="size-4" />
              {lines.length ? "Modifier" : "Sélectionner"}
            </Button>
          </div>

          {lastOrderItems.length && !initialContextChanged ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-[var(--tr1-line-strong)] bg-background text-[var(--tr1-navy)]"
              onClick={resumeLastOrder}
            >
              <RotateCcw className="size-4" /> Reprendre la dernière commande
            </Button>
          ) : null}

          {!lines.length ? (
            <button
              type="button"
              onClick={openProductPicker}
              className="flex min-h-28 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--tr1-orange)]/40 bg-[var(--tr1-orange)]/5 px-5 text-center"
            >
              <span>
                <PackagePlus className="mx-auto mb-2 size-6 text-[var(--tr1-orange)]" />
                <span className="block font-semibold text-[var(--tr1-navy)]">
                  Sélectionner plusieurs références
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Touchez les produits puis validez une seule fois.
                </span>
              </span>
            </button>
          ) : null}

          {lines.map((line, index) => {
            const product = products.find((item) => item.id === line.productId);
            if (!product) return null;
            const minimum = Math.max(1, product.minimumOrderQuantity ?? 1);
            const increment = Math.max(1, product.unitsPerCase ?? 1);
            const unitPrice = Number(line.unitPriceHt);
            const discount = Number(line.discountRate || 0);
            const lineTotal = Number.isFinite(unitPrice)
              ? line.quantity * unitPrice * (1 - discount / 100)
              : null;

            return (
              <article
                key={line.key}
                className="overflow-hidden rounded-2xl border bg-background shadow-sm"
              >
                <input type="hidden" name="productId" value={line.productId} />
                <input type="hidden" name="discountRate" value={line.discountRate} />
                <div className="flex items-start gap-3 border-b bg-muted/15 p-3.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--tr1-navy)] text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[0.95rem] font-black leading-tight text-[var(--tr1-navy)]">
                      {product.name}
                    </h3>
                    <p className="mt-1 truncate font-mono text-[0.66rem] text-muted-foreground">
                      {[product.detail, product.ean ? `EAN ${product.ean}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {product.price != null ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory-deep)]/70 text-[var(--tr1-navy)]"
                        >
                          {money(Number(product.price))} HT
                        </Badge>
                      ) : null}
                      {discount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--tr1-blue)]/35 bg-[var(--tr1-blue)]/10 text-[var(--tr1-blue)]"
                        >
                          REM. {discount}%
                        </Badge>
                      ) : null}
                      {line.freeQuantity > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--tr1-success)]/35 bg-[var(--tr1-success)]/10 text-[var(--tr1-success)]"
                        >
                          +{line.freeQuantity} UG
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-mr-1 -mt-1 size-10 shrink-0 rounded-xl text-muted-foreground hover:bg-[var(--tr1-danger)]/10 hover:text-[var(--tr1-danger)] active:bg-[var(--tr1-danger)]/15 active:text-[var(--tr1-danger)]"
                    aria-label={`Retirer ${product.name}`}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, lineIndex) => lineIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="p-3.5">
                  <div className="grid grid-cols-[1fr_5.25rem] gap-3">
                    <div>
                      <Label className="text-xs">Quantité</Label>
                      <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-xl border bg-background">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-12 w-12 rounded-none text-[var(--tr1-navy)]"
                          disabled={line.quantity <= minimum}
                          onClick={() =>
                            updateLineQuantity(
                              index,
                              Math.max(minimum, line.quantity - increment),
                            )
                          }
                          aria-label={`Retirer ${increment} unités de ${product.name}`}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          name="quantity"
                          type="number"
                          min={minimum}
                          step={increment}
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLineQuantity(
                              index,
                              Math.max(minimum, Number(event.target.value) || minimum),
                            )
                          }
                          className="h-12 min-w-0 flex-1 rounded-none border-0 px-1 text-center text-lg font-black text-[var(--tr1-navy)] shadow-none focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-12 w-12 rounded-none text-[var(--tr1-orange)]"
                          onClick={() =>
                            updateLineQuantity(index, line.quantity + increment)
                          }
                          aria-label={`Ajouter ${increment} unités de ${product.name}`}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      <p className="mt-1 text-[0.66rem] text-muted-foreground">
                        Pas de {increment} · minimum {minimum}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-[var(--tr1-success)]">UG</Label>
                      <Input
                        name="freeQuantity"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={line.freeQuantity}
                        onChange={(event) =>
                          updateLine(index, {
                            freeQuantity: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                        className="mt-1.5 h-12 rounded-xl border-[var(--tr1-success)]/30 bg-[var(--tr1-success)]/5 text-center text-lg font-black text-[var(--tr1-success)] focus-visible:ring-[var(--tr1-success)]/25"
                      />
                    </div>
                  </div>

                  {!isAgent || !line.unitPriceHt ? (
                    <div className="mt-3">
                      <Label className="text-xs">
                        {isAgent ? "Prix HT nécessaire" : "Prix unitaire HT"}
                      </Label>
                      <Input
                        name="unitPriceHt"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPriceHt}
                        onChange={(event) =>
                          updateLine(index, { unitPriceHt: event.target.value })
                        }
                        required
                        className="mt-1.5 h-11 rounded-xl"
                      />
                    </div>
                  ) : (
                    <input
                      type="hidden"
                      name="unitPriceHt"
                      value={line.unitPriceHt}
                    />
                  )}

                  <div className="mt-3 flex items-end justify-between gap-3 border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      {product.unitsPerCase ? `Colisage ${product.unitsPerCase}` : ""}
                      {product.taxRate != null
                        ? `${product.unitsPerCase ? " · " : ""}TVA ${Number(product.taxRate)}%`
                        : ""}
                    </span>
                    <strong className="text-base font-black text-[var(--tr1-navy)]">
                      {lineTotal == null ? "Prix à compléter" : `${money(lineTotal)} HT`}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <details className="rounded-2xl border bg-muted/15 p-3.5">
          <summary className="cursor-pointer font-semibold text-[var(--tr1-navy)]">
            Détails de commande
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            À ouvrir seulement si nécessaire.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="mobile-order-date">Date de commande</Label>
              <Input
                id="mobile-order-date"
                name="orderDate"
                type="datetime-local"
                defaultValue={localDateTimeNow()}
                required
              />
            </div>

            {!isAgent ? (
              <div className="space-y-2">
                <Label htmlFor="mobile-order-status">Statut</Label>
                <Select name="orderStatus" defaultValue="confirmed">
                  <SelectTrigger id="mobile-order-status" className="w-full">
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
              <Label htmlFor="mobile-order-type">Type demandé</Label>
              <Select
                name="orderType"
                value={orderType}
                onValueChange={setOrderType}
              >
                <SelectTrigger id="mobile-order-type" className="w-full">
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
              <Label>Référence externe</Label>
              <Input name="externalOrderId" />
            </div>
            <div className="space-y-2">
              <Label>Numéro de commande</Label>
              <Input name="orderNumber" />
            </div>
            <div className="space-y-2">
              <Label>Port HT</Label>
              <Input
                name="shippingAmountHt"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea name="notes" rows={3} />
            </div>
          </div>
        </details>

        <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-[var(--tr1-navy)]/15 bg-background/96 p-3 shadow-xl backdrop-blur">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-black text-[var(--tr1-navy)]">
                {money(totalHt)} HT
              </p>
              <p className="text-xs text-muted-foreground">
                {lines.length} réf. · {totalUnits} unités
              </p>
            </div>
            {freeUnitsRule ? (
              <Badge
                variant="outline"
                className="border-[var(--tr1-success)]/35 bg-[var(--tr1-success)]/10 text-[var(--tr1-success)]"
              >
                UG {freeUnitsRule.label}
              </Badge>
            ) : null}
          </div>
          <Button
            disabled={pending || lines.length === 0}
            className="h-12 w-full rounded-xl bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)]"
          >
            {pending
              ? "Enregistrement…"
              : isAgent
                ? "Envoyer à la marque"
                : "Créer la commande"}
          </Button>
        </div>
      </form>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="h-[88dvh] rounded-t-[1.75rem] p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-4 pb-3 pt-4 text-left">
              <div className="pr-8">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--tr1-orange)]">
                  Catalogue
                </p>
                <SheetTitle className="mt-1 text-xl">Choisir les références</SheetTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Touchez plusieurs produits puis validez une fois.
                </p>
              </div>
            </SheetHeader>

            <div className="border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder="Rechercher un produit, SKU ou EAN…"
                  className="h-12 rounded-xl pl-9 text-base"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {pickerSelection.length} sélectionnée
                  {pickerSelection.length > 1 ? "s" : ""}
                </span>
                <div className="flex gap-1">
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

            <div className="flex-1 overflow-y-auto p-3 pb-28">
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredProducts.map((product) => {
                  const selected = pickerSelection.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={cn(
                        "flex min-h-[5.5rem] w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                        selected
                          ? "border-[var(--tr1-orange)] bg-[var(--tr1-orange)]/7 shadow-sm"
                          : "border-[var(--tr1-line-strong)] bg-background active:bg-muted",
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
                        <span className="block font-black leading-tight text-[var(--tr1-navy)]">
                          {product.name}
                        </span>
                        <span className="mt-1 block truncate font-mono text-[0.65rem] text-muted-foreground">
                          {[product.detail, product.ean ? `EAN ${product.ean}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {product.price != null ? (
                            <Badge
                              variant="outline"
                              className="border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory-deep)]/70 text-[var(--tr1-navy)]"
                            >
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
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucune référence trouvée.
                </p>
              ) : null}
            </div>

            <div className="absolute inset-x-0 bottom-0 border-t bg-background/96 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
              <Button
                type="button"
                className="h-12 w-full rounded-xl bg-[var(--tr1-orange)] text-white hover:bg-[var(--tr1-orange)]/90"
                onClick={applyProductSelection}
              >
                Valider {pickerSelection.length} référence
                {pickerSelection.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

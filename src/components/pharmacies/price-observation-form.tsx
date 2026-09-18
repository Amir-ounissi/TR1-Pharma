"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Save } from "lucide-react";
import {
  savePriceObservationAction,
  type PriceObservationActionState,
} from "@/app/(protected)/dashboard/pharmacies/[id]/prices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyState: PriceObservationActionState = {};

export function PriceObservationForm({
  brandPharmacyId,
  visitId,
  products,
}: {
  brandPharmacyId: string;
  visitId?: string | null;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    ean: string | null;
    retailPriceTtc: number | string | null;
  }>;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(savePriceObservationAction, emptyState);
  const [priceType, setPriceType] = useState("regular");
  const [method, setMethod] = useState("photo");

  useEffect(() => {
    if (state.success && !state.error) router.refresh();
  }, [state.success, state.error, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandPharmacyId" value={brandPharmacyId} />
      <input type="hidden" name="visitId" value={visitId ?? ""} />

      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="price-product">Produit</Label>
          <select
            id="price-product"
            name="productId"
            required
            defaultValue=""
            className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="" disabled>Choisir un produit</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.sku ? ` · ${product.sku}` : ""}
                {product.retailPriceTtc != null ? ` · réf. ${product.retailPriceTtc} €` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="price-ttc">Prix TTC observé</Label>
          <Input id="price-ttc" name="priceTtc" type="number" min="0.01" max="10000" step="0.01" required className="mt-1.5" placeholder="19,90" />
        </div>

        <div>
          <Label htmlFor="price-type">Type de prix</Label>
          <select
            id="price-type"
            name="priceType"
            value={priceType}
            onChange={(event) => setPriceType(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="regular">Prix normal</option>
            <option value="promotion">Promotion</option>
            <option value="bundle">Lot</option>
            <option value="other">Autre</option>
          </select>
        </div>

        {priceType === "bundle" ? (
          <div>
            <Label htmlFor="bundle-quantity">Quantité dans le lot</Label>
            <Input id="bundle-quantity" name="bundleQuantity" type="number" min="2" max="100" step="1" required className="mt-1.5" />
          </div>
        ) : null}

        <div>
          <Label htmlFor="observed-ean">EAN observé</Label>
          <Input id="observed-ean" name="observedEan" maxLength={32} className="mt-1.5" placeholder="Facultatif" />
        </div>

        <div>
          <Label htmlFor="capture-method">Source</Label>
          <select
            id="capture-method"
            name="captureMethod"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="photo">Photo terrain</option>
            <option value="manual">Saisie manuelle</option>
            <option value="import">Import</option>
          </select>
        </div>

        <div>
          <Label htmlFor="price-confidence">Confiance</Label>
          <Input id="price-confidence" name="confidence" type="number" min="0" max="1" step="0.01" className="mt-1.5" placeholder="Facultatif" />
        </div>
      </div>

      {method === "photo" ? (
        <div className="rounded-xl border border-dashed p-3">
          <Label htmlFor="price-photo" className="flex cursor-pointer items-center gap-2 font-medium">
            <Camera className="size-4 text-[var(--tr1-orange)]" />
            Photo produit + étiquette prix
          </Label>
          <Input
            id="price-photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            required
            className="mt-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            La photo est une preuve privée. Évitez toute personne ou donnée client dans le cadre.
          </p>
        </div>
      ) : null}

      <div>
        <Label htmlFor="price-notes">Commentaire</Label>
        <Textarea id="price-notes" name="notes" maxLength={2000} rows={2} className="mt-1.5" placeholder="Ex. promo tête de gondole, prix barré…" />
      </div>

      <Button disabled={pending} className="min-h-11 w-full sm:w-auto">
        <Save className="size-4" />
        {pending ? "Enregistrement…" : "Enregistrer le prix observé"}
      </Button>
    </form>
  );
}

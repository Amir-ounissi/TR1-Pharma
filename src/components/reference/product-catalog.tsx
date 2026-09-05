"use client";

import { useState } from "react";

import { toggleProductAction } from "@/app/(protected)/dashboard/reference/actions";
import { ProductEditForm } from "@/components/reference/simple-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/reference-data";
import { productDistributionPercent } from "@/lib/product-distribution";
import { uiLabel } from "@/lib/ui-copy";

export type ProductCatalogItem = {
  id: string;
  name: string;
  sku: string;
  ean: string | null;
  category: string | null;
  product_family: string | null;
  format: string | null;
  description: string | null;
  strategic_priority: string;
  is_pharmacy_eligible: boolean;
  counts_for_distribution: boolean;
  wholesale_price_ht: number | string | null;
  retail_price_ttc: number | string | null;
  tax_rate: number | string | null;
  units_per_case: number | null;
  minimum_order_quantity: number | null;
  is_active: boolean;
  distribution_present_count: number;
  distribution_portfolio_count: number;
};

export function ProductCatalog({
  products,
  currency,
  canManage,
}: {
  products: ProductCatalogItem[];
  currency: string;
  canManage: boolean;
}) {
  const [selectedProduct, setSelectedProduct] =
    useState<ProductCatalogItem | null>(null);

  function openProduct(product: ProductCatalogItem) {
    setSelectedProduct(product);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Référence / EAN</TableHead>
            <TableHead>DN</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Logistique</TableHead>
            <TableHead>État</TableHead>
            {canManage ? <TableHead>Action</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              tabIndex={0}
              aria-label={`Ouvrir la fiche de ${product.name}`}
              className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              onClick={() => openProduct(product)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openProduct(product);
                }
              }}
            >
              <TableCell className="font-medium">
                {product.name}
                <p className="text-xs text-muted-foreground">
                  {product.product_family || product.category || "—"} ·{" "}
                  {product.format || "—"}
                </p>
              </TableCell>

              <TableCell>
                {product.sku}
                <p className="text-xs text-muted-foreground">
                  {product.ean || "EAN non renseigné"}
                </p>
              </TableCell>

              <TableCell>
                <ProductDistribution product={product} />
              </TableCell>

              <TableCell>
                Achat HT {formatCurrency(product.wholesale_price_ht, currency)}
                <p className="text-xs text-muted-foreground">
                  PVC{" "}
                  {formatCurrency(product.retail_price_ttc, currency)}
                  {" · TVA "}
                  {product.tax_rate == null
                    ? "—"
                    : `${Number(product.tax_rate).toFixed(2)} %`}
                </p>
              </TableCell>

              <TableCell>
                PCB {product.units_per_case ?? "—"}
                <p className="text-xs text-muted-foreground">
                  Minimum {product.minimum_order_quantity ?? "—"}
                </p>
              </TableCell>

              <TableCell>
                <Badge variant="secondary">
                  {product.is_active ? "Actif" : "Arrêté"}
                </Badge>
              </TableCell>

              {canManage ? (
                <TableCell
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={product.is_active ? "false" : "true"}
                    />
                    <Button variant="outline" size="sm">
                      {product.is_active ? "Arrêter" : "Réactiver"}
                    </Button>
                  </form>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Sheet
        open={selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedProduct ? (
            <>
              <SheetHeader className="border-b pr-12">
                <SheetTitle>{selectedProduct.name}</SheetTitle>
                <SheetDescription>
                  {canManage
                    ? "Complétez ou modifiez la fiche produit. Les données importées sont déjà préremplies."
                    : "Informations du catalogue et diffusion dans votre portefeuille."}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-8">
                {canManage ? (
                  <ProductEditForm
                    key={selectedProduct.id}
                    product={selectedProduct}
                  />
                ) : (
                  <ProductReadOnlyDetails
                    product={selectedProduct}
                    currency={currency}
                  />
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProductDistribution({ product }: { product: ProductCatalogItem }) {
  if (!product.counts_for_distribution) {
    return <Badge variant="outline">Hors DN</Badge>;
  }

  const percentage = productDistributionPercent(
    product.distribution_present_count,
    product.distribution_portfolio_count,
  );

  return (
    <div>
      <p className="font-medium">
        {product.distribution_present_count} / {product.distribution_portfolio_count}
      </p>
      <p className="text-xs text-muted-foreground">
        {percentage === null ? "—" : `${percentage.toLocaleString("fr-FR")} %`}
      </p>
    </div>
  );
}

function ProductReadOnlyDetails({
  product,
  currency,
}: {
  product: ProductCatalogItem;
  currency: string;
}) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <Detail label="Référence" value={product.sku} />
      <Detail label="EAN" value={product.ean ?? "—"} />
      <Detail label="Famille" value={product.product_family ?? product.category ?? "—"} />
      <Detail label="Format" value={product.format ?? "—"} />
      <Detail label="Priorité" value={uiLabel(product.strategic_priority)} />
      <div>
        <p className="text-xs text-muted-foreground">DN</p>
        <div className="mt-1"><ProductDistribution product={product} /></div>
      </div>
      <Detail label="Prix achat HT" value={formatCurrency(product.wholesale_price_ht, currency)} />
      <Detail label="PVC TTC" value={formatCurrency(product.retail_price_ttc, currency)} />
      <Detail
        label="TVA"
        value={product.tax_rate == null ? "—" : `${Number(product.tax_rate).toLocaleString("fr-FR")} %`}
      />
      <Detail label="PCB" value={product.units_per_case?.toLocaleString("fr-FR") ?? "—"} />
      <Detail label="Minimum de commande" value={product.minimum_order_quantity?.toLocaleString("fr-FR") ?? "—"} />
      <Detail label="État" value={product.is_active ? "Actif" : "Arrêté"} />
      {product.description ? (
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Description</p>
          <p className="mt-1 whitespace-pre-wrap">{product.description}</p>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

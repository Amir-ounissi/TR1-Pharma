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
};

export function ProductCatalog({
  products,
  currency,
}: {
  products: ProductCatalogItem[];
  currency: string;
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
            <TableHead>SKU / EAN</TableHead>
            <TableHead>Référentiel</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Logistique</TableHead>
            <TableHead>État</TableHead>
            <TableHead>Action</TableHead>
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
                <Badge variant="outline">
                  {product.strategic_priority}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {product.counts_for_distribution
                    ? "Compté DN"
                    : "Hors DN"}
                </p>
              </TableCell>

              <TableCell>
                {formatCurrency(product.wholesale_price_ht, currency)}
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
                  MOQ {product.minimum_order_quantity ?? "—"}
                </p>
              </TableCell>

              <TableCell>
                <Badge variant="secondary">
                  {product.is_active ? "Actif" : "Arrêté"}
                </Badge>
              </TableCell>

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
                  Complétez ou modifiez la fiche produit. Les données
                  importées sont déjà préremplies.
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-8">
                <ProductEditForm
                  key={selectedProduct.id}
                  product={selectedProduct}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

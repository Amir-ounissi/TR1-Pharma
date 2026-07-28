import { Building2 } from "lucide-react";
import { selectBrandAction } from "@/app/(auth)/select-brand/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts } from "@/lib/auth";

export default async function SelectBrandPage() {
  const brands = await getBrandContexts();
  return (
    <Card><CardHeader><CardTitle>Choisir une marque</CardTitle><CardDescription>Votre contexte actif filtre toutes les données affichées.</CardDescription></CardHeader><CardContent className="space-y-3">
      {brands.length ? brands.map((brand) => (
        <form action={selectBrandAction} key={brand.id}>
          <input type="hidden" name="brandId" value={brand.id} />
          <Button variant="outline" className="h-auto w-full justify-between gap-4 p-4">
            <span className="flex items-center gap-3 text-left"><Building2 className="size-5 text-primary" /><span><span className="block font-medium">{brand.name}</span><span className="block text-xs text-muted-foreground">{brand.slug}</span></span></span>
            <Badge variant="secondary">{brand.role}</Badge>
          </Button>
        </form>
      )) : <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Aucune marque active ne vous est attribuée.</p>}
    </CardContent></Card>
  );
}

import { Building2 } from "lucide-react";
import { selectBrandAction, selectPlatformViewAction } from "@/app/(auth)/select-brand/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, isPlatformAdmin } from "@/lib/auth";

export default async function SelectBrandPage() {
  const [brands, platformAdmin] = await Promise.all([getBrandContexts(), isPlatformAdmin()]);
  return (
    <Card><CardHeader><CardTitle>Choisir un contexte</CardTitle><CardDescription>{platformAdmin ? "Commencez en vue globale TR1 ou entrez dans une marque pour travailler au niveau tenant." : "Votre contexte actif filtre toutes les données affichées."}</CardDescription></CardHeader><CardContent className="space-y-3">
      {platformAdmin ? (
        <form action={selectPlatformViewAction}>
          <Button className="h-auto w-full justify-between gap-4 p-4" variant="default">
            <span className="flex items-center gap-3 text-left"><Building2 className="size-5" /><span><span className="block font-medium">Vue globale TR1</span><span className="block text-xs text-primary-foreground/80">Pilotage transverse multi-marques</span></span></span>
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10" variant="outline">super_admin</Badge>
          </Button>
        </form>
      ) : null}
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PenLine } from "lucide-react";
import { PdfOrderImport } from "@/components/orders/pdf-order-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { activeBrandHasCapability } from "@/lib/saas/server";

type SearchParams = Promise<{ pharmacy?: string }>;

export default async function ScanOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { pharmacy } = await searchParams;
  const { brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role)) redirect("/dashboard/orders");
  const enabled = await activeBrandHasCapability("pdf_order_import");
  if (!enabled) redirect(`/dashboard/orders/new${pharmacy ? `?pharmacy=${pharmacy}` : ""}`);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={pharmacy ? `/dashboard/pharmacies/${pharmacy}` : "/dashboard/field"}><ArrowLeft className="size-4" />Retour</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/orders/new${pharmacy ? `?pharmacy=${pharmacy}` : ""}`}><PenLine className="size-4" />Saisie manuelle</Link>
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Photographier une commande</CardTitle>
          <p className="text-sm text-muted-foreground">Photo → analyse → vérification → confirmation. Aucune commande n’est créée sans votre validation.</p>
        </CardHeader>
        <CardContent>
          <PdfOrderImport isAgent={role === "agent"} />
        </CardContent>
      </Card>
    </div>
  );
}

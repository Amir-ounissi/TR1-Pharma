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
    <div className="mx-auto max-w-3xl space-y-3 pb-24 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="px-1.5 sm:px-3">
          <Link href={pharmacy ? `/dashboard/pharmacies/${pharmacy}` : "/dashboard/field"}>
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link href={`/dashboard/orders/new${pharmacy ? `?pharmacy=${pharmacy}` : ""}`}>
            <PenLine className="size-4" />
            Saisie manuelle
          </Link>
        </Button>
      </div>
      <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-sm">
        <CardHeader className="px-0 pb-2 pt-1 sm:px-6 sm:pb-3 sm:pt-6">
          <CardTitle className="text-xl sm:text-2xl">Photographier une commande</CardTitle>
          <p className="text-sm leading-snug text-muted-foreground">
            Photo ou PDF → analyse → vérification → confirmation.
            <span className="hidden sm:inline"> Aucune commande n’est créée sans votre validation.</span>
          </p>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <PdfOrderImport isAgent={role === "agent"} />
        </CardContent>
      </Card>
    </div>
  );
}

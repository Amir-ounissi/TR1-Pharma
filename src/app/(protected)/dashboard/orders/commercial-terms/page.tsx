import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommercialTermsManager } from "@/components/orders/commercial-terms-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrandRole } from "@/lib/auth";

export default async function CommercialTermsPage() {
  await requireActiveBrandRole(["agent", "tr1_manager", "brand_admin", "super_admin"], "/dashboard/orders");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
            Référentiel commercial
          </p>
          <h1 className="text-2xl font-black text-[var(--tr1-navy)]">
            Conditions commerciales pharmacies
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            HubSpot reste la source automatique. TR1 permet de poser un override manuel de remise ou d’UG lorsqu’un accord client particulier doit primer.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/orders/new">
            <ArrowLeft className="size-4" /> Nouvelle commande
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modifier une condition client</CardTitle>
        </CardHeader>
        <CardContent>
          <CommercialTermsManager />
        </CardContent>
      </Card>
    </div>
  );
}

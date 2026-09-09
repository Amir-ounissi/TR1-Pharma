import { Building2, Check, ShieldCheck } from "lucide-react";
import {
  selectBrandAction,
  selectPlatformViewAction,
} from "@/app/(auth)/select-brand/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getBrandContexts,
  getOptionalActiveBrand,
  isPlatformAdmin,
} from "@/lib/auth";

const roleLabels: Record<string, string> = {
  super_admin: "Super administrateur",
  brand_admin: "Administrateur marque",
  tr1_manager: "Responsable TR1",
  brand_direction: "Direction de marque",
  brand_user: "Responsable marque",
  agent: "Agent terrain",
  facilitator: "Intervenant terrain",
};

export default async function AccountPage() {
  const [session, brands, platformAdmin] = await Promise.all([
    getOptionalActiveBrand(),
    getBrandContexts(),
    isPlatformAdmin(),
  ]);
  const activeBrandId = session.brand?.id ?? null;
  const facilitatorOnly = brands.length > 0 && brands.every((brand) => brand.role === "facilitator");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--tr1-orange)]">Compte</p>
        <h1 className="text-2xl font-black tracking-tight text-[var(--tr1-navy)] sm:text-3xl">
          Mon espace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre contexte de travail sans repasser par un écran intermédiaire à la connexion.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{session.profile.full_name}</CardTitle>
          <CardDescription>
            Votre marque active détermine les pharmacies, produits, commandes et données visibles.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marque active</CardTitle>
          <CardDescription>
            {facilitatorOnly
              ? "Vos missions restent réunies dans un espace terrain multi-marques."
              : "Choisissez ici la marque sur laquelle vous souhaitez travailler."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {platformAdmin ? (
            <form action={selectPlatformViewAction}>
              <Button
                className="h-auto w-full justify-between gap-4 rounded-xl p-4"
                variant={activeBrandId ? "outline" : "default"}
              >
                <span className="flex items-center gap-3 text-left">
                  <span className="grid size-10 place-items-center rounded-xl bg-background/10">
                    <ShieldCheck className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">TR1 global</span>
                    <span className="block text-xs opacity-70">Pilotage transverse multi-marques</span>
                  </span>
                </span>
                {!activeBrandId ? <Check className="size-4" /> : null}
              </Button>
            </form>
          ) : null}

          {brands.map((brand) => {
            const active = brand.id === activeBrandId;
            const content = (
              <>
                <span className="flex items-center gap-3 text-left">
                  <span className="grid size-10 place-items-center rounded-xl border bg-muted/30 text-[var(--tr1-navy)]">
                    <Building2 className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{brand.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {roleLabels[brand.role] ?? brand.role}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {active ? <Badge>Active</Badge> : null}
                  {active ? <Check className="size-4" /> : null}
                </span>
              </>
            );

            if (facilitatorOnly) {
              return (
                <div
                  key={brand.id}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border p-4"
                >
                  {content}
                </div>
              );
            }

            return (
              <form action={selectBrandAction} key={brand.id}>
                <input type="hidden" name="brandId" value={brand.id} />
                <Button
                  className="h-auto w-full justify-between gap-4 rounded-xl p-4"
                  variant={active ? "secondary" : "outline"}
                >
                  {content}
                </Button>
              </form>
            );
          })}

          {!brands.length && !platformAdmin ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Aucune marque active ne vous est encore attribuée.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

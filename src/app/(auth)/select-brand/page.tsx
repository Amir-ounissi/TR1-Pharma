import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, isPlatformAdmin, requireCompletedOnboarding } from "@/lib/auth";

export default async function SelectBrandPage() {
  const { supabase, userId } = await requireCompletedOnboarding();
  const [brands, platformAdmin, accessRequest] = await Promise.all([
    getBrandContexts(),
    isPlatformAdmin(),
    supabase
      .from("access_requests")
      .select("status,requested_profile_type,reviewer_note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (brands.length > 0 && brands.every((brand) => brand.role === "facilitator")) {
    redirect("/dashboard/field");
  }

  // This legacy URL is kept only as a compatibility bridge. Users with an
  // accessible brand are now routed silently; there is no forced choice step.
  if (brands.length > 0) {
    redirect("/auth/activate-brand");
  }

  if (platformAdmin) {
    redirect("/dashboard");
  }

  const request = accessRequest.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accès TR1</CardTitle>
        <CardDescription>
          Votre espace s’ouvrira automatiquement dès qu’un contexte de travail actif vous sera attribué.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {request?.status === "pending" ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="font-medium">Votre demande d’accès est en cours de validation.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              TR1 vous notifiera dès que votre marque, votre rôle et votre périmètre terrain seront activés.
            </p>
          </div>
        ) : request?.status === "rejected" ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="font-medium">Votre demande d’accès n’a pas été validée.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.reviewer_note || "Contactez TR1 pour connaître la suite."}
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune marque active ne vous est attribuée.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

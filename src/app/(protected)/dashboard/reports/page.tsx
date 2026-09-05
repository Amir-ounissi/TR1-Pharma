import Link from "next/link";
import { redirect } from "next/navigation";
import { reviewReportAction } from "../missions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBrandContexts, getOptionalActiveBrand } from "@/lib/auth";
import { presentationLabel } from "@/lib/presentation";

export default async function ReportsPage() {
  const [session, contexts] = await Promise.all([
    getOptionalActiveBrand(),
    getBrandContexts(),
  ]);
  const facilitatorOnly =
    contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  let role = "brand_user";
  if (facilitatorOnly) {
    role = "facilitator";
  } else {
    if (!session.brand) redirect("/select-brand");
    role =
      contexts.find((context) => context.id === session.brand?.id)?.role ??
      "brand_user";
  }

  const { supabase, userId } = session;
  const isContributor = role === "agent" || role === "facilitator";
  const isReviewer = role === "tr1_manager" || role === "super_admin";

  let reportsQuery = supabase
    .from("mission_reports")
    .select(
      "id,mission_id,brand_id,submitted_by,report_status,summary,submitted_at,data_quality_status,created_at,rejection_reason",
    );

  if (!facilitatorOnly) {
    reportsQuery = reportsQuery.eq("brand_id", session.brand!.id);
  }

  if (isContributor) {
    reportsQuery = reportsQuery
      .eq("submitted_by", userId)
      .in("report_status", [
        "draft",
        "needs_correction",
        "submitted",
        "validated",
        "rejected",
      ]);
  } else if (isReviewer) {
    reportsQuery = reportsQuery.eq("report_status", "submitted");
  } else {
    reportsQuery = reportsQuery.in("report_status", [
      "submitted",
      "needs_correction",
      "validated",
      "rejected",
    ]);
  }

  const { data: reports, error } = await reportsQuery.order("created_at", {
    ascending: false,
  });

  const missionIds = [
    ...new Set((reports ?? []).map((report) => report.mission_id)),
  ];

  const { data: missions } = missionIds.length
    ? await supabase
        .from("missions")
        .select("id,title,mission_type,status,brand_id,brands(name)")
        .in("id", missionIds)
    : { data: [] };

  const missionById = new Map(
    (missions ?? []).map((mission) => [mission.id, mission]),
  );

  const title = isContributor
    ? "Mes comptes rendus"
    : isReviewer
      ? "Rapports à valider"
      : "Rapports terrain";

  const description = facilitatorOnly
    ? "Tous vos brouillons, corrections et rapports, quelle que soit la marque."
    : isContributor
      ? "Retrouvez vos brouillons, corrections demandées et rapports transmis."
      : isReviewer
        ? "Validation TR1 obligatoire avant clôture d’une mission."
        : "Lecture des comptes rendus terrain partagés avec la marque.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive p-4 text-destructive">
          Impossible de charger les rapports : {error.message}
        </p>
      ) : null}

      {(reports ?? []).map((report) => {
        const mission = missionById.get(report.mission_id);
        const brand = Array.isArray(mission?.brands)
          ? mission?.brands[0]
          : mission?.brands;
        const missionHref = facilitatorOnly
          ? `/dashboard/field/missions/${report.mission_id}`
          : `/dashboard/missions/${report.mission_id}`;

        return (
          <Card key={report.id} data-mission-id={report.mission_id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{mission?.title || "Mission"}</CardTitle>
                  {facilitatorOnly && brand?.name ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {brand.name}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">
                  {presentationLabel(report.report_status)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap">
                {report.summary || "Aucune synthèse enregistrée."}
              </p>

              {report.rejection_reason ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <strong>Retour :</strong> {report.rejection_reason}
                </p>
              ) : null}

              {isReviewer ? (
                <form action={reviewReportAction} className="space-y-3">
                  <input type="hidden" name="reportId" value={report.id} />
                  <input
                    type="hidden"
                    name="missionId"
                    value={report.mission_id}
                  />

                  <Input
                    name="reason"
                    placeholder="Motif obligatoire pour correction ou rejet"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button name="status" value="validated">
                      Valider
                    </Button>
                    <Button
                      name="status"
                      value="needs_correction"
                      variant="outline"
                    >
                      À corriger
                    </Button>
                    <Button
                      name="status"
                      value="rejected"
                      variant="destructive"
                    >
                      Rejeter
                    </Button>
                  </div>
                </form>
              ) : (
                <Button asChild variant="outline">
                  <Link href={missionHref}>
                    {isContributor &&
                    ["draft", "needs_correction"].includes(
                      report.report_status,
                    )
                      ? "Continuer le compte rendu"
                      : "Ouvrir la mission"}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!error && !reports?.length ? (
        <p className="rounded-md border p-8 text-center text-muted-foreground">
          {isReviewer
            ? "Aucun compte rendu à traiter."
            : "Aucun compte rendu disponible."}
        </p>
      ) : null}
    </div>
  );
}

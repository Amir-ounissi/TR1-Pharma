import { notFound } from "next/navigation";
import { ProductEventTracker } from "@/components/agent/product-event-tracker";
import {
  MissionAssignmentForm,
  MissionReportForm,
  MissionScheduleForm,
  MissionStatusForm,
} from "@/components/missions/forms";
import {
  MissionImpact,
  type ImpactRow,
} from "@/components/missions/mission-impact";
import { MissionImpactTracker } from "@/components/missions/mission-impact-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatMissionType } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";
import { uploadMissionAttachmentAction } from "../actions";

const commercialMissionTypes = [
  "commercial_visit",
  "prospecting_visit",
  "reactivation",
  "relationship_visit",
];

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, brand, userId } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role =
    contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";

  const [
    { data: mission },
    { data: report },
    { data: products },
    { data: history },
    { data: attachments },
    { data: impactRows },
  ] = await Promise.all([
    supabase
      .from("missions")
      .select("*")
      .eq("id", id)
      .eq("brand_id", brand.id)
      .maybeSingle(),
    supabase
      .from("mission_reports")
      .select("*")
      .eq("mission_id", id)
      .maybeSingle(),
    supabase
      .from("mission_products")
      .select("id,objective_type,target_quantity,products(name,sku)")
      .eq("mission_id", id),
    supabase
      .from("mission_status_history")
      .select("*")
      .eq("mission_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("mission_attachments")
      .select("*")
      .eq("mission_id", id)
      .is("archived_at", null),
    supabase.rpc("get_mission_impact", {
      target_mission_id: id,
    }),
  ]);

  if (!mission) notFound();

  const isTr1 = role === "tr1_manager" || role === "super_admin";
  const isBrandAdmin = role === "brand_admin";
  const isAssigned = mission.assigned_user_id === userId;
  const canSeeCosts = isTr1 || isBrandAdmin || role === "brand_user";

  let transitionOptions: string[] = [];

  if (isAssigned) {
    if (mission.status === "assigned") {
      transitionOptions = ["accepted", "rejected"];
    } else if (mission.status === "scheduled") {
      transitionOptions = ["in_progress", "no_show"];
    }
  } else if (isTr1) {
    if (mission.status === "requested") {
      transitionOptions = ["to_assign", "cancelled"];
    } else if (
      !["completed", "cancelled", "rejected", "no_show"].includes(
        mission.status,
      ) &&
      !["to_assign", "accepted"].includes(mission.status)
    ) {
      transitionOptions = ["cancelled"];
    }
  } else if (
    isBrandAdmin &&
    ["requested", "to_assign"].includes(mission.status)
  ) {
    transitionOptions = ["cancelled"];
  }

  let candidateUsers: Array<{
    id: string;
    label: string;
    detail?: string;
  }> = [];

  if (isTr1 && mission.status === "to_assign") {
    const { data: members } = await supabase
      .from("memberships")
      .select(
        "user_id,roles!inner(key),users(user_profiles(full_name))",
      )
      .eq("brand_id", brand.id)
      .eq("status", "active")
      .in(
        "roles.key",
        commercialMissionTypes.includes(mission.mission_type)
          ? ["agent"]
          : ["agent", "facilitator"],
      );

    candidateUsers = (members ?? []).map((membership) => {
      const roleRow = Array.isArray(membership.roles)
        ? membership.roles[0]
        : membership.roles;

      const user = Array.isArray(membership.users)
        ? membership.users[0]
        : membership.users;

      const profile = Array.isArray(user?.user_profiles)
        ? user.user_profiles[0]
        : user?.user_profiles;

      return {
        id: membership.user_id,
        label: profile?.full_name || "Intervenant",
        detail:
          roleRow?.key === "facilitator"
            ? "Animateur / formateur"
            : "Agent",
      };
    });
  }

  const reportEditable =
    isAssigned &&
    ["in_progress", "report_pending"].includes(mission.status) &&
    !["submitted", "validated", "rejected"].includes(
      report?.report_status ?? "",
    );

  const canUpload = isAssigned || isTr1;

  return (
    <div className="space-y-6">
      <ProductEventTracker pharmacyId={mission.pharmacy_id} />

      {impactRows?.[0] ? (
        <MissionImpactTracker
          eventName="mission_impact_viewed"
          missionId={id}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{formatMissionType(mission.mission_type)}</Badge>
            <Badge variant="secondary">
              {presentationLabel(mission.status)}
            </Badge>
          </div>

          <h1 className="mt-2 text-2xl font-semibold">{mission.title}</h1>
          <p className="text-muted-foreground">{mission.objective}</p>
        </div>

        <div className="text-right text-sm">
          <p>
            {mission.scheduled_start_at
              ? new Date(mission.scheduled_start_at).toLocaleString("fr-FR")
              : "À planifier"}
          </p>

          {canSeeCosts ? (
            <strong>
              {Number(mission.cost_actual_ht ?? 0).toLocaleString("fr-FR")} € HT
            </strong>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Briefing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">
                {mission.briefing || "Aucun briefing."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {(products ?? []).map((item) => {
                  const product = Array.isArray(item.products)
                    ? item.products[0]
                    : item.products;

                  return (
                    <Badge variant="outline" key={item.id}>
                      {product?.name || "Produit"}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compte rendu</CardTitle>
            </CardHeader>
            <CardContent>
              {reportEditable ? (
                <MissionReportForm
                  missionId={id}
                  missionType={mission.mission_type}
                  pharmacyId={mission.pharmacy_id}
                  report={report}
                  draftScope={`${brand.id}:${userId}`}
                />
              ) : report ? (
                <div className="space-y-3">
                  <Badge variant="secondary">
                    {presentationLabel(report.report_status)}
                  </Badge>

                  <p className="whitespace-pre-wrap">
                    {report.summary || "Aucune synthèse."}
                  </p>

                  {report.rejection_reason ? (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      <strong>Retour TR1 :</strong>{" "}
                      {report.rejection_reason}
                    </p>
                  ) : null}

                  {isAssigned &&
                  report.report_status === "submitted" ? (
                    <p className="text-sm text-muted-foreground">
                      Rapport transmis. Il est verrouillé jusqu’à la décision
                      TR1.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Le compte rendu sera disponible une fois la mission démarrée
                  par l’intervenant.
                </p>
              )}
            </CardContent>
          </Card>

          {impactRows?.[0] ? (
            <MissionImpact impact={impactRows[0] as ImpactRow} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Pièces de mission</CardTitle>
            </CardHeader>
            <CardContent>
              {canUpload ? (
                <form
                  action={uploadMissionAttachmentAction}
                  className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
                >
                  <input type="hidden" name="missionId" value={id} />

                  <Input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                  />

                  <Select name="visibility" defaultValue="shared">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">Partagé</SelectItem>

                      {isTr1 ? (
                        <SelectItem value="tr1_internal">
                          TR1 interne
                        </SelectItem>
                      ) : null}

                      {isAssigned ? (
                        <SelectItem value="provider_private">
                          Privé intervenant
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>

                  <Button>Ajouter</Button>
                </form>
              ) : null}

              <div className={canUpload ? "mt-4 space-y-2" : "space-y-2"}>
                {(attachments ?? []).map((file) => (
                  <div
                    className="flex justify-between rounded border p-2 text-sm"
                    key={file.id}
                  >
                    <span>{file.original_name}</span>
                    <Badge variant="outline">
                      {presentationLabel(file.visibility)}
                    </Badge>
                  </div>
                ))}

                {!attachments?.length ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune pièce visible.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {isTr1 && mission.status === "to_assign" ? (
            <Card>
              <CardHeader>
                <CardTitle>Affecter l’intervenant</CardTitle>
              </CardHeader>
              <CardContent>
                <MissionAssignmentForm
                  missionId={id}
                  users={candidateUsers}
                />
              </CardContent>
            </Card>
          ) : null}

          {isTr1 && mission.status === "accepted" ? (
            <Card>
              <CardHeader>
                <CardTitle>Planification définitive</CardTitle>
              </CardHeader>
              <CardContent>
                <MissionScheduleForm
                  missionId={id}
                  defaultStart={mission.scheduled_start_at}
                  defaultEnd={mission.scheduled_end_at}
                />
              </CardContent>
            </Card>
          ) : null}

          {transitionOptions.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Étape suivante</CardTitle>
              </CardHeader>
              <CardContent>
                <MissionStatusForm
                  missionId={id}
                  options={transitionOptions}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Statut :</strong>{" "}
                {presentationLabel(mission.status)}
              </p>
              <p>
                <strong>Intervenant :</strong>{" "}
                {mission.assigned_user_id
                  ? "Affecté"
                  : "À affecter"}
              </p>
              <p>
                <strong>Planification :</strong>{" "}
                {mission.scheduled_start_at
                  ? new Date(
                      mission.scheduled_start_at,
                    ).toLocaleString("fr-FR")
                  : "À confirmer"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(history ?? []).map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 pl-3 text-sm"
                >
                  <strong>
                    {presentationLabel(entry.new_status)}
                  </strong>
                  <p className="text-muted-foreground">
                    {new Date(entry.changed_at).toLocaleString("fr-FR")}
                    {" · "}
                    {presentationLabel(entry.source)}
                  </p>
                  {entry.reason ? (
                    <p className="text-xs text-muted-foreground">
                      {entry.reason}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

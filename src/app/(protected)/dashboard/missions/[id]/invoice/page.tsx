import { notFound } from "next/navigation";
import {
  AnimationInvoiceCard,
  type AnimationInvoice,
} from "@/components/missions/animation-invoice-card";
import { Badge } from "@/components/ui/badge";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { presentationLabel } from "@/lib/presentation";

export default async function AnimationInvoicePage({
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
    { data: invoice },
    { data: report },
  ] = await Promise.all([
    supabase
      .from("missions")
      .select(
        "id,brand_id,mission_type,status,title,requested_by,managed_by,assigned_user_id,cost_actual_ht,cost_estimated_ht,provider_cost_ht,travel_cost_ht,scheduled_start_at",
      )
      .eq("id", id)
      .eq("brand_id", brand.id)
      .maybeSingle(),
    supabase
      .from("animation_invoices")
      .select(
        "id,attachment_id,invoice_number,amount_ht,vat_amount,amount_ttc,status,review_note,submitted_at,reviewed_at,paid_at,facilitator_user_id",
      )
      .eq("mission_id", id)
      .maybeSingle(),
    supabase
      .from("mission_reports")
      .select("report_status")
      .eq("mission_id", id)
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  if (!mission || mission.mission_type !== "animation") notFound();

  let invoiceUrl: string | null = null;
  if (invoice?.attachment_id) {
    const { data: attachment } = await supabase
      .from("mission_attachments")
      .select("object_path")
      .eq("id", invoice.attachment_id)
      .eq("mission_id", id)
      .maybeSingle();

    if (attachment?.object_path) {
      const { data: signed } = await supabase.storage
        .from("mission-evidence")
        .createSignedUrl(attachment.object_path, 900);
      invoiceUrl = signed?.signedUrl ?? null;
    }
  }

  const isTr1 = role === "tr1_manager" || role === "super_admin";
  const isBrandAdmin = role === "brand_admin";
  const isAssigned = mission.assigned_user_id === userId;
  const isFacilitator = role === "facilitator";
  const isDatedAnimation = Boolean(mission.scheduled_start_at);
  const reportValidated = report?.report_status === "validated";
  const invoiceStatus = invoice?.status ?? null;

  const canSubmit =
    isAssigned &&
    isFacilitator &&
    isDatedAnimation &&
    mission.status === "completed" &&
    reportValidated &&
    (!invoice || invoiceStatus === "rejected");

  const canReview = Boolean(
    invoice &&
      invoiceStatus === "submitted" &&
      invoice.facilitator_user_id !== userId &&
      (isTr1 ||
        isBrandAdmin ||
        mission.requested_by === userId ||
        mission.managed_by === userId),
  );

  const canMarkPaid = Boolean(
    invoice &&
      invoiceStatus === "approved" &&
      invoice.facilitator_user_id !== userId &&
      (isTr1 || isBrandAdmin),
  );

  const expectedAmountHt = Number(
    mission.cost_actual_ht ?? mission.cost_estimated_ht ?? 0,
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{presentationLabel(mission.status)}</Badge>
          {mission.scheduled_start_at ? (
            <span className="text-sm text-muted-foreground">
              {new Date(mission.scheduled_start_at).toLocaleString("fr-FR")}
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Facturation · {mission.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une facture correspond à une journée d’animation réalisée, clôturée et validée.
        </p>
      </header>

      {!isDatedAnimation ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          Cette demande d’animation n’est pas encore planifiée. La facturation
          sera disponible une fois une journée réalisée et clôturée.
        </div>
      ) : null}

      {isAssigned && isFacilitator && mission.status === "completed" && !reportValidated ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          La facture sera disponible dès que le compte rendu de l’animation aura
          été validé.
        </div>
      ) : null}

      <AnimationInvoiceCard
        missionId={id}
        invoice={(invoice as AnimationInvoice | null) ?? null}
        invoiceUrl={invoiceUrl}
        canSubmit={canSubmit}
        canReview={canReview}
        canMarkPaid={canMarkPaid}
        expectedAmountHt={expectedAmountHt}
      />
    </div>
  );
}

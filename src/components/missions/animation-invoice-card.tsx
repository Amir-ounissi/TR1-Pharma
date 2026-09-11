"use client";

import { useActionState } from "react";
import {
  markAnimationInvoicePaidAction,
  reviewAnimationInvoiceAction,
  submitAnimationInvoiceAction,
} from "@/app/(protected)/dashboard/missions/invoice-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type AnimationInvoice = {
  id: string;
  invoice_number: string;
  amount_ht: number | string;
  vat_amount: number | string;
  amount_ttc: number | string;
  status: "submitted" | "approved" | "rejected" | "paid";
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
};

const statusLabels: Record<AnimationInvoice["status"], string> = {
  submitted: "À valider",
  approved: "Validée",
  rejected: "À corriger",
  paid: "Payée",
};

function euro(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

export function AnimationInvoiceCard({
  missionId,
  invoice,
  canSubmit,
  canReview,
  canMarkPaid,
  expectedAmountHt,
}: {
  missionId: string;
  invoice: AnimationInvoice | null;
  canSubmit: boolean;
  canReview: boolean;
  canMarkPaid: boolean;
  expectedAmountHt: number;
}) {
  const [submitState, submitAction, submitting] = useActionState(
    submitAnimationInvoiceAction,
    {},
  );
  const [reviewState, reviewAction, reviewing] = useActionState(
    reviewAnimationInvoiceAction,
    {},
  );
  const [paymentState, paymentAction, markingPaid] = useActionState(
    markAnimationInvoicePaidAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Facturation animation</CardTitle>
          {invoice ? (
            <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>
              {statusLabels[invoice.status]}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          La facture est rattachée à cette journée d’animation. TR1 suit sa
          validation et son paiement, sans exécuter le paiement.
        </p>

        {expectedAmountHt > 0 ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">Montant mission prévu : </span>
            <strong>{euro(expectedAmountHt)} HT</strong>
          </div>
        ) : null}

        {invoice ? (
          <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Facture : </span><strong>{invoice.invoice_number}</strong></p>
            <p><span className="text-muted-foreground">HT : </span><strong>{euro(invoice.amount_ht)}</strong></p>
            <p><span className="text-muted-foreground">TVA : </span>{euro(invoice.vat_amount)}</p>
            <p><span className="text-muted-foreground">TTC : </span><strong>{euro(invoice.amount_ttc)}</strong></p>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Transmise le {new Date(invoice.submitted_at).toLocaleString("fr-FR")}
              {invoice.paid_at ? ` · Paiement enregistré le ${new Date(invoice.paid_at).toLocaleString("fr-FR")}` : ""}
            </p>
            {invoice.review_note ? (
              <p className="sm:col-span-2 rounded-md bg-muted/50 p-2">
                <strong>Retour : </strong>{invoice.review_note}
              </p>
            ) : null}
          </div>
        ) : null}

        {canSubmit ? (
          <form action={submitAction} className="space-y-4">
            <ActionFeedback {...submitState} />
            <input type="hidden" name="missionId" value={missionId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`invoice-number-${missionId}`}>N° de facture</Label>
                <Input
                  id={`invoice-number-${missionId}`}
                  name="invoiceNumber"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`invoice-file-${missionId}`}>Facture PDF</Label>
                <Input
                  id={`invoice-file-${missionId}`}
                  name="invoiceFile"
                  type="file"
                  accept="application/pdf"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`invoice-ht-${missionId}`}>Montant HT</Label>
                <Input
                  id={`invoice-ht-${missionId}`}
                  name="amountHt"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={expectedAmountHt > 0 ? expectedAmountHt.toFixed(2) : ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`invoice-vat-${missionId}`}>TVA</Label>
                <Input
                  id={`invoice-vat-${missionId}`}
                  name="vatAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  required
                />
              </div>
            </div>
            <Button disabled={submitting}>
              {submitting
                ? "Transmission…"
                : invoice?.status === "rejected"
                  ? "Renvoyer la facture"
                  : "Transmettre la facture"}
            </Button>
          </form>
        ) : null}

        {invoice && canReview ? (
          <form action={reviewAction} className="space-y-3 border-t pt-4">
            <ActionFeedback {...reviewState} />
            <input type="hidden" name="missionId" value={missionId} />
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <div className="space-y-2">
              <Label htmlFor={`invoice-review-${invoice.id}`}>
                Commentaire de validation
              </Label>
              <Textarea
                id={`invoice-review-${invoice.id}`}
                name="reviewNote"
                maxLength={2000}
                placeholder="Obligatoire en cas de refus"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                name="decision"
                value="approved"
                disabled={reviewing}
              >
                Valider la facture
              </Button>
              <Button
                name="decision"
                value="rejected"
                variant="outline"
                disabled={reviewing}
              >
                Demander une correction
              </Button>
            </div>
          </form>
        ) : null}

        {invoice && canMarkPaid ? (
          <form action={paymentAction} className="border-t pt-4">
            <ActionFeedback {...paymentState} />
            <input type="hidden" name="missionId" value={missionId} />
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <Button className="mt-3" disabled={markingPaid}>
              {markingPaid ? "Enregistrement…" : "Marquer comme payée"}
            </Button>
          </form>
        ) : null}

        {!invoice && !canSubmit ? (
          <p className="text-sm text-muted-foreground">
            La facture pourra être transmise par l’animateur une fois l’animation
            clôturée et le compte rendu validé.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

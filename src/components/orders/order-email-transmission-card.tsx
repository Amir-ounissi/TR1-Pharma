"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  disconnectGmailAction,
  sendOrderByEmailAction,
  updatePharmacyVatNumberAction,
  uploadPharmacyDocumentAction,
  type OrderTransmissionActionState,
} from "@/app/(protected)/dashboard/orders/transmission-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalizedFileInput } from "@/components/ui/localized-file-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: OrderTransmissionActionState = {};
const pharmacyDocumentAccept = "application/pdf,image/jpeg,image/png";

function Feedback({ state }: { state: OrderTransmissionActionState }) {
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.success) return <p className="text-sm text-emerald-700">{state.success}</p>;
  return null;
}

function Requirement({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Badge variant={ready ? "default" : "outline"}>{ready ? "Prêt" : "À compléter"}</Badge>
    </div>
  );
}

function gmailMessageUrl(senderEmail: string, messageId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(senderEmail)}#all/${encodeURIComponent(messageId)}`;
}

export type OrderEmailTransmission = {
  id: string;
  status: string;
  sender_email: string | null;
  recipient_email: string;
  subject: string;
  external_message_id: string | null;
  attachment_manifest: Array<{ filename?: string; content_type?: string }> | null;
  body_text: string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
};

export function OrderEmailTransmissionCard({
  orderId,
  gmailEmail,
  recipientEmail,
  vatNumber,
  hasKbis,
  hasRib,
  previewSubject,
  transmissions,
}: {
  orderId: string;
  gmailEmail: string | null;
  recipientEmail: string | null;
  vatNumber: string | null;
  hasKbis: boolean;
  hasRib: boolean;
  previewSubject: string;
  transmissions: OrderEmailTransmission[];
}) {
  const [vatState, vatAction, vatPending] = useActionState(updatePharmacyVatNumberAction, initialState);
  const [kbisState, kbisAction, kbisPending] = useActionState(uploadPharmacyDocumentAction, initialState);
  const [ribState, ribAction, ribPending] = useActionState(uploadPharmacyDocumentAction, initialState);
  const [sendState, sendAction, sendPending] = useActionState(sendOrderByEmailAction, initialState);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);

  const ready = Boolean(gmailEmail && recipientEmail && vatNumber && hasKbis && hasRib);
  const canSend = ready && previewConfirmed;
  const returnTo = `/dashboard/orders/${orderId}`;
  const pdfUrl = `/api/orders/${orderId}/pdf`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Transmission de la commande</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrôle des pièces, prévisualisation obligatoire du bon de commande puis envoi depuis votre Gmail.
            </p>
          </div>
          <Badge variant={canSend ? "default" : "outline"}>
            {canSend ? "Prête à envoyer" : ready ? "BDC à vérifier" : "Préparation"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
          <Requirement ready={Boolean(gmailEmail)} label="Gmail connecté" />
          <Requirement ready={Boolean(recipientEmail)} label="Email commandes marque" />
          <Requirement ready={Boolean(vatNumber)} label="N° TVA pharmacie" />
          <Requirement ready={hasKbis} label="KBIS" />
          <Requirement ready={hasRib} label="RIB" />
          <Requirement ready={previewConfirmed} label="Bon de commande vérifié" />
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Compte d’envoi</p>
              <p className="text-sm text-muted-foreground">{gmailEmail || "Aucun compte Gmail connecté"}</p>
            </div>
            {gmailEmail ? (
              <form action={disconnectGmailAction}>
                <input type="hidden" name="orderId" value={orderId} />
                <Button type="submit" variant="outline" size="sm">Déconnecter</Button>
              </form>
            ) : (
              <Button asChild size="sm">
                <Link href={`/api/integrations/gmail/connect?returnTo=${encodeURIComponent(returnTo)}`}>Connecter Gmail</Link>
              </Button>
            )}
          </div>
        </div>

        {!vatNumber ? (
          <form action={vatAction} className="space-y-2 rounded-xl border p-4">
            <input type="hidden" name="orderId" value={orderId} />
            <label className="text-sm font-medium" htmlFor="vatNumber">Numéro de TVA de la pharmacie</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="vatNumber"
                name="vatNumber"
                required
                placeholder="FR..."
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <Button type="submit" disabled={vatPending}>{vatPending ? "Enregistrement…" : "Enregistrer"}</Button>
            </div>
            <Feedback state={vatState} />
          </form>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <form action={kbisAction} className="space-y-2 rounded-xl border p-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="documentType" value="kbis" />
            <label className="text-sm font-medium" htmlFor={`kbis-${orderId}`}>KBIS {hasKbis ? "· enregistré" : ""}</label>
            <LocalizedFileInput id={`kbis-${orderId}`} name="file" accept={pharmacyDocumentAccept} required />
            <p className="text-xs text-muted-foreground">PDF ou photo · JPG/PNG · 10 Mo max. Sur mobile, vous pouvez prendre la photo directement.</p>
            <Button type="submit" variant="outline" size="sm" disabled={kbisPending}>{kbisPending ? "Envoi…" : hasKbis ? "Remplacer" : "Ajouter / photographier le KBIS"}</Button>
            <Feedback state={kbisState} />
          </form>

          <form action={ribAction} className="space-y-2 rounded-xl border p-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="documentType" value="rib" />
            <label className="text-sm font-medium" htmlFor={`rib-${orderId}`}>RIB {hasRib ? "· enregistré" : ""}</label>
            <LocalizedFileInput id={`rib-${orderId}`} name="file" accept={pharmacyDocumentAccept} required />
            <p className="text-xs text-muted-foreground">PDF ou photo · JPG/PNG · 10 Mo max. Sur mobile, vous pouvez prendre la photo directement.</p>
            <Button type="submit" variant="outline" size="sm" disabled={ribPending}>{ribPending ? "Envoi…" : hasRib ? "Remplacer" : "Ajouter / photographier le RIB"}</Button>
            <Feedback state={ribState} />
          </form>
        </div>

        <div className="space-y-4 rounded-xl border bg-muted/20 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">Prévisualisation avant envoi</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vérifiez le document exact qui sera joint à l’email avant d’autoriser l’envoi.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen((open) => !open)}
            >
              {previewOpen ? "Masquer le BDC" : "Prévisualiser le BDC"}
            </Button>
          </div>

          <div className="grid gap-2">
            <p><span className="text-muted-foreground">À :</span> {recipientEmail || "Non configuré dans la marque"}</p>
            <p><span className="text-muted-foreground">Objet :</span> {previewSubject}</p>
            <p><span className="text-muted-foreground">Pièces jointes :</span> bon de commande PDF, KBIS, RIB</p>
          </div>

          {previewOpen ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border bg-background">
                <iframe
                  src={pdfUrl}
                  title="Prévisualisation du bon de commande"
                  className="h-[680px] w-full"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Ouvrir le PDF dans un nouvel onglet
                </a>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={previewConfirmed}
                    onChange={(event) => setPreviewConfirmed(event.target.checked)}
                    className="h-4 w-4"
                  />
                  J’ai vérifié le bon de commande
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <form action={sendAction} className="space-y-2">
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" disabled={!canSend || sendPending} className="w-full sm:w-auto">
            {sendPending ? "Envoi en cours…" : "Envoyer la commande par Gmail"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {!ready
              ? "Complétez les éléments manquants avant l’envoi."
              : !previewConfirmed
                ? "Prévisualisez puis validez le bon de commande pour activer l’envoi."
                : "Aucun envoi automatique : cette action nécessite votre clic."}
          </p>
          <Feedback state={sendState} />
        </form>

        {transmissions.length ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Historique des envois</p>
            {transmissions.map((transmission) => {
              const canOpenGmail = Boolean(
                transmission.status === "sent" &&
                transmission.external_message_id &&
                transmission.sender_email,
              );

              return (
                <div key={transmission.id} className="space-y-3 rounded-lg border p-3 text-xs">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p>{transmission.sender_email || "Gmail"} → {transmission.recipient_email}</p>
                      <p className="text-muted-foreground">{new Date(transmission.sent_at || transmission.created_at).toLocaleString("fr-FR")}</p>
                      {transmission.error_message ? <p className="text-destructive">{transmission.error_message}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canOpenGmail ? (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={gmailMessageUrl(transmission.sender_email!, transmission.external_message_id!)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Voir le mail
                          </a>
                        </Button>
                      ) : null}
                      <Badge variant={transmission.status === "sent" ? "default" : "outline"}>
                        {transmission.status === "sent" ? "Envoyée" : transmission.status === "failed" ? "Échec" : "En cours"}
                      </Badge>
                    </div>
                  </div>

                  <details className="rounded-md bg-muted/30 p-3">
                    <summary className="cursor-pointer font-medium">Voir le contenu</summary>
                    <div className="mt-3 space-y-2">
                      <p><span className="text-muted-foreground">Objet :</span> {transmission.subject}</p>
                      {transmission.body_text ? (
                        <p className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm">{transmission.body_text}</p>
                      ) : (
                        <p className="text-muted-foreground">Le texte exact n’a pas été archivé pour cet ancien envoi. Utilisez « Voir le mail » pour consulter le message original dans Gmail.</p>
                      )}
                      {transmission.attachment_manifest?.length ? (
                        <div>
                          <p className="text-muted-foreground">Pièces jointes :</p>
                          <ul className="mt-1 list-disc pl-5">
                            {transmission.attachment_manifest.map((attachment, index) => (
                              <li key={`${attachment.filename || "piece-jointe"}-${index}`}>{attachment.filename || "Pièce jointe"}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

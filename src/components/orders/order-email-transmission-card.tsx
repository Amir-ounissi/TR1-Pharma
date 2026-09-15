"use client";

import { useActionState } from "react";
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

  const ready = Boolean(gmailEmail && recipientEmail && vatNumber && hasKbis && hasRib);
  const returnTo = `/dashboard/orders/${orderId}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Transmission de la commande</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrôle des pièces, génération du bon de commande puis envoi depuis votre Gmail.
            </p>
          </div>
          <Badge variant={ready ? "default" : "outline"}>{ready ? "Prête à envoyer" : "Préparation"}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
          <Requirement ready={Boolean(gmailEmail)} label="Gmail connecté" />
          <Requirement ready={Boolean(recipientEmail)} label="Email commandes marque" />
          <Requirement ready={Boolean(vatNumber)} label="N° TVA pharmacie" />
          <Requirement ready={hasKbis} label="KBIS" />
          <Requirement ready={hasRib} label="RIB" />
          <Requirement ready label="Bon de commande PDF" />
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
            <input id={`kbis-${orderId}`} name="file" type="file" accept={pharmacyDocumentAccept} required className="block w-full text-sm" />
            <p className="text-xs text-muted-foreground">PDF ou photo · JPG/PNG · 10 Mo max. Sur mobile, vous pouvez prendre la photo directement.</p>
            <Button type="submit" variant="outline" size="sm" disabled={kbisPending}>{kbisPending ? "Envoi…" : hasKbis ? "Remplacer" : "Ajouter / photographier le KBIS"}</Button>
            <Feedback state={kbisState} />
          </form>

          <form action={ribAction} className="space-y-2 rounded-xl border p-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="documentType" value="rib" />
            <label className="text-sm font-medium" htmlFor={`rib-${orderId}`}>RIB {hasRib ? "· enregistré" : ""}</label>
            <input id={`rib-${orderId}`} name="file" type="file" accept={pharmacyDocumentAccept} required className="block w-full text-sm" />
            <p className="text-xs text-muted-foreground">PDF ou photo · JPG/PNG · 10 Mo max. Sur mobile, vous pouvez prendre la photo directement.</p>
            <Button type="submit" variant="outline" size="sm" disabled={ribPending}>{ribPending ? "Envoi…" : hasRib ? "Remplacer" : "Ajouter / photographier le RIB"}</Button>
            <Feedback state={ribState} />
          </form>
        </div>

        <div className="space-y-2 rounded-xl border bg-muted/20 p-4 text-sm">
          <p className="font-medium">Prévisualisation</p>
          <p><span className="text-muted-foreground">À :</span> {recipientEmail || "Non configuré dans la marque"}</p>
          <p><span className="text-muted-foreground">Objet :</span> {previewSubject}</p>
          <p><span className="text-muted-foreground">Pièces jointes :</span> bon de commande PDF, KBIS, RIB</p>
        </div>

        <form action={sendAction} className="space-y-2">
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" disabled={!ready || sendPending} className="w-full sm:w-auto">
            {sendPending ? "Envoi en cours…" : "Envoyer la commande par Gmail"}
          </Button>
          <p className="text-xs text-muted-foreground">Aucun envoi automatique : cette action nécessite votre clic.</p>
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

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  disconnectGmailAction,
  lookupPharmacyVatNumberAction,
  sendOrderByEmailAction,
  updatePharmacyVatNumberAction,
  uploadPharmacyDocumentAction,
  type OrderTransmissionActionState,
} from "@/app/(protected)/dashboard/orders/transmission-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalizedFileInput } from "@/components/ui/localized-file-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderTransmissionDocumentType } from "@/lib/orders/order-email-transmission";

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

function DocumentUpload({
  orderId,
  documentType,
  hasDocument,
  action,
  pending,
  state,
}: {
  orderId: string;
  documentType: OrderTransmissionDocumentType;
  hasDocument: boolean;
  action: (payload: FormData) => void;
  pending: boolean;
  state: OrderTransmissionActionState;
}) {
  const label = documentType.toUpperCase();
  return (
    <form action={action} className="space-y-2 rounded-xl border p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="documentType" value={documentType} />
      <label className="text-sm font-medium" htmlFor={`${documentType}-${orderId}`}>
        {label} {hasDocument ? "· enregistré" : ""}
      </label>
      <LocalizedFileInput
        id={`${documentType}-${orderId}`}
        name="file"
        accept={pharmacyDocumentAccept}
        required
      />
      <p className="text-xs text-muted-foreground">
        PDF ou photo · JPG/PNG · 10 Mo max. Sur mobile, vous pouvez prendre la photo directement.
      </p>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Envoi…" : hasDocument ? "Remplacer" : `Ajouter / photographier le ${label}`}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function OrderEmailTransmissionCard({
  orderId,
  gmailEmail,
  recipientEmail,
  ccEmails,
  vatNumber,
  pharmacySiret,
  requireVat,
  requiredDocuments,
  hasKbis,
  hasRib,
  previewSubject,
  previewBody,
  transmissions,
}: {
  orderId: string;
  gmailEmail: string | null;
  recipientEmail: string | null;
  ccEmails: string[];
  vatNumber: string | null;
  pharmacySiret: string | null;
  requireVat: boolean;
  requiredDocuments: OrderTransmissionDocumentType[];
  hasKbis: boolean;
  hasRib: boolean;
  previewSubject: string;
  previewBody: string;
  transmissions: OrderEmailTransmission[];
}) {
  const [vatLookupState, vatLookupAction, vatLookupPending] = useActionState(lookupPharmacyVatNumberAction, initialState);
  const [vatState, vatAction, vatPending] = useActionState(updatePharmacyVatNumberAction, initialState);
  const [kbisState, kbisAction, kbisPending] = useActionState(uploadPharmacyDocumentAction, initialState);
  const [ribState, ribAction, ribPending] = useActionState(uploadPharmacyDocumentAction, initialState);
  const [sendState, sendAction, sendPending] = useActionState(sendOrderByEmailAction, initialState);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [toEmail, setToEmail] = useState(recipientEmail ?? "");
  const [ccInput, setCcInput] = useState(ccEmails.join(", "));
  const [subject, setSubject] = useState(previewSubject);
  const [body, setBody] = useState(previewBody);

  const requiresKbis = requiredDocuments.includes("kbis");
  const requiresRib = requiredDocuments.includes("rib");
  const documentsReady = (!requiresKbis || hasKbis) && (!requiresRib || hasRib);
  const ready = Boolean(
    gmailEmail &&
      toEmail.trim() &&
      (!requireVat || vatNumber) &&
      documentsReady,
  );
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
              Préparez le mail, vérifiez le bon de commande, puis envoyez-le depuis votre Gmail connecté.
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
          <Requirement ready={Boolean(toEmail.trim())} label="Destinataire" />
          {requireVat ? <Requirement ready={Boolean(vatNumber)} label="N° TVA pharmacie" /> : null}
          {requiresKbis ? <Requirement ready={hasKbis} label="KBIS" /> : null}
          {requiresRib ? <Requirement ready={hasRib} label="RIB" /> : null}
          <Requirement ready={previewConfirmed} label="Bon de commande vérifié" />
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Compte d’envoi Gmail</p>
              <p className="text-sm text-muted-foreground">{gmailEmail || "Aucun compte Gmail connecté"}</p>
            </div>
            {gmailEmail ? (
              <form action={disconnectGmailAction}>
                <input type="hidden" name="orderId" value={orderId} />
                <Button type="submit" variant="outline" size="sm">Déconnecter</Button>
              </form>
            ) : (
              <Button asChild size="sm">
                <Link href={`/api/integrations/gmail/connect?returnTo=${encodeURIComponent(returnTo)}`}>
                  Connecter Gmail
                </Link>
              </Button>
            )}
          </div>
        </div>

        {requireVat && !vatNumber ? (
          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Numéro de TVA de la pharmacie</p>
              <p className="mt-1 text-xs text-muted-foreground">
                TR1 peut le rechercher automatiquement dans l’Annuaire des Entreprises. En cas de doute sur l’identité de la société, aucun numéro n’est enregistré.
              </p>
            </div>

            <form action={vatLookupAction} className="space-y-3">
              <input type="hidden" name="orderId" value={orderId} />
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor={`vat-siret-${orderId}`}>
                    SIRET pour sécuriser la recherche
                  </label>
                  <input
                    id={`vat-siret-${orderId}`}
                    name="siret"
                    defaultValue={pharmacySiret ?? ""}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="14 chiffres"
                    maxLength={20}
                    className="h-10 w-full rounded-md border bg-background px-3 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Facultatif si l’identification est unique. En cas de plusieurs sociétés homonymes, saisissez le SIRET exact puis relancez.
                  </p>
                </div>
                <Button type="submit" disabled={vatLookupPending}>
                  {vatLookupPending ? "Recherche officielle…" : "Rechercher la TVA"}
                </Button>
              </div>
              <Feedback state={vatLookupState} />
            </form>

            <details className="rounded-lg border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">Saisir la TVA manuellement</summary>
              <form action={vatAction} className="mt-3 space-y-2">
                <input type="hidden" name="orderId" value={orderId} />
                <label className="sr-only" htmlFor="vatNumber">Numéro de TVA</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="vatNumber"
                    name="vatNumber"
                    required
                    placeholder="FR..."
                    className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                  />
                  <Button type="submit" variant="outline" disabled={vatPending}>
                    {vatPending ? "Enregistrement…" : "Enregistrer manuellement"}
                  </Button>
                </div>
                <Feedback state={vatState} />
              </form>
            </details>
          </div>
        ) : null}

        {requiredDocuments.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {requiresKbis ? (
              <DocumentUpload
                orderId={orderId}
                documentType="kbis"
                hasDocument={hasKbis}
                action={kbisAction}
                pending={kbisPending}
                state={kbisState}
              />
            ) : null}
            {requiresRib ? (
              <DocumentUpload
                orderId={orderId}
                documentType="rib"
                hasDocument={hasRib}
                action={ribAction}
                pending={ribPending}
                state={ribState}
              />
            ) : null}
          </div>
        ) : null}

        <form action={sendAction} className="space-y-6">
          <input type="hidden" name="orderId" value={orderId} />

          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="font-medium">Aperçu du mail</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Le mail est prérempli automatiquement. Vous pouvez modifier les destinataires, l’objet et le message uniquement pour cet envoi.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">De</label>
                <div className="h-10 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {gmailEmail || "Connectez Gmail pour envoyer"}
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor={`recipient-${orderId}`}>À</label>
                <input
                  id={`recipient-${orderId}`}
                  name="recipientEmail"
                  type="email"
                  required
                  value={toEmail}
                  onChange={(event) => setToEmail(event.target.value)}
                  placeholder="commandes@marque.fr"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor={`cc-${orderId}`}>Cc</label>
                <input
                  id={`cc-${orderId}`}
                  name="ccEmails"
                  value={ccInput}
                  onChange={(event) => setCcInput(event.target.value)}
                  placeholder="manager@marque.fr, logistique@marque.fr"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
                <p className="text-xs text-muted-foreground">Séparez plusieurs adresses par une virgule.</p>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor={`subject-${orderId}`}>Objet</label>
                <input
                  id={`subject-${orderId}`}
                  name="subject"
                  required
                  maxLength={300}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor={`body-${orderId}`}>Message</label>
                <textarea
                  id={`body-${orderId}`}
                  name="body"
                  rows={10}
                  maxLength={20000}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-56 rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Pièces jointes : bon de commande PDF
                {requiresKbis ? ", KBIS" : ""}
                {requiresRib ? ", RIB" : ""}.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">Bon de commande joint</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vérifiez le PDF exact qui sera joint au mail avant d’autoriser l’envoi.
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

          <div className="space-y-2">
            <Button type="submit" disabled={!canSend || sendPending} className="w-full sm:w-auto">
              {sendPending ? "Envoi en cours…" : "Envoyer via Gmail"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {!ready
                ? "Complétez les éléments manquants avant l’envoi."
                : !previewConfirmed
                  ? "Prévisualisez puis validez le bon de commande pour activer l’envoi."
                  : "Le mail ne part qu’après votre clic sur « Envoyer via Gmail »."}
            </p>
            <Feedback state={sendState} />
          </div>
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
                      <p className="text-muted-foreground">
                        {new Date(transmission.sent_at || transmission.created_at).toLocaleString("fr-FR")}
                      </p>
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
                        <p className="text-muted-foreground">
                          Le texte exact n’a pas été archivé pour cet ancien envoi. Utilisez « Voir le mail » pour consulter le message original dans Gmail.
                        </p>
                      )}
                      {transmission.attachment_manifest?.length ? (
                        <div>
                          <p className="text-muted-foreground">Pièces jointes :</p>
                          <ul className="mt-1 list-disc pl-5">
                            {transmission.attachment_manifest.map((attachment, index) => (
                              <li key={`${attachment.filename || "piece-jointe"}-${index}`}>
                                {attachment.filename || "Pièce jointe"}
                              </li>
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

"use client";

import { useActionState, useMemo, useState } from "react";
import { approveAccessRequestAction, rejectAccessRequestAction } from "@/app/(protected)/dashboard/admin/access-requests/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Brand = { id: string; name: string };
type Pharmacy = { id: string; brandId: string; name: string; city: string | null };

export type AccessRequestCardData = {
  id: string;
  fullName: string;
  email: string;
  profileType: "brand" | "agent" | "facilitator";
  requestedAccess: Record<string, unknown>;
  createdAt: string;
};

export function AccessRequestReviewCard({ request, brands, pharmacies }: {
  request: AccessRequestCardData;
  brands: Brand[];
  pharmacies: Pharmacy[];
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [selectedPharmacyIds, setSelectedPharmacyIds] = useState<string[]>([]);
  const [approveState, approveAction, approving] = useActionState(approveAccessRequestAction, {});
  const [rejectState, rejectAction, rejecting] = useActionState(rejectAccessRequestAction, {});
  const matchingPharmacies = useMemo(() => pharmacies.filter((pharmacy) => pharmacy.brandId === brandId), [brandId, pharmacies]);
  const isAgent = request.profileType === "agent";

  const setBrand = (nextBrandId: string) => {
    setBrandId(nextBrandId);
    setSelectedPharmacyIds([]);
  };

  const togglePharmacy = (pharmacyId: string) => {
    setSelectedPharmacyIds((current) => current.includes(pharmacyId)
      ? current.filter((id) => id !== pharmacyId)
      : [...current, pharmacyId]);
  };

  return (
    <Card className="border-[var(--tr1-line-strong)]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{request.fullName}</CardTitle>
            <CardDescription>{request.email} · demandée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(request.createdAt))}</CardDescription>
          </div>
          <Badge>{profileLabels[request.profileType]}</Badge>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(request.requestedAccess).filter(([, value]) => typeof value === "string").map(([key, value]) => (
            <div key={key} className="rounded-lg bg-muted/50 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{fieldLabels[key] ?? key}</dt>
              <dd className="mt-0.5 font-medium">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={approveAction} className="space-y-4 rounded-xl border bg-card p-4">
          <input type="hidden" name="requestId" value={request.id} />
          {approveState.error || approveState.success ? <Alert variant={approveState.error ? "destructive" : "default"}><AlertDescription>{approveState.error ?? approveState.success}</AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor={`brand-${request.id}`}>Marque à attribuer</Label>
            <select id={`brand-${request.id}`} name="targetBrandId" value={brandId} onChange={(event) => setBrand(event.target.value)} required className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Sélectionner une marque</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>
          {isAgent ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Pharmacies initiales</legend>
              <p className="text-xs text-muted-foreground">Facultatif : vous pourrez attribuer les pharmacies plus tard depuis l’administration.</p>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border p-3">
                {matchingPharmacies.map((pharmacy) => (
                  <label className="flex items-center gap-2 text-sm" key={pharmacy.id}>
                    <input type="checkbox" name="pharmacyIds" value={pharmacy.id} checked={selectedPharmacyIds.includes(pharmacy.id)} onChange={() => togglePharmacy(pharmacy.id)} />
                    <span>{pharmacy.name}{pharmacy.city ? ` · ${pharmacy.city}` : ""}</span>
                  </label>
                ))}
                {!matchingPharmacies.length ? <p className="text-sm text-muted-foreground">Aucune pharmacie active pour cette marque.</p> : null}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{request.profileType === "brand" ? "L’accès sera activé comme administrateur de cette marque." : "L’accès sera activé comme intervenant. Les missions seront attribuées ensuite."}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor={`approval-note-${request.id}`}>Note interne (facultative)</Label>
            <Textarea id={`approval-note-${request.id}`} name="reviewerNote" maxLength={500} placeholder="Contexte de l’attribution…" />
          </div>
          <Button disabled={approving || rejecting}>{approving ? "Activation…" : "Approuver et activer"}</Button>
        </form>

        <form action={rejectAction} className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
          <input type="hidden" name="requestId" value={request.id} />
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`rejection-note-${request.id}`}>Motif de refus</Label>
            <Textarea id={`rejection-note-${request.id}`} name="reviewerNote" required minLength={3} maxLength={500} placeholder="Expliquez la décision pour garder une trace." />
          </div>
          <Button variant="outline" disabled={approving || rejecting}>{rejecting ? "Refus…" : "Refuser"}</Button>
          {rejectState.error || rejectState.success ? <p className={rejectState.error ? "text-sm text-destructive" : "text-sm text-emerald-700"}>{rejectState.error ?? rejectState.success}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}

const profileLabels = { brand: "Demande marque", agent: "Demande agent", facilitator: "Demande intervenant" };
const fieldLabels: Record<string, string> = {
  company_name: "Marque ou société",
  job_title: "Fonction",
  organization: "Structure actuelle",
  territory: "Zone ou secteur",
  facilitator_kind: "Type d’intervention",
  specialty: "Spécialité",
};

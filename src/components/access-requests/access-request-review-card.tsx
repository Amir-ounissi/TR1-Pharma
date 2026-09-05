"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  approveAgentAccessRequestAction,
  approveBrandAccessRequestAction,
  approveFacilitatorAccessRequestAction,
  rejectAccessRequestAction,
} from "@/app/(protected)/dashboard/admin/access-requests/actions";
import { FranceDepartmentSelector } from "@/components/access-requests/france-department-selector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getFranceDepartmentLabel } from "@/lib/france-geography";

type Brand = { id: string; name: string; status: string; is_active: boolean };
type Territory = { id: string; brandId: string; name: string; pharmacyCount: number };
type FacilitatorActivity = "animation" | "training";

export type AccessRequestCardData = {
  id: string;
  fullName: string;
  email: string;
  profileType: "brand" | "agent" | "facilitator";
  requestedAccess: Record<string, unknown>;
  createdAt: string;
  reviewerNote?: string | null;
  reviewedBy?: string | null;
  targetBrandName?: string | null;
  targetTerritoryName?: string | null;
};

export function AccessRequestReviewCard({ request, brands, territories, matchedBrand }: {
  request: AccessRequestCardData;
  brands: Brand[];
  territories: Territory[];
  matchedBrand: Brand | null;
}) {
  const [brandId, setBrandId] = useState("");
  const [departmentCodes, setDepartmentCodes] = useState<string[]>([]);
  const [brandState, brandAction, approvingBrand] = useActionState(approveBrandAccessRequestAction, {});
  const [agentState, agentAction, approvingAgent] = useActionState(approveAgentAccessRequestAction, {});
  const [facilitatorState, facilitatorAction, approvingFacilitator] = useActionState(approveFacilitatorAccessRequestAction, {});
  const [rejectState, rejectAction, rejecting] = useActionState(rejectAccessRequestAction, {});
  const selectedBrand = brands.find((brand) => brand.id === brandId) ?? null;
  const availableTerritories = useMemo(() => territories.filter((territory) => territory.brandId === brandId), [territories, brandId]);
  const busy = approvingBrand || approvingAgent || approvingFacilitator || rejecting;

  return (
    <Card className="border-[var(--tr1-line-strong)]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{request.fullName}</CardTitle><CardDescription>{request.email} · demandée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(request.createdAt))}</CardDescription></div><Badge>{profileLabels[request.profileType]}</Badge></div>
        <DeclaredData request={request} />
      </CardHeader>
      <CardContent className="space-y-5">
        {request.profileType === "brand" ? <BrandReview request={request} matchedBrand={matchedBrand} state={brandState} action={brandAction} busy={busy} /> : null}
        {request.profileType === "agent" ? <AgentReview request={request} brands={brands} brandId={brandId} setBrandId={setBrandId} territories={availableTerritories} departmentCodes={departmentCodes} setDepartmentCodes={setDepartmentCodes} selectedBrand={selectedBrand} state={agentState} action={agentAction} busy={busy} /> : null}
        {request.profileType === "facilitator" ? <FacilitatorReview request={request} brands={brands} brandId={brandId} setBrandId={setBrandId} selectedBrand={selectedBrand} state={facilitatorState} action={facilitatorAction} busy={busy} /> : null}
        <RejectForm requestId={request.id} state={rejectState} action={rejectAction} busy={busy} />
      </CardContent>
    </Card>
  );
}

function BrandReview({ request, matchedBrand, state, action, busy }: { request: AccessRequestCardData; matchedBrand: Brand | null; state: { error?: string; success?: string }; action: (payload: FormData) => void; busy: boolean }) {
  if (!matchedBrand) return <Alert><AlertDescription><strong>Aucune marque TR1 correspondante.</strong><br />Créez ou préparez cette marque avant d’accorder un accès. <Link className="font-medium underline" href="/dashboard/admin/onboarding">Créer / préparer cette marque</Link></AlertDescription></Alert>;
  if (!matchedBrand.is_active || matchedBrand.status !== "active") return <Alert><AlertDescription><strong>Marque correspondante trouvée</strong><br />{matchedBrand.name} · En préparation<br /><Link className="font-medium underline" href={`/dashboard/admin/onboarding?brand=${matchedBrand.id}`}>Continuer l’onboarding</Link></AlertDescription></Alert>;
  return <form action={action} className="space-y-4 rounded-xl border bg-card p-4"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="targetBrandId" value={matchedBrand.id} /><p className="text-sm"><span className="text-muted-foreground">Marque correspondante :</span> <strong>{matchedBrand.name}</strong></p>{state.error || state.success ? <Alert variant={state.error ? "destructive" : "default"}><AlertDescription>{state.error ?? state.success}</AlertDescription></Alert> : null}<div className="space-y-2"><Label htmlFor={`brand-note-${request.id}`}>Note interne (facultative)</Label><Textarea id={`brand-note-${request.id}`} name="reviewerNote" maxLength={500} /></div><Button disabled={busy}>Accorder l’accès administrateur</Button></form>;
}

function AgentReview({
  request,
  brands,
  brandId,
  setBrandId,
  territories,
  departmentCodes,
  setDepartmentCodes,
  selectedBrand,
  state,
  action,
  busy,
}: {
  request: AccessRequestCardData;
  brands: Brand[];
  brandId: string;
  setBrandId: (value: string) => void;
  territories: Territory[];
  departmentCodes: string[];
  setDepartmentCodes: (value: string[]) => void;
  selectedBrand: Brand | null;
  state: { error?: string; success?: string };
  action: (payload: FormData) => void;
  busy: boolean;
}) {
  const activeBrands = brands.filter(
    (brand) => brand.is_active && brand.status === "active",
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-4">
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="targetBrandId" value={brandId} />

      {state.error || state.success ? (
        <Alert variant={state.error ? "destructive" : "default"}>
          <AlertDescription>{state.error ?? state.success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`brand-${request.id}`}>Marque</Label>
        <select
          id={`brand-${request.id}`}
          value={brandId}
          onChange={(event) => {
            setBrandId(event.target.value);
            setDepartmentCodes([]);
          }}
          required
          className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Sélectionner explicitement une marque</option>
          {activeBrands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div>
          <Label>Secteur géographique</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Cochez une région entière ou sélectionnez précisément les départements
            couverts par cet agent.
          </p>
        </div>

        <FranceDepartmentSelector
          selectedCodes={departmentCodes}
          onChange={setDepartmentCodes}
          disabled={!brandId}
        />

        <p className="text-sm text-muted-foreground">
          {departmentCodes.length
            ? `${departmentCodes.length} département${departmentCodes.length > 1 ? "s" : ""} sélectionné${departmentCodes.length > 1 ? "s" : ""}.`
            : "Sélectionnez au moins un département."}
        </p>
      </div>

      {selectedBrand && departmentCodes.length ? (
        <Alert>
          <AlertDescription>
            <strong>Secteur qui sera créé automatiquement</strong>
            <br />
            {selectedBrand.name}
            <br />
            {departmentCodes.map(getFranceDepartmentLabel).join(" · ")}
            <br />
            <span className="text-muted-foreground">
              Les pharmacies existantes de ces départements seront rattachées au
              portefeuille de l’agent. Les nouvelles pharmacies du secteur suivront
              automatiquement la même règle.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {selectedBrand && territories.length ? (
        <p className="text-xs text-muted-foreground">
          {territories.length} territoire{territories.length > 1 ? "s" : ""} déjà
          configuré{territories.length > 1 ? "s" : ""} pour cette marque.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`agent-note-${request.id}`}>
          Note interne (facultative)
        </Label>
        <Textarea
          id={`agent-note-${request.id}`}
          name="reviewerNote"
          maxLength={500}
        />
      </div>

      <Button disabled={busy || !selectedBrand || departmentCodes.length === 0}>
        Approuver et créer le secteur
      </Button>
    </form>
  );
}

function FacilitatorReview({
  request,
  brands,
  brandId,
  setBrandId,
  selectedBrand,
  state,
  action,
  busy,
}: {
  request: AccessRequestCardData;
  brands: Brand[];
  brandId: string;
  setBrandId: (value: string) => void;
  selectedBrand: Brand | null;
  state: { error?: string; success?: string };
  action: (payload: FormData) => void;
  busy: boolean;
}) {
  const activities = getFacilitatorActivities(request.requestedAccess);
  const activeBrands = brands.filter(
    (brand) => brand.is_active && brand.status === "active",
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-4">
      <input type="hidden" name="requestId" value={request.id} />
      <input type="hidden" name="targetBrandId" value={brandId} />

      {state.error || state.success ? (
        <Alert variant={state.error ? "destructive" : "default"}>
          <AlertDescription>{state.error ?? state.success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`facilitator-brand-${request.id}`}>Marque</Label>
        <select
          id={`facilitator-brand-${request.id}`}
          value={brandId}
          onChange={(event) => setBrandId(event.target.value)}
          required
          className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Sélectionner explicitement une marque</option>
          {activeBrands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>

      <Alert>
        <AlertDescription>
          <strong>Activités à activer :</strong>{" "}
          {activities.length
            ? activities.map(facilitatorActivityLabel).join(" + ")
            : "Aucune activité valide détectée"}
          <br />
          <span className="text-muted-foreground">
            L’approbation crée une seule membership Intervenant et une seule fiche terrain, avec toutes les compétences demandées.
          </span>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor={`facilitator-note-${request.id}`}>
          Note interne (facultative)
        </Label>
        <Textarea
          id={`facilitator-note-${request.id}`}
          name="reviewerNote"
          maxLength={500}
        />
      </div>

      <Button disabled={busy || !selectedBrand || activities.length === 0}>
        Approuver l’intervenant
      </Button>
    </form>
  );
}

function RejectForm({ requestId, state, action, busy }: { requestId: string; state: { error?: string; success?: string }; action: (payload: FormData) => void; busy: boolean }) {
  return <form action={action} className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"><input type="hidden" name="requestId" value={requestId} /><div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`rejection-note-${requestId}`}>Motif de refus</Label><Textarea id={`rejection-note-${requestId}`} name="reviewerNote" required minLength={3} maxLength={500} placeholder="Expliquez la décision pour garder une trace." /></div><Button variant="outline" disabled={busy}>Refuser</Button>{state.error || state.success ? <p className={state.error ? "text-sm text-destructive" : "text-sm text-emerald-700"}>{state.error ?? state.success}</p> : null}</form>;
}

function DeclaredData({ request }: { request: AccessRequestCardData }) {
  if (request.profileType === "facilitator") {
    const activities = getFacilitatorActivities(request.requestedAccess);
    const specialty = typeof request.requestedAccess.specialty === "string"
      ? request.requestedAccess.specialty.trim()
      : "";

    return (
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <DeclaredValue label="Activités" value={activities.length ? activities.map(facilitatorActivityLabel).join(" · ") : "Non renseigné"} />
        {specialty ? <DeclaredValue label="Spécialité" value={specialty} /> : null}
      </dl>
    );
  }

  const keys = request.profileType === "brand"
    ? ["company_name", "job_title"]
    : ["organization", "territory"];

  return <dl className="grid gap-2 text-sm sm:grid-cols-2">{keys.map((key) => <DeclaredValue key={key} label={fieldLabels[key]} value={typeof request.requestedAccess[key] === "string" ? String(request.requestedAccess[key]) : "Non renseigné"} />)}</dl>;
}

function DeclaredValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}

function getFacilitatorActivities(requestedAccess: Record<string, unknown>): FacilitatorActivity[] {
  const activities = Array.isArray(requestedAccess.activities)
    ? requestedAccess.activities.filter(
        (value): value is FacilitatorActivity => value === "animation" || value === "training",
      )
    : [];

  if (activities.length) {
    return [...new Set(activities)];
  }

  const legacyKind = typeof requestedAccess.facilitator_kind === "string"
    ? requestedAccess.facilitator_kind.trim().toLowerCase()
    : "";

  if (["animation", "animateur", "animator"].includes(legacyKind)) return ["animation"];
  if (["formation", "formateur", "trainer"].includes(legacyKind)) return ["training"];
  if (["mixte", "animation + formation", "animation et formation"].includes(legacyKind)) return ["animation", "training"];
  return [];
}

function facilitatorActivityLabel(activity: FacilitatorActivity) {
  return activity === "animation" ? "Animation" : "Formation";
}

const profileLabels = { brand: "Demande marque", agent: "Demande agent", facilitator: "Demande intervenant" };
const fieldLabels: Record<string, string> = { company_name: "Société / marque déclarée", job_title: "Fonction", organization: "Structure actuelle", territory: "Secteur demandé" };

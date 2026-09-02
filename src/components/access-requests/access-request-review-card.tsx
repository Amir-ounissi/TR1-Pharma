"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { approveAgentAccessRequestAction, approveBrandAccessRequestAction, rejectAccessRequestAction } from "@/app/(protected)/dashboard/admin/access-requests/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Brand = { id: string; name: string; status: string; is_active: boolean };
type Territory = { id: string; brandId: string; name: string; pharmacyCount: number };

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
};

export function AccessRequestReviewCard({ request, brands, territories, matchedBrand }: {
  request: AccessRequestCardData;
  brands: Brand[];
  territories: Territory[];
  matchedBrand: Brand | null;
}) {
  const [brandId, setBrandId] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [brandState, brandAction, approvingBrand] = useActionState(approveBrandAccessRequestAction, {});
  const [agentState, agentAction, approvingAgent] = useActionState(approveAgentAccessRequestAction, {});
  const [rejectState, rejectAction, rejecting] = useActionState(rejectAccessRequestAction, {});
  const selectedBrand = brands.find((brand) => brand.id === brandId) ?? null;
  const availableTerritories = useMemo(() => territories.filter((territory) => territory.brandId === brandId), [territories, brandId]);
  const selectedTerritory = availableTerritories.find((territory) => territory.id === territoryId) ?? null;
  const busy = approvingBrand || approvingAgent || rejecting;

  return (
    <Card className="border-[var(--tr1-line-strong)]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{request.fullName}</CardTitle><CardDescription>{request.email} · demandée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(request.createdAt))}</CardDescription></div><Badge>{profileLabels[request.profileType]}</Badge></div>
        <DeclaredData request={request} />
      </CardHeader>
      <CardContent className="space-y-5">
        {request.profileType === "brand" ? <BrandReview request={request} matchedBrand={matchedBrand} state={brandState} action={brandAction} busy={busy} /> : null}
        {request.profileType === "agent" ? <AgentReview request={request} brands={brands} brandId={brandId} setBrandId={setBrandId} territories={availableTerritories} territoryId={territoryId} setTerritoryId={setTerritoryId} selectedBrand={selectedBrand} selectedTerritory={selectedTerritory} state={agentState} action={agentAction} busy={busy} /> : null}
        {request.profileType === "facilitator" ? <Alert><AlertDescription>Workflow intervenant non activé pour le pilote. Cette demande historique peut être refusée, mais ne peut pas créer une membership incomplète.</AlertDescription></Alert> : null}
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

function AgentReview({ request, brands, brandId, setBrandId, territories, territoryId, setTerritoryId, selectedBrand, selectedTerritory, state, action, busy }: { request: AccessRequestCardData; brands: Brand[]; brandId: string; setBrandId: (value: string) => void; territories: Territory[]; territoryId: string; setTerritoryId: (value: string) => void; selectedBrand: Brand | null; selectedTerritory: Territory | null; state: { error?: string; success?: string }; action: (payload: FormData) => void; busy: boolean }) {
  const activeBrands = brands.filter((brand) => brand.is_active && brand.status === "active");
  return <form action={action} className="space-y-4 rounded-xl border bg-card p-4"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="targetBrandId" value={brandId} /><input type="hidden" name="targetTerritoryId" value={territoryId} />{state.error || state.success ? <Alert variant={state.error ? "destructive" : "default"}><AlertDescription>{state.error ?? state.success}</AlertDescription></Alert> : null}<div className="space-y-2"><Label htmlFor={`brand-${request.id}`}>Marque</Label><select id={`brand-${request.id}`} value={brandId} onChange={(event) => { setBrandId(event.target.value); setTerritoryId(""); }} required className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Sélectionner explicitement une marque</option>{activeBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor={`territory-${request.id}`}>Territoire</Label><select id={`territory-${request.id}`} value={territoryId} onChange={(event) => setTerritoryId(event.target.value)} required disabled={!brandId} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Sélectionner explicitement un territoire</option>{territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}</select>{selectedTerritory ? <p className="text-sm text-muted-foreground">{selectedTerritory.pharmacyCount} pharmacies dans ce territoire</p> : null}</div>{selectedBrand && selectedTerritory ? <Alert><AlertDescription>Vous allez accorder :<br /><strong>Agent terrain</strong><br />{selectedBrand.name}<br />{selectedTerritory.name}<br />{selectedTerritory.pharmacyCount} pharmacies</AlertDescription></Alert> : null}<div className="space-y-2"><Label htmlFor={`agent-note-${request.id}`}>Note interne (facultative)</Label><Textarea id={`agent-note-${request.id}`} name="reviewerNote" maxLength={500} /></div><Button disabled={busy || !selectedBrand || !selectedTerritory}>Approuver cet accès</Button></form>;
}

function RejectForm({ requestId, state, action, busy }: { requestId: string; state: { error?: string; success?: string }; action: (payload: FormData) => void; busy: boolean }) {
  return <form action={action} className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"><input type="hidden" name="requestId" value={requestId} /><div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`rejection-note-${requestId}`}>Motif de refus</Label><Textarea id={`rejection-note-${requestId}`} name="reviewerNote" required minLength={3} maxLength={500} placeholder="Expliquez la décision pour garder une trace." /></div><Button variant="outline" disabled={busy}>Refuser</Button>{state.error || state.success ? <p className={state.error ? "text-sm text-destructive" : "text-sm text-emerald-700"}>{state.error ?? state.success}</p> : null}</form>;
}

function DeclaredData({ request }: { request: AccessRequestCardData }) {
  const keys = request.profileType === "brand" ? ["company_name", "job_title"] : request.profileType === "agent" ? ["organization", "territory"] : ["facilitator_kind", "specialty"];
  return <dl className="grid gap-2 text-sm sm:grid-cols-2">{keys.map((key) => <div key={key} className="rounded-lg bg-muted/50 px-3 py-2"><dt className="text-xs text-muted-foreground">{fieldLabels[key]}</dt><dd className="mt-0.5 font-medium">{typeof request.requestedAccess[key] === "string" ? String(request.requestedAccess[key]) : "Non renseigné"}</dd></div>)}</dl>;
}

const profileLabels = { brand: "Demande marque", agent: "Demande agent", facilitator: "Demande intervenant" };
const fieldLabels: Record<string, string> = { company_name: "Société / marque déclarée", job_title: "Fonction", organization: "Structure actuelle", territory: "Secteur demandé", facilitator_kind: "Type d’intervention", specialty: "Spécialité" };

"use client";

import { useEffect, useState } from "react";
import {
  getPharmacyCommercialTermsAction,
  resetPharmacyCommercialTermsAction,
  savePharmacyCommercialTermsAction,
} from "@/app/(protected)/dashboard/pharmacies/commercial-terms-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Pricing = Awaited<ReturnType<typeof getPharmacyCommercialTermsAction>>;

function ugSourceLabel(source: Pricing["freeUnitsSource"]) {
  if (source === "tr1_override") return "TR1 manuel";
  if (source === "hubspot_lead_status") return "HubSpot · Statut du lead";
  if (source === "hubspot_field") return "HubSpot · Unités gratuites";
  return null;
}

function discountSourceLabel(source: Pricing["discountSource"]) {
  if (source === "tr1_override") return "TR1 manuel";
  if (source === "hubspot") return "HubSpot";
  return null;
}

export function PharmacyCommercialTerms({
  pharmacyId,
  pharmacyName,
}: {
  pharmacyId: string;
  pharmacyName: string;
}) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [discountRate, setDiscountRate] = useState("");
  const [ugPaidQuantity, setUgPaidQuantity] = useState("");
  const [ugFreeQuantity, setUgFreeQuantity] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function applyPricing(next: Pricing) {
    setPricing(next);
    setDiscountRate(
      next.discountSource === "tr1_override" && next.discountRate != null
        ? String(next.discountRate)
        : "",
    );
    setUgPaidQuantity(
      next.freeUnitsSource === "tr1_override" && next.freeUnitsRule
        ? String(next.freeUnitsRule.paidQuantity)
        : "",
    );
    setUgFreeQuantity(
      next.freeUnitsSource === "tr1_override" && next.freeUnitsRule
        ? String(next.freeUnitsRule.freeQuantity)
        : "",
    );
    setNote(next.overrideNote ?? "");
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getPharmacyCommercialTermsAction(pharmacyId)
      .then((next) => {
        if (active) applyPricing(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pharmacyId]);

  async function save() {
    const discount = discountRate.trim() === "" ? null : Number(discountRate);
    const paid = ugPaidQuantity.trim() === "" ? null : Number(ugPaidQuantity);
    const free = ugFreeQuantity.trim() === "" ? null : Number(ugFreeQuantity);

    if (discount != null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
      setMessage("La remise doit être comprise entre 0 et 100 %.");
      return;
    }
    if (
      (paid == null) !== (free == null) ||
      (paid != null && (!Number.isInteger(paid) || paid <= 0)) ||
      (free != null && (!Number.isInteger(free) || free < 0))
    ) {
      setMessage("Renseignez une règle UG complète, par exemple 12 + 2.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const next = await savePharmacyCommercialTermsAction({
        pharmacyId,
        discountRate: discount,
        ugPaidQuantity: paid,
        ugFreeQuantity: free,
        note: note.trim() || null,
      });
      applyPricing(next);
      setMessage("Conditions commerciales enregistrées sur la fiche client.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d’enregistrer les conditions.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setMessage(null);
    try {
      const next = await resetPharmacyCommercialTermsAction(pharmacyId);
      applyPricing(next);
      setMessage("Override TR1 supprimé : les conditions HubSpot sont à nouveau appliquées.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de réinitialiser les conditions.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !pricing) {
    return <p className="text-sm text-muted-foreground">Chargement des conditions commerciales…</p>;
  }

  const effectiveDiscount = pricing.discountRate;
  const effectiveUg = pricing.freeUnitsRule;
  const discountSource = discountSourceLabel(pricing.discountSource);
  const ugSource = ugSourceLabel(pricing.freeUnitsSource);

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-[var(--tr1-navy)]">{pharmacyName}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ces conditions sont rattachées à la pharmacie. Elles seront reprises automatiquement dans les prochaines commandes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {pricing.potential ? <Badge variant="outline">Potentiel {pricing.potential}</Badge> : null}
          {pricing.leadStatus ? <Badge variant="outline">Statut du lead · {pricing.leadStatus}</Badge> : null}
          {effectiveDiscount != null ? (
            <Badge variant="secondary">Remise effective {effectiveDiscount}%</Badge>
          ) : null}
          {discountSource ? <Badge variant="outline">Source remise · {discountSource}</Badge> : null}
          {effectiveUg ? <Badge variant="secondary">UG effectives {effectiveUg.label} à la ligne</Badge> : null}
          {ugSource ? <Badge variant="outline">Source UG · {ugSource}</Badge> : null}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/15 p-4">
        <p className="text-sm font-semibold text-[var(--tr1-navy)]">Override TR1</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Laissez un champ vide pour conserver la valeur HubSpot. Une valeur renseignée ici devient prioritaire uniquement pour cette pharmacie.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="commercial-discount">Remise TR1 (%)</Label>
            <Input
              id="commercial-discount"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={discountRate}
              onChange={(event) => setDiscountRate(event.target.value)}
              placeholder={effectiveDiscount == null ? "Aucune" : `HubSpot : ${effectiveDiscount}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-ug-paid">Base payante</Label>
            <Input
              id="commercial-ug-paid"
              type="number"
              min="1"
              step="1"
              value={ugPaidQuantity}
              onChange={(event) => setUgPaidQuantity(event.target.value)}
              placeholder={effectiveUg ? String(effectiveUg.paidQuantity) : "12"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-ug-free">UG offertes</Label>
            <Input
              id="commercial-ug-free"
              type="number"
              min="0"
              step="1"
              value={ugFreeQuantity}
              onChange={(event) => setUgFreeQuantity(event.target.value)}
              placeholder={effectiveUg ? String(effectiveUg.freeQuantity) : "2"}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="commercial-terms-note">Note interne</Label>
          <Textarea
            id="commercial-terms-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. accord exceptionnel validé par la direction commerciale"
          />
        </div>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer sur la fiche client"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void reset()} disabled={saving}>
          Revenir aux conditions HubSpot
        </Button>
      </div>
    </div>
  );
}

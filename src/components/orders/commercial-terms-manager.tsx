"use client";

import { useState } from "react";
import {
  getOrderPharmacyPricingAction,
  resetOrderPharmacyCommercialTermsAction,
  saveOrderPharmacyCommercialTermsAction,
} from "@/app/(protected)/dashboard/orders/pricing-actions";
import {
  searchOrderPharmaciesAction,
  type OrderPharmacySearchResult,
} from "@/app/(protected)/dashboard/orders/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Pricing = Awaited<ReturnType<typeof getOrderPharmacyPricingAction>>;

function sourceLabel(source: Pricing["freeUnitsSource"]) {
  if (source === "tr1_override") return "TR1 manuel";
  if (source === "hubspot_lead_status") return "HubSpot · Statut du lead";
  if (source === "hubspot_field") return "HubSpot · Unités gratuites";
  return null;
}

export function CommercialTermsManager() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderPharmacySearchResult[]>([]);
  const [selected, setSelected] = useState<OrderPharmacySearchResult | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [discountRate, setDiscountRate] = useState("");
  const [ugPaidQuantity, setUgPaidQuantity] = useState("");
  const [ugFreeQuantity, setUgFreeQuantity] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function applyPricing(next: Pricing) {
    setPricing(next);
    setDiscountRate(next.discountRate == null ? "" : String(next.discountRate));
    setUgPaidQuantity(next.freeUnitsRule ? String(next.freeUnitsRule.paidQuantity) : "");
    setUgFreeQuantity(next.freeUnitsRule ? String(next.freeUnitsRule.freeQuantity) : "");
    setNote(next.overrideNote ?? "");
  }

  async function search(value: string) {
    setQuery(value);
    setMessage(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const found = await searchOrderPharmaciesAction(value);
      setResults(found.filter((item) => item.relationStatus === "existing_brand_relation"));
    } finally {
      setLoading(false);
    }
  }

  async function selectPharmacy(pharmacy: OrderPharmacySearchResult) {
    setSelected(pharmacy);
    setQuery("");
    setResults([]);
    setMessage(null);
    setLoading(true);
    try {
      applyPricing(await getOrderPharmacyPricingAction(pharmacy.pharmacyId));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selected) return;
    const discount = discountRate.trim() === "" ? null : Number(discountRate);
    const paid = ugPaidQuantity.trim() === "" ? null : Number(ugPaidQuantity);
    const free = ugFreeQuantity.trim() === "" ? null : Number(ugFreeQuantity);
    if (discount != null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
      setMessage("La remise doit être comprise entre 0 et 100 %.");
      return;
    }
    if ((paid == null) !== (free == null) || (paid != null && (!Number.isInteger(paid) || paid <= 0)) || (free != null && (!Number.isInteger(free) || free < 0))) {
      setMessage("Renseignez une règle UG complète, par exemple 12 + 2.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const next = await saveOrderPharmacyCommercialTermsAction({
        pharmacyId: selected.pharmacyId,
        discountRate: discount,
        ugPaidQuantity: paid,
        ugFreeQuantity: free,
        note: note.trim() || null,
      });
      applyPricing(next);
      setMessage("Conditions commerciales TR1 enregistrées.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d’enregistrer les conditions.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const next = await resetOrderPharmacyCommercialTermsAction(selected.pharmacyId);
      applyPricing(next);
      setMessage("Override supprimé : les conditions HubSpot sont à nouveau appliquées.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de réinitialiser les conditions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="commercial-terms-pharmacy">Pharmacie cliente</Label>
        <Input
          id="commercial-terms-pharmacy"
          value={selected ? selected.name : query}
          placeholder="Nom, ville, CIP ou SIRET…"
          autoComplete="off"
          onChange={(event) => {
            setSelected(null);
            setPricing(null);
            void search(event.target.value);
          }}
        />
        {!selected && results.length ? (
          <div className="max-h-64 overflow-auto rounded-xl border bg-popover p-1 shadow-sm">
            {results.map((result) => (
              <button
                key={result.pharmacyId}
                type="button"
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => void selectPharmacy(result)}
              >
                <span className="font-semibold">{result.name}</span>
                <span className="block text-xs text-muted-foreground">{result.detail}</span>
              </button>
            ))}
          </div>
        ) : null}
        {loading ? <p className="text-xs text-muted-foreground">Chargement des conditions…</p> : null}
      </div>

      {selected && pricing ? (
        <div className="space-y-5 rounded-2xl border bg-background p-4">
          <div>
            <p className="font-semibold text-[var(--tr1-navy)]">{selected.name}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {pricing.potential ? <Badge variant="outline">Potentiel {pricing.potential}</Badge> : null}
              {pricing.leadStatus ? <Badge variant="outline">Statut du lead · {pricing.leadStatus}</Badge> : null}
              {pricing.freeUnitsRule ? <Badge variant="secondary">UG {pricing.freeUnitsRule.label} à la ligne</Badge> : null}
              {sourceLabel(pricing.freeUnitsSource) ? <Badge variant="outline">Source UG · {sourceLabel(pricing.freeUnitsSource)}</Badge> : null}
              {pricing.discountSource === "tr1_override" ? <Badge variant="outline">Remise · TR1 manuel</Badge> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="commercial-discount">Remise (%)</Label>
              <Input
                id="commercial-discount"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountRate}
                onChange={(event) => setDiscountRate(event.target.value)}
                placeholder="HubSpot si vide"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial-ug-paid">Quantité payante</Label>
              <Input
                id="commercial-ug-paid"
                type="number"
                min="1"
                step="1"
                value={ugPaidQuantity}
                onChange={(event) => setUgPaidQuantity(event.target.value)}
                placeholder="12"
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
                placeholder="2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="commercial-terms-note">Note interne</Label>
            <Textarea
              id="commercial-terms-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex. accord exceptionnel validé par la direction commerciale"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Une valeur enregistrée ici devient prioritaire dans TR1. « Revenir à HubSpot » supprime l’override manuel et réapplique automatiquement le statut du lead, la remise et les conditions disponibles dans HubSpot.
          </p>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer les conditions"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void reset()} disabled={saving}>
              Revenir à HubSpot
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

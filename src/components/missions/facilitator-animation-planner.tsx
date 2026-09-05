"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CopyPlus, Plus, Search, Trash2 } from "lucide-react";
import {
  proposeAnimationBatchAction,
  type FacilitatorAnimationState,
} from "@/app/(protected)/dashboard/missions/facilitator-actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FacilitatorPharmacyOption = {
  id: string;
  brandId: string;
  brandName: string;
  label: string;
  postalCode?: string;
  city?: string;
  address?: string;
  cipCode?: string;
};

type AnimationRow = {
  key: number;
  pharmacyId: string;
  date: string;
  start: string;
  end: string;
};

const initialState: FacilitatorAnimationState = {};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scorePharmacy(item: FacilitatorPharmacyOption, query: string) {
  const needle = normalize(query);
  if (!needle) return 1;
  const name = normalize(item.label);
  const cip = normalize(item.cipCode ?? "");
  const postal = normalize(item.postalCode ?? "");
  const city = normalize(item.city ?? "");
  const address = normalize(item.address ?? "");
  const haystack = `${name} ${cip} ${postal} ${city} ${address}`;
  const tokens = needle.split(" ").filter(Boolean);
  if (!tokens.every((token) => haystack.includes(token))) return 0;

  let score = 10;
  if (name === needle) score += 100;
  else if (name.startsWith(needle)) score += 70;
  else if (name.includes(needle)) score += 45;
  if (cip && cip === needle) score += 90;
  if (postal && postal.startsWith(needle)) score += 35;
  if (city && city.startsWith(needle)) score += 30;
  return score;
}

export function FacilitatorAnimationPlanner({
  pharmacies,
}: {
  pharmacies: FacilitatorPharmacyOption[];
}) {
  const [state, action, pending] = useActionState(
    proposeAnimationBatchAction,
    initialState,
  );
  const brands = useMemo(() => {
    const unique = new Map<string, string>();
    for (const pharmacy of pharmacies) unique.set(pharmacy.brandId, pharmacy.brandName);
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [pharmacies]);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [defaultStart, setDefaultStart] = useState("10:00");
  const [defaultEnd, setDefaultEnd] = useState("18:00");
  const [nextKey, setNextKey] = useState(2);
  const [rows, setRows] = useState<AnimationRow[]>([
    { key: 1, pharmacyId: "", date: "", start: "10:00", end: "18:00" },
  ]);

  const brandPharmacies = useMemo(
    () => pharmacies.filter((pharmacy) => pharmacy.brandId === brandId),
    [brandId, pharmacies],
  );

  useEffect(() => {
    if (!state.success) return;
    setRows([
      {
        key: nextKey,
        pharmacyId: "",
        date: "",
        start: defaultStart,
        end: defaultEnd,
      },
    ]);
    setNextKey((value) => value + 1);
  }, [state.success]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (key: number, patch: Partial<AnimationRow>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        key: nextKey,
        pharmacyId: "",
        date: "",
        start: defaultStart,
        end: defaultEnd,
      },
    ]);
    setNextKey((value) => value + 1);
  };

  const changeBrand = (nextBrandId: string) => {
    setBrandId(nextBrandId);
    setRows((current) => current.map((row) => ({ ...row, pharmacyId: "" })));
  };

  const payload = rows.map((row) => ({
    brandPharmacyId: row.pharmacyId,
    scheduledStartAt: row.date && row.start ? `${row.date}T${row.start}` : "",
    scheduledEndAt: row.date && row.end ? `${row.date}T${row.end}` : "",
  }));
  const isComplete =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.pharmacyId &&
        row.date &&
        row.start &&
        row.end &&
        row.end > row.start,
    );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="animationsJson" value={JSON.stringify(payload)} />
      <ActionFeedback {...state} />

      <div className="grid gap-4 rounded-xl border bg-muted/25 p-4 md:grid-cols-[1fr_150px_150px]">
        <div>
          <Label>Marque</Label>
          {brands.length > 1 ? (
            <select
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={brandId}
              onChange={(event) => changeBrand(event.target.value)}
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-2 flex h-10 items-center rounded-md border bg-white px-3 text-sm font-medium">
              {brands[0]?.name ?? "Aucune marque disponible"}
            </div>
          )}
        </div>
        <div>
          <Label>Début par défaut</Label>
          <Input
            className="mt-2 bg-white"
            type="time"
            value={defaultStart}
            onChange={(event) => setDefaultStart(event.target.value)}
          />
        </div>
        <div>
          <Label>Fin par défaut</Label>
          <Input
            className="mt-2 bg-white"
            type="time"
            value={defaultEnd}
            onChange={(event) => setDefaultEnd(event.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground md:col-span-3">
          Animation = présentiel en pharmacie, gamme complète de la marque. Le budget est défini par la marque lors de la validation.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="grid gap-3 rounded-xl border bg-white p-4 lg:grid-cols-[minmax(250px,1.7fr)_150px_120px_120px_auto] lg:items-end"
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label>Pharmacie {rows.length > 1 ? index + 1 : ""}</Label>
                {index === 0 ? <Badge variant="secondary">Recherche intelligente</Badge> : null}
              </div>
              <PharmacySearch
                pharmacies={brandPharmacies}
                value={row.pharmacyId}
                onChange={(pharmacyId) => updateRow(row.key, { pharmacyId })}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                className="mt-2"
                type="date"
                value={row.date}
                onChange={(event) => updateRow(row.key, { date: event.target.value })}
              />
            </div>
            <div>
              <Label>Début</Label>
              <Input
                className="mt-2"
                type="time"
                value={row.start}
                onChange={(event) => updateRow(row.key, { start: event.target.value })}
              />
            </div>
            <div>
              <Label>Fin</Label>
              <Input
                className="mt-2"
                type="time"
                value={row.end}
                onChange={(event) => updateRow(row.key, { end: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Supprimer l’animation ${index + 1}`}
              disabled={rows.length === 1}
              onClick={() =>
                setRows((current) => current.filter((item) => item.key !== row.key))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addRow} disabled={rows.length >= 30}>
            <Plus className="size-4" />
            Ajouter une animation
          </Button>
          <Button type="button" variant="ghost" onClick={addRow} disabled={rows.length >= 30}>
            <CopyPlus className="size-4" />
            Même marque et horaires
          </Button>
        </div>
        <Button disabled={pending || !isComplete || !brandId}>
          {pending
            ? "Envoi…"
            : rows.length > 1
              ? `Envoyer ${rows.length} animations`
              : "Envoyer l’animation"}
        </Button>
      </div>
    </form>
  );
}

function PharmacySearch({
  pharmacies,
  value,
  onChange,
}: {
  pharmacies: FacilitatorPharmacyOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = pharmacies.find((pharmacy) => pharmacy.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(
    () =>
      pharmacies
        .map((pharmacy) => ({ pharmacy, score: scorePharmacy(pharmacy, query) }))
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score || a.pharmacy.label.localeCompare(b.pharmacy.label, "fr"))
        .slice(0, 8)
        .map((result) => result.pharmacy),
    [pharmacies, query],
  );

  useEffect(() => {
    if (!selected) setQuery("");
  }, [selected]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={query || (selected ? formatPharmacy(selected) : "")}
          placeholder="Nom, ville, CP, adresse ou CIP…"
          autoComplete="off"
          onFocus={() => {
            if (selected) setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        />
      </div>
      {open ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {results.map((pharmacy) => (
            <button
              type="button"
              key={pharmacy.id}
              className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(pharmacy.id);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="block font-medium">{pharmacy.label}</span>
              <span className="block text-xs text-muted-foreground">
                {[pharmacy.postalCode, pharmacy.city, pharmacy.address, pharmacy.cipCode ? `CIP ${pharmacy.cipCode}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
          {!results.length ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Aucune pharmacie trouvée.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatPharmacy(pharmacy: FacilitatorPharmacyOption) {
  return [pharmacy.label, pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" · ");
}

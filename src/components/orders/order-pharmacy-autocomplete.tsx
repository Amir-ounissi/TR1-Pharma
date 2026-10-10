"use client";

import { useEffect, useRef, useState } from "react";
import { searchOrderPharmaciesAction, type OrderPharmacySearchResult } from "@/app/(protected)/dashboard/orders/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialPharmacy?: OrderPharmacySearchResult;
  onSelectionChange: (changedFromInitial: boolean, pharmacy?: OrderPharmacySearchResult) => void;
  mobile?: boolean;
};

const SEARCH_DELAY_MS = 300;

/**
 * One pharmacy picker for mobile and desktop orders.
 * Queries are debounced and older responses never replace newer results.
 */
export function OrderPharmacyAutocomplete({ initialPharmacy, onSelectionChange, mobile = false }: Props) {
  const inputId = mobile ? "mobile-order-pharmacy" : "quick-order-pharmacy";
  const listId = mobile ? "mobile-order-pharmacy-results" : "quick-order-pharmacy-results";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrderPharmacySearchResult | undefined>(initialPharmacy);
  const [results, setResults] = useState<OrderPharmacySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestSequence = useRef(0);
  const previousPharmacy = useRef(initialPharmacy);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;

    const requestId = requestSequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const items = await searchOrderPharmaciesAction(query.trim());
        if (requestSequence.current !== requestId) return;
        setResults(items);
        setActiveIndex(-1);
        setSearchError(false);
      } catch {
        if (requestSequence.current !== requestId) return;
        setResults([]);
        setSearchError(true);
      } finally {
        if (requestSequence.current === requestId) setLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [query, selected]);

  function changeQuery(value: string) {
    requestSequence.current += 1;
    if (selected) onSelectionChange(Boolean(initialPharmacy), undefined);
    setSelected(undefined);
    setQuery(value);
    setResults([]);
    setActiveIndex(-1);
    setSearchError(false);
    setLoading(value.trim().length >= 2);
  }

  function choose(pharmacy: OrderPharmacySearchResult) {
    requestSequence.current += 1;
    setSelected(pharmacy);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setLoading(false);
    setSearchError(false);
    const previous = previousPharmacy.current;
    const previousId = previous?.brandPharmacyId ?? previous?.pharmacyId;
    const nextId = pharmacy.brandPharmacyId ?? pharmacy.pharmacyId;
    previousPharmacy.current = pharmacy;
    onSelectionChange(Boolean(previousId && previousId !== nextId), pharmacy);
  }

  const showOptions = !selected && results.length > 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Pharmacie</Label>
      <Input
        id={inputId}
        value={selected ? selected.name : query}
        placeholder="Nom, ville, CIP ou SIRET…"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showOptions}
        aria-controls={showOptions ? listId : undefined}
        aria-activedescendant={showOptions && activeIndex >= 0 ? listId + "-" + activeIndex : undefined}
        aria-invalid={searchError || undefined}
        className={mobile ? "h-12 rounded-xl bg-background text-base" : undefined}
        onChange={(event) => changeQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && showOptions) {
            event.preventDefault();
            setResults([]);
            setActiveIndex(-1);
          } else if (event.key === "ArrowDown" && showOptions) {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % results.length);
          } else if (event.key === "ArrowUp" && showOptions) {
            event.preventDefault();
            setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
          } else if (event.key === "Enter" && showOptions && activeIndex >= 0) {
            event.preventDefault();
            choose(results[activeIndex]);
          }
        }}
      />
      <input type="hidden" name="brandPharmacyId" value={selected?.brandPharmacyId ?? ""} />
      <input type="hidden" name="pharmacyId" value={selected?.brandPharmacyId ? "" : selected?.pharmacyId ?? ""} />
      {selected ? (
        mobile ? (
          <div className="rounded-xl border bg-background px-3 py-2.5">
            <p className="font-semibold text-[var(--tr1-navy)]">{selected.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selected.detail}
              {selected.relationStatus === "existing_brand_relation" ? " · Déjà cliente" : " · Nouvelle pour la marque"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {selected.detail}
            {selected.relationStatus === "existing_brand_relation" ? " · Déjà cliente" : " · Nouvelle pour la marque"}
          </p>
        )
      ) : null}
      {showOptions ? (
        <div id={listId} role="listbox" aria-label="Résultats pharmacies" className={mobile ? "max-h-60 overflow-auto rounded-xl border bg-popover p-1 shadow-lg" : "max-h-56 overflow-auto rounded-xl border bg-popover p-1 shadow-sm"}>
          {results.map((result, index) => (
            <button
              id={listId + "-" + index}
              key={result.pharmacyId}
              role="option"
              aria-selected={index === activeIndex}
              type="button"
              className={["block w-full rounded-lg px-3 py-2.5 text-left", mobile ? "min-h-14" : "text-sm", index === activeIndex ? "bg-muted" : "hover:bg-muted active:bg-muted"].join(" ")}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(result)}
            >
              <span className="font-semibold">{result.name}</span>
              <span className="block text-xs text-muted-foreground">{result.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p role="status" className="text-xs text-muted-foreground">Recherche…</p> : null}
      {searchError ? <p role="alert" className="text-xs text-destructive">Impossible de rechercher les pharmacies. Modifiez la recherche pour réessayer.</p> : null}
      {!selected && !loading && !searchError && query.trim().length >= 2 && results.length === 0 ? (
        <p role="status" className="text-xs text-muted-foreground">Aucune pharmacie trouvée.</p>
      ) : null}
    </div>
  );
}

"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LivePharmacySearchProps = {
  initialValue: string;
  params: Record<string, string | string[] | undefined>;
  compact?: boolean;
};

export function LivePharmacySearch({ initialValue, params, compact = false }: LivePharmacySearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Preserve keyboard focus through server navigation. Still synchronize browser
  // back/forward or external filter changes when the field is not being edited.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === initialValue) return;
    if (trimmed.length === 1 && !initialValue) return;

    const timeout = window.setTimeout(() => {
      const next = toUrlSearchParams(params);
      next.set("view", "list");
      next.delete("page");
      if (trimmed.length >= 2) next.set("q", trimmed);
      else next.delete("q");

      startTransition(() => {
        router.replace(`/dashboard/pharmacies?${next.toString()}`, { scroll: false });
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [initialValue, params, query, router]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className={compact ? "absolute left-3 top-2.5 size-4 text-muted-foreground" : "absolute left-3 top-3 size-4 text-muted-foreground"} />
        <Input
          aria-label="Rechercher une pharmacie"
          autoComplete="off"
          name="q"
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          className={compact ? "h-9 rounded-md border-[var(--tr1-line-strong)] bg-white/90 pl-9 pr-10 text-sm" : "h-10 rounded-xl border-[var(--tr1-line-strong)] bg-white pl-9 pr-10 text-sm"}
          placeholder="Pharmacie, ville, CP, CIP…"
        />
        {isPending ? (
          <LoaderCircle className={compact ? "absolute right-3 top-2.5 size-4 animate-spin text-[var(--tr1-orange)]" : "absolute right-3 top-3 size-4 animate-spin text-[var(--tr1-orange)]"} aria-label="Recherche en cours" />
        ) : query ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={compact ? "absolute right-0.5 top-0.5 size-8 rounded-lg text-muted-foreground" : "absolute right-1 top-1 size-8 rounded-lg text-muted-foreground"}
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
          >
            <X className="size-4" />
            <span className="sr-only">Effacer la recherche</span>
          </Button>
        ) : null}
      </div>
      {query.trim().length === 1 ? (
        <p className="px-1 text-[0.68rem] text-muted-foreground">Tapez encore un caractère pour lancer la recherche.</p>
      ) : null}
    </div>
  );
}

function toUrlSearchParams(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length) next.set(key, value);
  }
  return next;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupSearchItems, moveSearchSelection, searchScopedItems, type SearchItem } from "@/lib/ux/search";

export function CommandPalette({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = useMemo(() => searchScopedItems(items, query), [items, query]);
  const groups = useMemo(() => groupSearchItems(results), [results]);

  const openPalette = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [open, openPalette]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function navigate(item: SearchItem) {
    setOpen(false);
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => moveSearchSelection(current, event.key === "ArrowDown" ? 1 : -1, results.length));
    }
    if (event.key === "Enter" && results[selectedIndex]) {
      event.preventDefault();
      navigate(results[selectedIndex]);
    }
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <>
      <Button
        aria-label="Ouvrir la recherche globale"
        className="h-10 w-full max-w-md justify-between border-border/80 bg-background/85 px-3 text-muted-foreground shadow-sm hover:bg-background"
        data-testid="command-palette-trigger"
        onClick={openPalette}
        type="button"
        variant="outline"
      >
        <span className="flex items-center gap-2"><Search className="size-4" />Rechercher partout…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.68rem] sm:inline">⌘ K</kbd>
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] grid items-start justify-items-center bg-[var(--tr1-navy)]/52 px-3 pt-[10vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <section
            aria-label="Recherche globale"
            aria-modal="true"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl"
            data-testid="command-palette"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center gap-3 border-b px-4">
              <Search aria-hidden="true" className="size-5 text-muted-foreground" />
              <input
                aria-controls="command-results"
                aria-label="Rechercher une pharmacie, mission ou tâche"
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Pharmacie, mission, tâche ou action…"
                ref={inputRef}
                value={query}
              />
              <Button aria-label="Fermer la recherche" onClick={() => setOpen(false)} size="icon" type="button" variant="ghost"><X className="size-4" /></Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2" id="command-results">
              {groups.map((group) => (
                <div className="py-2" key={group.kind}>
                  <p className="px-2 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
                  {group.items.map((item) => {
                    const index = results.indexOf(item);
                    return (
                      <button
                        className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors", index === selectedIndex && "bg-accent")}
                        key={item.id}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        type="button"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground"><Search className="size-3.5" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.label}</span>{item.description && <span className="block truncate text-xs text-muted-foreground">{item.description}</span>}</span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              ))}
              {!results.length && <p className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun résultat dans votre périmètre.</p>}
            </div>
            <div className="flex gap-4 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground"><span>↑↓ Naviguer</span><span>↵ Ouvrir</span><span>Esc Fermer</span></div>
          </section>
        </div>
      )}
    </>
  );
}

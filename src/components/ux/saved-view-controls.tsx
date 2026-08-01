"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseSavedView, savedViewStorageKey, serializeSavedView, type SavedView } from "@/lib/ux/saved-view";

export function SavedViewControls({ brandId, userId, activeFilter }: { brandId: string; userId: string; activeFilter: string }) {
  const key = savedViewStorageKey(brandId, userId, "commercial-priorities");
  const [savedView, setSavedView] = useState<SavedView | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSavedView(parseSavedView(localStorage.getItem(key))), 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  function save() {
    const view = {
      name: activeFilter ? `Priorités · ${activeFilter.replaceAll("_", " ")}` : "Toutes les priorités",
      href: activeFilter ? `/dashboard/commercial-health?filter=${activeFilter}` : "/dashboard/commercial-health",
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, serializeSavedView(view));
    setSavedView(view);
  }

  function reset() {
    localStorage.removeItem(key);
    setSavedView(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="saved-view-controls">
      {savedView && <Button asChild size="sm" variant="outline"><Link href={savedView.href}><Bookmark className="size-3.5" />{savedView.name}</Link></Button>}
      <Button onClick={save} size="sm" type="button" variant="outline"><Bookmark className="size-3.5" />{savedView ? "Mettre à jour ma vue" : "Enregistrer cette vue"}</Button>
      {savedView && <Button aria-label="Restaurer la vue officielle" onClick={reset} size="sm" type="button" variant="ghost"><RotateCcw className="size-3.5" />Vue officielle</Button>}
    </div>
  );
}

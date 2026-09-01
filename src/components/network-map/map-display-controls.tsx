"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MapDisplayState = {
  showActors: boolean;
  showPharmacies: boolean;
  showConnections: boolean;
  showInfluenceZones: boolean;
};

export function MapDisplayControls({
  controls,
  onToggle,
}: {
  controls: MapDisplayState;
  onToggle: (key: keyof MapDisplayState) => void;
}) {
  const items: Array<{ key: keyof MapDisplayState; label: string }> = [
    { key: "showActors", label: "Acteurs terrain" },
    { key: "showPharmacies", label: "Réseau pharmacies" },
    { key: "showConnections", label: "Connexions" },
    { key: "showInfluenceZones", label: "Zones d’influence" },
  ];

  return (
    <Card className="tr1-da-panel overflow-hidden py-0">
      <CardHeader className="border-b border-[var(--tr1-line)] px-3 py-2.5">
        <CardTitle className="font-mono text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--tr1-navy)]">
          Affichage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 py-3">
        {items.map((item) => {
          const enabled = controls[item.key];
          return (
            <button
              className="flex w-full items-center justify-between rounded-[0.45rem] border border-[var(--tr1-line)] bg-white/65 px-2.5 py-2 text-left transition hover:border-[var(--tr1-line-strong)]"
              key={item.key}
              onClick={() => onToggle(item.key)}
              type="button"
            >
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.06em] text-[var(--tr1-navy)]">
                {item.label}
              </span>
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-[0.22rem] border text-white",
                  enabled
                    ? "border-[var(--tr1-orange)] bg-[var(--tr1-orange)]"
                    : "border-[var(--tr1-line-strong)] bg-transparent text-transparent",
                )}
              >
                <Check className="size-3" />
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

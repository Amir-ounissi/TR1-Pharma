"use client";

import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function MapBottomStats({
  coverageLabel,
  activePharmacies,
  activeAnimations,
  priorityCount,
}: {
  coverageLabel: string;
  activePharmacies: number;
  activeAnimations: number;
  priorityCount: number;
}) {
  return (
    <Card className="tr1-da-panel overflow-hidden py-0">
      <CardContent className="flex min-h-[3.75rem] flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-0.5">
          <p className="font-mono text-[0.58rem] font-black uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
            Vue globale
          </p>
          <h3 className="text-sm font-semibold text-[var(--tr1-navy)]">Couverture réseau & activité observée</h3>
        </div>

        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <BottomStat label="Couverture réseau" value={coverageLabel} />
          <BottomStat label="Pharmacies actives" value={String(activePharmacies)} />
          <BottomStat label="Animations en cours" value={String(activeAnimations)} />
          <BottomStat label="Zones prioritaires" value={String(priorityCount)} />
        </div>

        <Button
          className="h-9 rounded-[0.45rem] border-[var(--tr1-line-strong)] bg-white/80 px-3 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] text-[var(--tr1-navy)]"
          disabled
          title="Bientôt disponible"
          variant="outline"
        >
          <Download className="size-3.5" />
          Exporter la carte
        </Button>
      </CardContent>
    </Card>
  );
}

function BottomStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[0.55rem] border border-[var(--tr1-line)] bg-white/62 px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="size-2.5 text-[var(--tr1-orange)]" />
        <p className="font-mono text-[0.54rem] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="font-mono text-[0.95rem] font-black tracking-[-0.06em] text-[var(--tr1-navy)]">{value}</p>
    </article>
  );
}

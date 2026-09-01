import { Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MapLegend() {
  const states = [
    { label: "Ciblée", swatch: "bg-[#8bb889]" },
    { label: "Ouverte récemment", swatch: "bg-[#7da4d8]" },
    { label: "Active", swatch: "bg-[var(--tr1-navy)]" },
    { label: "Sans prochaine action", swatch: "bg-[var(--tr1-orange)]" },
    { label: "À risque", swatch: "bg-[#d86838]" },
    { label: "Dormante", swatch: "bg-[#b7ad9a]" },
  ];

  return (
    <Card className="tr1-da-panel overflow-hidden py-0">
      <CardHeader className="border-b border-[var(--tr1-line)] px-3 py-2.5">
        <CardTitle className="font-mono text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--tr1-navy)]">
          Légende
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 py-3">
        <div className="space-y-2">
          {states.map((item) => (
            <div className="flex items-center gap-2 text-[0.71rem] text-[var(--tr1-navy)]" key={item.label}>
              <span className={`size-2.5 rounded-full ${item.swatch}`} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--tr1-line)] pt-3">
          <div className="space-y-2 text-[0.71rem] text-[var(--tr1-navy)]">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[0.82rem] text-[var(--tr1-orange)]">★</span>
              <span>Compte stratégique</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[0.82rem] text-[var(--tr1-orange)]">◎</span>
              <span>Animation en cours</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-4 place-items-center rounded-full border border-[var(--tr1-line-strong)] bg-white text-[0.58rem] font-bold text-[var(--tr1-navy)]">
                A
              </span>
              <span>Acteur terrain</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Minus className="size-4 text-[var(--tr1-orange)]" />
              <span>Couverture acteur</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

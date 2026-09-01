"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PharmacyQuickPanel } from "@/components/pharmacies/pharmacy-quick-panel";
import type { PharmacySummary } from "@/lib/pharmacy-summary";
import { labels } from "@/lib/reference-data";
import { cn } from "@/lib/utils";

export type PharmacyListRow = {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  pharmacy_group_name: string | null;
  city: string | null;
  postal_code: string | null;
  commercial_status: string;
  priority_level: string;
  potential_level: string;
  agent_name: string | null;
  territory_name: string | null;
};

type PharmacyListWithPanelProps = {
  rows: PharmacyListRow[];
  loadSummaryAction: (brandPharmacyId: string) => Promise<{ summary: PharmacySummary | null; error: string | null }>;
};

export function PharmacyListWithPanel({ rows, loadSummaryAction }: PharmacyListWithPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summaryById, setSummaryById] = useState<Record<string, PharmacySummary | null>>({});
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [isPending, startTransition] = useTransition();

  const currentSummary = selectedId ? (summaryById[selectedId] ?? null) : null;
  const currentError = selectedId ? (errorById[selectedId] ?? null) : null;


  function openPanel(brandPharmacyId: string) {
    setSelectedId(brandPharmacyId);
    setOpen(true);
    if (Object.prototype.hasOwnProperty.call(summaryById, brandPharmacyId) || Object.prototype.hasOwnProperty.call(errorById, brandPharmacyId)) {
      return;
    }
    startTransition(async () => {
      const result = await loadSummaryAction(brandPharmacyId);
      setSummaryById((current) => ({ ...current, [brandPharmacyId]: result.summary }));
      setErrorById((current) => ({ ...current, [brandPharmacyId]: result.error }));
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-[0.8rem] border border-[var(--tr1-line)] bg-white/78">
        <Table className="text-[0.75rem]">
          <TableHeader className="bg-[var(--tr1-navy)] text-white">
            <TableRow className="border-white/10 hover:bg-[var(--tr1-navy)]">
              <TableHead className="h-10 px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Pharmacie</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Localisation</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Statut</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Priorité</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Potentiel</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Agent</TableHead>
              <TableHead className="px-3 font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white">Territoire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const pharmacyName = row.trade_name || row.legal_name || "Pharmacie";
              return (
                <TableRow key={row.id} className="border-[var(--tr1-line)] hover:bg-white/45 focus-within:bg-white/45">
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openPanel(row.id)}
                          className="text-left text-[0.82rem] font-semibold text-[var(--tr1-navy)] underline-offset-4 hover:text-[var(--tr1-orange)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] focus-visible:ring-offset-2"
                          aria-label={`Ouvrir le résumé rapide de ${pharmacyName}`}
                        >
                          {pharmacyName}
                        </button>
                        <p className="mt-0.5 text-[0.68rem] text-muted-foreground">{row.pharmacy_group_name || "Indépendante"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <p className="font-medium text-[var(--tr1-navy)]">{row.city || "—"}</p>
                    <p className="text-[0.68rem] text-muted-foreground">{row.postal_code || "Code postal non renseigné"}</p>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Badge variant="outline" className="h-5 rounded-full border-[var(--tr1-line-strong)] bg-transparent font-mono text-[0.54rem] uppercase">
                      {labels.commercialStatus[row.commercial_status as keyof typeof labels.commercialStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-[var(--tr1-navy)]", row.priority_level === "strategic" && "text-[var(--tr1-orange)]")}>
                      <span className={cn("size-1.5 rounded-full bg-[var(--tr1-blue)]", row.priority_level === "strategic" && "bg-[var(--tr1-orange)]")} />
                      {labels.priorityLevel[row.priority_level as keyof typeof labels.priorityLevel]}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-[0.72rem] text-[var(--tr1-navy)]">
                    {labels.potentialLevel[row.potential_level as keyof typeof labels.potentialLevel]}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {row.agent_name ? (
                      <span className="text-[0.72rem] text-[var(--tr1-navy)]">{row.agent_name}</span>
                    ) : (
                      <span className="text-[0.72rem] text-[var(--tr1-orange)]">Non affecté</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-[0.72rem] text-[var(--tr1-navy)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>{row.territory_name || "—"}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 rounded-md px-2 text-[0.68rem] text-[var(--tr1-navy)] hover:text-[var(--tr1-orange)]" onClick={() => openPanel(row.id)}>
                        Voir le résumé
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PharmacyQuickPanel
        open={open}
        onOpenChange={setOpen}
        summary={currentSummary}
        loading={Boolean(open && selectedId && !currentSummary && !currentError && isPending)}
        error={currentError ?? null}
      />
    </>
  );
}

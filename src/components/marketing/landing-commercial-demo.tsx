import { CalendarDays, ChevronRight, ClipboardCheck, PackageCheck, Route } from "lucide-react";
import { demoPharmacies } from "@/lib/marketing/demo-network";

const pharmacy = demoPharmacies.find((item) => item.id === "arcades-lille") ?? demoPharmacies[0];

export function LandingCommercialDemo() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--tr1-line)] bg-white shadow-[0_16px_42px_rgba(14,29,49,.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tr1-line)] px-4 py-4 sm:px-5">
        <div>
          <p className="text-sm font-black text-[var(--tr1-navy)]">Ma journée terrain</p>
          <p className="mt-1 text-xs text-[var(--tr1-muted)]">Commercial · données de démonstration</p>
        </div>
        <span className="rounded-full bg-[var(--tr1-ivory)] px-3 py-1 text-xs font-bold text-[var(--tr1-muted)]">Démonstration</span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[.38fr_.62fr]">
        <div className="border-b border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-4 lg:border-b-0 lg:border-r sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[.06em] text-[var(--tr1-muted)]">Tournée du jour</p>
          <div className="mt-4 space-y-2">
            <TourStop time="09:00" name="Pharmacie République" status="Visite client" />
            <TourStop time="11:15" name={pharmacy.name} status="À relancer" active />
            <TourStop time="14:30" name="Pharmacie Bellecour" status="Réassort" />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold text-[var(--tr1-navy)]">
            <Route className="size-4 shrink-0 text-[var(--tr1-orange)]" aria-hidden="true" />
            3 visites · prochaines actions déjà préparées
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.06em] text-[var(--tr1-orange)]">Pharmacie sélectionnée</p>
              <h4 className="mt-1 text-lg font-black tracking-[-.025em] text-[var(--tr1-navy)]">{pharmacy.name}</h4>
              <p className="mt-1 text-sm text-[var(--tr1-muted)]">{pharmacy.city}</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#b43735]">{pharmacy.commercial.status}</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric icon={<PackageCheck className="size-4" />} label="Dernière commande" value="720 €" detail="il y a 71 jours" />
            <Metric icon={<CalendarDays className="size-4" />} label="Dernier échange" value="4 sept." detail="compte rendu disponible" />
            <Metric icon={<ClipboardCheck className="size-4" />} label="Priorité" value="Haute" detail="réassort attendu" />
          </div>

          <div className="mt-5 rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] p-4">
            <p className="text-xs font-bold uppercase tracking-[.05em] text-[var(--tr1-muted)]">Pourquoi agir maintenant ?</p>
            <p className="mt-2 text-sm font-semibold text-[var(--tr1-navy)]">{pharmacy.commercial.information}</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-3">
              <div>
                <p className="text-xs text-[var(--tr1-muted)]">Prochaine action</p>
                <p className="mt-1 text-sm font-black text-[var(--tr1-navy)]">{pharmacy.commercial.nextAction}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[var(--tr1-orange)]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TourStop({ time, name, status, active = false }: { time: string; name: string; status: string; active?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? "border-[var(--tr1-orange)] bg-white" : "border-transparent bg-white/70"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[.7rem] font-black text-[var(--tr1-muted)]">{time}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--tr1-navy)]">{name}</p>
          <p className={`mt-1 text-xs font-semibold ${active ? "text-[var(--tr1-orange)]" : "text-[var(--tr1-muted)]"}`}>{status}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[var(--tr1-line)] p-3">
      <div className="flex items-center gap-2 text-[var(--tr1-orange)]">{icon}<span className="text-xs font-semibold text-[var(--tr1-muted)]">{label}</span></div>
      <p className="mt-2 text-base font-black text-[var(--tr1-navy)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--tr1-muted)]">{detail}</p>
    </div>
  );
}

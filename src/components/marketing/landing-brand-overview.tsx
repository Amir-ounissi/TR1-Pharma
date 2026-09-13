import { demoPharmacies } from "@/lib/marketing/demo-network";

const arcades = demoPharmacies.find((item) => item.id === "arcades-lille")!;
const republique = demoPharmacies.find((item) => item.id === "republique-paris")!;
const comedie = demoPharmacies.find((item) => item.id === "comedie-montpellier")!;
const prado = demoPharmacies.find((item) => item.id === "prado-marseille")!;

export function LandingBrandOverview() {
  return (
    <div className="rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-[0_16px_42px_rgba(14,29,49,.07)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tr1-line)] pb-4">
        <div>
          <p className="text-sm font-black text-[var(--tr1-navy)]">Vue marque</p>
          <p className="mt-1 text-xs text-[var(--tr1-muted)]">Synthèse réseau · données de démonstration</p>
        </div>
        <span className="rounded-full bg-[var(--tr1-ivory)] px-3 py-1 text-xs font-bold text-[var(--tr1-muted)]">Démonstration</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Pharmacies prioritaires">
          <PriorityRow name={arcades.name} city={arcades.city} status={arcades.commercial.status} tone="risk" />
          <PriorityRow name={comedie.name} city={comedie.city} status={comedie.commercial.status} tone="watch" />
        </Panel>

        <Panel title="Interventions à suivre">
          <InterventionRow label="Animation" pharmacy={arcades.name} status={arcades.animations.status} />
          <InterventionRow label="Formation" pharmacy={prado.name} status={prado.formations.status} />
          <InterventionRow label="Compte rendu" pharmacy={republique.name} status={republique.animations.status} />
        </Panel>

        <Panel title="Résultats disponibles">
          <ResultRow label="Sell-out déclaré" value="24 unités" detail={comedie.name} />
          <ResultRow label="CA observé après intervention" value="En cours d’observation" detail={comedie.name} />
          <ResultRow label="Score moyen au quiz" value="91 %" detail={`${comedie.name} · 6 participants`} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-[var(--tr1-ivory)] p-4">
      <h3 className="text-sm font-black text-[var(--tr1-navy)]">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function PriorityRow({ name, city, status, tone }: { name: string; city: string; status: string; tone: "risk" | "watch" }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white p-3">
      <span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${tone === "risk" ? "bg-[#c2413d]" : "bg-[#d97706]"}`} />
      <div>
        <p className="text-sm font-bold text-[var(--tr1-navy)]">{name}</p>
        <p className="mt-0.5 text-xs text-[var(--tr1-muted)]">{city}</p>
        <p className="mt-2 text-xs font-semibold text-[var(--tr1-navy)]">{status}</p>
      </div>
    </div>
  );
}

function InterventionRow({ label, pharmacy, status }: { label: string; pharmacy: string; status: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[.04em] text-[var(--tr1-orange)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--tr1-navy)]">{pharmacy}</p>
      <p className="mt-1 text-xs text-[var(--tr1-muted)]">{status}</p>
    </div>
  );
}

function ResultRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs font-semibold leading-4 text-[var(--tr1-muted)]">{label}</p>
      <p className="mt-2 text-sm font-black text-[var(--tr1-navy)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--tr1-muted)]">{detail}</p>
    </div>
  );
}

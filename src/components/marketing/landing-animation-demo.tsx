import { demoPharmacies } from "@/lib/marketing/demo-network";

const pharmacy = demoPharmacies.find((item) => item.animationDetail) ?? demoPharmacies[0];
const detail = pharmacy.animationDetail;

export function LandingAnimationDemo() {
  if (!detail) return null;

  return (
    <div className="rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-[0_16px_42px_rgba(14,29,49,.07)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--tr1-line)] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.06em] text-[var(--tr1-orange)]">Animation · démonstration</p>
          <h4 className="mt-1 text-lg font-black tracking-[-.025em] text-[var(--tr1-navy)]">{pharmacy.name}</h4>
          <p className="mt-1 text-sm text-[var(--tr1-muted)]">{pharmacy.city} · {detail.date}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{detail.status}</span>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[.04em] text-[var(--tr1-muted)]">Intervenant</dt>
          <dd className="mt-1 font-bold text-[var(--tr1-navy)]">{detail.facilitator}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[.04em] text-[var(--tr1-muted)]">Objectif</dt>
          <dd className="mt-1 font-bold text-[var(--tr1-navy)]">{detail.objective}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Sell-out déclaré" value={detail.sellOut} />
        <Metric label="CA observé après intervention" value={detail.observedRevenue} />
        <Metric label="Facturation" value={detail.billing} />
      </div>

      <div className="mt-5 rounded-xl bg-[var(--tr1-ivory)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[var(--tr1-navy)]">Compte rendu</p>
          <span className="text-xs font-bold text-emerald-700">Rapport validé</span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-[var(--tr1-muted)] sm:grid-cols-3">
          <p>Photos terrain reçues</p>
          <p>Ventes déclarées renseignées</p>
          <p>Suivi commercial à préparer</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--tr1-line)] p-3">
      <p className="text-xs font-semibold leading-4 text-[var(--tr1-muted)]">{label}</p>
      <p className="mt-2 text-sm font-black leading-5 text-[var(--tr1-navy)]">{value}</p>
    </div>
  );
}

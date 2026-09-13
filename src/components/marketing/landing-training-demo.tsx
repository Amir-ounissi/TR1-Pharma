import { demoPharmacies } from "@/lib/marketing/demo-network";

const rows = demoPharmacies.filter((pharmacy) => pharmacy.formationDetail).slice(0, 4);

export function LandingTrainingDemo() {
  return (
    <div className="rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-[0_16px_42px_rgba(14,29,49,.07)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tr1-line)] pb-4">
        <div>
          <p className="text-sm font-black text-[var(--tr1-navy)]">Suivi des formations</p>
          <p className="mt-1 text-xs text-[var(--tr1-muted)]">Vue marque · données de démonstration</p>
        </div>
        <span className="rounded-full bg-[var(--tr1-ivory)] px-3 py-1 text-xs font-bold text-[var(--tr1-muted)]">Démonstration</span>
      </div>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[700px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--tr1-line)] text-xs uppercase tracking-[.04em] text-[var(--tr1-muted)]">
              <th className="pb-3 pr-4 font-bold">Pharmacie</th>
              <th className="pb-3 pr-4 font-bold">Module</th>
              <th className="pb-3 pr-4 font-bold">Date</th>
              <th className="pb-3 pr-4 font-bold">Formateur</th>
              <th className="pb-3 pr-4 font-bold">Participants</th>
              <th className="pb-3 pr-4 font-bold">Statut</th>
              <th className="pb-3 font-bold">Score moyen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pharmacy) => {
              const detail = pharmacy.formationDetail!;
              return (
                <tr className="border-b border-[var(--tr1-line)] last:border-0" key={pharmacy.id}>
                  <td className="py-4 pr-4 font-bold text-[var(--tr1-navy)]">{pharmacy.name}<span className="block text-xs font-normal text-[var(--tr1-muted)]">{pharmacy.city}</span></td>
                  <td className="py-4 pr-4 text-[var(--tr1-muted)]">{detail.module}</td>
                  <td className="py-4 pr-4 text-[var(--tr1-muted)]">{detail.date}</td>
                  <td className="py-4 pr-4 text-[var(--tr1-muted)]">{detail.trainer}</td>
                  <td className="py-4 pr-4 font-semibold">{detail.participants}</td>
                  <td className="py-4 pr-4"><StatusBadge status={detail.status} /></td>
                  <td className="py-4 font-black text-[var(--tr1-navy)]">{detail.averageScore == null ? "En attente" : `${detail.averageScore} %`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {rows.map((pharmacy) => {
          const detail = pharmacy.formationDetail!;
          return (
            <article className="rounded-xl bg-[var(--tr1-ivory)] p-4" key={pharmacy.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[var(--tr1-navy)]">{pharmacy.name}</p>
                  <p className="mt-1 text-xs text-[var(--tr1-muted)]">{pharmacy.city} · {detail.date}</p>
                </div>
                <StatusBadge status={detail.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2"><dt className="text-xs text-[var(--tr1-muted)]">Module</dt><dd className="mt-1 font-semibold">{detail.module}</dd></div>
                <div><dt className="text-xs text-[var(--tr1-muted)]">Formateur</dt><dd className="mt-1 font-semibold">{detail.trainer}</dd></div>
                <div><dt className="text-xs text-[var(--tr1-muted)]">Participants</dt><dd className="mt-1 font-semibold">{detail.participants}</dd></div>
                <div><dt className="text-xs text-[var(--tr1-muted)]">Score moyen</dt><dd className="mt-1 font-black">{detail.averageScore == null ? "En attente" : `${detail.averageScore} %`}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const warning = status.includes("prévoir") || status === "En cours";
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[.68rem] font-bold ${warning ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{status}</span>;
}

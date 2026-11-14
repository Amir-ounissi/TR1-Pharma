import Link from "next/link";
import { euroHT, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { getBuyerWorkspace } from "@/lib/catalogue-buyer-workspace";

const labels: Record<string, string> = {
  received: "Reçue",
  verifying: "En vérification",
  forwarded: "Transmise au laboratoire",
  confirmed: "Confirmée",
  closed: "Clôturée",
  declined: "Annulée / refusée",
};

export default async function PharmacyRequestsPage({
  searchParams,
}: { searchParams: Promise<{ envoyee?: string; marques?: string }> }) {
  const { envoyee, marques } = await searchParams;
  const submittedBrandCount = Math.max(1, Math.min(20, Number(marques) || 1));
  const { pharmacy, catalog, admin } = await requirePharmacyCatalogue();
  const workspace = await getBuyerWorkspace(admin);
  const reorderable = new Set(workspace.recent_requests.map((request) => request.id));
  const requests = catalog.requests ?? [];
  const names = new Map(catalog.brands.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-7">
      <Link href="/catalogue" className="text-sm font-semibold text-[#69717d] hover:text-[#ea7015]">← Retour au catalogue</Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ea7015]">{pharmacy.name}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Mes demandes</h1>
        <p className="mt-3 text-sm text-[#69717d]">Une demande reçue ne constitue pas encore une commande confirmée par le laboratoire.</p>
      </div>
      {envoyee === "1" ? <p role="status" className="rounded-xl border border-[#4f7a58]/30 bg-[#edf7ee] p-4 text-sm font-semibold text-[#315638]">{submittedBrandCount > 1 ? `Votre panier a été réparti automatiquement en ${submittedBrandCount} demandes distinctes, une par marque.` : "Votre demande a été enregistrée et transmise à TR1 PHARMA."}</p> : null}
      <div className="overflow-hidden rounded-xl border border-[#0e1d31]/10 bg-white">
        {requests.length ? (
          <div className="divide-y divide-[#0e1d31]/10">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-bold">{names.get(request.brand_id) ?? "Laboratoire"}</p>
                  <p className="mt-1 text-xs text-[#69717d]">{new Date(request.created_at).toLocaleDateString("fr-FR")} · Réf. {request.id.slice(0, 8).toUpperCase()}</p>
                  <p className="mt-2 text-xs font-bold text-[#69717d]">{request.request_kind === "quote" ? "Demande de conditions · " : "Demande de commande · "}{labels[request.status] ?? request.status}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="text-lg font-black">{request.request_kind === "quote" || request.total_ht === null ? "À chiffrer" : euroHT(Number(request.total_ht)) + " HT"}</p>
                  {reorderable.has(request.id) ? (
                    <Link href={"/catalogue?reprendre=" + encodeURIComponent(request.id) + "#reassort"}
                      className="inline-flex min-h-9 items-center rounded-lg border border-[#142941] px-3 text-xs font-bold text-[#142941] hover:bg-[#f4f6f6]">
                      Reprendre cette sélection
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="p-8 text-sm text-[#69717d]">Aucune demande transmise pour le moment.</p>}
      </div>
    </div>
  );
}

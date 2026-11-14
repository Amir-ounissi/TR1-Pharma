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
  const { pharmacy, catalog, admin, isLinkAccess } = await requirePharmacyCatalogue();
  const workspace = isLinkAccess
    ? { lines: [], recent_requests: [] }
    : await getBuyerWorkspace(admin);
  const reorderable = new Set(workspace.recent_requests.map((request) => request.id));
  const recentById = new Map(workspace.recent_requests.map((request) => [request.id, request] as const));
  const requests = catalog.requests ?? [];
  const names = new Map(catalog.brands.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-7">
      <Link href="/catalogue" className="text-sm font-semibold text-[#69717d] hover:text-[#ea7015]">← Retour au catalogue</Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ea7015]">{pharmacy.name}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">{isLinkAccess ? "Suivi des demandes" : "Mes demandes"}</h1>
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
                  {(recentById.get(request.id)?.shipping_batch_id ?? request.shipping_batch_id) ? (
                    <p className="mt-2 text-[11px] font-semibold text-[#416a4b]">
                      Regroupement livraison coréenne · Lot {(recentById.get(request.id)?.shipping_batch_id ?? request.shipping_batch_id)!.slice(0, 8).toUpperCase()} · Franco à 250 € HT remisé sur les marques cumulées, à confirmer après chiffrage.
                    </p>
                  ) : null}
                  {(recentById.get(request.id)?.items ?? request.items ?? []).length ? (
                    <details className="mt-3 rounded-lg border border-[#e5e9eb] bg-[#faf9f6] p-3">
                      <summary className="cursor-pointer text-xs font-bold text-[#142941]">
                        Voir {(recentById.get(request.id)?.items ?? request.items ?? []).length} références de la demande
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-[#526071]">
                        {(recentById.get(request.id)?.items ?? request.items ?? []).map((line, index) => (
                          <li key={(line.product_id ?? "ligne") + "-" + index}>{line.name} · {line.quantity} unité{line.quantity > 1 ? "s" : ""}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="text-lg font-black">{request.request_kind === "quote" || request.total_ht === null ? "À chiffrer" : euroHT(Number(request.total_ht)) + " HT"}</p>
                  {reorderable.has(request.id) ? (
                    <Link href={"/catalogue?reprendre=" + encodeURIComponent(request.id) + "#liste-produits"}
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

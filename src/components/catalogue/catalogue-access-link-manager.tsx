"use client";

import { useActionState, useState } from "react";
import {
  createPrivateCatalogueAccessLink,
  revokePrivateCatalogueAccessLink,
  type CatalogueAccessLinkActionState,
} from "@/app/catalogue/administration/actions";

const initialState: CatalogueAccessLinkActionState = {
  url: "",
  expiresAt: "",
  error: "",
  revoked: false,
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function CatalogueAccessLinkManager({
  pharmacyId,
  activeExpiresAt,
  lastUsedAt,
}: {
  pharmacyId: string;
  activeExpiresAt: string | null;
  lastUsedAt: string | null;
}) {
  const [created, createAction, creating] = useActionState(
    createPrivateCatalogueAccessLink,
    initialState,
  );
  const [revoked, revokeAction, revoking] = useActionState(
    revokePrivateCatalogueAccessLink,
    initialState,
  );
  const [copied, setCopied] = useState(false);
  const isActive = Boolean(activeExpiresAt && new Date(activeExpiresAt).getTime() > Date.now());

  async function copyLink() {
    if (!created.url) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      {isActive ? (
        <div className="text-[11px] leading-5 text-[#476b55]">
          <p className="font-bold">Lien actif jusqu’au {dateLabel(activeExpiresAt!)}</p>
          {lastUsedAt ? <p className="text-[#69717d]">Dernière utilisation : {dateLabel(lastUsedAt)}</p> : null}
        </div>
      ) : (
        <p className="text-[11px] text-[#69717d]">Aucun lien actif.</p>
      )}

      <form action={createAction}>
        <input type="hidden" name="pharmacy_id" value={pharmacyId} />
        <button type="submit" disabled={creating}
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-[#0e1d31] px-3 py-2 text-xs font-bold text-white hover:bg-[#1c3552] disabled:opacity-50">
          {creating ? "Génération…" : isActive ? "Renouveler le lien privé" : "Générer un lien privé"}
        </button>
      </form>

      {created.url ? (
        <div className="space-y-2 rounded-lg border border-[#c8d9ce] bg-[#f3f8f3] p-3">
          <p className="text-xs font-bold text-[#315c3f]">Nouveau lien prêt · valable jusqu’au {dateLabel(created.expiresAt)}</p>
          <input readOnly value={created.url}
            className="w-full rounded-md border border-[#dce3ea] bg-white px-2 py-2 text-[11px] text-[#142941]" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyLink()}
              className="min-h-9 rounded-md border border-[#315c3f] bg-white px-3 text-xs font-bold text-[#315c3f]">
              {copied ? "Lien copié" : "Copier le lien"}
            </button>
            <a href={created.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center rounded-md px-2 text-xs font-bold text-[#315c3f] underline">
              Tester le lien
            </a>
          </div>
        </div>
      ) : null}

      {created.error || revoked.error ? (
        <p role="alert" className="text-xs font-semibold text-red-700">{created.error || revoked.error}</p>
      ) : null}
      {revoked.revoked ? (
        <p role="status" className="text-xs font-semibold text-[#8c4212]">Lien désactivé. Les sessions déjà ouvertes seront refusées à la prochaine requête.</p>
      ) : null}

      {isActive ? (
        <form action={revokeAction}>
          <input type="hidden" name="pharmacy_id" value={pharmacyId} />
          <button type="submit" disabled={revoking}
            className="min-h-8 text-[11px] font-bold text-[#8c4212] underline underline-offset-2 disabled:opacity-50">
            {revoking ? "Désactivation…" : "Révoquer le lien"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

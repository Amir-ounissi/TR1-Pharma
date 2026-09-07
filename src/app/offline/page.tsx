import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fffdf8] px-6 py-10 text-[#0b1e32]">
      <div className="w-full max-w-sm rounded-3xl border border-[#0b1e32]/10 bg-white p-7 shadow-sm">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[#0b1e32] text-lg font-black text-white">
          TR1
        </div>
        <h1 className="text-2xl font-semibold">Connexion indisponible</h1>
        <p className="mt-3 text-sm leading-6 text-[#0b1e32]/65">
          TR1 ne met pas en cache vos données métier sur l’appareil. Reconnectez-vous au réseau pour retrouver pharmacies, commandes, missions et agenda.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/dashboard/field"
            className="rounded-xl bg-[#0b1e32] px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Réessayer
          </Link>
          <p className="text-center text-xs text-[#0b1e32]/50">
            Les brouillons explicitement enregistrés localement restent sur votre appareil.
          </p>
        </div>
      </div>
    </main>
  );
}

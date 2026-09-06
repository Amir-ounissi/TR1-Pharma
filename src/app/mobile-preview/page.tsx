"use client";

import { useState } from "react";

const pharmacies = [
  { name: "Grande Pharmacie de la Valentine", city: "Marseille", status: "Client", priority: "Stratégique", potential: "A" },
  { name: "Pharmacie du Prado", city: "Marseille", status: "Client", priority: "Haute", potential: "A" },
  { name: "Pharmacie Jas de Bouffan", city: "Aix-en-Provence", status: "Prospect", priority: "Haute", potential: "B" },
];

type Screen = "home" | "pharmacies" | "detail";

export default function MobilePreviewPage() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <main className="min-h-screen bg-[#eef1f5] px-4 py-8 text-[#111827]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <section className="hidden rounded-3xl bg-white p-8 shadow-sm lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3B5BDB]">TR1 Pharma Mobile</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Prévisualisation du MVP terrain</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#667085]">
            Cette page reproduit l’interface mobile actuellement développée sur la PR #48. Elle sert uniquement à valider l’UX et le design avant les builds natifs iOS / Android.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Accueil", "Priorités et actions rapides"],
              ["Pharmacies", "Portefeuille et recherche"],
              ["Pharma 360", "Lecture commerciale du compte"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-[#E4E7EC] p-4">
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm text-[#667085]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[390px]">
          <div className="overflow-hidden rounded-[2.6rem] border-[9px] border-[#111827] bg-[#F7F8FA] shadow-2xl">
            <div className="flex justify-center bg-[#111827] py-2">
              <div className="h-1.5 w-24 rounded-full bg-[#475467]" />
            </div>
            <div className="min-h-[760px] bg-[#F7F8FA]">
              {screen === "home" ? <HomeScreen onNavigate={setScreen} /> : null}
              {screen === "pharmacies" ? <PharmaciesScreen onNavigate={setScreen} /> : null}
              {screen === "detail" ? <DetailScreen onNavigate={setScreen} /> : null}
            </div>
            <nav className="grid grid-cols-3 border-t border-[#E4E7EC] bg-white px-2 py-3 text-center text-[11px] font-bold text-[#667085]">
              <button onClick={() => setScreen("home")} className={screen === "home" ? "text-[#3B5BDB]" : ""}>Accueil</button>
              <button onClick={() => setScreen("pharmacies")} className={screen === "pharmacies" || screen === "detail" ? "text-[#3B5BDB]" : ""}>Pharmacies</button>
              <button className="opacity-50">Missions</button>
            </nav>
          </div>
        </section>
      </div>
    </main>
  );
}

function HomeScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">TR1 Terrain</p>
          <h2 className="mt-1 text-2xl font-black">Naali</h2>
          <p className="mt-1 text-xs text-[#667085]">Agent terrain</p>
        </div>
        <button className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#3B5BDB] shadow-sm">Changer</button>
      </div>

      <div className="mt-5 rounded-3xl bg-[#111827] p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A5B4FC]">Aujourd’hui</p>
        <h3 className="mt-2 text-2xl font-black leading-tight">Votre journée terrain commence ici.</h3>
        <p className="mt-3 text-sm leading-5 text-[#D0D5DD]">8 pharmacies à voir · 3 commandes à valider · 2 relances prioritaires</p>
      </div>

      <h3 className="mt-6 text-base font-black">Actions rapides</h3>
      <div className="mt-3 space-y-3">
        <button className="w-full rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] p-4 text-left">
          <p className="font-black text-[#27346A]">Scanner une commande</p>
          <p className="mt-1 text-sm text-[#596591]">Photo → analyse → validation</p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[#3B5BDB]">Caméra mobile</p>
        </button>
        <button onClick={() => onNavigate("pharmacies")} className="w-full rounded-2xl border border-[#E4E7EC] bg-white p-4 text-left">
          <p className="font-black">Pharmacies</p>
          <p className="mt-1 text-sm text-[#667085]">Portefeuille et recherche</p>
        </button>
        <button className="w-full rounded-2xl border border-[#E4E7EC] bg-white p-4 text-left">
          <p className="font-black">Missions</p>
          <p className="mt-1 text-sm text-[#667085]">Priorités terrain</p>
        </button>
        <button className="w-full rounded-2xl border border-[#E4E7EC] bg-white p-4 text-left">
          <p className="font-black">Agenda</p>
          <p className="mt-1 text-sm text-[#667085]">Visites et relances</p>
        </button>
      </div>
    </div>
  );
}

function PharmaciesScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-5">
      <button onClick={() => onNavigate("home")} className="text-xs font-bold text-[#667085]">← Accueil</button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">Portefeuille</p>
      <h2 className="mt-1 text-2xl font-black">Pharmacies</h2>
      <p className="mt-1 text-sm text-[#667085]">836 comptes accessibles</p>

      <div className="mt-4 rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm text-[#98A2B3]">Rechercher pharmacie, ville, CIP…</div>

      <div className="mt-4 flex gap-2 overflow-hidden text-xs font-bold">
        <span className="rounded-full bg-[#111827] px-3 py-2 text-white">Toutes</span>
        <span className="rounded-full bg-white px-3 py-2 text-[#667085]">Prioritaires</span>
        <span className="rounded-full bg-white px-3 py-2 text-[#667085]">À relancer</span>
      </div>

      <div className="mt-4 space-y-3">
        {pharmacies.map((pharmacy, index) => (
          <button key={pharmacy.name} onClick={() => index === 0 && onNavigate("detail")} className="w-full rounded-2xl border border-[#E4E7EC] bg-white p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black leading-tight">{pharmacy.name}</p>
                <p className="mt-1 text-xs text-[#667085]">{pharmacy.city}</p>
              </div>
              <span className="rounded-full bg-[#ECFDF3] px-2 py-1 text-[10px] font-black text-[#067647]">{pharmacy.status}</span>
            </div>
            <div className="mt-3 flex gap-2 text-[10px] font-bold">
              <span className="rounded-full bg-[#FFF3E8] px-2 py-1 text-[#B54708]">{pharmacy.priority}</span>
              <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[#3B5BDB]">Potentiel {pharmacy.potential}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-5">
      <button onClick={() => onNavigate("pharmacies")} className="text-xs font-bold text-[#667085]">← Pharmacies</button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">Pharma 360</p>
      <h2 className="mt-1 text-2xl font-black leading-tight">Grande Pharmacie de la Valentine</h2>
      <p className="mt-2 text-sm text-[#667085]">Marseille · Compte stratégique</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="CA cumulé HT" value="18,4 k€" />
        <Metric label="CA 90 jours" value="4,8 k€" />
        <Metric label="Commandes" value="14" />
        <Metric label="Réassorts" value="11" />
      </div>

      <div className="mt-4 rounded-2xl bg-[#ECFDF3] p-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#067647]">Santé commerciale</p>
        <p className="mt-2 text-lg font-black">Actif · priorité 86/100</p>
        <p className="mt-2 text-sm leading-5 text-[#475467]">Dernière commande il y a 18 jours. Réassort attendu dans 9 jours.</p>
      </div>

      <div className="mt-4 rounded-2xl border border-[#E4E7EC] bg-white p-4">
        <p className="font-black">Compte</p>
        <Info label="Agent" value="Amir Ounissi" />
        <Info label="Territoire" value="13 - Marseille" />
        <Info label="Groupement" value="Indépendante" />
        <Info label="Potentiel" value="A" />
      </div>

      <button className="mt-4 w-full rounded-2xl bg-[#3B5BDB] px-4 py-4 font-black text-white">Créer une action terrain</button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-[#F2F4F7] pt-3 text-sm">
      <span className="text-[#667085]">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

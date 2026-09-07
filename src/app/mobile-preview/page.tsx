"use client";

import { useMemo, useState } from "react";

const pharmacies = [
  { name: "Grande Pharmacie de la Valentine", city: "Marseille", status: "Client", priority: "Stratégique", potential: "A" },
  { name: "Pharmacie du Prado", city: "Marseille", status: "Client", priority: "Haute", potential: "A" },
  { name: "Pharmacie Jas de Bouffan", city: "Aix-en-Provence", status: "Prospect", priority: "Haute", potential: "B" },
];

const orderLines = [
  ["Cheveux Pousse et Force 60", "12", "+2 UG"],
  ["Gummies Anti Stress FR Rouges", "24", "+4 UG"],
  ["Gummies Anti Stress X60", "24", "+4 UG"],
  ["Gummies Anti-Stress 20 Gommes", "36", "+6 UG"],
  ["Gummies Dream Safran Melat", "24", "+4 UG"],
  ["Gummies Dream Voyage X20", "24", "+4 UG"],
];

const outcomeOptions = ["Animation réalisée", "Animation partiellement réalisée", "Animation non réalisée"];
const feedbackOptions = ["Équipe engagée", "Questions produit", "Frein prix", "Manque de temps"];
const opportunityOptions = ["Commande prise", "Réassort à prévoir", "Formation à proposer", "À relancer"];
const nextStepOptions = ["Relance sous 7 jours", "Planifier une visite", "Proposer une animation", "Aucun suivi requis"];

type Screen = "home" | "mission" | "pharmacies" | "detail" | "capture" | "review";

type ChoiceFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

export default function MobilePreviewPage() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <main className="min-h-screen bg-[#eef1f5] px-4 py-8 text-[#111827]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <section className="hidden rounded-3xl bg-white p-8 shadow-sm lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3B5BDB]">TR1 Pharma Mobile</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Prévisualisation terrain guidée</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#667085]">
            Cette page reproduit dans le navigateur les principaux gestes du chantier mobile intégré à la PR #48 : Ma journée, progression vérifiable, prochaine mission et compte-rendu guidé.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["Ma journée", "Progression sur visites terminées et missions validées"],
              ["Prochaine action", "Accès direct à la mission terrain"],
              ["Rapport guidé", "Boutons métier + texte libre si nécessaire"],
              ["Validation", "Rapport envoyé ≠ mission validée"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-[#E4E7EC] p-4">
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm text-[#667085]">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#EFF6F2] p-4 text-sm leading-6 text-[#166534]">
            La progression ne récompense que l’exécution vérifiable. Un rapport simplement soumis reste en attente et ne fait pas avancer le compteur.
          </div>
          <div className="mt-4 rounded-2xl bg-[#FFFAEB] p-4 text-sm leading-6 text-[#854A0E]">
            Caméra, notifications et vrai hors-ligne restent simulés ici. La recette finale doit être faite dans l’application Expo sur téléphone réel.
          </div>
        </section>

        <section className="mx-auto w-full max-w-[390px]">
          <div className="overflow-hidden rounded-[2.6rem] border-[9px] border-[#111827] bg-[#F7F8FA] shadow-2xl">
            <div className="flex justify-center bg-[#111827] py-2">
              <div className="h-1.5 w-24 rounded-full bg-[#475467]" />
            </div>
            <div className="min-h-[760px] bg-[#F7F8FA]">
              {screen === "home" ? <HomeScreen onNavigate={setScreen} /> : null}
              {screen === "mission" ? <MissionScreen onNavigate={setScreen} /> : null}
              {screen === "pharmacies" ? <PharmaciesScreen onNavigate={setScreen} /> : null}
              {screen === "detail" ? <DetailScreen onNavigate={setScreen} /> : null}
              {screen === "capture" ? <CaptureScreen onNavigate={setScreen} /> : null}
              {screen === "review" ? <ReviewScreen onNavigate={setScreen} /> : null}
            </div>
            <nav className="grid grid-cols-3 border-t border-[#E4E7EC] bg-white px-2 py-3 text-center text-[11px] font-bold text-[#667085]">
              <button onClick={() => setScreen("home")} className={screen === "home" || screen === "capture" || screen === "review" ? "text-[#3B5BDB]" : ""}>Ma journée</button>
              <button onClick={() => setScreen("pharmacies")} className={screen === "pharmacies" || screen === "detail" ? "text-[#3B5BDB]" : ""}>Pharmacies</button>
              <button onClick={() => setScreen("mission")} className={screen === "mission" ? "text-[#3B5BDB]" : ""}>Missions</button>
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
          <p className="mt-1 text-xs text-[#667085]">Commercial terrain</p>
        </div>
        <button className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#3B5BDB] shadow-sm">Changer</button>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <h3 className="text-[27px] font-black">Ma journée</h3>
          <p className="mt-1 text-xs text-[#475467]">07/09/2026 · heure de Paris</p>
        </div>
        <button className="min-h-12 px-2 text-sm font-bold text-[#3048AC]">Actualiser</button>
      </div>

      <div className="mt-3 rounded-[22px] bg-[#EFF6F2] p-5">
        <p className="text-4xl font-black text-[#166534]">3 / 5</p>
        <p className="mt-2 text-sm font-medium leading-5 text-[#344054]">Visites terminées et missions validées</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#DCE7E0]">
          <div className="h-full w-[60%] rounded-full bg-[#15803D]" />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#475467]">1 rapport envoyé, en attente de validation</p>
        <p className="mt-1 text-xs leading-5 text-[#475467]">Uniquement vos visites et missions planifiées aujourd’hui.</p>
      </div>

      <button onClick={() => onNavigate("mission")} className="mt-4 w-full rounded-[20px] border border-[#C7D2FE] bg-white p-5 text-left">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#475467]">Prochaine action</p>
        <p className="mt-2 text-xl font-black">Pharmacie du Prado</p>
        <p className="mt-1 text-sm text-[#344054]">Animation gamme Sommeil</p>
        <p className="mt-2 text-xs text-[#475467]">14:00 · Marseille</p>
        <p className="mt-4 text-sm font-bold text-[#3048AC]">Ouvrir ma mission →</p>
      </button>

      <h3 className="mt-6 text-base font-black">Actions rapides</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate("capture")} className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] p-4 text-left">
          <p className="font-black text-[#27346A]">Scanner</p>
          <p className="mt-1 text-xs text-[#596591]">Commande photo</p>
        </button>
        <button onClick={() => onNavigate("pharmacies")} className="rounded-2xl border border-[#E4E7EC] bg-white p-4 text-left">
          <p className="font-black">Pharmacies</p>
          <p className="mt-1 text-xs text-[#667085]">Portefeuille</p>
        </button>
      </div>
    </div>
  );
}

function MissionScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [outcome, setOutcome] = useState("");
  const [feedback, setFeedback] = useState("");
  const [opportunity, setOpportunity] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = useMemo(() => Boolean(outcome), [outcome]);

  return (
    <div className="p-5">
      <button onClick={() => onNavigate("home")} className="text-xs font-bold text-[#667085]">← Ma journée</button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">Mission</p>
      <h2 className="mt-1 text-2xl font-black leading-tight">Animation gamme Sommeil</h2>
      <p className="mt-2 text-sm text-[#667085]">Pharmacie du Prado · Marseille</p>

      <div className="mt-4 rounded-2xl border border-[#E4E7EC] bg-white p-4">
        <Info label="Statut" value={submitted ? "Rapport en validation" : "En cours"} />
        <Info label="Priorité" value="Haute" />
        <Info label="Horaire" value="14:00 – 15:00" />
        <Info label="Objectif" value="Activer la gamme Sommeil et recueillir le feedback équipe" />
      </div>

      {submitted ? (
        <div className="mt-4 rounded-2xl border border-[#FEC84B] bg-[#FFFAEB] p-4">
          <p className="font-black text-[#854A0E]">Compte-rendu envoyé</p>
          <p className="mt-2 text-sm leading-5 text-[#854A0E]">Il est en attente de validation. Cette mission ne comptera dans votre progression qu’après validation réelle.</p>
          <button onClick={() => onNavigate("home")} className="mt-4 text-sm font-black text-[#3048AC]">Retour à Ma journée →</button>
        </div>
      ) : (
        <>
          <ChoiceField label="Résultat de la mission" value={outcome} options={outcomeOptions} onChange={setOutcome} />
          <ChoiceField label="Retour de la pharmacie" value={feedback} options={feedbackOptions} onChange={setFeedback} />
          <ChoiceField label="Opportunité détectée" value={opportunity} options={opportunityOptions} onChange={setOpportunity} />
          <ChoiceField label="Prochaine étape" value={nextStep} options={nextStepOptions} onChange={setNextStep} />

          <label className="mt-5 block text-sm font-black">Précisions utiles</label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ajoutez uniquement les éléments utiles au suivi" className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-[#CBD5E1] bg-white p-3 text-sm outline-none" />

          <div className="mt-5 rounded-2xl bg-[#F2F4F7] p-3 text-xs leading-5 text-[#475467]">
            Aucun bouton ne crée automatiquement une commande, une tâche ou une relance. Le rapport reste une preuve terrain soumise au workflow TR1.
          </div>
          <button disabled={!canSubmit} onClick={() => setSubmitted(true)} className="mt-4 w-full rounded-2xl bg-[#3B5BDB] px-4 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Envoyer pour validation</button>
          {!canSubmit ? <p className="mt-2 text-center text-[11px] text-[#B42318]">Choisissez au minimum le résultat de la mission.</p> : null}
        </>
      )}
    </div>
  );
}

function ChoiceField({ label, value, options, onChange }: ChoiceFieldProps) {
  return (
    <div className="mt-5">
      <p className="text-sm font-black">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button key={option} onClick={() => onChange(selected ? "" : option)} className={selected ? "min-h-12 rounded-2xl border border-[#3B5BDB] bg-[#EEF2FF] px-3 py-2 text-left text-sm font-bold text-[#263EA8]" : "min-h-12 rounded-2xl border border-[#CBD5E1] bg-white px-3 py-2 text-left text-sm text-[#344054]"}>
              {selected ? "✓ " : ""}{option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CaptureScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-5">
      <button onClick={() => onNavigate("home")} className="text-xs font-bold text-[#667085]">← Ma journée</button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">Commande</p>
      <h2 className="mt-1 text-2xl font-black">Scanner une commande</h2>
      <p className="mt-2 text-sm leading-5 text-[#667085]">Cadrez le bon entier, à plat et avec une lumière homogène.</p>
      <div className="mt-5 rounded-3xl bg-[#111827] p-4 text-white">
        <div className="flex h-[330px] items-center justify-center rounded-2xl border border-dashed border-[#667085] bg-[#1D2939]">
          <div className="w-[72%] rotate-[-2deg] rounded-lg bg-white p-4 text-[#111827] shadow-xl">
            <p className="text-[9px] font-black">BON DE COMMANDE</p>
            <div className="mt-3 space-y-2">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-2 rounded bg-[#F2F4F7]" />)}</div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-[#D0D5DD]">Aucune commande n’est créée automatiquement.</p>
      </div>
      <button onClick={() => onNavigate("review")} className="mt-4 w-full rounded-2xl bg-[#3B5BDB] px-4 py-4 font-black text-white">Prendre la photo</button>
      <button onClick={() => onNavigate("review")} className="mt-3 w-full rounded-2xl border border-[#E4E7EC] bg-white px-4 py-4 font-bold">Choisir une photo existante</button>
    </div>
  );
}

function ReviewScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [orderDate, setOrderDate] = useState("");
  return (
    <div className="p-5">
      <button onClick={() => onNavigate("capture")} className="text-xs font-bold text-[#667085]">← Reprendre</button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">Vérification</p>
      <h2 className="mt-1 text-2xl font-black">Contrôler la commande</h2>
      <div className="mt-4 rounded-2xl border border-[#E4E7EC] bg-white p-4">
        <Info label="Pharmacie" value="Grande Pharmacie de la Valentine" />
        <Info label="N° commande" value="155045" />
        <Info label="Total HT" value="1 947,26 €" />
        <Info label="Unités" value="144 + 24 UG" />
      </div>
      <label className="mt-4 block text-xs font-black">Date de commande</label>
      <input value={orderDate} onChange={(event) => setOrderDate(event.target.value)} placeholder="AAAA-MM-JJ" className="mt-2 w-full rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm outline-none" />
      <h3 className="mt-5 text-sm font-black">6 produits identifiés</h3>
      <div className="mt-3 space-y-2">
        {orderLines.map(([name, quantity, free]) => (
          <div key={name} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4E7EC] bg-white p-3">
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{name}</p><p className="mt-1 text-[10px] font-bold text-[#067647]">Produit TR1 identifié</p></div>
            <div className="rounded-xl bg-[#F2F4F7] px-3 py-2 text-center"><p className="text-sm font-black">{quantity}</p><p className="text-[9px] font-black text-[#3B5BDB]">{free}</p></div>
          </div>
        ))}
      </div>
      <button disabled={!orderDate} className="mt-5 w-full rounded-2xl bg-[#3B5BDB] px-4 py-4 font-black text-white disabled:opacity-40">Valider la commande</button>
    </div>
  );
}

function PharmaciesScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="p-5">
      <button onClick={() => onNavigate("home")} className="text-xs font-bold text-[#667085]">← Ma journée</button>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#3B5BDB]">Portefeuille</p>
      <h2 className="mt-1 text-2xl font-black">Pharmacies</h2>
      <p className="mt-1 text-sm text-[#667085]">836 comptes accessibles</p>
      <div className="mt-4 rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm text-[#98A2B3]">Rechercher pharmacie, ville, CIP…</div>
      <div className="mt-4 space-y-3">
        {pharmacies.map((pharmacy, index) => (
          <button key={pharmacy.name} onClick={() => index === 0 && onNavigate("detail")} className="w-full rounded-2xl border border-[#E4E7EC] bg-white p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-black leading-tight">{pharmacy.name}</p><p className="mt-1 text-xs text-[#667085]">{pharmacy.city}</p></div><span className="rounded-full bg-[#ECFDF3] px-2 py-1 text-[10px] font-black text-[#067647]">{pharmacy.status}</span></div>
            <div className="mt-3 flex gap-2 text-[10px] font-bold"><span className="rounded-full bg-[#FFF3E8] px-2 py-1 text-[#B54708]">{pharmacy.priority}</span><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[#3B5BDB]">Potentiel {pharmacy.potential}</span></div>
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
      <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="CA cumulé HT" value="18,4 k€" /><Metric label="CA 90 jours" value="4,8 k€" /><Metric label="Commandes" value="14" /><Metric label="Réassorts" value="11" /></div>
      <div className="mt-4 rounded-2xl bg-[#ECFDF3] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#067647]">Santé commerciale</p><p className="mt-2 text-lg font-black">Actif · priorité 86/100</p><p className="mt-2 text-sm leading-5 text-[#475467]">Dernière commande il y a 18 jours. Réassort attendu dans 9 jours.</p></div>
      <button onClick={() => onNavigate("mission")} className="mt-4 w-full rounded-2xl bg-[#3B5BDB] px-4 py-4 font-black text-white">Créer / ouvrir une action terrain</button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#667085]">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="mt-3 flex items-start justify-between gap-3 border-t border-[#F2F4F7] pt-3 text-sm first:mt-0 first:border-0 first:pt-0"><span className="shrink-0 text-[#667085]">{label}</span><span className="max-w-[62%] text-right font-bold">{value}</span></div>;
}

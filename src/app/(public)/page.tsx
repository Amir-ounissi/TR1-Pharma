import Image from "next/image";
import { ArrowRight, Building2, ChartNoAxesCombined, Route, ShieldCheck } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { ProductProof } from "@/components/marketing/product-proof";

const pillars = [
  { icon: Building2, number: "01", title: "Structurez votre réseau", text: "Réunissez les informations nécessaires au développement de chaque pharmacie.", items: ["Pharmacies", "Produits", "Commandes", "Territoires", "Affectations"] },
  { icon: Route, number: "02", title: "Pilotez l’exécution terrain", text: "Partagez les priorités, affectez les actions et suivez leur réalisation.", items: ["Visites", "Relances", "Animations", "Formations", "Rapports"] },
  { icon: ChartNoAxesCombined, number: "03", title: "Développez votre portefeuille", text: "Faites ressortir les comptes qui nécessitent une action commerciale.", items: ["Réassorts", "Comptes à risque", "Réactivation", "Prochaine action"] },
];

const problems = [
  ["01", "Vos données commerciales sont dispersées", "Pharmacies, commandes, produits détenus, contacts et prochaines actions restent répartis entre plusieurs supports."],
  ["02", "Vos intervenants travaillent avec des méthodes différentes", "Commerciaux, agents, animateurs et formateurs ne partagent pas toujours les mêmes priorités."],
  ["03", "Vous manquez de visibilité sur les comptes à développer", "Les zones à renforcer, les pharmacies à suivre et les actions réalisées sont difficiles à piloter."],
];

export default function LandingPage() {
  return <main className="bg-[#fffdf8] [background-image:linear-gradient(rgba(11,30,50,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(11,30,50,.025)_1px,transparent_1px)] [background-size:30px_30px]">
    <MarketingPageEvent event="landing_view" />

    <section className="overflow-hidden border-b border-[#0b1e32]/10 bg-[radial-gradient(circle_at_88%_8%,rgba(47,108,163,.13),transparent_28%),radial-gradient(circle_at_5%_94%,rgba(239,106,58,.1),transparent_23%)]">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-24">
        <div>
          <p className="font-mono text-[.68rem] font-black uppercase tracking-[.17em] text-[#c84f24]">La plateforme des marques qui se développent en pharmacie</p>
          <h1 className="mt-6 max-w-3xl text-[3.1rem] font-black leading-[.92] tracking-[-.072em] text-[#0b1e32] sm:text-6xl lg:text-[5rem]">Structurez, pilotez et développez <span className="text-[#c84f24]">votre réseau officinal.</span></h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#667384]">TR1 réunit vos pharmacies, vos équipes, vos commandes et vos actions terrain pour vous aider à faire grandir votre réseau sans perdre le contrôle.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MarketingTrackedLink className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c84f24] px-5 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(200,79,36,.23)] transition hover:-translate-y-0.5 hover:bg-[#a63f19]" event="primary_cta_click" href="#diagnostic">Découvrir TR1 sur mon réseau officinal <ArrowRight className="size-4" /></MarketingTrackedLink>
            <a className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#0b1e32]/15 bg-white/80 px-5 text-sm font-black" href="#produit">Voir la plateforme</a>
          </div>
          <p className="mt-4 text-sm text-[#667384]">Diagnostic et démonstration personnalisée de 30 minutes.</p>
        </div>

        <div className="relative lg:pl-4">
          <div className="rounded-[1.6rem] border border-[#0b1e32]/10 bg-white/65 p-3 shadow-[0_32px_90px_rgba(7,20,33,.18)] backdrop-blur-sm sm:p-5">
            <Image alt="Fiche pharmacie TR1 avec commandes, réassort et prochaine action" className="w-full rounded-xl" height={600} priority src="/marketing/pharmacy-account.webp" width={600} />
          </div>
          <div className="absolute -left-3 top-[17%] hidden max-w-52 rounded-xl border border-[#0b1e32]/10 bg-[#fffdf8]/95 p-4 shadow-xl xl:block"><strong className="text-sm">Une vision complète du compte</strong><p className="mt-1 text-xs leading-5 text-[#667384]">Commandes, activité, assortiment et historique.</p></div>
          <div className="absolute -right-3 bottom-[12%] hidden max-w-52 rounded-xl border border-[#0b1e32]/10 bg-[#fffdf8]/95 p-4 shadow-xl xl:block"><strong className="text-sm">Une prochaine action claire</strong><p className="mt-1 text-xs leading-5 text-[#667384]">Le management et le terrain savent où agir.</p></div>
        </div>
      </div>
    </section>

    <div className="border-b border-[#0b1e32]/10 bg-[#f8f2e8] px-5 py-5 text-center font-mono text-xs font-bold uppercase tracking-[.08em] text-[#445265]">Pour les marques ayant déjà ouvert leurs premières pharmacies et souhaitant structurer leur prochaine phase de développement.</div>

    <section className="px-5 py-20 lg:px-8" id="probleme">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.75fr_1.25fr]">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[.16em] text-[#c84f24]">Votre réseau grandit</p>
          <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Votre organisation doit pouvoir suivre.</h2>
          <p className="mt-6 text-lg leading-8 text-[#667384]">À mesure que les pharmacies, les territoires et les intervenants se multiplient, le développement devient plus difficile à coordonner.</p>
          <p className="mt-6 border-l-2 border-[#ef6a3a] pl-5 text-xl font-bold">TR1 transforme une organisation dispersée en un système commercial commun.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#0b1e32]/10 bg-[#fffefa]">
          {problems.map(([number, title, text]) => <article className="grid gap-4 border-b border-[#0b1e32]/10 p-6 last:border-b-0 sm:grid-cols-[3rem_1fr]" key={number}><span className="font-mono text-xs font-black text-[#c84f24]">{number}</span><div><h3 className="text-xl font-black tracking-[-.03em]">{title}</h3><p className="mt-2 leading-7 text-[#667384]">{text}</p></div></article>)}
        </div>
      </div>
    </section>

    <section className="border-y border-[#0b1e32]/10 bg-[#f8f2e8] px-5 py-20 lg:px-8" id="valeur">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs font-black uppercase tracking-[.16em] text-[#c84f24]">La proposition de valeur TR1</p>
        <h2 className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-5xl">Structurez. Pilotez. Développez.</h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">{pillars.map(({ icon: Icon, ...pillar }) => <article className="rounded-2xl border border-[#0b1e32]/10 bg-[#fffdf8] p-7 shadow-[0_14px_36px_rgba(7,20,33,.05)]" key={pillar.number}><div className="flex items-center justify-between"><Icon className="size-6 text-[#c84f24]" /><span className="font-mono text-xs font-bold text-[#c84f24]">{pillar.number}</span></div><h3 className="mt-8 text-2xl font-black tracking-[-.04em]">{pillar.title}</h3><p className="mt-4 leading-7 text-[#667384]">{pillar.text}</p><div className="mt-7 flex flex-wrap gap-2">{pillar.items.map(item => <span className="rounded-full border border-[#0b1e32]/10 bg-[#f8f2e8] px-3 py-1 font-mono text-[.62rem] font-bold uppercase tracking-[.05em]" key={item}>{item}</span>)}</div></article>)}</div>
      </div>
    </section>

    <section className="bg-[radial-gradient(circle_at_84%_12%,rgba(47,108,163,.23),transparent_30%),radial-gradient(circle_at_8%_88%,rgba(239,106,58,.13),transparent_24%),#071421] px-5 py-20 text-white lg:px-8" id="produit">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs font-black uppercase tracking-[.16em] text-[#ff9d78]">La preuve produit</p>
        <div className="mb-10 mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><h2 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Un seul environnement pour savoir où agir.</h2><p className="max-w-xl leading-7 text-white/65">Suivez le même scénario du management jusqu’à l’exécution terrain : une priorité identifiée, une visite préparée et une mission suivie.</p></div>
        <ProductProof />
      </div>
    </section>

    <section className="px-5 py-20 lg:px-8" id="equipes">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div><p className="font-mono text-xs font-black uppercase tracking-[.16em] text-[#c84f24]">Une organisation qui s’adapte à la vôtre</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Conservez vos équipes. Complétez votre couverture.</h2><p className="mt-6 text-lg leading-8 text-[#667384]">TR1 intègre vos commerciaux, agents, animateurs et formateurs dans un cadre commun.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">{[{ title: "Vos ressources existantes", text: "Vous ne changez pas votre organisation. Vous lui donnez un système commun." }, { title: "Les ressources validées par TR1", text: "Complétez votre dispositif selon les territoires et la disponibilité des profils." }].map((block, index) => <article className={`rounded-2xl border p-7 ${index ? "border-[#0b1e32] bg-[#0b1e32] text-white" : "border-[#0b1e32]/10 bg-[#fffefa]"}`} key={block.title}><ShieldCheck className={`size-7 ${index ? "text-[#ef6a3a]" : "text-[#0b1e32]"}`} /><h3 className="mt-8 text-2xl font-black tracking-[-.04em]">{block.title}</h3><p className={`mt-4 leading-7 ${index ? "text-white/65" : "text-[#667384]"}`}>{block.text}</p></article>)}</div>
      </div>
    </section>

    <section className="border-t border-[#0b1e32]/10 bg-[#f8f2e8] px-5 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-[.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28"><p className="font-mono text-xs font-black uppercase tracking-[.16em] text-[#c84f24]">Diagnostic et démonstration personnalisée</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Donnez à votre réseau les moyens de grandir.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-[#667384]">En 30 minutes, nous faisons le point sur votre portefeuille, votre organisation terrain et vos outils actuels.</p></div>
        <LeadForm />
      </div>
    </section>
  </main>;
}

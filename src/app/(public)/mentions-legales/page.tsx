import { legalInformation, missingLegalInformation } from "@/config/legal";

const fields = [
  ["Raison sociale", "legalEntityName"], ["Forme juridique", "legalForm"], ["Capital social", "shareCapital"],
  ["Siège social", "registeredOffice"], ["Immatriculation", "registrationNumber"], ["TVA", "vatNumber"],
  ["Directeur de la publication", "publicationDirector"], ["Contact", "contactEmail"], ["Hébergeur", "hostingProviderName"],
  ["Adresse de l’hébergeur", "hostingProviderAddress"],
] as const;

export default function LegalPage() {
  return <main className="mx-auto min-h-[70vh] max-w-3xl px-5 py-16"><p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-[#c9562d]">Informations légales</p><h1 className="mt-3 text-4xl font-black tracking-[-.05em]">Mentions légales</h1>{missingLegalInformation.length ? <p className="mt-6 rounded-lg border border-[#c9562d] bg-[#fff6ec] p-4 text-sm font-semibold text-[#7a351d]">Document de préparation — informations définitives requises avant collecte publique de leads.</p> : null}<p className="mt-8 leading-7 text-[#596574]">TR1 Pharma édite une plateforme SaaS de pilotage commercial et d’exécution terrain dédiée aux marques qui se développent en pharmacie.</p><dl className="mt-8 divide-y divide-[#d8d0c2] border-y border-[#d8d0c2]">{fields.map(([label,key]) => <div className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr]" key={key}><dt className="font-mono text-xs font-bold uppercase tracking-[.08em]">{label}</dt><dd className={legalInformation[key].startsWith("À renseigner") ? "text-[#c9562d]" : "text-[#596574]"}>{legalInformation[key]}</dd></div>)}</dl></main>;
}

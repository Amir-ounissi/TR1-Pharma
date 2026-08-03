import { legalInformation, missingLegalInformation } from "@/lib/legal";

export default function PrivacyPage() {
  const sections = [
    ["Responsable du traitement", legalInformation.dataController],
    ["Finalités", "Répondre à une demande de diagnostic, qualifier le besoin et, si TR1 est adapté, préparer une démonstration ou un pilote contrôlé."],
    ["Base juridique", legalInformation.legalBasis],
    ["Données collectées", "Nom et prénom, e-mail professionnel, marque ou laboratoire, puis informations de qualification communiquées pendant les échanges."],
    ["Destinataires", "Responsables TR1 autorisés. Les données ne sont jamais mises à disposition des marques clientes."],
    ["Durée de conservation", legalInformation.retentionPeriod],
    ["Droits", `Accès, rectification, effacement, limitation, opposition et portabilité lorsque ces droits s’appliquent. Contact : ${legalInformation.privacyContactEmail}.`],
    ["Transferts et sous-traitants", "À documenter selon les projets Supabase, Vercel, l’outil de réservation et le fournisseur analytics effectivement configurés."],
    ["Sécurité", "Accès restreints, politiques RLS PostgreSQL, stockage privé, secrets serveur séparés et journalisation contrôlée."],
    ["Cookies et analytics", "Aucun fournisseur analytics n’est actif par défaut. Les événements prévus excluent les noms, e-mails, notes et contenus du formulaire."],
  ];
  return <main className="mx-auto min-h-[70vh] max-w-3xl px-5 py-16"><p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-[#c9562d]">Données personnelles</p><h1 className="mt-3 text-4xl font-black tracking-[-.05em]">Politique de confidentialité</h1>{missingLegalInformation.length ? <p className="mt-6 rounded-lg border border-[#c9562d] bg-[#fff6ec] p-4 text-sm font-semibold text-[#7a351d]">Version de préparation — les champs signalés doivent être fournis par le responsable TR1 avant publication.</p> : null}<div className="mt-8 space-y-8">{sections.map(([title,content]) => <section key={title}><h2 className="font-mono text-sm font-black uppercase tracking-[.05em]">{title}</h2><p className={`mt-2 leading-7 ${content.startsWith("À renseigner") ? "text-[#c9562d]" : "text-[#596574]"}`}>{content}</p></section>)}</div><p className="mt-10 text-xs text-[#66717d]">Dernière mise à jour : {legalInformation.privacyLastUpdated}</p></main>;
}

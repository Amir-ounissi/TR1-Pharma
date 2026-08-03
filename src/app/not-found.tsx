import Link from "next/link";

export default function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f5efe4] px-5 text-center text-[#0f2740]"><div><h1 className="font-mono text-xs font-bold uppercase tracking-[.18em] text-[#c9562d]">404</h1><h2 className="mt-4 text-5xl font-black tracking-[-.06em]">Page introuvable.</h2><p className="mt-5 text-[#596574]">Vérifiez l’adresse ou revenez à l’accueil TR1.</p><Link className="mt-8 inline-flex rounded-md bg-[#0f2740] px-5 py-3 font-mono text-xs font-black uppercase text-white" href="/">Retour à l’accueil</Link></div></main>;
}

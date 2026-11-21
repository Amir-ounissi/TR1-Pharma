import Link from "next/link";
import { ArrowRight, Heart, RotateCcw, ShoppingBasket, Store } from "lucide-react";
import type { ReorderRequest } from "@/lib/catalogue-buyer-workspace";

export function PharmacyWelcome({
  pharmacyName,brandCount,productCount,favoriteCount,recentRequests,
  limitedAccess,
}:{
  pharmacyName:string;
  brandCount:number;
  productCount:number;
  favoriteCount:number;
  recentRequests:ReorderRequest[];
  limitedAccess:boolean;
}) {
  const lastSelection=limitedAccess ? undefined
    : recentRequests.find(request=>request.items.length>0);
  const cards=[
    {
      href:lastSelection?"/catalogue?reprendre="+encodeURIComponent(lastSelection.id)+"#liste-produits":"/catalogue#liste-produits",
      title:lastSelection?"Reprendre ma dernière sélection":"Parcourir le catalogue",
      detail:lastSelection
        ? lastSelection.items.length+" référence(s) · "+lastSelection.brand_name+" · quantités et tarifs à vérifier"
        : "Découvrez les références autorisées pour votre pharmacie",
      icon:RotateCcw,
    },
    {
      href:limitedAccess?"/catalogue#liste-produits":"/catalogue?favoris=1#liste-produits",
      title:limitedAccess?"Découvrir mes références":"Mes produits favoris",
      detail:limitedAccess?"Sélectionnez les produits qui vous intéressent":favoriteCount+" référence(s) enregistrée(s)",
      icon:Heart,
    },
    {
      href:"/catalogue/mes-demandes",
      title:limitedAccess?"Suivi de mes demandes":"Mes demandes et réassorts",
      detail:"Retrouvez vos demandes et leur état de traitement",
      icon:ShoppingBasket,
    },
  ];
  return (
    <section aria-labelledby="pharmacy-home-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce4e8] bg-white px-5 py-5 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.13em] text-[#a45c35]">
            <Store size={14} aria-hidden="true"/> Mon espace pharmacie
          </p>
          <h1 id="pharmacy-home-title" className="mt-1 text-xl font-black tracking-tight text-[#142941] sm:text-2xl">
            Bienvenue, {pharmacyName}
          </h1>
          <p className="mt-1 text-xs leading-5 text-[#647785]">
            {brandCount} marque{brandCount>1?"s":""} · {productCount} référence{productCount>1?"s":""} accessibles.
            Retrouvez vos tarifs professionnels, vos offres applicables et votre panier multimarque.
          </p>
        </div>
        <Link href="#liste-produits" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#142941] px-4 text-xs font-extrabold text-white hover:bg-[#254961]">
          Voir les produits <ArrowRight size={16} aria-hidden="true"/>
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {cards.map(card=>(
          <Link key={card.title} href={card.href}
            className="group flex min-w-0 items-start gap-3 rounded-xl border border-[#e0e6e9] bg-white p-4 hover:border-[#b5c5d0] hover:shadow-sm">
            <span className="rounded-lg bg-[#f5eee7] p-2 text-[#a96336]"><card.icon size={18} aria-hidden="true"/></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black text-[#20374b]">{card.title}</span>
              <span className="mt-1 block text-[11px] leading-4 text-[#6c7c87]">{card.detail}</span>
            </span>
            <ArrowRight size={15} aria-hidden="true" className="mt-1 shrink-0 text-[#8695a0] transition group-hover:translate-x-0.5"/>
          </Link>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";

const main=[
 {href:"/app",label:"Vue d'ensemble"},
 {href:"/app/relation-client",label:"Relation client · demandes"},
 {href:"/app/marques",label:"Gestion des marques"},
 {href:"/app/implantations",label:"Pharmacies & implantations"},
 {href:"/app/commandes",label:"Transmission commandes"},
 {href:"/app/terrain",label:"Terrain & missions"},

];
const advanced=[
 {href:"/app/revenus",label:"Mes revenus"},
 {href:"/app/produits",label:"Tous les produits"},
 {href:"/app/offres-implantation",label:"Offres et packs"},
 {href:"/app/conditions",label:"Conditions fournisseurs"},
 {href:"/app/commissions",label:"Commissions & primes"},
 {href:"/app/qualite",label:"Contrôle qualité"},
 {href:"/app/medias",label:"Photos produits & validation"},
 {href:"/app/acces",label:"Accès B2B"},
 {href:"/app/althesia",label:"Sources Althesia"},
 {href:"/app/demo",label:"Pilote Vitalora TEST"},
];
export function OwnerNavigation(){
 return <nav aria-label="Navigation du cockpit" className="space-y-2">
   <div className="grid gap-1">
     {main.map(x=><Link key={x.href} href={x.href}
       className="rounded-lg px-4 py-3 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
       {x.label}
     </Link>)}
   </div>
   <details className="rounded-lg border border-white/15">
     <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-white/65 hover:text-white">
       Paramètres avancés
     </summary>
     <div className="grid gap-0.5 border-t border-white/10 p-2">
       {advanced.map(x=><Link key={x.href} href={x.href}
         className="rounded-md px-3 py-2.5 text-xs text-white/75 hover:bg-white/10 hover:text-white">
         {x.label}
       </Link>)}
     </div>
   </details>
 </nav>;
}

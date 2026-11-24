import Link from "next/link";
const links = [
  { href: "/app", label: "Mon cockpit" },
  { href: "/app/pharmacies", label: "Pharmacies" },
  { href: "/app/marques", label: "Marques" },
  { href: "/app/produits", label: "Catalogue produits" },
  { href: "/app/althesia", label: "Althesia · Sources" },
  { href: "/app/commissions", label: "Commissions & primes" },
  { href: "/app/qualite", label: "Contrôle qualité" },
  { href: "/app/demo", label: "Pilote Vitalora · TEST" },
  { href: "/app/conditions", label: "Conditions commerciales" },
  { href: "/app/commandes", label: "Demandes & commandes" },
  { href: "/app/acces", label: "Accès B2B" },
  { href: "/app/terrain", label: "Terrain & missions" },
  { href: "/app/revenus", label: "Mes revenus" },
];
export function OwnerNavigation() {
  return <nav aria-label="Navigation du cockpit" className="grid gap-1">
    {links.map(x=><Link key={x.href} href={x.href} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">{x.label}</Link>)}
  </nav>;
}

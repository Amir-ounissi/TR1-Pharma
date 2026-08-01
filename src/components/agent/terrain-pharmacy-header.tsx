import Link from "next/link";
import { CalendarPlus, ClipboardPlus, MapPinned, Navigation, Phone, Play, ShoppingCart } from "lucide-react";
import { TrackedLink } from "@/components/agent/tracked-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildGoogleMapsUrl, buildWazeUrl, type NavigablePharmacy } from "@/lib/agent-experience";

type TerrainPharmacyHeaderProps = {
  brandPharmacyId: string;
  pharmacyId: string;
  name: string;
  phone?: string | null;
  address: string;
  status: string;
  potential: string;
  lastOrderAt?: string | null;
  nextActionType?: string | null;
  nextActionAt?: string | null;
  navigation: NavigablePharmacy;
};

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

export function TerrainPharmacyHeader(props: TerrainPharmacyHeaderProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[var(--tr1-navy)] text-[var(--tr1-ivory)] shadow-[0_20px_55px_-35px_rgb(14_26_43/0.85)]" data-testid="terrain-pharmacy-header">
      <div className="h-1 bg-[var(--tr1-orange)]" />
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8ab5d5]">Compte pharmacie</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{props.name}</h1>
            <p className="mt-1 text-sm text-[#d7e2eb]">{props.address}</p>
          </div>
          <div className="flex gap-2"><Badge className="bg-white/10 text-white">{props.status}</Badge><Badge className="bg-[var(--tr1-orange)] text-white">{props.potential}</Badge></div>
        </div>
        <div className="grid overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] text-sm sm:grid-cols-3">
          <p className="p-3 sm:border-r sm:border-white/10"><span className="text-xs text-[#9eb0bf]">Téléphone</span><br /><strong className="font-medium">{props.phone || "Non renseigné"}</strong></p>
          <p className="border-y border-white/10 p-3 sm:border-x-0 sm:border-y-0 sm:border-r"><span className="text-xs text-[#9eb0bf]">Dernière commande</span><br /><strong className="font-medium">{date(props.lastOrderAt)}</strong></p>
          <p className="p-3"><span className="text-xs text-[#9eb0bf]">Prochaine action</span><br /><strong className="font-medium">{props.nextActionType ? `${props.nextActionType} · ${date(props.nextActionAt)}` : "À créer"}</strong></p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <TrackedLink href={`tel:${props.phone || ""}`} eventName="interaction_started" pharmacyId={props.pharmacyId} className="bg-white text-[#0f2740]"><Phone /> Appeler</TrackedLink>
          <TrackedLink href={buildWazeUrl(props.navigation)} eventName="navigation_waze_clicked" pharmacyId={props.pharmacyId} external className="bg-[#2d6f9f] text-white"><Navigation /> Waze</TrackedLink>
          <TrackedLink href={buildGoogleMapsUrl(props.navigation)} eventName="navigation_maps_clicked" pharmacyId={props.pharmacyId} external className="bg-[#2d6f9f] text-white"><MapPinned /> Maps</TrackedLink>
          <Button asChild size="lg" className="min-h-11"><Link href="?tab=activity"><Play /> Interaction</Link></Button>
          <Button asChild size="lg" variant="secondary" className="min-h-11"><Link href="?tab=activity"><ClipboardPlus /> Tâche</Link></Button>
          <Button asChild size="lg" variant="secondary" className="min-h-11"><Link href={`/dashboard/orders/new?pharmacy=${props.brandPharmacyId}`}><ShoppingCart /> Commande</Link></Button>
          <Button asChild size="lg" variant="secondary" className="col-span-2 min-h-11 sm:col-span-1"><Link href={`/dashboard/missions/new?pharmacy=${props.brandPharmacyId}`}><CalendarPlus /> Mission</Link></Button>
        </div>
        <Button asChild className="w-full border-white/15 bg-white/10 text-white hover:bg-white/15 sm:w-auto" variant="outline"><Link href="?tab=activity"><CalendarPlus />Préparer la relance</Link></Button>
      </div>
    </section>
  );
}

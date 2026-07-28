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
    <section className="overflow-hidden rounded-3xl bg-[#0f2740] text-[#fffaf0] shadow-lg" data-testid="terrain-pharmacy-header">
      <div className="h-1.5 bg-[#ee6c3b]" />
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#7fb8df]">Fiche terrain</p>
            <h1 className="mt-1 text-2xl font-semibold">{props.name}</h1>
            <p className="mt-1 text-sm text-[#d7e2eb]">{props.address}</p>
          </div>
          <div className="flex gap-2"><Badge className="bg-white/10 text-white">{props.status}</Badge><Badge className="bg-[#ee6c3b] text-white">{props.potential}</Badge></div>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p><span className="text-[#9eb0bf]">Téléphone</span><br />{props.phone || "Non renseigné"}</p>
          <p><span className="text-[#9eb0bf]">Dernière commande</span><br />{date(props.lastOrderAt)}</p>
          <p><span className="text-[#9eb0bf]">Prochaine action</span><br />{props.nextActionType ? `${props.nextActionType} · ${date(props.nextActionAt)}` : "À créer"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <TrackedLink href={`tel:${props.phone || ""}`} eventName="interaction_started" pharmacyId={props.pharmacyId} className="bg-white text-[#0f2740]"><Phone /> Appeler</TrackedLink>
          <TrackedLink href={buildWazeUrl(props.navigation)} eventName="navigation_waze_clicked" pharmacyId={props.pharmacyId} external className="bg-[#2d6f9f] text-white"><Navigation /> Waze</TrackedLink>
          <TrackedLink href={buildGoogleMapsUrl(props.navigation)} eventName="navigation_maps_clicked" pharmacyId={props.pharmacyId} external className="bg-[#2d6f9f] text-white"><MapPinned /> Maps</TrackedLink>
          <Button asChild size="lg" className="min-h-11 bg-[#ee6c3b]"><Link href="?tab=activity"><Play /> Interaction</Link></Button>
          <Button asChild size="lg" variant="secondary" className="min-h-11"><Link href="?tab=activity"><ClipboardPlus /> Tâche</Link></Button>
          <Button asChild size="lg" variant="secondary" className="min-h-11"><Link href={`/dashboard/orders/new?pharmacy=${props.brandPharmacyId}`}><ShoppingCart /> Commande</Link></Button>
          <Button asChild size="lg" variant="secondary" className="col-span-2 min-h-11 sm:col-span-1"><Link href={`/dashboard/missions/new?pharmacy=${props.brandPharmacyId}`}><CalendarPlus /> Mission</Link></Button>
        </div>
      </div>
    </section>
  );
}

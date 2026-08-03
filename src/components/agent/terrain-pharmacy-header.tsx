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
    <section className="tr1-da-panel overflow-hidden" data-testid="terrain-pharmacy-header">
      <div className="h-0.5 bg-[var(--tr1-orange)]" />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[.18em] text-[var(--tr1-orange)]">Compte pharmacie</p>
            <h1 className="mt-1 font-mono text-2xl font-black uppercase tracking-[-0.055em] text-[var(--tr1-navy)] sm:text-3xl">{props.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{props.address}</p>
          </div>
          <div className="flex gap-2"><Badge variant="outline" className="border-[var(--tr1-line-strong)] bg-transparent">{props.status}</Badge><Badge variant="outline" className="border-[var(--tr1-orange)] bg-transparent text-[var(--tr1-orange)]">{props.potential}</Badge></div>
        </div>
        <div className="grid overflow-hidden rounded-[0.4rem] border border-[var(--tr1-line-strong)] bg-transparent text-sm sm:grid-cols-3">
          <p className="p-3 sm:border-r sm:border-[var(--tr1-line)]"><span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Téléphone</span><br /><strong className="font-mono text-[0.72rem] font-bold">{props.phone || "Non renseigné"}</strong></p>
          <p className="border-y border-[var(--tr1-line)] p-3 sm:border-x-0 sm:border-y-0 sm:border-r"><span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Dernière commande</span><br /><strong className="font-mono text-[0.72rem] font-bold">{date(props.lastOrderAt)}</strong></p>
          <p className="p-3"><span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Prochaine action</span><br /><strong className="font-mono text-[0.72rem] font-bold text-[var(--tr1-orange)]">{props.nextActionType ? `${props.nextActionType} · ${date(props.nextActionAt)}` : "À créer"}</strong></p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <TrackedLink href={`tel:${props.phone || ""}`} eventName="interaction_started" pharmacyId={props.pharmacyId} className="border border-[var(--tr1-line-strong)] bg-transparent text-[#0f2740]"><Phone /> Appeler</TrackedLink>
          <TrackedLink href={buildWazeUrl(props.navigation)} eventName="navigation_waze_clicked" pharmacyId={props.pharmacyId} external className="bg-[var(--tr1-navy)] text-white"><Navigation /> Waze</TrackedLink>
          <TrackedLink href={buildGoogleMapsUrl(props.navigation)} eventName="navigation_maps_clicked" pharmacyId={props.pharmacyId} external className="bg-[var(--tr1-navy)] text-white"><MapPinned /> Maps</TrackedLink>
          <Button asChild size="lg" className="min-h-11"><Link href="?tab=activity"><Play /> Interaction</Link></Button>
          <Button asChild size="lg" variant="secondary" className="min-h-11"><Link href="?tab=activity"><ClipboardPlus /> Tâche</Link></Button>
          <Button asChild size="lg" variant="secondary" className="min-h-11"><Link href={`/dashboard/orders/new?pharmacy=${props.brandPharmacyId}`}><ShoppingCart /> Commande</Link></Button>
          <Button asChild size="lg" variant="secondary" className="col-span-2 min-h-11 sm:col-span-1"><Link href={`/dashboard/missions/new?pharmacy=${props.brandPharmacyId}`}><CalendarPlus /> Mission</Link></Button>
        </div>
        <Button asChild className="w-full border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)] hover:text-white sm:w-auto" variant="outline"><Link href="?tab=activity"><CalendarPlus />Préparer la relance</Link></Button>
      </div>
    </section>
  );
}

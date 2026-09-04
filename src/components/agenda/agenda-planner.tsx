"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, GripVertical, Plus } from "lucide-react";
import { createAgendaBlockAction, createFieldVisitAction, rescheduleFieldVisitAction } from "@/app/(protected)/dashboard/agenda/actions";
import { addCalendarDays, isoToParisLocal } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export type AgendaEvent = { event_key:string; source_kind:string; source_id:string; event_type:string; title:string; start_at:string; end_at:string; pharmacy_id:string|null; pharmacy_name:string|null; city:string|null; brand_ids:string[]; brand_names:string[]; assigned_user_id:string|null; assigned_user_name:string|null; ownership:"mine"|"pharmacy_activity"; status:string; draggable:boolean; detail_url:string; priority:string; metadata:Record<string,unknown> };
export type BacklogItem = { item_key:string; source_kind:string; source_id:string; title:string; pharmacy_id:string|null; pharmacy_name:string|null; brand_id:string; brand_name:string; due_at:string|null; status:string; priority:string; detail_url:string; metadata:Record<string,unknown> };
export type PharmacyOption = { id:string; label:string; city?:string; brands:Array<{ relationId:string; brandId:string; brandName:string }> };

const filters = [{key:"all",label:"Tout"},{key:"mine",label:"Mon planning"},{key:"pharmacy_activity",label:"Dans mes pharmacies"},{key:"mission",label:"Missions"},{key:"task",label:"Tâches"}] as const;
const hours = Array.from({ length: 12 }, (_, index) => index + 8);

export function AgendaPlanner({ date, view, events, backlog, brands, pharmacies, canCreateVisit }: { date:string; view:"day"|"week"; events:AgendaEvent[]; backlog:BacklogItem[]; brands:Array<{id:string;name:string}>; pharmacies:PharmacyOption[]; canCreateVisit:boolean }) {
  const router = useRouter();
  const [filter,setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [,startTransition] = useTransition();
  const days = useMemo(()=>Array.from({length:view==="week"?7:1},(_,index)=>addCalendarDays(date,index)),[date,view]);
  const visible = events.filter((event)=>filter==="all" || event.ownership===filter || event.source_kind===filter);
  const navigate = (next:string) => router.push(`/dashboard/agenda?date=${next}&view=${view}`);
  const dropVisit = (event:React.DragEvent, day:string, hour:number) => {
    event.preventDefault();
    const visitId=event.dataTransfer.getData("text/field-visit");
    if (!visitId) return;
    startTransition(async()=>{ await rescheduleFieldVisitAction(visitId,`${day}T${String(hour).padStart(2,"0")}:00`); router.refresh(); });
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">Agenda Terrain · toutes vos marques</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--tr1-navy)]">Organisez votre terrain</h1><p className="mt-1 text-sm text-muted-foreground">Une seule vue pour vos visites, missions, tâches et activités en pharmacie.</p></div>
      <div className="flex flex-wrap gap-2">{canCreateVisit?<VisitSheet pharmacies={pharmacies}/>:null}<BlockSheet/></div>
    </header>
    <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_17rem]">
      <aside className="space-y-4 rounded-xl border border-[var(--tr1-line)] bg-white/70 p-3">
        <Input type="date" value={date} onChange={(event)=>navigate(event.target.value)}/>
        <div className="grid grid-cols-2 gap-1"><Button size="sm" variant={view==="day"?"default":"outline"} onClick={()=>router.push(`/dashboard/agenda?date=${date}&view=day`)}>Jour</Button><Button size="sm" variant={view==="week"?"default":"outline"} onClick={()=>router.push(`/dashboard/agenda?date=${date}&view=week`)}>Semaine</Button></div>
        <div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Filtres</p>{filters.map((item)=><button className={cn("mb-1 w-full rounded-md px-3 py-2 text-left text-sm",filter===item.key?"bg-[var(--tr1-navy)] text-white":"hover:bg-muted")} onClick={()=>setFilter(item.key)} key={item.key}>{item.label}</button>)}</div>
        <div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Marques actives</p><div className="flex flex-wrap gap-1">{brands.map((brand)=><Badge variant="outline" key={brand.id}>{brand.name}</Badge>)}</div></div>
      </aside>
      <main className="min-w-0 overflow-hidden rounded-xl border border-[var(--tr1-line)] bg-white/80">
        <div className="flex items-center justify-between border-b p-3"><Button size="icon" variant="ghost" onClick={()=>navigate(addCalendarDays(date,view==="week"?-7:-1))}><ChevronLeft/></Button><div className="flex items-center gap-2 text-sm font-bold text-[var(--tr1-navy)]"><CalendarDays className="size-4"/>{view==="week"?`Semaine du ${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR")}`:new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div><Button size="icon" variant="ghost" onClick={()=>navigate(addCalendarDays(date,view==="week"?7:1))}><ChevronRight/></Button></div>
        <div className={cn("grid min-w-[44rem]",view==="week"?"grid-cols-[3rem_repeat(7,minmax(7rem,1fr))]":"grid-cols-[3.5rem_minmax(19rem,1fr)_minmax(14rem,0.42fr)]")}>
          <div/><>{days.map((day)=><div className="border-l p-2 text-center text-xs font-bold" key={day}>{new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric"})}</div>)}</>{view==="day"?<div className="border-l p-2 text-center text-xs font-bold text-muted-foreground">Dans mes pharmacies</div>:null}
          {hours.map((hour)=><TimelineRow key={hour} hour={hour} days={days} events={visible} view={view} onDrop={dropVisit}/>) }
        </div>
      </main>
      <aside className="rounded-xl border border-[var(--tr1-line)] bg-white/70 p-3"><h2 className="font-bold text-[var(--tr1-navy)]">À planifier</h2><p className="mb-3 text-xs text-muted-foreground">Tâches ouvertes, retards et corrections.</p><div className="space-y-2">{backlog.map((item)=><Link href={item.detail_url} className="block rounded-lg border bg-white p-3 text-sm hover:border-[var(--tr1-orange)]" key={item.item_key}><div className="flex justify-between gap-2"><strong>{item.title}</strong><Badge variant={item.status==="overdue"?"destructive":"secondary"}>{item.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.pharmacy_name} · {item.brand_name}</p></Link>)}{!backlog.length?<p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Rien à planifier.</p>:null}</div></aside>
    </div>
  </div>;
}

function TimelineRow({hour,days,events,view,onDrop}:{hour:number;days:string[];events:AgendaEvent[];view:"day"|"week";onDrop:(event:React.DragEvent,day:string,hour:number)=>void}) {
  const cells=days.map((day)=>events.filter((event)=>event.ownership==="mine"&&isoToParisLocal(event.start_at).startsWith(`${day}T${String(hour).padStart(2,"0")}`)));
  const pharmacy=events.filter((event)=>event.ownership==="pharmacy_activity"&&isoToParisLocal(event.start_at).startsWith(`${days[0]}T${String(hour).padStart(2,"0")}`));
  return <><div className="border-t p-2 text-right font-mono text-[0.62rem] text-muted-foreground">{hour}:00</div>{cells.map((items,index)=><div className="min-h-20 border-l border-t p-1.5" onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>onDrop(event,days[index],hour)} key={days[index]}>{items.map((item)=><EventCard event={item} key={item.event_key}/>)}</div>)}{view==="day"?<div className="min-h-20 border-l border-t bg-slate-50/70 p-1.5">{pharmacy.map((item)=><EventCard event={item} key={item.event_key}/>)}</div>:null}</>;
}

function EventCard({event}:{event:AgendaEvent}) { const tone=event.ownership==="pharmacy_activity"?"border-slate-300 bg-slate-100":event.source_kind==="field_visit"?"border-orange-300 bg-orange-50":event.source_kind==="mission"?"border-blue-300 bg-blue-50":event.source_kind==="agenda_block"?"border-stone-300 bg-stone-100":"border-emerald-300 bg-emerald-50"; return <Link href={event.detail_url} draggable={event.draggable} onDragStart={(drag)=>{if(event.draggable)drag.dataTransfer.setData("text/field-visit",event.source_id)}} className={cn("mb-1 block rounded-md border-l-4 p-2 text-xs shadow-sm",tone)}><div className="flex items-start gap-1">{event.draggable?<GripVertical className="mt-0.5 size-3 shrink-0"/>:null}<strong className="line-clamp-2">{event.title}</strong></div><p className="mt-1 text-[0.65rem] text-muted-foreground"><Clock3 className="mr-1 inline size-3"/>{isoToParisLocal(event.start_at).slice(11)} · {event.pharmacy_name||event.status}</p>{event.ownership==="pharmacy_activity"?<p className="mt-1 font-medium">Lecture seule · {event.assigned_user_name||"Intervenant"}</p>:null}</Link>; }

function VisitSheet({pharmacies}:{pharmacies:PharmacyOption[]}) { const [state,action,pending]=useActionState(createFieldVisitAction,{} as {error?:string;success?:string}); const [pharmacyId,setPharmacyId]=useState(pharmacies[0]?.id??""); const selected=pharmacies.find((item)=>item.id===pharmacyId); return <Sheet><SheetTrigger asChild><Button><Plus className="size-4"/>Nouvelle visite</Button></SheetTrigger><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>Nouvelle visite</SheetTitle></SheetHeader><form action={action} className="space-y-4 p-4"><Feedback state={state}/><Field label="Pharmacie"><select className="h-10 w-full rounded-md border px-3" name="pharmacyId" value={pharmacyId} onChange={(event)=>setPharmacyId(event.target.value)}>{pharmacies.map((item)=><option value={item.id} key={item.id}>{item.label} · {item.city}</option>)}</select></Field><Field label="Marques concernées"><div className="space-y-2">{selected?.brands.map((brand)=><label className="flex gap-2 text-sm" key={brand.relationId}><input type="checkbox" name="brandPharmacyId" value={brand.relationId}/>{brand.brandName}</label>)}</div></Field><Field label="Type"><select className="h-10 w-full rounded-md border px-3" name="visitKind"><option value="client_visit">Visite client</option><option value="prospecting">Prospection</option><option value="relationship">Relation</option><option value="training">Formation</option><option value="other">Autre</option></select></Field><Field label="Titre"><Input name="title" required/></Field><div className="grid grid-cols-2 gap-2"><Field label="Début"><Input type="datetime-local" name="startAt" required/></Field><Field label="Fin"><Input type="datetime-local" name="endAt" required/></Field></div><Field label="Objectif"><Textarea name="objective"/></Field><Field label="Notes"><Textarea name="notes"/></Field><Button disabled={pending} className="w-full">{pending?"Création…":"Confirmer la visite"}</Button></form></SheetContent></Sheet>; }
function BlockSheet(){const[state,action,pending]=useActionState(createAgendaBlockAction,{} as {error?:string;success?:string});return <Sheet><SheetTrigger asChild><Button variant="outline">Bloquer un créneau</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Bloquer un créneau</SheetTitle></SheetHeader><form action={action} className="space-y-4 p-4"><Feedback state={state}/><Field label="Type"><select name="blockType" className="h-10 w-full rounded-md border px-3"><option value="unavailable">Indisponible</option><option value="travel">Trajet</option><option value="meeting">Réunion</option><option value="break">Pause</option><option value="personal">Personnel</option><option value="other">Autre</option></select></Field><Field label="Titre"><Input name="title" required/></Field><Field label="Début"><Input type="datetime-local" name="startAt" required/></Field><Field label="Fin"><Input type="datetime-local" name="endAt" required/></Field><Button disabled={pending} className="w-full">{pending?"Création…":"Bloquer"}</Button></form></SheetContent></Sheet>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><Label className="mb-1.5">{label}</Label>{children}</div>}
function Feedback({state}:{state:{error?:string;success?:string}}){return state.error?<p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>:state.success?<p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p>:null}

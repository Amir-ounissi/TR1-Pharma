import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { leadStatuses } from "@/lib/marketing/leads";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 20;
  const { supabase } = await requirePlatformAdmin();
  let query = supabase.from("commercial_leads").select("id,full_name,professional_email,company_name,status,assigned_to,next_action_at,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (params.status && leadStatuses.includes(params.status as (typeof leadStatuses)[number])) query = query.eq("status", params.status);
  if (params.q) query = query.or(`full_name.ilike.%${params.q.replaceAll(",", "")}%,professional_email.ilike.%${params.q.replaceAll(",", "")}%,company_name.ilike.%${params.q.replaceAll(",", "")}%`);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59.999Z`);
  if (params.assignedTo === "unassigned") query = query.is("assigned_to", null);
  else if (params.assignedTo) query = query.eq("assigned_to", params.assignedTo);
  const [{ data: leads, count }, { data: memberships }] = await Promise.all([
    query,
    supabase.from("memberships").select("user_id,users!memberships_user_id_fkey(user_profiles(full_name))").is("brand_id", null).eq("status", "active"),
  ]);
  const assignees = (memberships ?? []).map((membership) => { const user = Array.isArray(membership.users) ? membership.users[0] : membership.users; const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles; return { id: membership.user_id, name: profile?.full_name ?? "Responsable TR1" }; });
  const names = new Map(assignees.map((item) => [item.id, item.name]));
  return <div className="space-y-6"><div><p className="tr1-da-eyebrow">Acquisition TR1</p><h1 className="tr1-da-title">Leads commerciaux</h1><p className="mt-2 text-muted-foreground">Demandes de diagnostic, qualification et préparation des pilotes.</p></div>
    <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5"><input className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={params.q} name="q" placeholder="Rechercher"/><select className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={params.status} name="status"><option value="">Tous les statuts</option>{leadStatuses.map(status=><option key={status}>{status}</option>)}</select><input className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={params.from} name="from" type="date"/><input className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={params.to} name="to" type="date"/><select className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={params.assignedTo} name="assignedTo"><option value="">Tous les responsables</option><option value="unassigned">Non attribués</option>{assignees.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="h-10 rounded-md bg-primary px-4 font-mono text-xs font-bold uppercase text-primary-foreground">Filtrer</button></form>
    <div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Lead</th><th className="p-3 text-left">Statut</th><th className="p-3 text-left">Responsable</th><th className="p-3 text-left">Créé</th></tr></thead><tbody>{(leads ?? []).map(lead=><tr className="border-t" key={lead.id}><td className="p-3"><Link className="font-semibold hover:underline" href={`/dashboard/admin/leads/${lead.id}`}>{lead.company_name}</Link><p className="text-xs text-muted-foreground">{lead.full_name} · {lead.professional_email}</p></td><td className="p-3 font-mono text-xs uppercase">{lead.status}</td><td className="p-3">{lead.assigned_to ? names.get(lead.assigned_to) ?? "Responsable TR1" : "Non attribué"}</td><td className="p-3">{new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium"}).format(new Date(lead.created_at))}</td></tr>)}</tbody></table>{!leads?.length?<p className="p-8 text-center text-muted-foreground">Aucun lead.</p>:null}</div>
    <div className="flex items-center justify-between text-sm"><span>{count ?? 0} lead(s)</span><div className="flex gap-2">{page>1?<Link className="rounded border px-3 py-2" href={{query:{...params,page:page-1}}}>Précédent</Link>:null}{(count ?? 0)>page*pageSize?<Link className="rounded border px-3 py-2" href={{query:{...params,page:page+1}}}>Suivant</Link>:null}</div></div>
  </div>;
}

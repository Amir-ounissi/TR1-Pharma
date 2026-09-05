import Link from "next/link";
import { updateTaskAction } from "@/app/(protected)/dashboard/commercial/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { uiLabel } from "@/lib/ui-copy";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const taskStatuses = ["open", "in_progress", "overdue", "completed", "cancelled"];
const taskPriorities = ["low", "normal", "high", "urgent"];
const taskTypes = ["call", "email", "visit", "appointment", "send_offer", "follow_up", "qualify", "update_contact", "check_stock", "request_order", "internal_review", "other"];

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, brand, userId } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const isAgent = role === "agent";
  const requestedScope = typeof params.scope === "string" ? params.scope : "mine";
  const scope = isAgent && requestedScope === "team" ? "mine" : requestedScope;
  const today = new Date();
  const rangeEnd = new Date(today);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + (scope === "week" ? 7 : 1));

  let query = supabase.from("commercial_tasks").select("*").eq("brand_id", brand.id).order("due_at", { ascending: true, nullsFirst: false });
  if (scope === "mine" || isAgent) query = query.eq("assigned_to", userId);
  if (scope === "overdue") query = query.eq("effective_status", "overdue");
  if (scope === "completed") query = query.eq("effective_status", "completed");
  if (scope === "undated") query = query.is("due_at", null).in("status", ["open", "in_progress"]);
  if (scope === "today" || scope === "week") query = query.gte("due_at", today.toISOString().slice(0, 10)).lt("due_at", rangeEnd.toISOString().slice(0, 10));
  if (typeof params.status === "string" && params.status !== "all") query = query.eq("effective_status", params.status);
  if (typeof params.priority === "string" && params.priority !== "all") query = query.eq("priority", params.priority);
  if (typeof params.type === "string" && params.type !== "all") query = query.eq("task_type", params.type);
  if (!isAgent && typeof params.user === "string" && params.user) query = query.eq("assigned_to", params.user);
  if (!isAgent && typeof params.agent === "string" && params.agent) query = query.eq("current_agent_user_id", params.agent);
  if (!isAgent && typeof params.territory === "string" && params.territory) query = query.eq("territory_id", params.territory);
  if (typeof params.pharmacy === "string" && params.pharmacy) query = query.ilike("pharmacy_name", `%${params.pharmacy}%`);

  const { data: tasks, error } = await query.limit(200);
  let users: { id: string; name: string }[] = [];
  let territories: { id: string; name: string }[] = [];
  if (!isAgent) {
    const [membershipsResult, territoriesResult] = await Promise.all([
      supabase.from("memberships").select("user_id,users!memberships_user_id_fkey(user_profiles(full_name))").eq("brand_id", brand.id).eq("status", "active"),
      supabase.from("territories").select("id,name").eq("brand_id", brand.id).is("archived_at", null).order("name"),
    ]);
    users = (membershipsResult.data ?? []).map((membership) => {
      const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
      const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
      return { id: membership.user_id, name: profile?.full_name ?? "Utilisateur" };
    });
    territories = territoriesResult.data ?? [];
  }

  const scopes = [["mine", "Mes tâches"], ["team", "Équipe"], ["overdue", "En retard"], ["today", "Aujourd’hui"], ["week", "Cette semaine"], ["undated", "Sans échéance"], ["completed", "Terminées"]].filter(([value]) => !isAgent || value !== "team");

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">{isAgent ? "Mes tâches" : "Tâches commerciales"}</h1><p className="text-muted-foreground">{isAgent ? "Vos relances et prochaines actions, limitées à votre portefeuille." : "Mes tâches, équipe, retards et échéances."}</p></div>
    <div className="flex flex-wrap gap-2">{scopes.map(([value, label]) => <Button key={value} asChild variant={scope === value ? "default" : "outline"} size="sm"><Link href={`?scope=${value}`}>{label}</Link></Button>)}</div>
    <Card><CardContent className="pt-6"><form className={`grid gap-3 sm:grid-cols-2 ${isAgent ? "xl:grid-cols-5" : "xl:grid-cols-8"}`}><input type="hidden" name="scope" value={scope} /><Select name="status" defaultValue={typeof params.status === "string" ? params.status : "all"}><SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem>{taskStatuses.map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select><Select name="priority" defaultValue={typeof params.priority === "string" ? params.priority : "all"}><SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes priorités</SelectItem>{taskPriorities.map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select><Select name="type" defaultValue={typeof params.type === "string" ? params.type : "all"}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">Tous types</SelectItem>{taskTypes.map((value) => <SelectItem key={value} value={value}>{uiLabel(value)}</SelectItem>)}</SelectContent></Select>{!isAgent ? <><Select name="user"><SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><Select name="agent"><SelectTrigger><SelectValue placeholder="Agent du compte" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><Select name="territory"><SelectTrigger><SelectValue placeholder="Territoire" /></SelectTrigger><SelectContent>{territories.map((territory) => <SelectItem key={territory.id} value={territory.id}>{territory.name}</SelectItem>)}</SelectContent></Select></> : null}<Input name="pharmacy" placeholder="Pharmacie" defaultValue={typeof params.pharmacy === "string" ? params.pharmacy : ""} /><Button>Filtrer</Button></form></CardContent></Card>
    <Card><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Chargement impossible.</p> : (tasks ?? []).length === 0 ? <div className="p-10 text-center"><p className="text-muted-foreground">Aucune tâche dans cette vue.</p>{isAgent ? <Button asChild className="mt-4" size="sm" variant="outline"><Link href="/dashboard/pharmacies">Choisir une pharmacie</Link></Button> : null}</div> : <Table><TableHeader><TableRow><TableHead>Tâche</TableHead><TableHead>Pharmacie</TableHead><TableHead>Responsable</TableHead><TableHead>Échéance</TableHead><TableHead>Statut</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{tasks?.map((task) => <TableRow key={task.id}><TableCell><p className="font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{uiLabel(task.task_type)} · {uiLabel(task.priority)}</p></TableCell><TableCell><Link href={`/dashboard/pharmacies/${task.brand_pharmacy_id}`} className="hover:underline">{task.pharmacy_name || "Pharmacie"}</Link></TableCell><TableCell>{task.assigned_name || "—"}</TableCell><TableCell className={task.effective_status === "overdue" ? "text-destructive" : ""}>{task.due_at ? new Date(task.due_at).toLocaleString("fr-FR") : "Sans échéance"}</TableCell><TableCell><Badge variant="secondary">{uiLabel(task.effective_status)}</Badge></TableCell><TableCell>{!["completed", "cancelled"].includes(task.status) ? <div className="space-y-2"><form action={updateTaskAction}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="status" value="completed" /><Button size="sm" variant="outline">Terminer</Button></form><form action={updateTaskAction} className="flex gap-1"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="status" value="cancelled" /><Input name="cancellationReason" placeholder="Motif obligatoire" required className="h-8 min-w-36" /><Button size="sm" variant="ghost">Annuler</Button></form></div> : "—"}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
  </div>;
}

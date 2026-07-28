import { CreateUserForm } from "@/components/users/create-user-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";

export default async function UsersPage() {
  const { supabase, brand } = await requireActiveBrand();
  const { data: allowed } = await supabase.rpc("can_manage_brand_users", { target_brand_id: brand.id });
  if (!allowed) return <Alert><AlertTitle>Accès limité</AlertTitle><AlertDescription>Votre rôle ne permet pas d’administrer les utilisateurs de cette marque.</AlertDescription></Alert>;

  const { data: memberships } = await supabase.from("memberships").select("id,status,created_at,roles(label),users(user_profiles(full_name))").eq("brand_id", brand.id).order("created_at");
  return (
    <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1><p className="text-muted-foreground">Gérez les accès de {brand.name}.</p></div><CreateUserForm /><Card><CardHeader><CardTitle>Équipe</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{(memberships ?? []).map((membership) => { const users = Array.isArray(membership.users) ? membership.users[0] : membership.users; const profile = Array.isArray(users?.user_profiles) ? users.user_profiles[0] : users?.user_profiles; const role = Array.isArray(membership.roles) ? membership.roles[0] : membership.roles; return <TableRow key={membership.id}><TableCell className="font-medium">{profile?.full_name ?? "Invitation en attente"}</TableCell><TableCell>{role?.label ?? "—"}</TableCell><TableCell><Badge variant="secondary">{membership.status}</Badge></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card></div>
  );
}

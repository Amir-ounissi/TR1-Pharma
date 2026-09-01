import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { formatMembershipStatus } from "@/lib/platform-admin";
import { loadPlatformUsersPageData } from "@/lib/platform-admin-page";

export default async function PlatformUsersPage() {
  const users = await loadPlatformUsersPageData();

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Plateforme TR1"
        title="Utilisateurs & accès"
        description="Vue globale des rattachements, rôles et statuts de la plateforme."
        tone="dark"
      />
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs globaux</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Marque(s)</TableHead>
                <TableHead>Rôle(s)</TableHead>
                <TableHead>Statut(s)</TableHead>
                <TableHead>Créé / invité le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.brands.join(", ")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {user.statuses.map((status) => (
                        <Badge key={status} variant={status === "active" ? "default" : "outline"}>
                          {formatMembershipStatus(status)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(user.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

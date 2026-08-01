import { redirect } from "next/navigation";
import { RoleNavigation } from "@/components/shell/role-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ux/page-header";
import { StatusBadge, type StatusTone } from "@/components/ux/status-badge";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { canAccessDesignSystem } from "@/lib/ux/permissions";

const colors = [
  ["Navy", "#0E1A2B"], ["Navy secondaire", "#14263E"], ["Ivoire", "#F6F2E9"], ["Ivoire secondaire", "#ECE6DA"],
  ["Orange actif", "#E96708"], ["Bleu accent", "#2B5FC7"], ["Succès", "#4F7A58"], ["Alerte", "#C54B3C"],
];

export default async function DesignSystemPage() {
  const [{ brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!canAccessDesignSystem(role)) redirect("/dashboard");

  return (
    <main className="space-y-8" data-testid="design-system-page">
      <PageHeader eyebrow="Référence interne · Sprint 11.2" title="Design system TR1" description="Fondation visuelle sobre, éditoriale et orientée exécution terrain." tone="dark" />
      <section className="space-y-3"><h2 className="text-xl font-semibold">Couleurs</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{colors.map(([name, value]) => <div className="overflow-hidden rounded-xl border bg-card" key={name}><div className="h-20" style={{ background: value }} /><div className="p-3"><p className="font-medium">{name}</p><code className="text-xs text-muted-foreground">{value}</code></div></div>)}</div></section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Typographie et actions</CardTitle><CardDescription>Geist pour la lecture, monospace pour les données courtes.</CardDescription></CardHeader><CardContent className="space-y-4"><h3 className="text-2xl font-semibold">Titre d’écran premium</h3><p className="text-sm text-muted-foreground">Texte secondaire concis et lisible.</p><p className="font-mono text-sm">09:30 · SCORE 84 · J+30</p><div className="flex flex-wrap gap-2"><Button>Action principale</Button><Button variant="outline">Secondaire</Button><Button variant="ghost">Discrète</Button><Button variant="destructive">Critique</Button></div><Input aria-label="Exemple de champ" placeholder="Rechercher une pharmacie…" /></CardContent></Card>
        <Card><CardHeader><CardTitle>États</CardTitle><CardDescription>Couleurs réservées aux informations qui le nécessitent.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{(["neutral", "information", "active", "success", "attention", "overdue", "critical"] as StatusTone[]).map((tone) => <StatusBadge key={tone} tone={tone}>{tone}</StatusBadge>)}<Badge variant="secondary">Badge existant</Badge></CardContent></Card>
      </section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Navigation par rôle</h2><div className="grid gap-4 xl:grid-cols-3">{[["Agent", "agent"], ["Manager", "tr1_manager"], ["Administration", "brand_admin"]].map(([label, previewRole]) => <div className="rounded-2xl bg-sidebar p-4 text-sidebar-foreground" key={previewRole}><p className="mb-5 font-semibold">{label}</p><RoleNavigation role={previewRole} /></div>)}</div></section>
      <section className="overflow-hidden rounded-xl border bg-card"><div className="border-b bg-[var(--tr1-navy)] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/70">Tableau métier</div><table className="w-full text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Pharmacie</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr></thead><tbody><tr className="border-t hover:bg-muted/30"><td className="p-3 font-medium">Pharmacie République</td><td className="p-3"><StatusBadge tone="overdue">réassort en retard</StatusBadge></td><td className="p-3"><Button size="sm">Créer la relance</Button></td></tr></tbody></table></section>
    </main>
  );
}

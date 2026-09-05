import { MessageSquarePlus, ShoppingCart, SquareCheckBig } from "lucide-react";
import Link from "next/link";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import { Card, CardContent } from "@/components/ui/card";
import { getAgentMoreItems } from "@/lib/ux/navigation";

const quickActions = [
  {
    href: "/dashboard/pharmacies",
    label: "Interaction avec une pharmacie",
    description: "Choisir la pharmacie puis enregistrer l’interaction.",
    icon: MessageSquarePlus,
  },
  {
    href: "/dashboard/pharmacies",
    label: "Relance ou tâche",
    description: "Choisir la pharmacie puis créer le suivi.",
    icon: SquareCheckBig,
  },
  {
    href: "/dashboard/orders/new",
    label: "Nouvelle commande",
    description: "Saisir directement une commande terrain.",
    icon: ShoppingCart,
  },
];

export default function AgentMorePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Plus</h1>
        <p className="text-muted-foreground">Actions rapides et outils complémentaires à votre activité terrain.</p>
      </header>

      <section className="space-y-3" aria-labelledby="agent-quick-actions">
        <div>
          <h2 className="text-lg font-semibold" id="agent-quick-actions">Actions rapides</h2>
          <p className="text-sm text-muted-foreground">Accédez directement aux actions terrain les plus fréquentes.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link href={action.href} key={action.label}>
              <Card className="h-full transition hover:border-[var(--tr1-orange)]">
                <CardContent className="flex h-full gap-3 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
                    <action.icon className="size-5 text-[var(--tr1-orange)]" />
                  </span>
                  <span>
                    <span className="block font-semibold">{action.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{action.description}</span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="agent-more-tools">
        <h2 className="text-lg font-semibold" id="agent-more-tools">Outils</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {getAgentMoreItems().map((item) => (
            <Link href={item.href} key={item.href}>
              <Card className="h-full transition hover:border-[var(--tr1-orange)]">
                <CardContent className="flex items-center gap-3 p-5">
                  <span className="grid size-10 place-items-center rounded-md bg-muted">
                    <NavigationIcon className="size-5 text-[var(--tr1-navy)]" name={item.icon} />
                  </span>
                  <span className="font-semibold">{item.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

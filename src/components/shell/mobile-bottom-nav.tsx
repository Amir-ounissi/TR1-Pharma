"use client";

import { MessageSquarePlus, Plus, ShoppingCart, SquareCheckBig } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getMobileAgentNavigationItems, getRoleFamily, isNavigationItemActive, type NavigationItem } from "@/lib/ux/navigation";

const quickActions = [
  { href: "/dashboard/pharmacies", label: "Ajouter une interaction", description: "Choisir d’abord la pharmacie", icon: MessageSquarePlus },
  { href: "/dashboard/pharmacies", label: "Créer une relance ou une tâche", description: "Choisir d’abord la pharmacie", icon: SquareCheckBig },
  { href: "/dashboard/orders/new", label: "Créer une commande", description: "Saisir une commande terrain", icon: ShoppingCart },
];

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  if (getRoleFamily(role) !== "agent") return null;

  const destinations = getMobileAgentNavigationItems();
  const beforeAction = destinations.filter((item) => ["/dashboard/agent", "/dashboard/pharmacies"].includes(item.href));
  const afterAction = destinations.filter((item) => ["/dashboard/orders", "/dashboard/agenda"].includes(item.href));

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory)]/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        {beforeAction.map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
        <Sheet>
          <SheetTrigger asChild>
            <button aria-label="Ouvrir les actions rapides" className="mx-auto grid size-12 -translate-y-3 place-items-center rounded-full border-4 border-[var(--tr1-ivory)] bg-[var(--tr1-navy)] text-white shadow-lg shadow-slate-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button">
              <Plus className="size-5 text-[var(--tr1-orange)]" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader><SheetTitle>Actions rapides</SheetTitle></SheetHeader>
            <div className="grid gap-2 px-4 pb-4">
              {quickActions.map((action) => <Button asChild className="h-auto justify-start gap-3 p-3 text-left" variant="outline" key={action.label}><Link href={action.href}><action.icon className="size-5 shrink-0 text-[var(--tr1-orange)]" /><span><span className="block font-semibold">{action.label}</span><span className="block text-xs font-normal text-muted-foreground">{action.description}</span></span></Link></Button>)}
            </div>
          </SheetContent>
        </Sheet>
        {afterAction.map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
      </div>
    </nav>
  );
}

function MobileLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isNavigationItemActive(pathname, item.href);
  return <Link className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-md font-mono text-[0.57rem] font-bold uppercase text-muted-foreground", active && "text-[var(--tr1-orange)]")} href={item.href}><NavigationIcon className="size-5" name={item.icon} /><span>{item.shortLabel ?? (item.href === "/dashboard/orders" ? "Commandes" : item.label)}</span></Link>;
}

import { Activity, BarChart3, Building2, Boxes, CalendarDays, ClipboardCheck, ClipboardList, Crosshair, FileUp, LayoutDashboard, LogOut, Map, Menu, MessageCircle, MessageSquareText, Network, Route, ShoppingCart, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { changeBrandAction, signOutAction } from "@/app/(protected)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/dashboard/commercial-health", label: "Où agir ?", icon: Crosshair },
  { href: "/dashboard/pharmacies", label: "Pharmacies", icon: Building2 },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: Route },
  { href: "/dashboard/tasks", label: "Tâches", icon: ClipboardList },
  { href: "/dashboard/agent", label: "Mon activité", icon: UserRound },
  { href: "/dashboard/agent/assistant", label: "Assistant Terrain", icon: MessageSquareText },
  { href: "/dashboard/account/whatsapp", label: "Mon WhatsApp", icon: MessageCircle },
  { href: "/dashboard/orders", label: "Commandes", icon: ShoppingCart },
  { href: "/dashboard/missions", label: "Missions", icon: CalendarDays },
  { href: "/dashboard/field", label: "Mon terrain", icon: UserRound },
  { href: "/dashboard/reports", label: "Rapports", icon: ClipboardCheck },
  { href: "/dashboard/mission-performance", label: "Impact missions", icon: Activity },
  { href: "/dashboard/network", label: "Performance réseau", icon: BarChart3 },
  { href: "/dashboard/products", label: "Produits", icon: Boxes },
  { href: "/dashboard/groups", label: "Groupements", icon: Network },
  { href: "/dashboard/territories", label: "Territoires", icon: Map },
  { href: "/dashboard/imports", label: "Imports CSV", icon: FileUp },
  { href: "/dashboard/users", label: "Utilisateurs", icon: Users },
];

function Navigation({ scrollable = false }: { scrollable?: boolean }) {
  return (
    <nav className={scrollable ? "min-h-0 flex-1 space-y-1 overflow-y-auto pb-4" : "space-y-1"}>
      {navigation.map((item) => <Button asChild variant="ghost" className="w-full justify-start" key={item.href}><Link href={item.href}><item.icon className="size-4" />{item.label}</Link></Button>)}
    </nav>
  );
}

export function AppShell({ children, brandName, userName }: { children: React.ReactNode; brandName: string; userName: string }) {
  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 hidden w-64 flex-col border-r bg-background p-4 md:flex">
        <div className="mb-6 flex shrink-0 items-center gap-2 px-2 font-semibold"><span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><Activity className="size-4" /></span>TR1 Pharma</div>
        <Navigation scrollable />
        <div className="shrink-0 space-y-3"><Separator /><p className="px-2 text-sm font-medium">{userName}</p><form action={signOutAction}><Button variant="ghost" className="w-full justify-start"><LogOut className="size-4" />Déconnexion</Button></form></div>
      </aside>
      <div className="md:pl-64">
        <header data-testid="mobile-sticky-header" className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-3">
            <Sheet><SheetTrigger asChild><Button size="icon-lg" variant="ghost" className="min-h-11 min-w-11 md:hidden"><Menu className="size-5" /><span className="sr-only">Ouvrir le menu</span></Button></SheetTrigger><SheetContent side="left" className="w-72"><SheetHeader><SheetTitle>TR1 Pharma</SheetTitle></SheetHeader><div className="p-4"><Navigation /></div></SheetContent></Sheet>
            <div><p className="text-xs text-muted-foreground">Marque active</p><p className="font-medium">{brandName}</p></div>
          </div>
          <form action={changeBrandAction}><Button variant="outline" size="sm" className="min-h-11"><Building2 className="size-4" />Changer</Button></form>
        </header>
        <main className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

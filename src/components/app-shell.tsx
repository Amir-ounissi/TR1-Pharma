import { Activity, Building2, ChevronsUpDown, LogOut, Menu } from "lucide-react";
import { changeBrandAction, signOutAction } from "@/app/(protected)/dashboard/actions";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { RoleNavigation } from "@/components/shell/role-navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SearchItem } from "@/lib/ux/search";

type AppShellProps = {
  children: React.ReactNode;
  brandName: string;
  role: string;
  searchItems: SearchItem[];
  userName: string;
};

export function AppShell({ children, brandName, role, searchItems, userName }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--tr1-ivory)]">
      <aside className="fixed inset-y-0 z-40 hidden w-[17.5rem] flex-col border-r border-white/8 bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="mb-7 flex shrink-0 items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--tr1-orange)] text-white shadow-sm"><Activity className="size-4" /></span>
          <div><p className="text-sm font-semibold tracking-tight">TR1 Pharma</p><p className="text-[0.68rem] text-sidebar-foreground/48">Opérations terrain</p></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-5"><RoleNavigation role={role} /></div>
        <div className="shrink-0 space-y-3">
          <Separator className="bg-white/10" />
          <div className="flex items-center gap-3 px-2"><span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold">{initials(userName)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-xs text-sidebar-foreground/45">{roleLabel(role)}</p></div></div>
          <form action={signOutAction}><Button className="w-full justify-start text-sidebar-foreground/65 hover:bg-white/8 hover:text-white" variant="ghost"><LogOut className="size-4" />Déconnexion</Button></form>
        </div>
      </aside>

      <div className="md:pl-[17.5rem]">
        <header data-testid="mobile-sticky-header" className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b bg-background/92 px-3 backdrop-blur-xl sm:px-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Sheet>
            <SheetTrigger asChild><Button className="min-h-11 min-w-11 md:hidden" size="icon-lg" variant="ghost"><Menu className="size-5" /><span className="sr-only">Ouvrir le menu</span></Button></SheetTrigger>
            <SheetContent className="w-[19rem] border-r-0 bg-sidebar text-sidebar-foreground" side="left">
              <SheetHeader className="border-white/10"><SheetTitle className="flex items-center gap-2 text-sidebar-foreground"><span className="grid size-8 place-items-center rounded-lg bg-[var(--tr1-orange)] text-white"><Activity className="size-4" /></span>TR1 Pharma</SheetTitle></SheetHeader>
              <div className="p-4"><RoleNavigation role={role} /></div>
            </SheetContent>
          </Sheet>

          <form action={changeBrandAction} className="shrink-0">
            <Button className="h-10 max-w-44 justify-between gap-2 px-2.5" title="Changer de marque" type="submit" variant="ghost">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--tr1-navy)] text-white"><Building2 className="size-3.5" /></span>
              <span className="hidden min-w-0 text-left sm:block"><span className="block text-[0.62rem] font-medium uppercase tracking-wider text-muted-foreground">Marque active</span><span className="block truncate text-xs font-semibold">{brandName}</span></span>
              <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
            </Button>
          </form>

          <div className="ml-auto flex min-w-0 flex-1 justify-end md:ml-3 md:justify-center"><CommandPalette items={searchItems} /></div>
          <div className="hidden size-9 shrink-0 place-items-center rounded-full bg-[var(--tr1-navy)] text-xs font-semibold text-white lg:grid" title={userName}>{initials(userName)}</div>
        </header>
        <main className="mx-auto w-full max-w-[100rem] p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-8 lg:p-8">{children}</main>
      </div>
      <MobileBottomNav role={role} />
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleLabel(role: string) {
  return ({ super_admin: "Super administrateur", brand_admin: "Administrateur marque", tr1_manager: "Manager TR1", brand_user: "Manager marque", agent: "Agent terrain", facilitator: "Intervenant" } as Record<string, string>)[role] ?? role;
}

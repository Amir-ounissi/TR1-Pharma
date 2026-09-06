import { Building2, ChevronsUpDown, LogOut, Menu, ShieldCheck } from "lucide-react";
import { changeBrandAction, returnToPlatformAdministrationAction, signOutAction } from "@/app/(protected)/dashboard/actions";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { RoleNavigation } from "@/components/shell/role-navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SaasCapability } from "@/lib/saas/capabilities";
import type { SearchItem } from "@/lib/ux/search";
import type { NavigationScope } from "@/lib/ux/navigation";

type AppShellProps = {
  children: React.ReactNode;
  brandName: string;
  brandHint?: string;
  role: string;
  navigationScope?: NavigationScope;
  capabilities?: SaasCapability[];
  searchItems: SearchItem[];
  userName: string;
};

export function AppShell({ children, brandName, brandHint = "Marque active", role, navigationScope = "tenant", capabilities, searchItems, userName }: AppShellProps) {
  const showPlatformAdministrationReturn = role === "super_admin" && navigationScope === "tenant";

  return (
    <div className="tr1-product-da min-h-screen bg-[var(--tr1-ivory)]">
      <aside className="fixed inset-y-0 z-40 hidden w-[16.5rem] flex-col border-r border-white/10 bg-sidebar px-4 py-5 text-sidebar-foreground md:flex">
        <div className="mb-8 flex shrink-0 items-center gap-3 px-2">
          <span className="relative grid size-10 place-items-center rounded-[0.55rem] border border-white/15 bg-white/6 font-mono text-[0.68rem] font-black tracking-[-0.04em] text-white">TR1<span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--tr1-orange)]" /></span>
          <div><p className="text-[0.86rem] font-black uppercase tracking-[-0.02em]">TR1 Pharma</p><p className="font-mono text-[0.55rem] uppercase tracking-[0.17em] text-sidebar-foreground/42">Intelligence terrain</p></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-5"><RoleNavigation role={role} scope={navigationScope} capabilities={capabilities} /></div>
        <div className="shrink-0 space-y-3">
          {showPlatformAdministrationReturn ? <PlatformAdministrationReturn /> : null}
          <Separator className="bg-white/10" />
          <div className="flex items-center gap-3 px-2"><span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold">{initials(userName)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-xs text-sidebar-foreground/45">{roleLabel(role)}</p></div></div>
          <form action={signOutAction}><Button className="w-full justify-start text-sidebar-foreground/65 hover:bg-white/8 hover:text-white" variant="ghost"><LogOut className="size-4" />Déconnexion</Button></form>
        </div>
      </aside>

      <div className="md:pl-[16.5rem]">
        <header data-testid="mobile-sticky-header" className="sticky top-0 z-30 flex min-h-[4.25rem] items-center gap-3 border-b border-[var(--tr1-line)] bg-[var(--tr1-ivory)]/94 px-3 backdrop-blur-xl sm:px-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Sheet>
            <SheetTrigger asChild><Button className="min-h-11 min-w-11 md:hidden" size="icon-lg" variant="ghost"><Menu className="size-5" /><span className="sr-only">Ouvrir le menu</span></Button></SheetTrigger>
            <SheetContent className="w-[19rem] border-r-0 bg-sidebar text-sidebar-foreground" side="left">
              <SheetHeader className="border-white/10"><SheetTitle className="flex items-center gap-2 text-sidebar-foreground"><span className="grid size-8 place-items-center rounded-md border border-white/15 bg-white/6 font-mono text-[0.6rem] font-black">TR1</span>TR1 Pharma</SheetTitle></SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="min-h-0 flex-1 overflow-y-auto"><RoleNavigation role={role} scope={navigationScope} capabilities={capabilities} /></div>
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  {showPlatformAdministrationReturn ? <PlatformAdministrationReturn /> : null}
                  <div className="flex items-center gap-3 px-2"><span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold">{initials(userName)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-xs text-sidebar-foreground/45">{roleLabel(role)}</p></div></div>
                  <form action={signOutAction}><Button className="w-full justify-start text-sidebar-foreground/65 hover:bg-white/8 hover:text-white" variant="ghost"><LogOut className="size-4" />Déconnexion</Button></form>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <form action={changeBrandAction} className="shrink-0">
            <Button className="h-10 max-w-44 justify-between gap-2 rounded-md px-2.5" title="Changer de marque" type="submit" variant="ghost">
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-[var(--tr1-line-strong)] bg-transparent text-[var(--tr1-navy)]"><Building2 className="size-3.5" /></span>
              <span className="hidden min-w-0 text-left sm:block"><span className="block text-[0.62rem] font-medium uppercase tracking-wider text-muted-foreground">{brandHint}</span><span className="block truncate text-xs font-semibold">{brandName}</span></span>
              <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
            </Button>
          </form>

          <div className="ml-auto flex min-w-0 flex-1 justify-end md:ml-3 md:justify-center"><CommandPalette items={searchItems} /></div>
          <div className="hidden size-9 shrink-0 place-items-center rounded-md border border-[var(--tr1-line-strong)] bg-transparent font-mono text-[0.65rem] font-bold text-[var(--tr1-navy)] lg:grid" title={userName}>{initials(userName)}</div>
        </header>
        <main className="mx-auto w-full max-w-[96rem] p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-8 lg:p-7">{children}</main>
      </div>
      <MobileBottomNav role={role} capabilities={capabilities} />
    </div>
  );
}

function PlatformAdministrationReturn() {
  return (
    <form action={returnToPlatformAdministrationAction}>
      <Button className="w-full justify-start text-sidebar-foreground/75 hover:bg-white/8 hover:text-white" type="submit" variant="ghost">
        <ShieldCheck className="size-4 text-[var(--tr1-orange)]" />
        Administration TR1
      </Button>
    </form>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleLabel(role: string) {
  return ({ super_admin: "Super administrateur", brand_admin: "Administrateur marque", tr1_manager: "Responsable TR1", brand_direction: "Direction de marque", brand_user: "Responsable marque", agent: "Agent terrain", facilitator: "Intervenant terrain" } as Record<string, string>)[role] ?? role;
}

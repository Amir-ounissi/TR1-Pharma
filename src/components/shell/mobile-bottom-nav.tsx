"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import { cn } from "@/lib/utils";
import { getMobileAgentNavigationItems, getRoleFamily, isNavigationItemActive, type NavigationItem } from "@/lib/ux/navigation";

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  if (getRoleFamily(role) !== "agent") return null;

  const destinations = getMobileAgentNavigationItems();

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory)]/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        {destinations.map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
      </div>
    </nav>
  );
}

function MobileLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isNavigationItemActive(pathname, item.href);
  return <Link className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-md font-mono text-[0.57rem] font-bold uppercase text-muted-foreground", active && "text-[var(--tr1-orange)]")} href={item.href}><NavigationIcon className="size-5" name={item.icon} /><span>{item.shortLabel ?? (item.href === "/dashboard/orders" ? "Commandes" : item.label)}</span></Link>;
}

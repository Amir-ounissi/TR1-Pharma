"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import { cn } from "@/lib/utils";
import { getNavigationItems, getRoleFamily, isNavigationItemActive } from "@/lib/ux/navigation";

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const family = getRoleFamily(role);
  if (family !== "agent") return null;

  const items = getNavigationItems(role);
  const primary = [items[0], items[1], items[2], items[5]].filter(Boolean);

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        {primary.slice(0, 2).map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
        <Link aria-label="Créer une action" className="mx-auto grid size-12 -translate-y-3 place-items-center rounded-full bg-[var(--tr1-orange)] text-white shadow-lg shadow-orange-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/dashboard/tasks"><Plus className="size-5" /></Link>
        {primary.slice(2).map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
      </div>
    </nav>
  );
}

function MobileLink({ item, pathname }: { item: ReturnType<typeof getNavigationItems>[number]; pathname: string }) {
  const active = isNavigationItemActive(pathname, item.href);
  return (
    <Link className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[0.66rem] font-medium text-muted-foreground", active && "text-[var(--tr1-orange)]")} href={item.href}>
      <NavigationIcon className="size-5" name={item.icon} />
      <span>{item.href === "/dashboard/agent/assistant" ? "Plus" : item.shortLabel ?? item.label.split(" ")[0]}</span>
    </Link>
  );
}

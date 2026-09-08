"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import type { SaasCapability } from "@/lib/saas/capabilities";
import { cn } from "@/lib/utils";
import { getMobileAgentNavigationItems, getRoleFamily, isNavigationItemActive, type NavigationItem } from "@/lib/ux/navigation";

export function MobileBottomNav({ role, capabilities }: { role: string; capabilities?: SaasCapability[] }) {
  const pathname = usePathname();
  if (getRoleFamily(role) !== "agent") return null;

  const destinations = getMobileAgentNavigationItems(capabilities);
  if (!destinations.length) return null;

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory)]/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div
        className="grid h-16 items-center"
        style={{ gridTemplateColumns: `repeat(${destinations.length}, minmax(0, 1fr))` }}
      >
        {destinations.map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
      </div>
    </nav>
  );
}

function MobileLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isNavigationItemActive(pathname, item.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="min-h-12 rounded-md active:scale-[0.97]"
      href={item.href}
    >
      <MobileLinkContent item={item} active={active} />
    </Link>
  );
}

function MobileLinkContent({ item, active }: { item: NavigationItem; active: boolean }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-busy={pending || undefined}
      className={cn(
        "relative flex min-h-12 flex-col items-center justify-center gap-1 overflow-hidden rounded-md px-0.5 font-mono text-[0.65rem] font-bold uppercase leading-none text-muted-foreground transition-[color,background-color] duration-150",
        active && "bg-[var(--tr1-orange)]/6 text-[var(--tr1-orange)]",
        pending && "bg-[var(--tr1-orange)]/8 text-[var(--tr1-orange)]",
      )}
    >
      <NavigationIcon className={cn("size-5", pending && "animate-pulse")} name={item.icon} />
      <span className="max-w-full truncate">{item.shortLabel ?? (item.href === "/dashboard/orders" ? "Commandes" : item.label)}</span>
      {(active || pending) ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-[24%] top-0 h-0.5 rounded-full bg-[var(--tr1-orange)]",
            pending && "animate-pulse",
          )}
        />
      ) : null}
    </span>
  );
}

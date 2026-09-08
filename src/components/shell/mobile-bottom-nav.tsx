"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import type { SaasCapability } from "@/lib/saas/capabilities";
import { cn } from "@/lib/utils";
import { getMobileAgentNavigationItems, getRoleFamily, isNavigationItemActive, type NavigationItem } from "@/lib/ux/navigation";

export function MobileBottomNav({ role, capabilities }: { role: string; capabilities?: SaasCapability[] }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  if (getRoleFamily(role) !== "agent") return null;

  const destinations = getMobileAgentNavigationItems(capabilities);
  if (!destinations.length) return null;

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory)]/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div
        className="grid h-16 items-center"
        style={{ gridTemplateColumns: `repeat(${destinations.length}, minmax(0, 1fr))` }}
      >
        {destinations.map((item) => (
          <MobileLink
            item={item}
            pathname={pathname}
            pending={pendingHref === item.href}
            key={item.href}
            onNavigate={() => setPendingHref(item.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function MobileLink({
  item,
  pathname,
  pending,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  pending: boolean;
  onNavigate: () => void;
}) {
  const active = isNavigationItemActive(pathname, item.href);
  const navigating = pending && !active;

  return (
    <Link
      aria-busy={navigating || undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-md font-mono text-[0.57rem] font-bold uppercase text-muted-foreground transition-[color,background-color,transform] duration-150 active:scale-[0.97]",
        (active || navigating) && "text-[var(--tr1-orange)]",
        navigating && "bg-[var(--tr1-orange)]/6",
      )}
      href={item.href}
      onNavigate={() => {
        if (!active) onNavigate();
      }}
    >
      <NavigationIcon className={cn("size-5", navigating && "animate-pulse")} name={item.icon} />
      <span>{item.shortLabel ?? (item.href === "/dashboard/orders" ? "Commandes" : item.label)}</span>
      {navigating ? <span aria-hidden="true" className="absolute inset-x-[28%] bottom-0 h-0.5 rounded-full bg-[var(--tr1-orange)]" /> : null}
    </Link>
  );
}

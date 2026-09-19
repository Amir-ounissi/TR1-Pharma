"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import type { SaasCapability } from "@/lib/saas/capabilities";
import { cn } from "@/lib/utils";
import { getMobileAgentNavigationItems, getMobileFacilitatorNavigationItems, getRoleFamily, isNavigationItemActive, type NavigationItem } from "@/lib/ux/navigation";

export function MobileBottomNav({ role, capabilities }: { role: string; capabilities?: SaasCapability[] }) {
  const pathname = usePathname();
  const family = getRoleFamily(role);
  const destinations = family === "agent"
    ? getMobileAgentNavigationItems(capabilities)
    : family === "facilitator"
      ? getMobileFacilitatorNavigationItems(capabilities)
      : [];
  if (!destinations.length) return null;

  return (
    <nav
      aria-label="Navigation mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tr1-line)] bg-white/97 px-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(14_29_49/0.055)] backdrop-blur-xl md:hidden"
    >
      <div
        className="grid h-[4.4rem] items-stretch"
        style={{ gridTemplateColumns: `repeat(${destinations.length}, minmax(0, 1fr))` }}
      >
        {destinations.map((item) => <MobileLink item={item} pathname={pathname} key={item.href} />)}
      </div>
    </nav>
  );
}

function MobileLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isNavigationItemActive(pathname, item.href);
  const router = useRouter();
  const warmRoute = () => router.prefetch(item.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="flex min-h-14 touch-manipulation select-none items-stretch rounded-[0.7rem] px-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] focus-visible:ring-inset"
      href={item.href}
      prefetch={false}
      onPointerDown={warmRoute}
      onPointerEnter={warmRoute}
      onFocus={warmRoute}
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
        "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[0.7rem] px-0.5 text-[0.68rem] font-semibold leading-none text-muted-foreground transition-[color,background-color,transform] duration-150",
        active && "bg-[var(--tr1-navy)]/[0.055] text-[var(--tr1-navy)]",
        pending && "bg-[var(--tr1-orange)]/8 text-[var(--tr1-orange)]",
      )}
    >
      <NavigationIcon className={cn("size-[1.3rem]", active && "text-[var(--tr1-orange)]", pending && "animate-pulse")} name={item.icon} />
      <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
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

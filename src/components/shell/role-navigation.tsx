"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import type { SaasCapability } from "@/lib/saas/capabilities";
import { cn } from "@/lib/utils";
import { getNavigationSections, isNavigationItemActive, type NavigationScope } from "@/lib/ux/navigation";

const performanceMapItem = {
  href: "/dashboard/network/performance-map",
  label: "Carte de performance",
  shortLabel: "Carte",
  icon: "map",
  capability: "performance" as const,
};

export function RoleNavigation({
  role,
  scope = "tenant",
  capabilities,
  onNavigate,
}: {
  role: string;
  scope?: NavigationScope;
  capabilities?: SaasCapability[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = getNavigationSections(role, scope, capabilities).map((section) => {
    const performanceIndex = section.items.findIndex((item) => item.href === "/dashboard/network/commercial");
    if (performanceIndex < 0 || section.items.some((item) => item.href === performanceMapItem.href)) return section;
    return {
      ...section,
      items: [
        ...section.items.slice(0, performanceIndex + 1),
        performanceMapItem,
        ...section.items.slice(performanceIndex + 1),
      ],
    };
  });

  return (
    <nav aria-label="Navigation principale" className="space-y-6">
      {sections.map((section) => (
        <section key={section.label} aria-labelledby={`nav-${section.label}`}>
          <p id={`nav-${section.label}`} className="mb-2 px-3 text-[0.68rem] font-semibold tracking-[0.055em] text-sidebar-foreground/42">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = isNavigationItemActive(pathname, item.href);
              const warmRoute = () => router.prefetch(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-3 rounded-[0.65rem] border border-transparent px-3 text-[0.84rem] font-medium text-sidebar-foreground/68 transition-colors",
                    "hover:bg-white/7 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active && "border-white/8 bg-white/9 font-semibold text-white",
                  )}
                  href={item.href}
                  key={item.href}
                  prefetch={false}
                  onPointerEnter={warmRoute}
                  onPointerDown={warmRoute}
                  onFocus={warmRoute}
                  onClick={onNavigate}
                >
                  {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--tr1-orange)]" /> : null}
                  <NavigationIcon className={cn("size-[1.05rem] shrink-0", active ? "text-[var(--tr1-orange)]" : "text-sidebar-foreground/48 group-hover:text-sidebar-foreground/82")} name={item.icon} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

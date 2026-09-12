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
    <nav aria-label="Navigation principale" className="space-y-7">
      {sections.map((section) => (
        <section key={section.label} aria-labelledby={`nav-${section.label}`}>
          <p id={`nav-${section.label}`} className="mb-2.5 px-3 font-mono text-[0.57rem] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/42">
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
                    "group flex min-h-10 items-center gap-3 rounded-[0.4rem] border border-transparent px-3 text-[0.8rem] font-semibold text-sidebar-foreground/68 transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active && "border-white/8 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--tr1-orange)]",
                  )}
                  href={item.href}
                  key={item.href}
                  prefetch={false}
                  onPointerEnter={warmRoute}
                  onPointerDown={warmRoute}
                  onFocus={warmRoute}
                  onClick={onNavigate}
                >
                  <NavigationIcon className={cn("size-[1.05rem]", active ? "text-[var(--tr1-orange)]" : "text-sidebar-foreground/52 group-hover:text-sidebar-foreground")} name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
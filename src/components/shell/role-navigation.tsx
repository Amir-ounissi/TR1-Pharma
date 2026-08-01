"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationIcon } from "@/components/shell/navigation-icons";
import { cn } from "@/lib/utils";
import { getNavigationSections, isNavigationItemActive } from "@/lib/ux/navigation";

export function RoleNavigation({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="space-y-6">
      {getNavigationSections(role).map((section) => (
        <section key={section.label} aria-labelledby={`nav-${section.label}`}>
          <p id={`nav-${section.label}`} className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = isNavigationItemActive(pathname, item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/72 transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--tr1-orange)]",
                  )}
                  href={item.href}
                  key={item.href}
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

"use client";

import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/shell/command-palette";
import type { SearchItem } from "@/lib/ux/search";

export function RouteAwareCommandPalette({ items }: { items: SearchItem[] }) {
  const pathname = usePathname();
  const captureOrderOnMobile = pathname.startsWith("/dashboard/orders/scan");

  return (
    <div className={captureOrderOnMobile ? "hidden w-full md:block" : "w-full"}>
      <CommandPalette items={items} />
    </div>
  );
}

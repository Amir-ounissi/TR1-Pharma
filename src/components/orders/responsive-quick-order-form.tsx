"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { MobileQuickOrderForm } from "@/components/orders/mobile-quick-order-form";
import { QuickOrderForm } from "@/components/orders/quick-order-form";
import { Skeleton } from "@/components/ui/skeleton";

type ResponsiveQuickOrderFormProps = ComponentProps<typeof QuickOrderForm> &
  ComponentProps<typeof MobileQuickOrderForm>;

export function ResponsiveQuickOrderForm(props: ResponsiveQuickOrderFormProps) {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (mobile === null) {
    return (
      <div className="space-y-3 p-3 md:p-0" aria-label="Chargement de la commande">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return mobile ? <MobileQuickOrderForm {...props} /> : <QuickOrderForm {...props} />;
}

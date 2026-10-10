"use client";

import Link from "next/link";
import { Building2, CalendarPlus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileCreateMenu({
  canPlanVisit,
  canCreateOrder,
}: {
  canPlanVisit: boolean;
  canCreateOrder: boolean;
}) {
  if (!canPlanVisit && !canCreateOrder) return null;

  const actions = [
    ...(canPlanVisit ? [
      { href: "/dashboard/agenda?create=visit", label: "Planifier une visite", detail: "Choisir la pharmacie et le créneau", icon: CalendarPlus },
      { href: "/dashboard/pharmacies", label: "Ouvrir une pharmacie", detail: "Ajouter une note ou une relance", icon: Building2 },
    ] : []),
    ...(canCreateOrder ? [
      { href: "/dashboard/orders/new", label: "Nouvelle commande", detail: "Saisir une commande terrain", icon: ShoppingCart },
    ] : []),
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          aria-label="Créer une action terrain"
          className="fixed bottom-[calc(5.3rem+env(safe-area-inset-bottom))] right-4 z-40 h-12 rounded-full bg-[var(--tr1-navy)] px-4 text-sm font-bold text-white shadow-lg hover:bg-[var(--tr1-navy-soft)] md:hidden"
        >
          <Plus className="size-5" aria-hidden="true" /> Créer
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <SheetHeader>
          <SheetTitle>Action terrain</SheetTitle>
        </SheetHeader>
        <div className="grid gap-2 pb-3">
          {actions.map((action) => (
            <SheetClose asChild key={action.href}>
              <Link
                href={action.href}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--tr1-line)] bg-background p-3 transition-colors active:bg-muted"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-[var(--tr1-navy)]">
                  <action.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{action.label}</span>
                  <span className="block text-xs text-muted-foreground">{action.detail}</span>
                </span>
              </Link>
            </SheetClose>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

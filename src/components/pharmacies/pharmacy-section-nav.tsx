"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { AiVisitClose } from "@/components/agent/ai-visit-close";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PRIMARY_TABS = [
  ["overview", "Vue générale"],
  ["activity", "Activité"],
  ["orders", "Commandes"],
] as const;

const MORE_TABS = [
  ["performance", "Performance"],
  ["contacts", "Contacts"],
  ["products", "Produits / Assortiment"],
  ["history", "Historique"],
  ["admin", "Administratif"],
] as const;

const ALL_TABS = [...PRIMARY_TABS, ...MORE_TABS] as const;

type PharmacySectionNavProps = {
  pharmacyId: string;
  activeTab: string;
};

function href(pharmacyId: string, tab: string) {
  return `/dashboard/pharmacies/${pharmacyId}?tab=${tab}`;
}

function commercialTermsHref(pharmacyId: string) {
  return `/dashboard/pharmacies/${pharmacyId}/commercial-terms`;
}

export function PharmacySectionNav({ pharmacyId, activeTab }: PharmacySectionNavProps) {
  const router = useRouter();
  const commercialTermsActive = activeTab === "commercial_terms";
  const moreActive =
    commercialTermsActive || MORE_TABS.some(([value]) => value === activeTab);
  const warmRoute = (target: string) => () => router.prefetch(target);

  return (
    <>
      <AiVisitClose brandPharmacyId={pharmacyId} />

      <nav
        aria-label="Sections de la pharmacie"
        className="hidden gap-1 overflow-x-auto rounded-[0.4rem] border border-[var(--tr1-line-strong)] bg-transparent p-1 sm:flex"
      >
        {ALL_TABS.map(([value, label]) => {
          const active = activeTab === value;
          const target = href(pharmacyId, value);
          return (
            <Button
              key={value}
              asChild
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "shrink-0",
                active && "bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)] hover:text-white",
              )}
            >
              <Link
                aria-current={active ? "page" : undefined}
                href={target}
                prefetch={false}
                onPointerEnter={warmRoute(target)}
                onPointerDown={warmRoute(target)}
                onFocus={warmRoute(target)}
              >
                {label}
              </Link>
            </Button>
          );
        })}
        <Button
          asChild
          variant={commercialTermsActive ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "shrink-0",
            commercialTermsActive &&
              "bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)] hover:text-white",
          )}
        >
          <Link
            aria-current={commercialTermsActive ? "page" : undefined}
            href={commercialTermsHref(pharmacyId)}
            prefetch={false}
            onPointerEnter={warmRoute(commercialTermsHref(pharmacyId))}
            onPointerDown={warmRoute(commercialTermsHref(pharmacyId))}
            onFocus={warmRoute(commercialTermsHref(pharmacyId))}
          >
            Conditions commerciales
          </Link>
        </Button>
      </nav>

      <nav
        aria-label="Sections principales de la pharmacie"
        className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--tr1-line-strong)] bg-white/65 p-1 shadow-sm sm:hidden"
      >
        {PRIMARY_TABS.map(([value, label]) => {
          const active = activeTab === value;
          const target = href(pharmacyId, value);
          return (
            <Link
              key={value}
              aria-current={active ? "page" : undefined}
              href={target}
              prefetch={false}
              onPointerDown={warmRoute(target)}
              onFocus={warmRoute(target)}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1.5 text-center font-mono text-[0.64rem] font-bold uppercase leading-tight transition-colors",
                active
                  ? "bg-[var(--tr1-navy)] text-white shadow-sm"
                  : "text-muted-foreground active:bg-[var(--tr1-navy)]/6",
              )}
            >
              {label}
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-current={moreActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-center font-mono text-[0.64rem] font-bold uppercase leading-tight transition-colors",
                moreActive
                  ? "bg-[var(--tr1-navy)] text-white shadow-sm"
                  : "text-muted-foreground active:bg-[var(--tr1-navy)]/6",
              )}
            >
              <MoreHorizontal className="size-4 shrink-0" />
              Plus
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="px-0">
              <SheetTitle>Plus de sections</SheetTitle>
            </SheetHeader>
            <div className="grid gap-2 pb-2">
              {MORE_TABS.map(([value, label]) => {
                const active = activeTab === value;
                const target = href(pharmacyId, value);
                return (
                  <SheetClose key={value} asChild>
                    <Link
                      aria-current={active ? "page" : undefined}
                      href={target}
                      prefetch={false}
                      onPointerDown={warmRoute(target)}
                      onFocus={warmRoute(target)}
                      className={cn(
                        "flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-semibold transition-colors",
                        active
                          ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
                          : "border-[var(--tr1-line-strong)] bg-white text-[var(--tr1-navy)] active:bg-muted",
                      )}
                    >
                      {label}
                      <span aria-hidden="true">›</span>
                    </Link>
                  </SheetClose>
                );
              })}
              <SheetClose asChild>
                <Link
                  aria-current={commercialTermsActive ? "page" : undefined}
                  href={commercialTermsHref(pharmacyId)}
                  prefetch={false}
                  onPointerDown={warmRoute(commercialTermsHref(pharmacyId))}
                  onFocus={warmRoute(commercialTermsHref(pharmacyId))}
                  className={cn(
                    "flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-semibold transition-colors",
                    commercialTermsActive
                      ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
                      : "border-[var(--tr1-line-strong)] bg-white text-[var(--tr1-navy)] active:bg-muted",
                  )}
                >
                  Conditions commerciales
                  <span aria-hidden="true">›</span>
                </Link>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}

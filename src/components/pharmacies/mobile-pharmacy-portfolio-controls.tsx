import { Map, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { LivePharmacySearch } from "@/components/pharmacies/live-pharmacy-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  activityStatuses,
  commercialStatuses,
  labels,
  potentialLevels,
  priorityLevels,
} from "@/lib/reference-data";
import { cn } from "@/lib/utils";

type MobilePharmacyPortfolioControlsProps = {
  params: Record<string, string | string[] | undefined>;
  search: string;
  count: number;
  role: string;
  hasActiveFilters: boolean;
};

export function MobilePharmacyPortfolioControls({
  params,
  search,
  count,
  role,
  hasActiveFilters,
}: MobilePharmacyPortfolioControlsProps) {
  const attentionOnly = params.attention === "1";
  const priorityOnly = params.priority === "strategic" && !attentionOnly;
  const current = toUrlSearchParams(params);

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--tr1-orange)]">
            Mon portefeuille
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--tr1-navy)]">
            Pharmacies
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count} pharmacie{count > 1 ? "s" : ""}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-9 rounded-full border-[var(--tr1-line-strong)] bg-white/80 px-3 text-[var(--tr1-navy)]"
        >
          <Link href={buildViewHref(current, "map")}>
            <Map className="size-4" />
            Carte
          </Link>
        </Button>
      </div>

      <LivePharmacySearch key={search} initialValue={search} params={params} />

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <MobileFilterLink
          href="/dashboard/pharmacies?view=list"
          active={!hasActiveFilters}
        >
          Toutes
        </MobileFilterLink>
        <MobileFilterLink
          href="/dashboard/pharmacies?view=list&priority=strategic"
          active={priorityOnly}
        >
          Prioritaires
        </MobileFilterLink>
        <MobileFilterLink
          href="/dashboard/pharmacies?view=list&attention=1"
          active={attentionOnly}
        >
          À relancer
        </MobileFilterLink>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 shrink-0 rounded-full border-[var(--tr1-line-strong)] bg-white px-3 text-xs font-medium text-[var(--tr1-navy)]",
                hasActiveFilters &&
                  !priorityOnly &&
                  !attentionOnly &&
                  "border-[var(--tr1-orange)] text-[var(--tr1-orange)]",
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Filtres
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[var(--tr1-ivory)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <form>
              <input type="hidden" name="view" value="list" />
              <input type="hidden" name="q" value={search} />
              <SheetHeader className="px-0">
                <SheetTitle className="text-left text-lg font-semibold text-[var(--tr1-navy)]">
                  Filtrer les pharmacies
                </SheetTitle>
              </SheetHeader>
              <div className="mt-5 grid gap-3">
                <Select
                  name="status"
                  defaultValue={stringParam(params.status, "all")}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl bg-white">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {commercialStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {labels.commercialStatus[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  name="activity"
                  defaultValue={stringParam(params.activity, "all")}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl bg-white">
                    <SelectValue placeholder="Activité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute activité</SelectItem>
                    {activityStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {labels.activityStatus[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name="city"
                    defaultValue={stringParam(params.city)}
                    className="h-11 rounded-xl bg-white text-sm"
                    placeholder="Ville"
                  />
                  <Input
                    name="postalCode"
                    defaultValue={stringParam(params.postalCode)}
                    className="h-11 rounded-xl bg-white text-sm"
                    placeholder="Code postal"
                  />
                </div>

                <Select
                  name="priority"
                  defaultValue={stringParam(params.priority, "all")}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl bg-white">
                    <SelectValue placeholder="Priorité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute priorité</SelectItem>
                    {priorityLevels.map((value) => (
                      <SelectItem key={value} value={value}>
                        {labels.priorityLevel[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  name="potential"
                  defaultValue={stringParam(params.potential, "all")}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl bg-white">
                    <SelectValue placeholder="Potentiel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout potentiel</SelectItem>
                    {potentialLevels.map((value) => (
                      <SelectItem key={value} value={value}>
                        {labels.potentialLevel[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  name="group"
                  defaultValue={stringParam(params.group)}
                  className="h-11 rounded-xl bg-white text-sm"
                  placeholder="Groupement"
                />

                {role !== "agent" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      name="agent"
                      defaultValue={stringParam(params.agent)}
                      className="h-11 rounded-xl bg-white text-sm"
                      placeholder="Agent"
                    />
                    <Input
                      name="territory"
                      defaultValue={stringParam(params.territory)}
                      className="h-11 rounded-xl bg-white text-sm"
                      placeholder="Territoire"
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    name="sort"
                    defaultValue={stringParam(params.sort, "trade_name")}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-white">
                      <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trade_name">Nom</SelectItem>
                      <SelectItem value="city">Ville</SelectItem>
                      <SelectItem value="commercial_status">Statut</SelectItem>
                      <SelectItem value="priority_level">Priorité</SelectItem>
                      <SelectItem value="potential_level">Potentiel</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    name="direction"
                    defaultValue={stringParam(params.direction, "asc")}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Croissant</SelectItem>
                      <SelectItem value="desc">Décroissant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button asChild type="button" variant="outline" className="h-11 rounded-xl">
                  <Link href="/dashboard/pharmacies?view=list">Réinitialiser</Link>
                </Button>
                <Button
                  type="submit"
                  className="h-11 rounded-xl bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)]"
                >
                  Appliquer
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function MobileFilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
          : "border-[var(--tr1-line-strong)] bg-white text-[var(--tr1-navy)]",
      )}
    >
      {children}
    </Link>
  );
}

function stringParam(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toUrlSearchParams(
  params: Record<string, string | string[] | undefined>,
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length) next.set(key, value);
  }
  return next;
}

function buildViewHref(current: URLSearchParams, view: "list" | "map") {
  const next = new URLSearchParams(current.toString());
  next.set("view", view);
  next.delete("page");
  return `?${next.toString()}`;
}

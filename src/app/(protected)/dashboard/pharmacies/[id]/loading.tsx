import { Skeleton } from "@/components/ui/skeleton";

export default function PharmacyDetailLoading() {
  return (
    <main className="space-y-5" aria-label="Chargement de la fiche pharmacie" aria-busy="true">
      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-7 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-48 max-w-full" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      </section>
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-11 w-32 shrink-0" />
        <Skeleton className="h-11 w-28 shrink-0" />
        <Skeleton className="h-11 w-32 shrink-0" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </main>
  );
}

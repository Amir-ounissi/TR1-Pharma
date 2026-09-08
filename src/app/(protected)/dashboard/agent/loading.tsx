import { Skeleton } from "@/components/ui/skeleton";

export default function AgentLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-label="Chargement de Ma journée" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-36" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

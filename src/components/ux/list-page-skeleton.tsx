import { Skeleton } from "@/components/ui/skeleton";

export function ListPageSkeleton({
  showMetrics = true,
}: {
  showMetrics?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-[var(--tr1-line-strong)] pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </div>
        <Skeleton className="h-10 w-full max-w-44" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Skeleton className="h-9 w-full sm:w-44" />
          <Skeleton className="h-9 w-full sm:w-44" />
        </div>
      </div>
      {showMetrics ? (
        <div className="grid gap-px overflow-hidden rounded-[0.7rem] border border-[var(--tr1-line)] bg-[var(--tr1-line)] sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 bg-[var(--tr1-ivory)] px-4 py-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="rounded-[0.7rem] border border-[var(--tr1-line)] bg-white/70 px-3 py-3">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[var(--tr1-line)] overflow-hidden rounded-[0.7rem] border border-[var(--tr1-line)] bg-white/70 md:hidden">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 max-w-48" />
                <Skeleton className="h-3 w-1/2 max-w-32" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-[0.7rem] border border-[var(--tr1-line)] bg-white/70 md:block">
        <div className="grid grid-cols-6 gap-px border-b border-[var(--tr1-line)] bg-[var(--tr1-line)]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="min-w-0 bg-[var(--tr1-navy)] px-3 py-3">
              <Skeleton className="h-3 w-16 max-w-full bg-white/20" />
            </div>
          ))}
        </div>
        <div className="divide-y divide-[var(--tr1-line)]">
          {Array.from({ length: 7 }).map((_, row) => (
            <div key={row} className="grid grid-cols-6 gap-3 px-3 py-3">
              {Array.from({ length: 6 }).map((_, cell) => (
                <Skeleton key={cell} className="h-4 w-full min-w-0" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

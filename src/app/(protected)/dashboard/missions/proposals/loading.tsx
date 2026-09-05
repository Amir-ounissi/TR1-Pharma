import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MissionProposalsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement des propositions">
      <div className="space-y-2"><Skeleton className="h-3 w-36" /><Skeleton className="h-9 w-80 max-w-full" /></div>
      {[0, 1].map((item) => <Card key={item}><CardContent className="space-y-3 p-6"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>)}
    </div>
  );
}

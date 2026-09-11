import type { ReactNode } from "react";
import { MissionDetailTabs } from "@/components/missions/mission-detail-tabs";
import { requireActiveBrand } from "@/lib/auth";

export default async function MissionDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrand();
  const { data: mission } = await supabase
    .from("missions")
    .select("mission_type")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (mission?.mission_type !== "animation") return children;

  return (
    <div className="space-y-4">
      <MissionDetailTabs missionId={id} />
      {children}
    </div>
  );
}

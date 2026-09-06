import { requireActiveBrandRole } from "@/lib/auth";
import { requireActiveBrandCapability } from "@/lib/saas/server";

const directionRoles = ["super_admin", "tr1_manager", "brand_admin", "brand_direction"] as const;

export default async function DirectionLayout({ children }: { children: React.ReactNode }) {
  await Promise.all([
    requireActiveBrandRole(directionRoles),
    requireActiveBrandCapability("direction_workspace"),
  ]);
  return children;
}

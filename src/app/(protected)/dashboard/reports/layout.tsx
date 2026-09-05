import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function MissionsCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("missions");
  return children;
}

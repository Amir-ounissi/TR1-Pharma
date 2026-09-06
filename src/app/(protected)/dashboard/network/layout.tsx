import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function PerformanceCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("performance");
  return children;
}

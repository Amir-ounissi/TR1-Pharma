import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function PrioritiesCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("next_best_action");
  return children;
}

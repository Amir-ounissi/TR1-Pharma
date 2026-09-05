import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function AssistantCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("assistant_terrain");
  return children;
}

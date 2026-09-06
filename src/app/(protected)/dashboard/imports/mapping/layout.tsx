import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function DataMappingCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("data_mapping");
  return children;
}

import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function CoreCrmCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("core_crm");
  return children;
}
